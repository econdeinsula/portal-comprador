#!/usr/bin/env python3
"""
Migração dos dados históricos (Lote 1 e Lote 2) para o Portal do Comprador.
"""

import argparse
import os
import re
import sys
from datetime import date

import pandas as pd
import psycopg2
import psycopg2.extras


def norm(text):
    if text is None or (isinstance(text, float) and pd.isna(text)):
        return None
    return re.sub(r"\s+", " ", str(text)).strip()


def is_blank(text):
    n = norm(text)
    return n is None or n == ""


FRACAO_LOTE2_RE = re.compile(
    r"^\s*(?P<bloco>[A-Za-z0-9]+)\s*/\s*P\s*(?P<piso>-?\d+)\s*/\s*(?P<apto>[A-Za-z])\s*-\s*(?P<codigo>[A-Za-z0-9]+)\s*$",
    re.IGNORECASE,
)


def parse_fracao_lote2(raw):
    m = FRACAO_LOTE2_RE.match(raw)
    if not m:
        return None
    return m.group("bloco"), m.group("piso"), m.group("apto"), m.group("codigo")


def to_date(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        parsed = pd.to_datetime(value, dayfirst=True, errors="coerce")
        return None if pd.isna(parsed) else parsed.date()
    except Exception:
        return None


class Migrador:
    def __init__(self, conn):
        self.conn = conn
        self.review_rows = []
        self.stats = {"lote1_inseridas": 0, "lote2_inseridas": 0,
                       "empresas_nao_resolvidas": set(), "estados_nao_resolvidos": set()}
        self._carregar_lookups()
        self._fracao_cache = {}

    def _carregar_lookups(self):
        cur = self.conn.cursor()

        cur.execute("select id, lote from empreendimentos")
        self.empreendimento_por_lote = {row[1]: row[0] for row in cur.fetchall()}
        if "Lote 1" not in self.empreendimento_por_lote or "Lote 2" not in self.empreendimento_por_lote:
            sys.exit("ERRO: não encontrei 'Lote 1' / 'Lote 2' em empreendimentos. Corre primeiro o seed_data.sql.")

        cur.execute("select alias_legado, estado_id from estados_alias_legado")
        self.estado_por_alias = {norm(a).upper(): eid for a, eid in cur.fetchall()}
        cur.execute("select id from estados where nome = 'Aberta'")
        self.estado_default_id = cur.fetchone()[0]

        cur.execute("select alias_legado, empresa_id from empresas_alias_legado")
        self.empresa_por_alias = {norm(a).upper(): eid for a, eid in cur.fetchall()}

        cur.close()

    def resolver_estado(self, estado_raw, fonte):
        if is_blank(estado_raw):
            return self.estado_default_id
        key = norm(estado_raw).upper().rstrip("?").strip()
        eid = self.estado_por_alias.get(key)
        if eid is None:
            self.stats["estados_nao_resolvidos"].add(norm(estado_raw))
            self.review_rows.append({"fonte": fonte, "motivo": "estado sem correspondência",
                                      "valor_original": norm(estado_raw)})
            return self.estado_default_id
        return eid

    def resolver_empresas(self, empresa_raw, fonte):
        if is_blank(empresa_raw):
            return []
        partes = [p.strip() for p in norm(empresa_raw).split("/") if p.strip()]
        ids = []
        for parte in partes:
            eid = self.empresa_por_alias.get(parte.upper())
            if eid is None:
                self.stats["empresas_nao_resolvidas"].add(parte)
                self.review_rows.append({"fonte": fonte, "motivo": "empresa sem correspondência",
                                          "valor_original": parte})
                continue
            ids.append(eid)
        return ids

    def obter_ou_criar_fracao(self, empreendimento_id, codigo_fracao, bloco=None, piso=None,
                               apartamento=None, data_escritura=None):
        chave = (empreendimento_id, codigo_fracao)
        if chave in self._fracao_cache:
            return self._fracao_cache[chave]

        cur = self.conn.cursor()
        cur.execute(
            "select id from fracoes where empreendimento_id = %s and codigo_fracao = %s",
            (empreendimento_id, codigo_fracao),
        )
        row = cur.fetchone()
        if row:
            fracao_id = row[0]
        else:
            cur.execute(
                """insert into fracoes (empreendimento_id, codigo_fracao, bloco, piso, apartamento, data_escritura)
                   values (%s, %s, %s, %s, %s, %s) returning id""",
                (empreendimento_id, codigo_fracao, bloco, piso, apartamento, data_escritura),
            )
            fracao_id = cur.fetchone()[0]
        cur.close()
        self._fracao_cache[chave] = fracao_id
        return fracao_id

    def inserir_anomalia(self, fracao_id, descricao, estado_id, fonte_legado,
                          empresa_ids=None, data_entrada=None, data_vistoria=None,
                          data_encomenda=None, data_correcao=None):
        cur = self.conn.cursor()
        cur.execute(
            """insert into anomalias
               (fracao_id, descricao, estado_id, origem, fonte_legado,
                data_entrada, data_vistoria, data_encomenda, data_correcao)
               values (%s, %s, %s, 'legado', %s, %s, %s, %s, %s)
               returning id""",
            (fracao_id, descricao, estado_id, fonte_legado,
             data_entrada, data_vistoria, data_encomenda, data_correcao),
        )
        anomalia_id = cur.fetchone()[0]

        for empresa_id in (empresa_ids or []):
            cur.execute(
                "insert into anomalia_empresas (anomalia_id, empresa_id) values (%s, %s) on conflict do nothing",
                (anomalia_id, empresa_id),
            )

        marcos = [
            (data_entrada, "Anomalia registada"),
            (data_vistoria, "Vistoria realizada"),
            (data_encomenda, "Reparação encomendada / agendada"),
            (data_correcao, "Correção registada como concluída"),
        ]
        for data_evento, texto in marcos:
            if data_evento is None:
                continue
            cur.execute(
                """insert into timeline_eventos (anomalia_id, autor_tipo, tipo_evento, texto, reconstruido, ocorrido_em)
                   values (%s, 'sistema', 'mudanca_estado', %s, true, %s)""",
                (anomalia_id, texto, data_evento),
            )
        cur.close()
        return anomalia_id

    def migrar_lote1(self, path):
        df = pd.read_excel(path, sheet_name="Lote I - Total ", header=0)
        empreendimento_id = self.empreendimento_por_lote["Lote 1"]

        for idx, row in df.iterrows():
            excel_row = idx + 2
            fonte = f"Lote 1 - linha {excel_row}"

            codigo_fracao = norm(row.get("FRAÇÃO"))
            if is_blank(codigo_fracao):
                continue

            descricao = norm(row.get("ANOMALIAS"))
            if is_blank(descricao):
                continue

            fracao_id = self.obter_ou_criar_fracao(
                empreendimento_id,
                codigo_fracao,
                bloco=norm(row.get("BLOCO ")),
                piso=norm(row.get("PISO ")),
                apartamento=norm(row.get("APART.")),
                data_escritura=to_date(row.get("DATA DA ESCRITURA")),
            )

            estado_id = self.resolver_estado(row.get("ESTADO"), fonte)
            empresa_ids = self.resolver_empresas(row.get("EMPRESA"), fonte)

            self.inserir_anomalia(
                fracao_id=fracao_id,
                descricao=descricao,
                estado_id=estado_id,
                fonte_legado=fonte,
                empresa_ids=empresa_ids,
                data_entrada=to_date(row.get("DATA ENTRADA ANOMALIA")),
                data_vistoria=to_date(row.get("DATA DA VISTORIA ")),
                data_encomenda=to_date(row.get("AGENDAM. CORREÇÃO/\nDATA ENCOMENDA")),
                data_correcao=to_date(row.get("DATA de  CORREÇÃO_BAIXA")),
            )
            self.stats["lote1_inseridas"] += 1

    def migrar_lote2(self, path):
        df = pd.read_excel(path, sheet_name="ANOMALIAS - PONTOS - LOTE 2 ", header=0)
        empreendimento_id = self.empreendimento_por_lote["Lote 2"]

        cutoff = len(df)
        for idx, row in df.iterrows():
            if norm(row.get("ANOMALIAS NOVAS ")) == "PONTOS ANTIGOS":
                cutoff = idx
                break
        df = df.iloc[:cutoff]

        df["FRAÇÃO"] = df["FRAÇÃO"].ffill()

        for idx, row in df.iterrows():
            excel_row = idx + 2
            fracao_raw = norm(row.get("FRAÇÃO"))
            if is_blank(fracao_raw):
                continue

            if fracao_raw.strip().lower() == "zonas comuns":
                fracao_id = self.obter_ou_criar_fracao(
                    empreendimento_id, "ZONAS_COMUNS", bloco=None, piso=None, apartamento=None,
                )
            else:
                parsed = parse_fracao_lote2(fracao_raw)
                if parsed is None:
                    self.review_rows.append({
                        "fonte": f"Lote 2 - linha {excel_row}",
                        "motivo": "fração em formato não reconhecido — não migrada",
                        "valor_original": fracao_raw,
                    })
                    continue
                bloco, piso, apartamento, codigo_fracao = parsed
                fracao_id = self.obter_ou_criar_fracao(
                    empreendimento_id, codigo_fracao, bloco=bloco, piso=piso, apartamento=apartamento,
                )

            desc_antiga = norm(row.get("ANOMALIAS ANTIGAS "))
            if not is_blank(desc_antiga):
                fonte = f"Lote 2 - linha {excel_row} - antiga"
                estado_id = self.resolver_estado(row.get("ESTADO ANOMALIAS - ANTIGAS"), fonte)
                empresa_ids = self.resolver_empresas(row.get("RESPONSÁVEL"), fonte)
                self.inserir_anomalia(fracao_id, desc_antiga, estado_id, fonte, empresa_ids)
                self.stats["lote2_inseridas"] += 1

            desc_nova = norm(row.get("ANOMALIAS NOVAS "))
            if not is_blank(desc_nova):
                fonte = f"Lote 2 - linha {excel_row} - nova"
                estado_id = self.resolver_estado(row.get("ESTADO ANOMALIAS - NOVAS"), fonte)
                empresa_ids = self.resolver_empresas(row.get("RESPONSÁVEL.1"), fonte)
                self.inserir_anomalia(fracao_id, desc_nova, estado_id, fonte, empresa_ids)
                self.stats["lote2_inseridas"] += 1

    def gravar_relatorio(self, caminho_csv):
        if self.review_rows:
            pd.DataFrame(self.review_rows).to_csv(caminho_csv, index=False)
        print("\n=== RESUMO DA MIGRAÇÃO ===")
        print(f"Lote 1 — anomalias inseridas: {self.stats['lote1_inseridas']}")
        print(f"Lote 2 — anomalias inseridas: {self.stats['lote2_inseridas']}")
        print(f"Linhas assinaladas para revisão manual: {len(self.review_rows)}"
              + (f" -> {caminho_csv}" if self.review_rows else ""))
        if self.stats["estados_nao_resolvidos"]:
            print(f"Estados sem correspondência: {sorted(self.stats['estados_nao_resolvidos'])}")
        if self.stats["empresas_nao_resolvidas"]:
            print(f"Empresas sem correspondência: {sorted(self.stats['empresas_nao_resolvidas'])}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lote1", required=True)
    parser.add_argument("--lote2", required=True)
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--review-csv", default="linhas_para_revisao.csv")
    args = parser.parse_args()

    if not args.db_url:
        sys.exit("ERRO: define --db-url ou a variável de ambiente DATABASE_URL")

    conn = psycopg2.connect(args.db_url)
    try:
        migrador = Migrador(conn)
        migrador.migrar_lote1(args.lote1)
        migrador.migrar_lote2(args.lote2)
        conn.commit()
        migrador.gravar_relatorio(args.review_csv)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()