#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Importa frações e proprietários a partir do ficheiro de contactos da Hera Residences.

  python3 scripts/importar_proprietarios.py FICHEIRO.xlsb              -> simulação (não toca na base de dados)
  python3 scripts/importar_proprietarios.py FICHEIRO.xlsb --executar   -> importa de verdade (NÃO envia convites)

Regras acordadas:
  - uma fração por código e por lote (se um código aparece duas vezes, vale a primeira linha);
  - um proprietário por fração: o primeiro email que aparece;
  - email em falta ou inválido -> a fração é criada sem proprietário;
  - inquilinos e telefones não são lidos nem importados.
"""
import argparse, csv, getpass, os, re, sys, unicodedata

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-']+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
TEL_RE = re.compile(r"^[\d\s+().\-]{7,}$")
NOME_EM_FALTA = "(nome a confirmar)"
LOTES = ("Lote 1", "Lote 2")


# ---------------------------------------------------------------- utilitários
def sem_acentos(s):
    s = unicodedata.normalize("NFKD", str(s))
    return "".join(c for c in s if not unicodedata.combining(c)).strip().lower()


def limpar(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r"\s+", " ", str(v)).strip()


def codigo(v):
    return limpar(v).upper()


def limpar_email(s):
    return s.lower().strip(".,;'")


TEL_NO_NOME = re.compile(r"\+?\d[\d\s().\-/]{6,}\d")


def limpar_nome(s):
    """tira telefones colados ao nome (os telefones não se importam)"""
    s = TEL_NO_NOME.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip(" -–,;:/")


def pontuar(nome, email):
    """quantas palavras do nome aparecem na parte do email antes do @"""
    local = re.sub(r"[^a-z0-9]", "", sem_acentos(email.split("@")[0]))
    palavras = [p for p in re.split(r"\W+", sem_acentos(nome)) if len(p) >= 3 and p.isalpha()]
    return sum(1 for p in palavras if p in local)


def classificar(v):
    """nome | email | invalido | tel | None (vazio)"""
    s = limpar(v)
    if not s:
        return None
    if isinstance(v, float):
        return "tel"
    if EMAIL_RE.search(s):
        return "email"
    if "@" in s:
        return "invalido"
    if TEL_RE.match(s):
        return "tel"
    sem_tel = re.sub(r"\b(ou|e)\b", " ", TEL_NO_NOME.sub(" ", s), flags=re.I)
    if TEL_NO_NOME.search(s) and not re.search(r"[A-Za-zÀ-ÿ]{2,}", sem_tel):
        return "tel"
    return "nome"


def colunas(cabecalho, quero):
    mapa = {sem_acentos(c): i for i, c in enumerate(cabecalho) if c not in (None, "")}
    res = {}
    for chave, opcoes in quero.items():
        for o in opcoes:
            if o in mapa:
                res[chave] = mapa[o]
                break
        else:
            sys.exit(f"Não encontrei a coluna '{opcoes[0]}' no cabeçalho. Colunas vistas: {sorted(mapa)}")
    return res


def ler_ficheiro(caminho):
    try:
        from pyxlsb import open_workbook
    except ImportError:
        sys.exit("Falta a biblioteca pyxlsb. Corre: pip install pyxlsb requests")
    folhas = {}
    with open_workbook(caminho) as wb:
        for nome in wb.sheets:
            with wb.get_sheet(nome) as sh:
                folhas[nome] = [[c.v for c in r] for r in sh.rows()]
    return folhas


def achar_folha(folhas, numero):
    for nome, linhas in folhas.items():
        if re.search(rf"lote\s*{numero}\b", sem_acentos(nome)):
            return linhas
    sys.exit(f"Não encontrei a folha do Lote {numero}. Folhas: {list(folhas)}")


def pad(r, n):
    return list(r) + [None] * (n - len(r))


# ------------------------------------------------------------------- Lote 1
def ler_lote1(linhas):
    c = colunas(linhas[0], {
        "fracao": ["fraccao", "fracao"], "n1": ["nome cliente 1"], "n2": ["nome cliente 2"],
        "e1": ["email1"], "e2": ["email2"],
    })
    n_cols = max(c.values()) + 1
    entradas, duplicadas, sem_codigo, vistos = [], [], [], {}
    for n, r in enumerate(linhas[1:], start=2):
        r = pad(r, n_cols)
        if not any(limpar(v) for v in r):
            continue
        frac = codigo(r[c["fracao"]])
        if not frac:
            sem_codigo.append(n)
            continue
        if frac in vistos:
            duplicadas.append((frac, n, vistos[frac]))
            continue
        vistos[frac] = n

        email, nome, conf, nota = None, "", "ok", ""
        # o primeiro email que aparece decide (Email1, e só se estiver vazio, Email2)
        for k_email, k_nome, ordem in (("e1", "n1", 1), ("e2", "n2", 2)):
            bruto = limpar(r[c[k_email]])
            if not bruto:
                continue
            m = EMAIL_RE.search(bruto)
            if not m:
                nota = "email inválido"
                break
            email = limpar_email(m.group(0))
            nome = limpar_nome(limpar(r[c[k_nome]]))
            if not nome and ordem == 2:
                nome = limpar_nome(limpar(r[c["n1"]]))
                if nome:
                    conf, nota = "rever", "nome do cliente 1 (o 2 está vazio)"
            break
        if email and not nome:
            nome, conf, nota = NOME_EM_FALTA, "rever", "sem nome"
        if not email and not nota:
            nota = "sem email"
        entradas.append(dict(lote="Lote 1", fracao=frac, linha=n, email=email,
                             nome=nome if email else "", confianca=conf if email else "-", nota=nota))
    return entradas, duplicadas, sem_codigo


# ------------------------------------------------------------------- Lote 2
def ler_lote2(linhas):
    c = colunas(linhas[0], {
        "apto": ["apartamento"], "fracao": ["fracao", "fraccao"], "nome": ["nome"], "contacto": ["contacto"],
    })
    n_cols = max(c.values()) + 1
    blocos, atual, vistos, duplicadas, sem_codigo = [], None, {}, [], []
    for n, r in enumerate(linhas[1:], start=2):
        r = pad(r, n_cols)
        frac = codigo(r[c["fracao"]])
        if frac:
            if frac in vistos:
                duplicadas.append((frac, n, vistos[frac]))
                atual = None
                continue
            vistos[frac] = n
            atual = {"fracao": frac, "linha": n, "itens": []}
            blocos.append(atual)
        elif limpar(r[c["apto"]]):
            # começa um apartamento novo sem código de fração: não misturar com o bloco anterior
            sem_codigo.append(n)
            atual = None
            continue
        if atual is None:
            continue
        for idx in (c["nome"], c["contacto"]):
            t = classificar(r[idx])
            if t and t != "tel":
                atual["itens"].append((t, limpar(r[idx])))

    entradas = []
    for b in blocos:
        itens = b["itens"]
        i = next((k for k, (t, _) in enumerate(itens) if t in ("email", "invalido")), None)
        base = dict(lote="Lote 2", fracao=b["fracao"], linha=b["linha"], email=None, nome="", confianca="-", nota="")
        if i is None:
            base["nota"] = "sem email"
        elif itens[i][0] == "invalido":
            base["nota"] = "email inválido"
        else:
            texto = itens[i][1]
            email = limpar_email(EMAIL_RE.search(texto).group(0))
            antes = [s for t, s in itens[:i] if t == "nome"]
            depois = [s for t, s in itens[i + 1:] if t == "nome"]
            conf, nota = "ok", ""
            if len(antes) == 1:
                nome = antes[0]
            elif len(antes) > 1:
                pontos = [pontuar(a, email) for a in antes]
                melhor = max(pontos)
                nome = antes[max(i for i, p in enumerate(pontos) if p == melhor)]
                conf = "rever"
                nota = f"{len(antes)} textos antes do email (escolhi o " + ("mais parecido com o email)" if melhor else "mais próximo do email)")
            elif depois:
                nome, conf, nota = depois[0], "rever", "o nome vem depois do email"
            else:
                resto = re.sub(r"[<>()\[\];,:–\-]", " ", EMAIL_RE.sub("", texto))
                resto = limpar(resto)
                if len(resto) >= 3 and re.search(r"[A-Za-zÀ-ÿ]", resto):
                    nome, conf, nota = resto, "rever", "nome na mesma célula do email"
                else:
                    nome, conf, nota = NOME_EM_FALTA, "rever", "sem nome"
            limpo = limpar_nome(nome)
            if limpo != nome:
                nome = limpo or NOME_EM_FALTA
                nota = (nota + "; " if nota else "") + "telefone retirado do nome"
                if nome == NOME_EM_FALTA:
                    conf = "rever"
            base.update(email=email, nome=nome, confianca=conf, nota=nota)
        entradas.append(base)
    return entradas, duplicadas, sem_codigo


# ------------------------------------------------------------------- plano
def construir_plano(entradas):
    fracoes, donos, ligacoes = [], {}, []
    for e in entradas:
        fracoes.append((e["lote"], e["fracao"]))
        if e["email"]:
            donos.setdefault(e["email"], e["nome"])   # primeira ocorrência decide o nome
            ligacoes.append((e["lote"], e["fracao"], e["email"]))
    return fracoes, donos, ligacoes


def resumo(entradas, duplicadas, sem_codigo):
    fracoes, donos, ligacoes = construir_plano(entradas)
    print("\n================ RESUMO (simulação) ================")
    for lote in LOTES:
        es = [e for e in entradas if e["lote"] == lote]
        com = [e for e in es if e["email"]]
        print(f"\n{lote}")
        print(f"  frações a criar:                 {len(es)}")
        print(f"  com proprietário:                {len(com)}")
        print(f"  sem proprietário (sem email):    {sum(1 for e in es if e['nota'] == 'sem email')}")
        print(f"  sem proprietário (email inválido): {sum(1 for e in es if e['nota'] == 'email inválido')}")
        print(f"  nomes a confirmar ('rever'):     {sum(1 for e in com if e['confianca'] == 'rever')}")
        if duplicadas.get(lote):
            print(f"  linhas ignoradas (código repetido): {[(f, n, 'igual à linha ' + str(o)) for f, n, o in duplicadas[lote]]}")
        if sem_codigo.get(lote):
            print(f"  linhas ignoradas (sem código de fração): {sem_codigo[lote]}")
    por_email = {}
    for _, _, em in ligacoes:
        por_email[em] = por_email.get(em, 0) + 1
    print("\nTotais")
    print(f"  frações:                         {len(fracoes)}")
    print(f"  proprietários distintos (emails): {len(donos)}")
    print(f"  ligações fração-proprietário:    {len(ligacoes)}")
    print(f"  emails com mais de uma fração:   {sum(1 for v in por_email.values() if v > 1)}")
    print("\nNão foram lidos: telefones, inquilinos. Nenhum convite é enviado por este script.")


def escrever_revisao(entradas, caminho):
    ordem = {"rever": 0, "-": 1, "ok": 2}
    linhas = sorted(entradas, key=lambda e: (ordem.get(e["confianca"], 3), e["lote"], e["fracao"]))
    with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["lote", "fracao", "linha_excel", "nome_proposto", "email", "confianca", "nota"])
        for e in linhas:
            w.writerow([e["lote"], e["fracao"], e["linha"], e["nome"], e["email"] or "", e["confianca"], e["nota"]])
    print(f"\nFicheiro de revisão: {caminho}  (contém dados pessoais: não o enviar nem o pôr no Git)")


# ------------------------------------------------------------------- base de dados
class Api:
    def __init__(self, url, chave):
        try:
            import requests
        except ImportError:
            sys.exit("Falta a biblioteca requests. Corre: pip install pyxlsb requests")
        self.base = url.rstrip("/") + "/rest/v1"
        self.s = requests.Session()
        self.s.headers.update({"apikey": chave, "Authorization": f"Bearer {chave}", "Content-Type": "application/json"})

    @staticmethod
    def _erro(tabela, r):
        try:
            d = r.json()
            msg = f"{d.get('code', '')} {d.get('message', '')}".strip()
        except Exception:
            msg = ""
        return RuntimeError(f"{tabela}: erro {r.status_code} {msg}")

    def ler(self, tabela, campos="*"):
        saida, inicio, passo = [], 0, 1000
        while True:
            r = self.s.get(f"{self.base}/{tabela}", params={"select": campos},
                           headers={"Range-Unit": "items", "Range": f"{inicio}-{inicio + passo - 1}"})
            if r.status_code not in (200, 206):
                raise self._erro(tabela, r)
            bloco = r.json()
            saida += bloco
            if len(bloco) < passo:
                return saida
            inicio += passo

    def inserir(self, tabela, linhas):
        saida = []
        for i in range(0, len(linhas), 100):
            r = self.s.post(f"{self.base}/{tabela}", json=linhas[i:i + 100],
                            headers={"Prefer": "return=representation"})
            if r.status_code not in (200, 201):
                raise self._erro(tabela, r)
            saida += r.json()
        return saida


def executar(api, entradas, mesmo_assim=False, confirmar=None):
    fracoes, donos, ligacoes = construir_plano(entradas)

    emps = api.ler("empreendimentos", "id,lote")
    ids_lote = {limpar(e["lote"]): e["id"] for e in emps}
    for l in LOTES:
        if l not in ids_lote:
            sys.exit(f"Não existe o empreendimento '{l}' na base de dados. Existem: {sorted(ids_lote)}")

    ex_fr = api.ler("fracoes", "id,codigo_fracao,empreendimento_id")
    ex_pr = api.ler("proprietarios", "id,email")
    ex_li = api.ler("fracao_proprietarios", "fracao_id,proprietario_id")
    if (ex_fr or ex_pr or ex_li) and not mesmo_assim:
        sys.exit(f"A base de dados não está vazia (frações: {len(ex_fr)}, proprietários: {len(ex_pr)}, "
                 f"ligações: {len(ex_li)}). Limpa os dados de teste primeiro, ou usa --mesmo-assim "
                 f"(nesse caso o que já existe é reutilizado e nada é duplicado).")

    if confirmar is not None and not confirmar():
        sys.exit("Cancelado. Nada foi alterado.")

    mapa_fr = {(f["empreendimento_id"], limpar(f["codigo_fracao"]).upper()): f["id"] for f in ex_fr}
    novas = [{"empreendimento_id": ids_lote[l], "codigo_fracao": c}
             for (l, c) in dict.fromkeys(fracoes) if (ids_lote[l], c) not in mapa_fr]
    for f in api.inserir("fracoes", novas):
        mapa_fr[(f["empreendimento_id"], limpar(f["codigo_fracao"]).upper())] = f["id"]

    mapa_pr = {limpar(p["email"]).lower(): p["id"] for p in ex_pr}
    novos = [{"nome": nome, "email": em} for em, nome in donos.items() if em not in mapa_pr]
    for p in api.inserir("proprietarios", novos):
        mapa_pr[limpar(p["email"]).lower()] = p["id"]

    existentes = {(x["fracao_id"], x["proprietario_id"]) for x in ex_li}
    links = []
    for lote, frac, em in ligacoes:
        par = (mapa_fr[(ids_lote[lote], frac)], mapa_pr[em])
        if par not in existentes:
            existentes.add(par)
            links.append({"fracao_id": par[0], "proprietario_id": par[1]})
    api.inserir("fracao_proprietarios", links)

    print("\n================ IMPORTAÇÃO CONCLUÍDA ================")
    print(f"  frações criadas:       {len(novas)}")
    print(f"  proprietários criados: {len(novos)}")
    print(f"  ligações criadas:      {len(links)}")
    print("  Nenhum convite foi enviado.")
    return dict(fracoes=len(novas), proprietarios=len(novos), ligacoes=len(links))


def credenciais():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    if not url and os.path.exists(".env.local"):
        for linha in open(".env.local", encoding="utf-8"):
            if linha.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                url = linha.split("=", 1)[1].strip()
    if not url:
        sys.exit("Não encontrei o endereço do Supabase (NEXT_PUBLIC_SUPABASE_URL no .env.local).")
    chave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or getpass.getpass(
        "Chave service_role do Supabase (não aparece enquanto escreves): ").strip()
    if not chave:
        sys.exit("Sem chave.")
    return url, chave


def main():
    p = argparse.ArgumentParser(description="Importa frações e proprietários (simulação por defeito).")
    p.add_argument("ficheiro")
    p.add_argument("--executar", action="store_true", help="escreve na base de dados (não envia convites)")
    p.add_argument("--mesmo-assim", action="store_true", help="permite correr com a base de dados já com dados")
    p.add_argument("--revisao", default="revisao_importacao.csv")
    a = p.parse_args()

    folhas = ler_ficheiro(a.ficheiro)
    e1, dup1, sc1 = ler_lote1(achar_folha(folhas, 1))
    e2, dup2, sc2 = ler_lote2(achar_folha(folhas, 2))
    entradas = e1 + e2
    resumo(entradas, {"Lote 1": dup1, "Lote 2": dup2}, {"Lote 1": sc1, "Lote 2": sc2})
    escrever_revisao(entradas, a.revisao)

    if not a.executar:
        print("\nIsto foi só uma simulação: nada foi escrito na base de dados.")
        return
    url, chave = credenciais()

    def confirmar():
        return input("\nEscreve IMPORTAR para criar estes dados na base de dados: ").strip() == "IMPORTAR"

    executar(Api(url, chave), entradas, a.mesmo_assim, confirmar)


if __name__ == "__main__":
    main()
