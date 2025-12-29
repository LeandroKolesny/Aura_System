
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Save, Clock, CalendarOff, Trash2, X, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
import { BusinessHours, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';
import { BusinessHoursEditor } from '../components/BusinessHoursEditor';

const BusinessHoursSettings: React.FC = () => {
  const { currentCompany, updateCompany, professionals, addUnavailabilityRule, removeUnavailabilityRule, unavailabilityRules, setHasUnsavedChanges, triggerSave, setTriggerSave, pendingNavigationPath, setPendingNavigationPath } = useApp();
  const navigate = useNavigate();

  // State for Business Hours
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
      monday: { isOpen: true, start: '08:00', end: '18:00' },
      tuesday: { isOpen: true, start: '08:00', end: '18:00' },
      wednesday: { isOpen: true, start: '08:00', end: '18:00' },
      thursday: { isOpen: true, start: '08:00', end: '18:00' },
      friday: { isOpen: true, start: '08:00', end: '18:00' },
      saturday: { isOpen: true, start: '09:00', end: '13:00' },
      sunday: { isOpen: false, start: '00:00', end: '00:00' }
  });

  // States for Unavailability Rules
  const [unavDesc, setUnavDesc] = useState('');
  const [unavStart, setUnavStart] = useState('');
  const [unavEnd, setUnavEnd] = useState('');
  const [unavDateInput, setUnavDateInput] = useState('');
  const [unavSelectedDates, setUnavSelectedDates] = useState<string[]>([]);
  const [unavProfId, setUnavProfId] = useState('');
  const [unavSelectedProfIds, setUnavSelectedProfIds] = useState<string[]>([]);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isLoaded = useRef(false);

  useEffect(() => {
    if (currentCompany && !isLoaded.current) {
        if (currentCompany.businessHours) {
            setBusinessHours(currentCompany.businessHours);
        }
        isLoaded.current = true;
    }
  }, [currentCompany]);

  // Comparação real para saber se houve alteração (Dirty Check)
  useEffect(() => {
      if (isLoaded.current && currentCompany?.businessHours) {
          // Compara o objeto atual com o objeto original vindo do contexto
          const hasChanged = JSON.stringify(businessHours) !== JSON.stringify(currentCompany.businessHours);
          setHasUnsavedChanges(hasChanged);
      }
  }, [businessHours, currentCompany, setHasUnsavedChanges]);

  // Clean up
  useEffect(() => {
      return () => {
          setHasUnsavedChanges(false);
          setTriggerSave(false);
          setPendingNavigationPath(null);
      };
  }, [setHasUnsavedChanges, setTriggerSave, setPendingNavigationPath]);

  const handleSaveHours = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setErrorMsg('');
      setSuccessMsg('');

      if (!currentCompany) return false;

      try {
          updateCompany(currentCompany.id, { businessHours });
          setSuccessMsg('Horários de atendimento atualizados!');
          setHasUnsavedChanges(false);
          setTimeout(() => setSuccessMsg(''), 3000);
          return true;
      } catch (err: any) {
          setErrorMsg(err.message || 'Erro ao salvar horários.');
          return false;
      }
  };

  // External Save Trigger
  useEffect(() => {
      if (triggerSave) {
          const saved = handleSaveHours();
          setTriggerSave(false);
          if (saved && pendingNavigationPath) {
              navigate(pendingNavigationPath);
              setPendingNavigationPath(null);
          }
      }
  }, [triggerSave, pendingNavigationPath, navigate, setTriggerSave, setPendingNavigationPath]);

  // Unavailability Handlers
  const handleAddUnavDate = () => {
      if (unavDateInput && !unavSelectedDates.includes(unavDateInput)) {
          setUnavSelectedDates([...unavSelectedDates, unavDateInput]);
          setUnavDateInput('');
      }
  };

  const handleRemoveUnavDate = (date: string) => {
      setUnavSelectedDates(unavSelectedDates.filter(d => d !== date));
  };

  const handleAddUnavProf = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val && !unavSelectedProfIds.includes(val)) {
          setUnavSelectedProfIds([...unavSelectedProfIds, val]);
      }
      setUnavProfId('');
  };

  const handleRemoveUnavProf = (id: string) => {
      setUnavSelectedProfIds(unavSelectedProfIds.filter(pid => pid !== id));
  };

  const handleAddRule = () => {
      // Se o usuário preencheu o campo de data ou profissional mas esqueceu de clicar no "+",
      // nós adicionamos automaticamente para ele.
      const effectiveDates = [...unavSelectedDates];
      if (unavDateInput && !effectiveDates.includes(unavDateInput)) {
          effectiveDates.push(unavDateInput);
      }

      const effectiveProfs = [...unavSelectedProfIds];
      if (unavProfId && !effectiveProfs.includes(unavProfId)) {
          effectiveProfs.push(unavProfId);
      }

      // Validações
      if (!unavStart || !unavEnd) {
          alert("Por favor, preencha o horário de início e término.");
          return;
      }

      if (effectiveDates.length === 0) {
          alert("Por favor, selecione pelo menos uma data para o bloqueio.");
          return;
      }

      if (effectiveProfs.length === 0) {
          alert("Por favor, selecione 'Toda a Equipe' ou funcionários específicos.");
          return;
      }

      addUnavailabilityRule({
          description: unavDesc || 'Bloqueio de Agenda',
          startTime: unavStart,
          endTime: unavEnd,
          dates: effectiveDates,
          professionalIds: effectiveProfs
      });

      // Reset fields
      setUnavDesc('');
      setUnavStart('');
      setUnavEnd('');
      setUnavDateInput('');
      setUnavSelectedDates([]);
      setUnavProfId('');
      setUnavSelectedProfIds([]);
  };

  const getProfName = (id: string) => {
      if (id === 'all') return 'Toda a Equipe';
      const p = professionals.find(pro => pro.id === id);
      return p ? p.name : 'Desconhecido';
  };

  const formatDateString = (dateStr: string) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="space-y-6 max-w-[1600px] pb-10 relative">
        {/* Toasts */}
        {errorMsg && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-lg animate-fade-in">
                <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center justify-between mx-4">
                    <div className="flex items-center gap-3"><div className="bg-white/20 p-2 rounded-full"><AlertTriangle className="w-6 h-6" /></div><div><p className="font-bold">Atenção</p><p className="text-sm opacity-90">{errorMsg}</p></div></div>
                    <button onClick={() => setErrorMsg('')} className="text-white/70 hover:text-white p-1"><X className="w-5 h-5" /></button>
                </div>
            </div>
        )}
        {successMsg && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-lg animate-fade-in">
                <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center justify-between mx-4">
                    <div className="flex items-center gap-3"><div className="bg-white/20 p-2 rounded-full"><CheckCircle className="w-6 h-6" /></div><div><p className="font-bold">Sucesso</p><p className="text-sm opacity-90">{successMsg}</p></div></div>
                    <button onClick={() => setSuccessMsg('')} className="text-white/70 hover:text-white p-1"><X className="w-5 h-5" /></button>
                </div>
            </div>
        )}

        <div>
            <h1 className="text-2xl font-bold text-slate-900">Horários de Atendimento</h1>
            <p className="text-slate-500">Configure o funcionamento da clínica e bloqueios de agenda.</p>
        </div>

        {/* Business Hours Section */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-white">
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><Clock className="w-5 h-5" /></div>
                <div><h2 className="text-lg font-bold text-slate-800">Horário de Funcionamento</h2><p className="text-xs text-slate-500">Defina os dias e horários de abertura.</p></div>
            </div>
            
            <div className="p-6">
                <BusinessHoursEditor value={businessHours} onChange={setBusinessHours} />
                
                <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
                    <button onClick={handleSaveHours} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm">
                        <Save className="w-4 h-4" /> Salvar Horários
                    </button>
                </div>
            </div>
        </section>

        {/* Unavailability Section */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-white">
                <div className="bg-red-100 p-2 rounded-lg text-red-600"><CalendarOff className="w-5 h-5" /></div>
                <div><h2 className="text-lg font-bold text-slate-800">Indisponibilidades e Bloqueios</h2><p className="text-xs text-slate-500">Bloqueie a agenda para feriados, reuniões ou folgas.</p></div>
            </div>

            <div className="p-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Motivo / Descrição</label>
                            <input type="text" placeholder="Ex: Feriado Nacional" className="w-full p-2 border border-slate-200 rounded-lg bg-white" value={unavDesc} onChange={e => setUnavDesc(e.target.value)} />
                        </div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Início</label><input type="time" className="w-full p-2 border border-slate-200 rounded-lg bg-white" value={unavStart} onChange={e => setUnavStart(e.target.value)} /></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Término</label><input type="time" className="w-full p-2 border border-slate-200 rounded-lg bg-white" value={unavEnd} onChange={e => setUnavEnd(e.target.value)} /></div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Datas</label>
                            <div className="flex gap-2"><input type="date" className="flex-1 p-2 border border-slate-200 rounded-lg bg-white" value={unavDateInput} onChange={e => setUnavDateInput(e.target.value)} /><button type="button" onClick={handleAddUnavDate} className="bg-slate-200 text-slate-700 px-3 rounded-lg hover:bg-slate-300">+</button></div>
                            <div className="flex flex-wrap gap-2 mt-2">{unavSelectedDates.map(date => <span key={date} className="bg-white border text-xs px-2 py-1 rounded-full flex gap-1 items-center">{formatDateString(date)}<button onClick={() => handleRemoveUnavDate(date)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3"/></button></span>)}</div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Funcionários Afetados</label>
                            <select className="w-full p-2 border border-slate-200 rounded-lg bg-white" value={unavProfId} onChange={handleAddUnavProf}>
                                <option value="">Selecione...</option><option value="all">Toda a Equipe</option>
                                {professionals.filter(p => p.role !== UserRole.PATIENT && p.role !== UserRole.RECEPTIONIST).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <div className="flex flex-wrap gap-2 mt-2">{unavSelectedProfIds.map(pid => <span key={pid} className="bg-blue-50 border border-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full flex gap-1 items-center">{getProfName(pid)}<button onClick={() => handleRemoveUnavProf(pid)} className="text-blue-400 hover:text-blue-600"><X className="w-3 h-3"/></button></span>)}</div>
                        </div>
                    </div>
                    <div className="flex justify-end"><button type="button" onClick={handleAddRule} className="bg-secondary-800 hover:bg-secondary-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar Regra</button></div>
                </div>

                <div className="space-y-3">
                    {unavailabilityRules.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Nenhuma regra de bloqueio ativa.</p>}
                    {unavailabilityRules.map(rule => (
                        <div key={rule.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
                            <div className="flex-1">
                                <div className="font-bold text-slate-700 text-sm">{rule.description || 'Bloqueio'} <span className="text-red-500 ml-2 bg-red-50 px-2 py-0.5 rounded text-xs">{rule.startTime} - {rule.endTime}</span></div>
                                <div className="text-xs text-slate-500 mt-1">Datas: {rule.dates.map(d => formatDateString(d)).join(', ')}</div>
                                <div className="text-xs text-slate-400 mt-0.5">Afeta: {rule.professionalIds.includes('all') ? 'Toda a Equipe' : rule.professionalIds.map(id => getProfName(id)).join(', ')}</div>
                            </div>
                            <button type="button" onClick={() => removeUnavailabilityRule(rule.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-slate-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    </div>
  );
};

export default BusinessHoursSettings;
