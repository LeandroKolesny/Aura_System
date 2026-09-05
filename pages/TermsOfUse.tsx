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

const TermsOfUse: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f5ebe0]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#bd7b65] to-[#8b5a47] py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <AuraLogo className="w-8 h-8 brightness-[10]" />
            <span className="text-xl font-bold text-white">{SAAS_COMPANY_NAME}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Termos de Uso</h1>
          <p className="text-white/70 text-sm">Versão 1.0 · Vigente a partir de março de 2025</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
          <strong>Aviso:</strong> Este documento é baseado em práticas do mercado SaaS brasileiro de saúde e estética e na LGPD (Lei nº 13.709/2018). Recomendamos revisão por advogado especializado antes de decisões jurídicas.
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">

          {/* Sumário */}
          <div className="mb-8 p-4 bg-[#fdfcfb] rounded-xl border border-[#f0e8e0]">
            <p className="text-xs font-bold text-[#a09890] uppercase tracking-wider mb-3">Sumário</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-[#bd7b65]">
              {['Das Partes e Definições','Do Objeto e Aceite','Do Cadastro e Acesso','Das Obrigações do Contratante',`Das Obrigações do ${SAAS_COMPANY_NAME}`,'Dos Planos e Pagamentos','Da Propriedade Intelectual','Da Proteção de Dados (LGPD)','Da Segurança e Disponibilidade','Da Suspensão e Cancelamento','Da Portabilidade e Encerramento','Da Limitação de Responsabilidade','Das Disposições Gerais'].map((item, i) => (
                <span key={i} className="text-xs">{i + 1}. {item}</span>
              ))}
            </div>
          </div>

          <Section title="1. Das Partes e Definições">
            <p><strong>1.1</strong> Estes Termos de Uso regulam a relação entre o <strong>{SAAS_COMPANY_NAME}</strong> (plataforma de gestão SaaS para clínicas de estética) e o <strong>Contratante</strong> (pessoa jurídica ou física que realiza o cadastro e utiliza os serviços).</p>
            <p><strong>1.2</strong> Definições conforme a LGPD (Lei nº 13.709/2018):</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse mt-2">
                <thead><tr className="bg-[#f5ebe0]">
                  <th className="text-left p-2 font-semibold text-[#1c1917] border border-[#f0e8e0]">Termo</th>
                  <th className="text-left p-2 font-semibold text-[#1c1917] border border-[#f0e8e0]">Definição</th>
                </tr></thead>
                <tbody>
                  {[
                    ['Dado Pessoal', 'Informação relacionada a pessoa natural identificada ou identificável'],
                    ['Dado Pessoal Sensível', 'Dado sobre saúde, biométrico, genético, racial, religioso, sexual ou político'],
                    ['Controlador', 'Quem decide sobre o tratamento dos dados — a Clínica, em relação aos dados de seus pacientes'],
                    ['Operador', `Quem trata dados em nome do Controlador — o ${SAAS_COMPANY_NAME}, em relação aos dados das clínicas`],
                    ['Titular', 'A pessoa natural a quem os dados se referem (pacientes, usuários do sistema)'],
                    ['ANPD', 'Autoridade Nacional de Proteção de Dados'],
                  ].map(([term, def]) => (
                    <tr key={term}>
                      <td className="p-2 font-medium border border-[#f0e8e0] align-top">{term}</td>
                      <td className="p-2 border border-[#f0e8e0]">{def}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="2. Do Objeto e Aceite">
            <p><strong>2.1</strong> O {SAAS_COMPANY_NAME} é uma plataforma de gestão em nuvem (SaaS) para clínicas de estética, disponibilizando funcionalidades de agendamento online, cadastro de pacientes, prontuário eletrônico, controle financeiro, gestão de estoque, relatórios e demais ferramentas conforme o plano contratado.</p>
            <p><strong>2.2</strong> Ao concluir o cadastro, clicar em "Concordo" ou utilizar qualquer funcionalidade da Plataforma, o Contratante declara que: (a) leu e compreendeu estes Termos e a Política de Privacidade; (b) tem capacidade legal para celebrar este contrato; (c) as informações fornecidas são verdadeiras; (d) está ciente de suas responsabilidades como Controlador dos dados de seus pacientes.</p>
          </Section>

          <Section title="3. Do Cadastro e Acesso">
            <p><strong>3.1</strong> O acesso é realizado por login e senha individuais. O Contratante é responsável pelo sigilo das suas credenciais e por todas as ações realizadas em sua conta.</p>
            <p><strong>3.2</strong> É permitido criar usuários adicionais (administradores, recepcionistas, profissionais) conforme limites do plano. Compartilhamento de senhas é vedado.</p>
            <p><strong>3.3</strong> O {SAAS_COMPANY_NAME} reserva-se o direito de recusar cadastros com informações falsas ou incompletas.</p>
          </Section>

          <Section title="4. Das Obrigações do Contratante">
            <p><strong>4.1</strong> O Contratante obriga-se a:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Uso lícito:</strong> Utilizar a Plataforma exclusivamente para gestão de clínicas de estética;</li>
              <li><strong>Consentimento dos pacientes:</strong> Obter, de forma prévia e documentada, o consentimento válido dos pacientes para coleta e armazenamento de seus dados — especialmente dados sensíveis de saúde;</li>
              <li><strong>Informação aos pacientes:</strong> Informar seus pacientes, em linguagem clara, sobre a utilização do sistema digital {SAAS_COMPANY_NAME} para armazenamento de seus dados (Art. 9º LGPD);</li>
              <li><strong>Dados necessários:</strong> Inserir somente os dados estritamente necessários, respeitando o princípio da necessidade (Art. 6º, III, LGPD);</li>
              <li><strong>Notificação de incidentes:</strong> Comunicar imediatamente o {SAAS_COMPANY_NAME} em caso de acesso não autorizado.</li>
            </ul>
            <p className="mt-2"><strong>4.2</strong> É expressamente <strong>vedado</strong>: inserir dados de pacientes sem consentimento; compartilhar credenciais; realizar engenharia reversa; usar a Plataforma para fins ilegais; sublicenciar o acesso a terceiros.</p>
          </Section>

          <Section title={`5. Das Obrigações do ${SAAS_COMPANY_NAME}`}>
            <p>O {SAAS_COMPANY_NAME} compromete-se a:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Disponibilidade:</strong> Manter a Plataforma disponível conforme SLA (Cláusula 9), com comunicação prévia de 48h sobre manutenções programadas;</li>
              <li><strong>Segurança:</strong> Implementar medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado;</li>
              <li><strong>Confidencialidade:</strong> Manter sigilo sobre todos os dados tratados, extensivo a colaboradores e subcontratados;</li>
              <li><strong>Notificação de incidentes:</strong> Comunicar o Contratante em até <strong>72 horas</strong> sobre incidentes de segurança;</li>
              <li><strong>Não uso para fins próprios:</strong> Nunca utilizar dados de pacientes para fins comerciais, publicidade, treinamento de IA ou venda a terceiros.</li>
            </ul>
          </Section>

          <Section title="6. Dos Planos, Pagamentos e Renovação">
            <p><strong>6.1</strong> Os planos e valores estão disponíveis na página de planos da Plataforma, com cobrança recorrente mensal ou anual via cartão de crédito, PIX ou boleto bancário.</p>
            <p><strong>6.2</strong> Os valores são reajustados anualmente (IGPM ou índice substitutivo) com comunicação prévia de <strong>30 dias</strong>.</p>
            <p><strong>6.3</strong> Inadimplência: após 5 dias, notificação; após 15 dias, suspensão temporária (dados preservados); após 30 dias, possibilidade de cancelamento com exportação disponível por 30 dias adicionais.</p>
            <p><strong>6.4</strong> Novos Contratantes têm direito ao período de teste gratuito de 15 dias, durante o qual estes Termos se aplicam integralmente.</p>
          </Section>

          <Section title="7. Da Propriedade Intelectual">
            <p><strong>7.1</strong> O {SAAS_COMPANY_NAME} e todos os seus componentes são de propriedade exclusiva do {SAAS_COMPANY_NAME}, protegidos pela Lei nº 9.610/1998 e demais normas de propriedade intelectual.</p>
            <p><strong>7.2</strong> A contratação concede uma <strong>licença de uso não exclusiva, intransferível e revogável</strong> para acesso à Plataforma durante a vigência do contrato.</p>
            <p><strong>7.3</strong> Os <strong>dados inseridos pelo Contratante</strong> (dados dos pacientes, procedimentos, financeiro, etc.) pertencem ao Contratante e a seus pacientes. O {SAAS_COMPANY_NAME} não reivindica propriedade sobre esses dados.</p>
          </Section>

          <Section title="8. Da Proteção de Dados Pessoais (LGPD)">
            <p><strong>8.1 Papéis:</strong> O Contratante é o <strong>Controlador</strong> dos dados de seus pacientes. O {SAAS_COMPANY_NAME} é o <strong>Operador</strong>, tratando esses dados apenas conforme instruções do Contratante.</p>
            <p><strong>8.2 Dados Sensíveis:</strong> O {SAAS_COMPANY_NAME} reconhece que fichas de anamnese, prontuários, fotografias de procedimentos e histórico de saúde são dados sensíveis (Art. 5º, II e Art. 11 da LGPD) e adota proteção reforçada.</p>
            <p><strong>8.3</strong> O Contratante é responsável por: definir a base legal para o tratamento; obter os consentimentos necessários; manter sua própria Política de Privacidade para seus pacientes; atender às solicitações de direitos dos titulares em até 15 dias úteis.</p>
            <p><strong>8.4 Vedação absoluta (Art. 11, §4º LGPD):</strong> É proibido o uso dos dados sensíveis de saúde para obtenção de vantagem econômica. O {SAAS_COMPANY_NAME} confirma que nunca realizará tal prática.</p>
            <p><strong>8.5 Contato do Encarregado (DPO):</strong> privacidade@aura-system.com.br</p>
          </Section>

          <Section title="9. Da Segurança e Disponibilidade">
            <p>Medidas de segurança adotadas: criptografia em trânsito (TLS 1.2+) e em repouso (AES-256); controle de acesso baseado em função (RBAC); backups automáticos diários; monitoramento contínuo de anomalias.</p>
            <p><strong>SLA:</strong> Disponibilidade mensal de <strong>99,5%</strong>, excluindo manutenções programadas (com aviso prévio de 48h) e casos de força maior.</p>
          </Section>

          <Section title="10. Da Suspensão e Cancelamento">
            <p><strong>10.1</strong> O Contratante pode cancelar a qualquer momento pelo painel administrativo, com efeito ao final do período pago corrente.</p>
            <p><strong>10.2</strong> O {SAAS_COMPANY_NAME} pode suspender o acesso em caso de inadimplência, violação grave destes Termos ou uso ilícito da Plataforma. Em risco imediato a dados de terceiros, a suspensão pode ser imediata.</p>
          </Section>

          <Section title="11. Da Portabilidade e Encerramento">
            <p><strong>11.1</strong> O Contratante tem direito à portabilidade dos dados em formato legível por máquina (CSV/PDF) a qualquer momento pelo painel administrativo.</p>
            <p><strong>11.2</strong> Após o cancelamento, os dados ficam disponíveis para exportação por <strong>30 dias</strong>. Após esse prazo, o {SAAS_COMPANY_NAME} realiza exclusão segura, mantendo apenas o exigido por lei (dados fiscais: 5 anos; logs: 6 meses — Marco Civil da Internet, Art. 15).</p>
          </Section>

          <Section title="12. Da Limitação de Responsabilidade">
            <p><strong>12.1</strong> A responsabilidade total do {SAAS_COMPANY_NAME} fica limitada ao valor pago pelo Contratante nos <strong>12 meses</strong> anteriores ao evento.</p>
            <p><strong>12.2</strong> O {SAAS_COMPANY_NAME} não se responsabiliza por danos indiretos, lucros cessantes, atos do Contratante que violem a LGPD, conteúdo inserido pelo Contratante, falhas de infraestrutura de terceiros ou eventos de força maior.</p>
          </Section>

          <Section title="13. Das Disposições Gerais">
            <p><strong>Alterações:</strong> Notificação com 30 dias de antecedência. Uso continuado implica aceite.</p>
            <p><strong>Lei Aplicável:</strong> Lei nº 13.709/2018 (LGPD), Lei nº 12.965/2014 (Marco Civil da Internet) e Código de Defesa do Consumidor (Lei nº 8.078/1990), quando aplicável.</p>
            <p><strong>Contato:</strong> contato@aura-system.com.br · privacidade@aura-system.com.br</p>
          </Section>

        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-[#a09890] space-y-2">
          <p>© {new Date().getFullYear()} {SAAS_COMPANY_NAME} · Todos os direitos reservados</p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/politica-de-privacidade" className="text-[#bd7b65] hover:underline">Política de Privacidade</Link>
            <span>·</span>
            <Link to="/login" className="text-[#bd7b65] hover:underline">← Voltar</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUse;
