// Política de privacidade do Portal do Cliente.
// ATENÇÃO: isto é um rascunho de trabalho, não é aconselhamento jurídico.
// Tem de ser revisto por quem trata da proteção de dados antes de ser dado como definitivo.

const REVISTA = false // passar a true SÓ depois de a política ser aprovada

const DADOS = {
  empresa: 'Insula Capital',
  morada: 'Largo Jean Monnet 1 5º Piso, 1250-130 Lisboa',
  email: '',
  conservacao: '[A PREENCHER: prazo de conservação, por exemplo "X anos após o fim do prazo de garantia"]',
  atualizada: '06/11/2026',
}

const faltaPreencher = Object.values(DADOS).some((v) => v.includes('A PREENCHER'))

function Seccao({ titulo, children }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>{titulo}</h2>
      {children}
    </section>
  )
}

// Notas para quem revê: só aparecem enquanto a política não estiver aprovada
function Nota({ children }) {
  if (REVISTA) return null
  return (
    <p style={{
      fontSize: 12, background: '#F7EBD6', color: '#7A5412', borderRadius: 8,
      padding: '8px 12px', margin: '8px 0',
    }}>
      Nota para revisão: {children}
    </p>
  )
}

const lista = { margin: '8px 0', paddingLeft: 22 }

export const metadata = {
  title: 'Política de privacidade — Portal do Cliente',
}

