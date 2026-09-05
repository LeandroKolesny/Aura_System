import React from 'react';
import { Link } from 'react-router-dom';
import AuraLogo from '../components/AuraLogo';
import { SAAS_COMPANY_NAME } from '../constants';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-base font-bold text-[#1c1917] mb-3 pb-2 border-b border-[#f0e8e0]">{title}</h2>
    <div className="text-sm text-[#57534e] leading-relaxed space-y-3">{children}</div>
  </div>
);

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5ebe0]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#bd7b65] to-[#8b5a47] py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <AuraLogo className="w-8 h-8 brightness-[10]" />
            <span className="text-xl font-bold text-white">{SAAS_COMPANY_NAME}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Política de Privacidade</h1>
          <p className="text-white/70 text-sm">Versão 1.0 · Vigente a partir de março de 2025</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
          <strong>Aviso:</strong> Este documento é baseado em pesquisa sobre a LGPD e práticas do mercado SaaS brasileiro. Recomendamos revisão por advogado especializado antes de decisões jurídicas.
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">

          <Section title="1. Quem Somos">
            <p>O <strong>{SAAS_COMPANY_NAME}</strong> é uma plataforma digital de gestão para clínicas de estética.</p>
            <p><strong>Encarregado de Proteção de Dados (DPO):</strong><br />E-mail: privacidade@aura-system.com.br<br /><span className="text-[#a09890]">(Canal oficial para questões de privacidade, conforme Art. 41 da LGPD)</span></p>
          </Section>

          <Section title="2. A Quem Esta Política se Aplica">
            <p>Esta Política aplica-se a três grupos:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Usuários do Sistema:</strong> Administradores, recepcionistas e profissionais cadastrados pelas clínicas;</li>
              <li><strong>Pacientes das Clínicas:</strong> Quando as clínicas inserem seus dados no sistema, o {SAAS_COMPANY_NAME} os trata como Operador;</li>
              <li><strong>Visitantes do site institucional.</strong></li>
            </ul>
            <div className="bg-[#fdfcfb] border border-[#f0e8e0] rounded-xl p-3 text-xs mt-2">
              <strong>Importante para pacientes:</strong> Se você é paciente de uma clínica que usa o {SAAS_COMPANY_NAME}, seus dados são controlados <strong>pela clínica</strong>. Para exercer seus direitos (acesso, correção, exclusão), entre em contato diretamente com a clínica. O {SAAS_COMPANY_NAME} atuará como facilitador quando necessário.
            </div>
          </Section>

          <Section title="3. Papéis na Proteção de Dados">
            <div className="grid gap-3">
              <div className="bg-[#fdfcfb] border border-[#f0e8e0] rounded-xl p-3">
                <p className="font-semibold text-[#1c1917] text-xs mb-1">{SAAS_COMPANY_NAME} como Controlador</p>
                <p className="text-xs">Em relação aos dados dos <strong>usuários do sistema</strong> (profissionais e administradores), o {SAAS_COMPANY_NAME} decide como e por que esses dados são tratados.</p>
              </div>
              <div className="bg-[#fdfcfb] border border-[#f0e8e0] rounded-xl p-3">
                <p className="font-semibold text-[#1c1917] text-xs mb-1">{SAAS_COMPANY_NAME} como Operador</p>
                <p className="text-xs">Em relação aos <strong>dados dos pacientes</strong> inseridos pelas clínicas, o {SAAS_COMPANY_NAME} trata esses dados apenas a mando e conforme instruções da clínica cliente.</p>
              </div>
              <div className="bg-[#fdfcfb] border border-[#f0e8e0] rounded-xl p-3">
                <p className="font-semibold text-[#1c1917] text-xs mb-1">A Clínica como Controladora</p>
                <p className="text-xs">A clínica é responsável por obter os consentimentos necessários, definir as finalidades do tratamento e responder às solicitações dos pacientes.</p>
              </div>
            </div>
          </Section>

          <Section title="4. Quais Dados Coletamos e Por Quê">
            <p className="font-medium text-[#1c1917]">4.1 Dados dos Usuários do Sistema</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse mt-1">
                <thead><tr className="bg-[#f5ebe0]">
                  {['Categoria','Dados','Base Legal'].map(h => <th key={h} className="text-left p-2 font-semibold text-[#1c1917] border border-[#f0e8e0]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    ['Identificação','Nome, e-mail, senha (criptografada)','Execução de contrato (Art. 7º, V)'],
                    ['Faturamento','CNPJ, dados de pagamento','Execução de contrato (Art. 7º, V)'],
                    ['Uso da plataforma','Logs de acesso, IP, funcionalidades usadas','Legítimo interesse (Art. 7º, IX)'],
                  ].map(([cat, data, base]) => (
                    <tr key={cat}>
                      <td className="p-2 font-medium border border-[#f0e8e0]">{cat}</td>
                      <td className="p-2 border border-[#f0e8e0]">{data}</td>
                      <td className="p-2 border border-[#f0e8e0]">{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="font-medium text-[#1c1917] mt-3">4.2 Dados dos Pacientes das Clínicas</p>
            <p className="text-xs">Estes dados são inseridos pelas próprias clínicas. O {SAAS_COMPANY_NAME} suporta:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs mt-1">
              <li>Nome, data de nascimento, CPF, RG, endereço, telefone, e-mail;</li>
              <li>Histórico de agendamentos, atendimentos e dados financeiros;</li>
              <li><strong>Dados sensíveis de saúde</strong> (ver Seção 5): fichas de anamnese, prontuários, fotografias de procedimentos, condições de pele.</li>
            </ul>
          </Section>

          <Section title="5. Dados Sensíveis de Saúde — Proteção Especial">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-semibold text-red-800 text-xs mb-2">Por que esses dados exigem cuidado extra?</p>
              <p className="text-xs text-red-700">A LGPD (Art. 5º, II e Art. 11) classifica como <strong>dados pessoais sensíveis</strong> todas as informações referentes à saúde. Em clínicas de estética, isso inclui: histórico de doenças e alergias, medicamentos em uso, condições de pele (rosácea, psoríase, dermatite), fotografias vinculadas a procedimentos e registro de resultados.</p>
            </div>
            <p>Esses dados recebem <strong>proteção reforçada</strong>: controles de acesso mais rigorosos, criptografia adicional e restrições específicas de uso.</p>
            <p><strong>Bases legais para tratamento de dados sensíveis:</strong></p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Consentimento específico e destacado do paciente</strong> (Art. 11, I): A clínica deve obter assinatura em termo que descreva claramente quais dados sensíveis serão coletados e para quais finalidades;</li>
              <li><strong>Tutela da saúde do titular</strong> (Art. 11, II, f): Dados tratados por profissional habilitado exclusivamente para proteção e cuidado do paciente.</li>
            </ul>
            <div className="bg-[#fdfcfb] border border-[#f0e8e0] rounded-xl p-3 text-xs">
              <strong>Vedação absoluta (Art. 11, §4º LGPD):</strong> É proibido compartilhar dados sensíveis de saúde para obtenção de vantagem econômica. O {SAAS_COMPANY_NAME} confirma que <strong>nunca realiza e nunca realizará</strong> essa prática.
            </div>
            <p><strong>Fotografias de antes/depois:</strong> São dados sensíveis quando vinculadas à identidade do paciente. A clínica deve obter consentimento específico para armazenamento E consentimento <strong>separado e adicional</strong> para uso em marketing.</p>
          </Section>

          <Section title="6. Com Quem Compartilhamos os Dados">
            <p>O {SAAS_COMPANY_NAME} <strong>não vende dados</strong>. Dados são compartilhados somente com:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Suboperadores de infraestrutura:</strong> Provedores de nuvem, gateway de pagamento (Asaas), serviço de e-mail (Resend) — todos com contratos de proteção equivalente;</li>
              <li><strong>Por obrigação legal:</strong> Quando exigido por lei, ordem judicial ou autoridade competente;</li>
              <li><strong>Proteção de direitos:</strong> Em disputas contratuais ou processos judiciais, limitado ao mínimo necessário.</li>
            </ul>
          </Section>

          <Section title="7. Por Quanto Tempo Guardamos os Dados">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-[#f5ebe0]">
                  {['Tipo de Dado','Prazo'].map(h => <th key={h} className="text-left p-2 font-semibold text-[#1c1917] border border-[#f0e8e0]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    ['Dados de usuários (conta ativa)','Durante toda a vigência do contrato'],
                    ['Dados de usuários (após cancelamento)','5 anos (prescrição civil)'],
                    ['Prontuários e anamneses','Mínimo 5 anos (recomendado: 20 anos)'],
                    ['Fotografias de procedimentos','Conforme consentimento; mínimo 5 anos'],
                    ['Dados financeiros e fiscais','5 anos (obrigação fiscal)'],
                    ['Logs de acesso','6 meses (Marco Civil da Internet, Art. 15)'],
                  ].map(([tipo, prazo]) => (
                    <tr key={tipo}>
                      <td className="p-2 border border-[#f0e8e0]">{tipo}</td>
                      <td className="p-2 border border-[#f0e8e0] font-medium">{prazo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="8. Como Protegemos os Dados">
            <p><strong>Medidas Técnicas:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Criptografia em trânsito: TLS 1.2+ (HTTPS em todas as comunicações);</li>
              <li>Criptografia em repouso: AES-256;</li>
              <li>Controle de acesso baseado em função (RBAC);</li>
              <li>Backups automáticos diários com testes periódicos de restauração;</li>
              <li>Monitoramento de segurança com alertas de anomalias.</li>
            </ul>
            <p><strong>Medidas Organizacionais:</strong> Política de acesso mínimo; acordo de confidencialidade para todos os colaboradores; treinamento periódico em LGPD; plano de resposta a incidentes.</p>
          </Section>

          <Section title="9. Seus Direitos como Titular">
            <p>A LGPD (Art. 18) garante os seguintes direitos:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-[#f5ebe0]">
                  {['Direito','O que significa'].map(h => <th key={h} className="text-left p-2 font-semibold text-[#1c1917] border border-[#f0e8e0]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    ['Acesso','Receber cópia dos seus dados'],
                    ['Correção','Corrigir dados incompletos ou incorretos'],
                    ['Eliminação','Solicitar exclusão de dados tratados com base no consentimento'],
                    ['Portabilidade','Receber seus dados em formato estruturado para uso em outro serviço'],
                    ['Revogação do consentimento','Retirar um consentimento dado anteriormente, a qualquer momento'],
                    ['Oposição','Opor-se a tratamento baseado em legítimo interesse'],
                  ].map(([dir, sig]) => (
                    <tr key={dir}>
                      <td className="p-2 font-medium border border-[#f0e8e0]">{dir}</td>
                      <td className="p-2 border border-[#f0e8e0]">{sig}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2">Para exercer seus direitos: <strong>privacidade@aura-system.com.br</strong> · Prazo de resposta: até <strong>15 dias úteis</strong>.</p>
            <p className="text-xs text-[#a09890]">Se não estiver satisfeito, você pode registrar reclamação na ANPD: gov.br/anpd</p>
          </Section>

          <Section title="10. Cookies">
            <p>Utilizamos cookies essenciais (autenticação, segurança — obrigatórios), analíticos (uso do produto — opcionais) e de preferências (configurações — opcionais). Você pode gerenciar suas preferências pelo banner de cookies ao acessar o site pela primeira vez.</p>
          </Section>

          <Section title="11. Transferência Internacional de Dados">
            <p>Alguns suboperadores podem processar dados fora do Brasil. Nesse caso, garantimos conformidade com o Art. 33 da LGPD por meio de cláusulas contratuais específicas de proteção de dados.</p>
          </Section>

          <Section title="12. Incidentes de Segurança">
            <p>Em caso de incidente com dados pessoais: (a) notificamos as clínicas afetadas em até <strong>72 horas</strong>; (b) comunicamos a ANPD quando o incidente representar risco relevante; (c) comunicamos diretamente os titulares quando houver risco elevado.</p>
          </Section>

          <Section title="13. Crianças e Adolescentes">
            <p>A Plataforma não é destinada a crianças como usuários diretos. Para pacientes menores de idade, a clínica deve obter consentimento expresso de pais ou responsável legal, especialmente para dados sensíveis de saúde.</p>
          </Section>

          <Section title="14. Alterações nesta Política">
            <p>Alterações relevantes serão comunicadas por e-mail com antecedência mínima de <strong>30 dias</strong>. Alterações que exijam novo consentimento solicitarão concordância ativa antes de implementar as mudanças.</p>
          </Section>

          <Section title="15. Contato e Canal de Privacidade">
            <p><strong>DPO / Encarregado de Dados:</strong><br />privacidade@aura-system.com.br<br /><span className="text-[#a09890] text-xs">Resposta em até 15 dias úteis</span></p>
            <p><strong>Suporte Geral:</strong> contato@aura-system.com.br</p>
          </Section>

          {/* Glossário */}
          <div className="bg-[#fdfcfb] border border-[#f0e8e0] rounded-xl p-5">
            <p className="text-xs font-bold text-[#a09890] uppercase tracking-wider mb-3">Glossário Simplificado</p>
            <dl className="grid grid-cols-1 gap-2 text-xs">
              {[
                ['LGPD','Lei Geral de Proteção de Dados (Lei nº 13.709/2018) — a lei brasileira que protege seus dados pessoais.'],
                ['Dado Pessoal','Qualquer informação que identifique ou possa identificar você (nome, CPF, e-mail, telefone, foto).'],
                ['Dado Sensível','Dado que pode causar mais risco se mal usado — como informações de saúde, biometria, etc. Exige cuidado extra.'],
                ['Controlador','Quem decide como seus dados são usados. No caso dos dados de pacientes, é a clínica.'],
                ['Operador',`Quem trata dados a mando do Controlador. O ${SAAS_COMPANY_NAME} é o Operador dos dados dos pacientes.`],
                ['ANPD','Autoridade Nacional de Proteção de Dados — órgão do governo que fiscaliza o cumprimento da LGPD.'],
              ].map(([term, def]) => (
                <div key={term} className="flex gap-2">
                  <dt className="font-semibold text-[#1c1917] shrink-0 w-28">{term}</dt>
                  <dd className="text-[#57534e]">{def}</dd>
                </div>
              ))}
            </dl>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-[#a09890] space-y-2">
          <p>© {new Date().getFullYear()} {SAAS_COMPANY_NAME} · Todos os direitos reservados</p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/termos-de-uso" className="text-[#bd7b65] hover:underline">Termos de Uso</Link>
            <span>·</span>
            <Link to="/login" className="text-[#bd7b65] hover:underline">← Voltar</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
