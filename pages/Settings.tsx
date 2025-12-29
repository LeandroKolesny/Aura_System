
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Save, Building, Clock, ChevronDown, ChevronUp, Plus, Trash2, MapPin, Globe, Facebook, Instagram, Shield, CreditCard, Phone, AlertTriangle, CheckCircle, X, Image as ImageIcon, Upload } from 'lucide-react';
import { UserRole } from '../types';
import { maskCpfCnpj, maskPhone, validateCpfCnpj } from '../utils/maskUtils';
import { useNavigate } from 'react-router-dom';

const Settings: React.FC = () => {
  const { currentCompany, user, updateCompany, setHasUnsavedChanges, triggerSave, setTriggerSave, pendingNavigationPath, setPendingNavigationPath, setIsSubscriptionModalOpen } = useApp();
  const navigate = useNavigate();
  
  // States for Accordions
  const [isProfileOpen, setIsProfileOpen] = useState(true); // Open by default since it's the main section now
  
  // States for Business Profile
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [logo, setLogo] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [presentation, setPresentation] = useState('');
  const [phones, setPhones] = useState<string[]>(['']);
  const [targetAudience, setTargetAudience] = useState({ female: false, male: false, kids: false });
  const [socialMedia, setSocialMedia] = useState({ website: '', facebook: '', instagram: '' });

  // Track if initial load is done to avoid setting dirty state on mount
  const isLoaded = useRef(false);

  useEffect(() => {
    if (currentCompany && !isLoaded.current) {
        setCompanyName(currentCompany.name || '');
        setCompanyAddress(currentCompany.address || '');
        setLogo(currentCompany.logo || '');
        setCnpj(currentCompany.cnpj || '');
        setPresentation(currentCompany.presentation || '');
        setPhones(currentCompany.phones && currentCompany.phones.length > 0 ? currentCompany.phones : ['']);
        setTargetAudience(currentCompany.targetAudience || { female: false, male: false, kids: false });
        setSocialMedia({
            website: currentCompany.socialMedia?.website || '',
            facebook: currentCompany.socialMedia?.facebook || '',
            instagram: currentCompany.socialMedia?.instagram || ''
        });
        
        isLoaded.current = true;
    }
  }, [currentCompany]);

  // Monitor changes to set dirty state
  useEffect(() => {
      if (isLoaded.current) {
          setHasUnsavedChanges(true);
      }
  }, [companyName, companyAddress, logo, cnpj, presentation, phones, targetAudience, socialMedia, setHasUnsavedChanges]);

  // Clean up on unmount
  useEffect(() => {
      return () => {
          setHasUnsavedChanges(false);
          setTriggerSave(false);
          setPendingNavigationPath(null);
      };
  }, [setHasUnsavedChanges, setTriggerSave, setPendingNavigationPath]);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const executeSave = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentCompany) return false;

    try {
        // Filter out empty phones
        const validPhones = phones.filter(p => p.trim() !== '');

        // Validation CPF/CNPJ
        if (cnpj && !validateCpfCnpj(cnpj)) {
             throw new Error('CNPJ/CPF inválido. Verifique os números digitados.');
        }

        updateCompany(currentCompany.id, { 
            name: companyName, 
            address: companyAddress,
            logo,
            cnpj,
            presentation,
            phones: validPhones,
            targetAudience,
            socialMedia
        });
        
        setHasUnsavedChanges(false); // Clear dirty state
        return true;
    } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao salvar configurações.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (executeSave()) {
        setSuccessMsg('Configurações salvas com sucesso!');
        setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Listen for TriggerSave from Sidebar
  useEffect(() => {
      if (triggerSave) {
          const saved = executeSave();
          setTriggerSave(false);
          if (saved && pendingNavigationPath) {
              navigate(pendingNavigationPath);
              setPendingNavigationPath(null);
          }
      }
  }, [triggerSave, pendingNavigationPath, navigate, setTriggerSave, setPendingNavigationPath, executeSave]);

  const handlePhoneChange = (index: number, value: string) => {
      const newPhones = [...phones];
      newPhones[index] = maskPhone(value);
      setPhones(newPhones);
  };

  const addPhone = () => {
      setPhones([...phones, '']);
  };

  const removePhone = (index: number) => {
      const newPhones = phones.filter((_, i) => i !== index);
      setPhones(newPhones.length > 0 ? newPhones : ['']);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setLogo(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  // --- Subscription Logic ---
  const calculateDaysRemaining = () => {
      if (!currentCompany?.subscriptionExpiresAt) return 0;
      const today = new Date();
      const expiration = new Date(currentCompany.subscriptionExpiresAt);
      const diffTime = expiration.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
  };

  const daysRemaining = calculateDaysRemaining();
  const isExpired = daysRemaining === 0;

  if (!currentCompany || !user) return <div>Carregando...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] pb-10 relative">
      {/* ERROR / SUCCESS TOASTS (Fixed Top) */}
      {errorMsg && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-lg animate-fade-in">
              <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center justify-between mx-4">
                  <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-full">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                          <p className="font-bold">Atenção</p>
                          <p className="text-sm opacity-90">{errorMsg}</p>
                      </div>
                  </div>
                  <button onClick={() => setErrorMsg('')} className="text-white/70 hover:text-white p-1">
                      <X className="w-5 h-5" />
                  </button>
              </div>
          </div>
      )}

      {successMsg && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-lg animate-fade-in">
              <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center justify-between mx-4">
                  <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-full">
                          <CheckCircle className="w-6 h-6" />
                      </div>
                      <div>
                          <p className="font-bold">Sucesso</p>
                          <p className="text-sm opacity-90">{successMsg}</p>
                      </div>
                  </div>
                  <button onClick={() => setSuccessMsg('')} className="text-white/70 hover:text-white p-1">
                      <X className="w-5 h-5" />
                  </button>
              </div>
          </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500">Gerencie o perfil do negócio e preferências.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* SECTION 1: PERFIL DO NEGÓCIO */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
           <button 
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 transition-colors"
           >
                <div className="flex items-center gap-3">
                    <div className="bg-primary-100 p-2 rounded-lg text-primary-600">
                        <Building className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-lg font-bold text-slate-800">Perfil do Negócio</h2>
                        <p className="text-xs text-slate-500">Informações públicas, contato e localização.</p>
                    </div>
                </div>
                {isProfileOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
           </button>
           
           {isProfileOpen && (
               <div className="p-6 border-t border-slate-100 animate-fade-in space-y-6">
                  
                  {/* LOGO UPLOAD */}
                  <div className="flex items-start gap-6">
                      <div className="relative group shrink-0">
                          <div className={`w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 ${!logo ? 'hover:bg-slate-100' : ''} transition-colors`}>
                              {logo ? (
                                  <img src={logo} alt="Logo da Clínica" className="w-full h-full object-contain" />
                              ) : (
                                  <div className="text-center text-slate-400">
                                      <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                                      <span className="text-[10px] font-bold uppercase">Logo</span>
                                  </div>
                              )}
                          </div>
                          <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl font-bold text-xs">
                              <Upload className="w-4 h-4 mr-1" /> Alterar
                              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                          </label>
                      </div>
                      <div className="flex-1">
                          <h4 className="font-bold text-slate-800 text-sm">Logotipo da Clínica</h4>
                          <p className="text-xs text-slate-500 mt-1 mb-3">Este logo será exibido na barra lateral do sistema e na página de agendamento online dos seus pacientes. Recomendamos formato PNG com fundo transparente.</p>
                          {logo && (
                              <button type="button" onClick={() => setLogo('')} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                                  <Trash2 className="w-3 h-3" /> Remover Logo
                              </button>
                          )}
                      </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* ... Inputs de Perfil ... */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Negócio</label>
                          <input 
                            type="text" 
                            className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ / CPF</label>
                          <input 
                            type="text" 
                            className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none ${errorMsg && !validateCpfCnpj(cnpj) ? 'border-red-500 ring-red-200 bg-red-50' : 'border-slate-200 focus:ring-primary-500'}`}
                            placeholder="00.000.000/0000-00"
                            value={cnpj}
                            onChange={e => setCnpj(maskCpfCnpj(e.target.value))}
                            maxLength={18}
                          />
                          {errorMsg && !validateCpfCnpj(cnpj) && (
                              <p className="text-xs text-red-500 mt-1 font-bold">Documento inválido</p>
                          )}
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Texto de Apresentação</label>
                      <textarea 
                        rows={3}
                        className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        value={presentation}
                        onChange={e => setPresentation(e.target.value)}
                      />
                  </div>

                  {/* ... Phones ... */}
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                          <span>Telefones de Contato</span>
                          <button type="button" onClick={addPhone} className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-700 font-bold">
                             <Plus className="w-3 h-3" /> Adicionar Telefone
                          </button>
                      </label>
                      <div className="space-y-2">
                          {phones.map((phone, index) => (
                              <div key={index} className="flex gap-2">
                                  <div className="relative flex-1">
                                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                      <input 
                                          type="text" 
                                          className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg"
                                          placeholder="(DDD) 99999-9999"
                                          value={phone}
                                          onChange={e => handlePhoneChange(index, e.target.value)}
                                          maxLength={15}
                                      />
                                  </div>
                                  {phones.length > 1 && (
                                      <button type="button" onClick={() => removePhone(index)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* ... Target Audience & Social ... */}
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Links e Redes Sociais</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="relative">
                              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input type="text" className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg" placeholder="Site" value={socialMedia.website} onChange={e => setSocialMedia({...socialMedia, website: e.target.value})} />
                          </div>
                          <div className="relative">
                              <Facebook className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input type="text" className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg" placeholder="Facebook" value={socialMedia.facebook} onChange={e => setSocialMedia({...socialMedia, facebook: e.target.value})} />
                          </div>
                          <div className="relative">
                              <Instagram className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input type="text" className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg" placeholder="Instagram" value={socialMedia.instagram} onChange={e => setSocialMedia({...socialMedia, instagram: e.target.value})} />
                          </div>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Localização</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" className="w-full pl-9 p-2.5 border border-slate-200 rounded-lg" placeholder="Endereço Completo" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} />
                      </div>
                  </div>
               </div>
           )}
        </section>

        {/* SECTION 4: ASSINATURA (Mantida) */}
        <section className={`bg-slate-50 rounded-xl border border-slate-200 p-6 ${isExpired ? 'border-red-300 bg-red-50' : ''}`}>
           <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${isExpired ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'}`}>
                  <CreditCard className="w-5 h-5" />
              </div>
              <div>
                  <h2 className={`text-lg font-bold ${isExpired ? 'text-red-700' : 'text-slate-800'}`}>Assinatura</h2>
                  {isExpired && <p className="text-xs text-red-600">Seu plano expirou. Renove para continuar.</p>}
              </div>
           </div>
           
           <div className="flex justify-between items-center">
              <div>
                  <p className="text-sm font-medium text-slate-600">Plano Atual</p>
                  <p className={`text-xl font-bold capitalize ${isExpired ? 'text-red-600' : 'text-primary-600'}`}>
                      {currentCompany.plan === 'basic' ? 'Basic (Expirado)' : currentCompany.plan}
                  </p>
                  {daysRemaining > 0 ? (
                      <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {daysRemaining} dias restantes
                      </p>
                  ) : (
                      <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Expirado
                      </p>
                  )}
              </div>
              <button 
                  type="button" 
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm
                      ${isExpired 
                          ? 'bg-red-600 text-white border-red-600 hover:bg-red-700 animate-pulse' 
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}
                  `}
              >
                  {isExpired ? 'Renovar Agora' : 'Gerenciar Assinatura'}
              </button>
           </div>
           <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Ambiente seguro. Gerenciado pelo Aura System.
           </p>
        </section>

        {/* Botão de Salvar (FIXED POSITION AT BOTTOM) */}
        <div className="mt-8 border-t border-slate-200 pt-6 flex justify-end">
            <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg w-full md:w-auto justify-center">
                <Save className="w-5 h-5" /> Salvar Alterações
            </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
