import React, { useState, useEffect } from 'react';
import { Copy, ExternalLink, QrCode, Check, Globe, Eye, Palette, Type, RotateCcw, Save, Layout, ChevronDown, ChevronUp, Clock, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { PublicLayoutConfig, UserRole, OnlineBookingConfig } from '../types';

const AccessLink: React.FC = () => {
  const { currentCompany, updateCompany, user, setHasUnsavedChanges } = useApp();
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  // Accordion States
  const [isScheduleConfigOpen, setIsScheduleConfigOpen] = useState(false);
  const [isLayoutConfigOpen, setIsLayoutConfigOpen] = useState(false);

  // Online Booking Configuration State
  const [onlineConfig, setOnlineConfig] = useState<OnlineBookingConfig>({
      slotInterval: 30,
      minAdvanceTime: 60,
      maxBookingPeriod: 30,
      cancellationNotice: 1440,
      cancellationPolicy: ''
  });

  // Layout Configuration State
  const defaultLayout: PublicLayoutConfig = {
    backgroundColor: '#fdfcfb',
    primaryColor: '#bd7b65',
    textColor: '#1c1917',
    fontFamily: 'inter',
    baseFontSize: 'md',
    cardBackgroundColor: '#ffffff',
    cardTextColor: '#44403c',
    headerBackgroundColor: '#ffffff',
    headerTextColor: '#1c1917'
  };

  // --- PRESETS REFORMULADOS COM FOCO EM LEGIBILIDADE ---
  const STYLE_PRESETS = [
    {
      id: 'aura',
      name: 'Aura Premium',
      preview: '#bd7b65',
      config: {
        backgroundColor: '#fdfcfb',
        primaryColor: '#bd7b65',
        textColor: '#1c1917',
        headerBackgroundColor: '#ffffff',
        headerTextColor: '#1c1917',
        cardBackgroundColor: '#ffffff',
        cardTextColor: '#44403c',
        fontFamily: 'inter' as const // Alterado de serif para inter para melhor visibilidade
      }
    },
    {
      id: 'midnight-gold',
      name: 'Midnight Gold',
      preview: '#d4af37',
      config: {
        backgroundColor: '#0a0a0a',
        primaryColor: '#d4af37',
        textColor: '#ffffff',
        headerBackgroundColor: '#171717',
        headerTextColor: '#ffffff',
        cardBackgroundColor: '#171717',
        cardTextColor: '#e5e5e5',
        fontFamily: 'inter' as const // Alterado de serif para inter para melhor visibilidade
      }
    },
    {
        id: 'silk-nude',
        name: 'Silk Nude',
        preview: '#e5d1c5',
        config: {
          backgroundColor: '#f5ebe0',
          primaryColor: '#8d7b6f',
          textColor: '#2d2a28',
          headerBackgroundColor: '#f5ebe0',
          headerTextColor: '#2d2a28',
          cardBackgroundColor: '#ffffff',
          cardTextColor: '#4a4542',
          fontFamily: 'system' as const
        }
    },
    {
      id: 'medical',
      name: 'Pure Clinic',
      preview: '#2563eb',
      config: {
        backgroundColor: '#ffffff',
        primaryColor: '#2563eb',
        textColor: '#0f172a',
        headerBackgroundColor: '#f8fafc',
        headerTextColor: '#1e293b',
        cardBackgroundColor: '#ffffff',
        cardTextColor: '#334155',
        fontFamily: 'system' as const
      }
    },
    {
      id: 'wellness',
      name: 'Wellness Spa',
      preview: '#15803d',
      config: {
        backgroundColor: '#f5f5f4',
        primaryColor: '#15803d',
        textColor: '#44403c',
        headerBackgroundColor: '#ffffff',
        headerTextColor: '#1c1917',
        cardBackgroundColor: '#ffffff',
        cardTextColor: '#44403c',
        fontFamily: 'inter' as const // Alterado de serif para inter para melhor visibilidade
      }
    }
  ];

  const [layoutConfig, setLayoutConfig] = useState<PublicLayoutConfig>(defaultLayout);
  const [msg, setMsg] = useState('');
  const [configMsg, setConfigMsg] = useState('');

  useEffect(() => {
    if (currentCompany?.layoutConfig) {
        setLayoutConfig({
            ...defaultLayout,
            ...currentCompany.layoutConfig
        });
    }
    if (currentCompany?.onlineBookingConfig) {
        setOnlineConfig(currentCompany.onlineBookingConfig);
    }
  }, [currentCompany]);

  const baseUrl = window.location.origin + window.location.pathname;
  const publicLink = `${baseUrl}#/booking/${currentCompany?.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInternalPreview = () => {
    navigate(`/booking/${currentCompany?.id}`);
  };

  const handleApplyPreset = (presetConfig: any) => {
      setLayoutConfig(prev => ({
          ...prev,
          ...presetConfig
      }));
      setHasUnsavedChanges(true);
  };

  const handleSaveLayout = () => {
      if (currentCompany) {
          updateCompany(currentCompany.id, { layoutConfig });
          setMsg('Layout atualizado com sucesso!');
          setTimeout(() => setMsg(''), 3000);
      }
  };

  const handleResetLayout = () => {
      setLayoutConfig(defaultLayout);
      if (currentCompany) {
          updateCompany(currentCompany.id, { layoutConfig: undefined });
          setMsg('Layout restaurado para o padrão.');
          setTimeout(() => setMsg(''), 3000);
      }
  };

  const handleSaveOnlineConfig = () => {
      if (currentCompany) {
          updateCompany(currentCompany.id, { onlineBookingConfig: onlineConfig });
          setConfigMsg('Configurações de horário salvas!');
          setTimeout(() => setConfigMsg(''), 3000);
      }
  };

  const canEditLayout = user?.role === UserRole.ADMIN || user?.role === UserRole.OWNER;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agenda Online</h1>
        <p className="text-slate-500">
          Configure como seus pacientes visualizam e agendam horários pelo link público.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary-100 p-3 rounded-full text-primary-600">
              <Globe className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Link de Agendamento</h2>
          </div>
          
          <p className="text-slate-500 mb-4 text-sm">
            Copie o link abaixo e adicione na bio do Instagram ou envie por WhatsApp.
          </p>

          <div className="flex gap-2 mb-6">
            <input 
              type="text" 
              readOnly 
              value={publicLink}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-600 text-sm focus:outline-none"
            />
            <button 
              onClick={handleCopy}
              className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2
                ${copied ? 'bg-green-600 text-white' : 'bg-secondary-900 text-white hover:bg-black'}
              `}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
                onClick={handleInternalPreview}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-medium hover:bg-primary-100 transition-colors"
            >
                <Eye className="w-4 h-4" /> Visualizar Agora (Teste)
            </button>
            
            <a 
                href={`#/booking/${currentCompany?.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
            >
                <ExternalLink className="w-4 h-4" /> Abrir Nova Aba
            </a>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">Use o botão "Visualizar Agora" se estiver no editor de código.</p>
        </div>

        <div className="bg-gradient-to-br from-primary-600 to-secondary-900 rounded-xl shadow-2xl p-8 text-white relative overflow-hidden flex flex-col items-center justify-center text-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <QrCode className="w-32 h-32 text-white mb-6 opacity-90" />
            <h3 className="text-xl font-serif font-bold mb-2">Seu Portal de Pacientes</h3>
            <p className="text-white/70 text-sm max-w-xs mx-auto mb-6">
                Seus pacientes verão uma página exclusiva com sua marca para escolher serviços e horários.
            </p>
            <div className="px-4 py-1.5 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                Aura Booking
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          <div 
              className="p-6 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setIsScheduleConfigOpen(!isScheduleConfigOpen)}
          >
              <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                      <Clock className="w-5 h-5" />
                  </div>
                  <div>
                      <h3 className="font-bold text-slate-900">Configurações de Horários dos Clientes</h3>
                      <p className="text-sm text-slate-500">Defina regras de intervalo, antecedência e cancelamento.</p>
                  </div>
              </div>
              <div className="text-slate-400">
                  {isScheduleConfigOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
          </div>

          {isScheduleConfigOpen && (
              <div className="p-6 bg-slate-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Intervalo de Horários</label>
                          <select 
                              className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                              value={onlineConfig.slotInterval}
                              onChange={(e) => setOnlineConfig({...onlineConfig, slotInterval: Number(e.target.value)})}
                          >
                              <option value={10}>de 10 em 10 minutos</option>
                              <option value={15}>de 15 em 15 minutos</option>
                              <option value={30}>de 30 em 30 minutos</option>
                              <option value={60}>A cada 1 hora</option>
                          </select>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Tempo de Antecedência Mínimo</label>
                          <select 
                              className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                              value={onlineConfig.minAdvanceTime}
                              onChange={(e) => setOnlineConfig({...onlineConfig, minAdvanceTime: Number(e.target.value)})}
                          >
                              <option value={60}>1 hora antes</option>
                              <option value={1440}>24 hora antes</option>
                          </select>
                      </div>
                  </div>
                  <div className="flex justify-end items-center pt-4">
                      {configMsg && <span className="text-green-600 font-medium text-sm mr-4 animate-fade-in flex items-center gap-1"><Check className="w-4 h-4" /> {configMsg}</span>}
                      <button 
                          onClick={handleSaveOnlineConfig}
                          className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-all text-sm"
                      >
                          <Save className="w-4 h-4" /> Salvar Regras
                      </button>
                  </div>
              </div>
          )}
      </div>

      {canEditLayout && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            <div 
                className="p-6 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsLayoutConfigOpen(!isLayoutConfigOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-secondary-100 p-2 rounded-lg text-secondary-600">
                        <Palette className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Configurar Layout de Acesso Público</h3>
                        <p className="text-sm text-slate-500">Personalize a aparência da página de agendamento.</p>
                    </div>
                </div>
                <div className="text-slate-400">
                    {isLayoutConfigOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
            </div>
            
            {isLayoutConfigOpen && (
                <>
                    <div className="p-8 bg-slate-50 border-b border-slate-100">
                        <div className="max-w-3xl mx-auto text-center">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center justify-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" /> Estilos Prontos (Presets de Luxo)
                            </h4>
                            <div className="flex flex-wrap justify-center gap-4">
                                {STYLE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleApplyPreset(preset.config)}
                                        className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-3 hover:border-primary-500 hover:shadow-xl hover:-translate-y-1 transition-all group w-32"
                                    >
                                        <div 
                                            className="w-12 h-12 rounded-full border border-white/50 shadow-inner group-hover:scale-110 transition-transform relative overflow-hidden"
                                            style={{ backgroundColor: preset.preview }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{preset.name}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-6 italic">Selecione um estilo para atualizar as cores automaticamente.</p>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/30">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cor de Fundo Página</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={layoutConfig.backgroundColor} onChange={(e) => { setLayoutConfig({...layoutConfig, backgroundColor: e.target.value}); setHasUnsavedChanges(true); }} className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 shadow-sm" />
                                <input type="text" value={layoutConfig.backgroundColor} onChange={(e) => { setLayoutConfig({...layoutConfig, backgroundColor: e.target.value}); setHasUnsavedChanges(true); }} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm uppercase" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cor Principal (Destaque)</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={layoutConfig.primaryColor} onChange={(e) => { setLayoutConfig({...layoutConfig, primaryColor: e.target.value}); setHasUnsavedChanges(true); }} className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 shadow-sm" />
                                <input type="text" value={layoutConfig.primaryColor} onChange={(e) => { setLayoutConfig({...layoutConfig, primaryColor: e.target.value}); setHasUnsavedChanges(true); }} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm uppercase" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cor do Texto Principal</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={layoutConfig.textColor || '#1e293b'} onChange={(e) => { setLayoutConfig({...layoutConfig, textColor: e.target.value}); setHasUnsavedChanges(true); }} className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 shadow-sm" />
                                <input type="text" value={layoutConfig.textColor || '#1e293b'} onChange={(e) => { setLayoutConfig({...layoutConfig, textColor: e.target.value}); setHasUnsavedChanges(true); }} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm uppercase" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cor Fundo Cabeçalho</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={layoutConfig.headerBackgroundColor || '#ffffff'} onChange={(e) => { setLayoutConfig({...layoutConfig, headerBackgroundColor: e.target.value}); setHasUnsavedChanges(true); }} className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 shadow-sm" />
                                <input type="text" value={layoutConfig.headerBackgroundColor || '#ffffff'} onChange={(e) => { setLayoutConfig({...layoutConfig, headerBackgroundColor: e.target.value}); setHasUnsavedChanges(true); }} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm uppercase" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Fonte</label>
                            <select 
                                value={layoutConfig.fontFamily}
                                onChange={(e) => { setLayoutConfig({...layoutConfig, fontFamily: e.target.value as any}); setHasUnsavedChanges(true); }}
                                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-sm"
                            >
                                <option value="serif">Luxuosa (Serifada)</option>
                                <option value="inter">Moderna (Sans)</option>
                                <option value="system">Clean (System)</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
                        <button onClick={handleResetLayout} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"><RotateCcw className="w-3 h-3" /> Resetar</button>
                        <div className="flex items-center gap-4">
                            {msg && <span className="text-green-600 font-medium text-sm flex items-center gap-1 animate-fade-in"><Check className="w-4 h-4" /> {msg}</span>}
                            <button onClick={handleSaveLayout} className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-primary-200 transition-all">Salvar Design</button>
                        </div>
                    </div>
                </>
            )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
         <h3 className="font-bold text-slate-900 mb-4">Como usar seu link?</h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">1</div>
                 <p className="text-sm text-slate-600">Copie o link acima e coloque no botão "Agendar" do seu perfil no Instagram.</p>
             </div>
             <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">2</div>
                 <p className="text-sm text-slate-600">O paciente acessa, escolhe o procedimento e o horário.</p>
             </div>
             <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">3</div>
                 <p className="text-sm text-slate-600">Você recebe uma notificação para aprovar o agendamento.</p>
             </div>
         </div>
      </div>
    </div>
  );
};

export default AccessLink;