export default function Privacidade() {
  return (
    <main style={{
      maxWidth: 760, margin: '70px auto 60px', fontFamily: 'sans-serif',
      lineHeight: 1.6, color: '#24292E', fontSize: 14, padding: '0 8px',
    }}>
      {(!REVISTA || faltaPreencher) && (
        <p style={{
          background: '#F6E4DF', color: '#B4462F', borderRadius: 8, padding: '10px 14px',
          fontSize: 13, fontWeight: 600,
        }}>
          Rascunho em revisão: este texto ainda não é a versão final.
          {faltaPreencher ? ' Faltam dados da empresa (assinalados com [A PREENCHER]).' : ''}
        </p>
      )}

      <h1>Política de privacidade</h1>
      <p style={{ color: '#6B7178' }}>
        Esta política explica que dados pessoais tratamos no Portal do Cliente, para que os usamos,
        com quem os partilhamos e quais são os seus direitos.
      </p>

      <Seccao titulo="1. Quem é o responsável pelo tratamento">
        <p>
          O responsável pelo tratamento dos seus dados é <strong>{DADOS.empresa}</strong>, com sede em {DADOS.morada}.
          Para qualquer questão sobre privacidade, ou para exercer os seus direitos, contacte-nos através de{' '}
          <strong>{DADOS.email}</strong>.
        </p>
      </Seccao>

      <Seccao titulo="2. Que dados tratamos">
        <ul style={lista}>
          <li><strong>Identificação e contacto:</strong> o seu nome e endereço de email.</li>
          <li><strong>Habitação:</strong> a fração a que está associado e o empreendimento.</li>
          <li>
            <strong>Reclamações:</strong> a descrição, a categoria, a localização assinalada na planta, as mensagens
            trocadas com a nossa equipa e as fotografias e ficheiros que decida anexar.
          </li>
          <li><strong>Visitas técnicas:</strong> as datas propostas e confirmadas e o nome do técnico.</li>
          <li>
            <strong>Dados técnicos:</strong> os nossos fornecedores de alojamento registam informação técnica
            (por exemplo, o endereço IP e a hora do acesso) para garantir a segurança e o funcionamento do serviço.
          </li>
        </ul>
        <p>Ao anexar fotografias, pedimos que evite fotografar pessoas ou documentos pessoais.</p>
        <Nota>confirmar esta lista com quem trata da proteção de dados, incluindo os registos técnicos dos fornecedores.</Nota>
      </Seccao>

      <Seccao titulo="3. Para que usamos os dados e com que fundamento">
        <ul style={lista}>
          <li>
            <strong>Gerir as reclamações de garantia</strong> da sua habitação e comunicar consigo sobre elas
            (confirmações, respostas e conclusão). Fundamento: execução do contrato de compra e venda e cumprimento
            das obrigações de garantia.
          </li>
          <li>
            <strong>Criar e manter o seu acesso ao portal</strong> (convite, autenticação e recuperação da password).
            Fundamento: execução do contrato e interesse legítimo na segurança do acesso.
          </li>
          <li>
            <strong>Garantir a segurança do portal</strong> e prevenir abusos. Fundamento: interesse legítimo.
          </li>
        </ul>
        <p>Não usamos os seus dados para decisões automatizadas nem para comunicações comerciais.</p>
        <Nota>
          as bases legais indicadas são uma suposição de trabalho e têm de ser confirmadas. Se a empresa pretender
          outro uso (por exemplo, comunicações comerciais), é preciso prever outro fundamento.
        </Nota>
      </Seccao>

      <Seccao titulo="4. Quem recebe os seus dados">
        <p>
          Recorremos a prestadores de serviços que tratam dados por nossa conta (subcontratantes), ao abrigo de
          contratos de tratamento de dados:
        </p>
        <ul style={lista}>
          <li><strong>Supabase:</strong> base de dados, autenticação e armazenamento de ficheiros (região da União Europeia, Irlanda).</li>
          <li><strong>Vercel:</strong> alojamento da aplicação (processamento na União Europeia, Dublin).</li>
          <li><strong>Resend:</strong> envio das mensagens de email do portal.</li>
        </ul>
        <p>
          Dentro de {DADOS.empresa}, o acesso aos dados está limitado à equipa que gere as reclamações.
          Para resolver uma reclamação, podemos comunicar à empresa responsável pela intervenção os dados
          estritamente necessários (por exemplo, a fração e a descrição do problema).
          Não vendemos nem cedemos os seus dados para outros fins.
        </p>
        <Nota>
          confirmar se, na prática, a equipa partilha dados com as empresas que fazem as intervenções e quais.
          Se sim, o jurista pode pedir que sejam identificadas como destinatários.
        </Nota>
      </Seccao>

      <Seccao titulo="5. Transferências para fora da União Europeia">
        <p>
          Alguns destes prestadores pertencem a grupos sediados fora da União Europeia. Quando existe acesso a dados
          a partir de fora da União Europeia, a transferência apoia-se nos mecanismos previstos no RGPD
          (por exemplo, cláusulas contratuais-tipo ou uma decisão de adequação).
        </p>
        <Nota>
          confirmar com o jurista o mecanismo aplicável a cada fornecedor e, se for o caso, listá-lo aqui.
        </Nota>
      </Seccao>

      <Seccao titulo="6. Durante quanto tempo guardamos os dados">
        <p>
          Guardamos os seus dados enquanto forem necessários para gerir as suas reclamações e durante{' '}
          {DADOS.conservacao}. Depois disso, são apagados ou tornados anónimos.
        </p>
      </Seccao>

      <Seccao titulo="7. Os seus direitos">
        <p>Pode, em qualquer momento:</p>
        <ul style={lista}>
          <li>aceder aos seus dados e obter uma cópia;</li>
          <li>pedir a correção de dados incorretos;</li>
          <li>pedir o apagamento dos dados, nos casos previstos na lei;</li>
          <li>pedir a limitação do tratamento ou opor-se a ele;</li>
          <li>pedir os seus dados num formato estruturado (portabilidade).</li>
        </ul>
        <p>
          Para exercer qualquer destes direitos, escreva para <strong>{DADOS.email}</strong>. Respondemos no prazo
          de um mês. Tem também o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados
          (<a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">www.cnpd.pt</a>).
        </p>
      </Seccao>

      <Seccao titulo="8. Como protegemos os dados">
        <ul style={lista}>
          <li>Cada proprietário só tem acesso às suas próprias reclamações e documentos.</li>
          <li>As fotografias e os documentos ficam em armazenamento privado e só se abrem através de ligações temporárias.</li>
          <li>As comunicações com o portal são cifradas (HTTPS) e os dados são tratados em servidores na União Europeia.</li>
          <li>O acesso interno é limitado a pessoas autorizadas, com conta pessoal.</li>
        </ul>
        <Nota>
          só acrescentar que as contas de administração têm autenticação de dois passos depois de a ativar em todas
          (GitHub, Supabase, Vercel e Resend).
        </Nota>
      </Seccao>

      <Seccao titulo="9. Cookies e armazenamento local">
        <p>
          O portal usa apenas o armazenamento do navegador estritamente necessário, para manter a sessão iniciada e
          guardar preferências de visualização. Não usamos cookies de publicidade nem de análise de audiência.
        </p>
      </Seccao>

      <Seccao titulo="10. Menores">
        <p>O portal destina-se a proprietários de habitações e não a menores de idade.</p>
      </Seccao>

      <Seccao titulo="11. Alterações a esta política">
        <p>
          Podemos atualizar esta política. A versão em vigor é a desta página, atualizada em {DADOS.atualizada}.
        </p>
      </Seccao>

      <p style={{ marginTop: 30 }}>
        <a href="/login">← Voltar ao portal</a>
      </p>
    </main>
  )
}