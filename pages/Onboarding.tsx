
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Syringe, Clock, Check, ChevronRight, ChevronLeft, Upload, Building, Palette, Image as ImageIcon, DollarSign } from 'lucide-react';
import AuraLogo from '../components/AuraLogo';
import { BusinessHours, DaySchedule } from '../types';

const Onboarding: React.FC = () => {
  const { addProcedure, updateCompany, currentCompany, completeOnboarding, setupGoogleCompany } = useApp();
  const navigate = useNavigate();
  const needsCompany = !currentCompany;
  const [step, setStep] = useState(needsCompany ? 0 : 1);

  // Step 1: Service
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('60');

  // Step 2: Hours
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
      monday: { isOpen: true, start: '08:00', end: '18:00' },
      tuesday: { isOpen: true, start: '08:00', end: '18:00' },
      wednesday: { isOpen: true, start: '08:00', end: '18:00' },
      thursday: { isOpen: true, start: '08:00', end: '18:00' },
      friday: { isOpen: true, start: '08:00', end: '18:00' },
      saturday: { isOpen: true, start: '09:00', end: '13:00' },
      sunday: { isOpen: false, start: '00:00', end: '00:00' }
  });

  // Step 3: Details
  const [logo, setLogo] = useState('');
  const [themeColor, setThemeColor] = useState('#bd7b65');
  const [industry, setIndustry] = useState('Estética');

  // Step 0 state (for Google-registered admins without a company)
  const [setupCompanyName, setSetupCompanyName] = useState('');
  const [setupState, setSetupState] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [awaitingCompany, setAwaitingCompany] = useState(false);

  useEffect(() => {
    if (awaitingCompany && currentCompany) {
      setAwaitingCompany(false);
      setStep(1);
    }
  }, [currentCompany, awaitingCompany]);

  const handleNextStep1 = () => {
      if (serviceName && servicePrice) {
          addProcedure({
              name: serviceName,
              price: Number(servicePrice),
              durationMinutes: Number(serviceDuration),
              cost: 0
          });
          setStep(2);
      } else {
          alert('Por favor, preencha o nome e o valor do serviço.');
      }
  };

  const handleDayChange = (day: keyof BusinessHours, field: keyof DaySchedule, value: any) => {
      setBusinessHours(prev => ({
          ...prev,
          [day]: { ...prev[day], [field]: value }
      }));
  };

  const handleNextStep2 = () => {
      if (currentCompany) {
          updateCompany(currentCompany.id, { businessHours });
      }
      setStep(3);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => { setLogo(reader.result as string); };
          reader.readAsDataURL(file);
      }
  };

  const handleFinish = () => {
      if (currentCompany) {
          updateCompany(currentCompany.id, { 
              logo,
              layoutConfig: { 
                  ...currentCompany.layoutConfig, 
                  primaryColor: themeColor,
                  backgroundColor: '#f8fafc',
                  fontFamily: 'inter',
                  baseFontSize: 'md'
              } as any
          });
          completeOnboarding();
          navigate('/dashboard');
      }
  };

  const handleCreateCompany = async () => {
    if (!setupCompanyName.trim()) {
      setSetupError('Nome da clínica é obrigatório.');
      return;
    }
    setSetupLoading(true);
    setSetupError('');
    const result = await setupGoogleCompany(setupCompanyName.trim(), setupState || undefined, setupPhone || undefined);
    if (!result.success) {
      setSetupError(result.error || 'Erro ao criar empresa. Tente novamente.');
      setSetupLoading(false);
      return;
    }
    setAwaitingCompany(true);
    setSetupLoading(false);
  };

  const dayLabels: Record<keyof BusinessHours, string> = {
      monday: 'Segunda-feira',
      tuesday: 'Terça-feira',
      wednesday: 'Quarta-feira',
      thursday: 'Quinta-feira',
      friday: 'Sexta-feira',
      saturday: 'Sábado',
      sunday: 'Domingo'
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-100 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary-100 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2"></div>

        <div className="max-w-2xl w-full relative z-10">
            <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                    <AuraLogo className="w-16 h-16" />
                </div>
                <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">Vamos começar!</h1>
                <p className="text-slate-500">Configure sua clínica em 3 passos simples.</p>
            </div>

            {/* Steps Indicator */}
            <div className="flex justify-center gap-2 mb-8">
                {step > 0 && [1, 2, 3].map((i) => (
                    <div key={i} className={`h-1 w-12 rounded-full transition-colors ${step >= i ? 'bg-primary-600' : 'bg-slate-200'}`}></div>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in">
                
                {/* STEP 0: CREATE COMPANY (Google-registered admins) */}
                {step === 0 && (
                  <div className="p-8">
                    <div className="space-y-5">
                      <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Bem-vindo(a) ao Aura!</h2>
                        <p className="text-slate-500 text-sm mt-1">Para começar, nos conte sobre sua clínica.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome da Clínica *</label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
                          placeholder="Ex: Studio Bella Estética"
                          value={setupCompanyName}
                          onChange={(e) => setSetupCompanyName(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Estado</label>
                          <select
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
                            value={setupState}
                            onChange={(e) => setSetupState(e.target.value)}
                          >
                            <option value="">Selecione</option>
                            {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                              <option key={uf} value={uf}>{uf}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Celular</label>
                          <input
                            type="tel"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
                            placeholder="(99) 99999-9999"
                            value={setupPhone}
                            onChange={(e) => setSetupPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      {setupError && (
                        <p className="text-red-600 text-sm">{setupError}</p>
                      )}

                      <button
                        onClick={handleCreateCompany}
                        disabled={setupLoading}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        {setupLoading ? 'Criando...' : 'Continuar'}
                        {!setupLoading && <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 1: SERVICE */}
                {step === 1 && (
                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center"><Syringe className="w-5 h-5" /></div>
                            <h2 className="text-xl font-bold text-slate-800">Adicione seu primeiro serviço</h2>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Procedimento</label>
                                <input type="text" className="w-full p-3 border rounded-xl" placeholder="Ex: Harmonização Facial" value={serviceName} onChange={e => setServiceName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input type="number" className="w-full pl-9 p-3 border rounded-xl" placeholder="0.00" value={servicePrice} onChange={e => setServicePrice(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Duração (min)</label>
                                    <div className="relative">
                                        <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input type="number" className="w-full pl-9 p-3 border rounded-xl" placeholder="60" value={serviceDuration} onChange={e => setServiceDuration(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleNextStep1} className="w-full mt-8 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                            Salvar e Continuar <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* STEP 2: HOURS */}
                {step === 2 && (
                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div>
                            <h2 className="text-xl font-bold text-slate-800">Defina seu horário de trabalho</h2>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">Você poderá personalizar isso mais tarde nas configurações.</p>
                        
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {(Object.keys(dayLabels) as Array<keyof BusinessHours>).map(day => (
                                <div key={day} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                                    <div className="flex items-center gap-3 w-32">
                                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input type="checkbox" name={`toggle-${day}`} id={`toggle-${day}`} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer" checked={businessHours[day].isOpen} onChange={(e) => handleDayChange(day, 'isOpen', e.target.checked)}/>
                                            <label htmlFor={`toggle-${day}`} className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${businessHours[day].isOpen ? 'bg-primary-500' : 'bg-slate-300'}`}></label>
                                        </div>
                                        <span className="text-sm font-medium text-slate-700">{dayLabels[day].split('-')[0]}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="time" className={`p-1 border border-slate-200 rounded text-xs w-20 text-center ${!businessHours[day].isOpen && 'opacity-50 bg-slate-100'}`} value={businessHours[day].start} onChange={(e) => handleDayChange(day, 'start', e.target.value)} disabled={!businessHours[day].isOpen} />
                                        <span className="text-slate-400 text-xs">às</span>
                                        <input type="time" className={`p-1 border border-slate-200 rounded text-xs w-20 text-center ${!businessHours[day].isOpen && 'opacity-50 bg-slate-100'}`} value={businessHours[day].end} onChange={(e) => handleDayChange(day, 'end', e.target.value)} disabled={!businessHours[day].isOpen} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setStep(1)} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors">Voltar</button>
                            <button onClick={handleNextStep2} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                                Próximo <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: DETAILS */}
                {step === 3 && (
                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building className="w-5 h-5" /></div>
                            <h2 className="text-xl font-bold text-slate-800">Detalhes Finais</h2>
                        </div>

                        <div className="space-y-6">
                            {/* Industry */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Qual é o seu ramo?</label>
                                <select className="w-full p-3 border rounded-xl bg-white" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                                    <option>Estética Facial e Corporal</option>
                                    <option>Dermatologia</option>
                                    <option>Odontologia Estética</option>
                                    <option>Salão de Beleza / Spa</option>
                                    <option>Outros</option>
                                </select>
                            </div>

                            {/* Theme Color */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Cor da sua marca (Sistema)</label>
                                <div className="flex gap-3">
                                    {['#bd7b65', '#be185d', '#0f766e', '#1e40af', '#4338ca', '#000000'].map(color => (
                                        <button 
                                            key={color} 
                                            onClick={() => setThemeColor(color)}
                                            className={`w-8 h-8 rounded-full border-2 transition-transform ${themeColor === color ? 'border-slate-400 scale-110 shadow-md' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <div className="relative">
                                        <input type="color" className="w-8 h-8 opacity-0 absolute inset-0 cursor-pointer" value={themeColor} onChange={e => setThemeColor(e.target.value)} />
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 via-green-500 to-blue-500 border border-slate-200 flex items-center justify-center"><Palette className="w-4 h-4 text-white drop-shadow-md" /></div>
                                    </div>
                                </div>
                            </div>

                            {/* Logo Upload */}
                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors relative">
                                {logo ? (
                                    <img src={logo} alt="Logo Preview" className="h-20 object-contain mb-2" />
                                ) : (
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                                        <ImageIcon className="w-8 h-8" />
                                    </div>
                                )}
                                <p className="text-sm font-medium text-slate-600">{logo ? 'Clique para trocar' : 'Inserir Logotipo'}</p>
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleLogoUpload} />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setStep(2)} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors">Voltar</button>
                            <button onClick={handleFinish} className="flex-1 bg-secondary-900 hover:bg-black text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg">
                                <Check className="w-4 h-4" /> Finalizar Cadastro
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
        
        <style>{`
            .toggle-checkbox:checked {
                right: 0;
                border-color: #bd7b65;
            }
            .toggle-checkbox:checked + .toggle-label {
                background-color: #bd7b65;
            }
        `}</style>
    </div>
  );
};

export default Onboarding;
