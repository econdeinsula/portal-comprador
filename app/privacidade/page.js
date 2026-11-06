// Política de privacidade do Portal do Cliente.

const DADOS = {
  empresa: 'Insula Capital',
  morada: 'Largo Jean Monnet 1, 5º Piso, 1250-130 Lisboa',
  email: 'pv_hera@insulacapital.pt',
  conservacao:
    'enquanto forem necessários para gerir as suas reclamações, durante o prazo de garantia aplicável à sua fração e pelo período adicional necessário ao cumprimento de obrigações legais e à defesa de direitos em caso de litígio',
  atualizada: '6 de novembro de 2026',
}

function Seccao({ titulo, children }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>{titulo}</h2>
      {children}
    </section>
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
          Dentro da {DADOS.empresa}, o acesso aos dados está limitado à equipa que gere as reclamações.
          Para resolver uma reclamação, podemos comunicar à empresa responsável pela intervenção os dados
          estritamente necessários (por exemplo, a fração e a descrição do problema).
          Não vendemos nem cedemos os seus dados para outros fins.
        </p>
      </Seccao>

      <Seccao titulo="5. Transferências para fora da União Europeia">
        <p>
          Alguns destes prestadores pertencem a grupos sediados fora da União Europeia. Quando existe acesso a dados
          a partir de fora da União Europeia, a transferência apoia-se nos mecanismos previstos no RGPD
          (por exemplo, cláusulas contratuais-tipo ou uma decisão de adequação).
        </p>
      </Seccao>

      <Seccao titulo="6. Durante quanto tempo guardamos os dados">
        <p>
          Guardamos os seus dados {DADOS.conservacao}. Depois disso, são apagados ou tornados anónimos.
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