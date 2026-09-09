import React from 'react';

// Demonstração real do sistema (gravação de tela do admin), em loop.
// Mostra todas as telas principais (Dashboard, Agenda, Pacientes, Procedimentos,
// Financeiro, Relatórios BI, Profissionais) — não é específica por aba do tour,
// então o mesmo GIF é exibido nas 4 abas de funcionalidades.
const LandingDemoPlayer: React.FC<{ tabIndex: number }> = () => (
  <img
    src="/aura-system-demo.gif"
    alt="Demonstração do sistema Aura System em uso real"
    style={{ width: '100%', display: 'block' }}
  />
);

export default LandingDemoPlayer;
