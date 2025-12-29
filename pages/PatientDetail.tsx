import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, Image as ImageIcon, Sparkles, Share2, CheckCircle, MessageCircle, Maximize2, Trash2, X, AlertTriangle, Clock, Plus, Edit, Save, PenTool, Shield, Info, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { summarizeAnamnesis, generateFollowUpMessage } from '../services/geminiService';
import { NewPhotoModal, SignatureModal } from '../components/Modals';
import { PhotoRecord, Patient, Appointment } from '../types';
import { maskPhone, validateBirthDate } from '../utils/maskUtils';
import { formatDate, formatDateTime, formatCurrency } from '../utils/formatUtils';

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { patients, updatePatient, toggleConsent, signConsent, toggleAnamnesisSent, currentCompany, photos, removePhoto, appointments, isReadOnly } = useApp();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'anamnesis' | 'photos'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Patient>>({});
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  
  // Estado para o Admin visualizar a evidência de uma assinatura específica
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    if (location.state && location.state.editMode && !isReadOnly) {
        setIsEditing(true);
        window.history.replaceState({}, document.title);
    }
  }, [location, isReadOnly]);

  const [photoModalConfig, setPhotoModalConfig] = useState<{
    isOpen: boolean;
    initialType: 'before' | 'after';
    initialProcedure: string;
    lockFields: boolean;
    initialGroupId?: string;
  }>({ isOpen: false, initialType: 'before', initialProcedure: '', lockFields: false });

  const [viewingPhoto, setViewingPhoto] = useState<PhotoRecord | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);

  const patient = patients.find(p => p.id === id);

  useEffect(() => {
      if (patient) {
          setEditData({
              name: patient.name,
              phone: patient.phone,
              email: patient.email,
              birthDate: patient.birthDate,
              status: patient.status
          });
      }
  }, [patient]);

  const patientPhotos = photos.filter(p => p.patientId === id);

  const photosByProcedure = useMemo(() => {
    // Agrupa fotos por procedimento e depois por groupId para manter os Antes/Depois vinculados
    return patientPhotos.reduce((acc, photo) => {
      const proc = photo.procedure;
      const gid = photo.groupId || 'default';
      
      if (!acc[proc]) acc[proc] = {};
      if (!acc[proc][gid]) acc[proc][gid] = { before: undefined, after: undefined };
      
      acc[proc][gid][photo.type] = photo;
      return acc;
    }, {} as Record<string, Record<string, { before?: PhotoRecord; after?: PhotoRecord }>>);
  }, [patientPhotos]);

  const patientAppointments = appointments
    .filter(a => a.patientId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // EXTRAÇÃO DINÂMICA: Lista de procedimentos que o paciente já realizou na clínica
  const availableProceduresList = useMemo(() => {
    const uniqueProcs = new Set(patientAppointments.map(a => a.service));
    return Array.from(uniqueProcs).sort();
  }, [patientAppointments]);

  const [anamnesisText, setAnamnesisText] = useState(
    "Paciente relata desconforto com linhas de expressão na região frontal. Histórico de aplicação de toxina há 8 meses."
  );
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [followUpMsg, setFollowUpMsg] = useState<string | null>(null);
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false);

  if (!patient) return <div className="p-6 text-slate-500 italic">Paciente não encontrado</div>;

  const handleGenerateSummary = async () => {
    if (isReadOnly) return;
    setIsGeneratingSummary(true);
    const result = await summarizeAnamnesis(anamnesisText);
    setSummary(result);
    setIsGeneratingSummary(false);
  };

  const handleGenerateFollowUp = async () => {
    if (isReadOnly) return;
    setIsGeneratingMsg(true);
    const clinicName = currentCompany?.name || "Clínica de Estética";
    const result = await generateFollowUpMessage(patient.name, "Procedimento Estético", clinicName);
    setFollowUpMsg(result);
    setIsGeneratingMsg(false);
  };

  const handleSendFollowUp = () => {
    if (isReadOnly) return;
    if (!followUpMsg || !patient.phone) return;
    const phone = patient.phone.replace(/\D/g, '');
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(followUpMsg)}`;
    window.open(url, '_blank');
  };

  const sendAnamnesisLink = () => {
    if (isReadOnly) return;
    const message = `Olá ${patient.name}, por favor preencha sua ficha de anamnese antes da consulta: https://aura.app/anamnesis/${patient.id}`;
    const url = `https://wa.me/55${patient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    toggleAnamnesisSent(patient.id);
  };

  const confirmDeletePhoto = () => {
    if (isReadOnly) return;
    if (photoToDelete) {
      removePhoto(photoToDelete);
      if (viewingPhoto?.id === photoToDelete) setViewingPhoto(null);
      setPhotoToDelete(null);
    }
  };

  const openPhotoModal = (type: 'before' | 'after', procedure: string = '', lock: boolean = false, groupId: string = '') => {
    if (isReadOnly) return;
    setPhotoModalConfig({ 
        isOpen: true, 
        initialType: type, 
        initialProcedure: procedure, 
        lockFields: lock,
        initialGroupId: groupId
    });
  };

  const handleSaveEdit = () => {
      if (isReadOnly) return;
      if (editData.birthDate && !validateBirthDate(editData.birthDate)) {
          alert("Data de nascimento inválida. Verifique o ano.");
          return;
      }
      updatePatient(patient.id, editData);
      setIsEditing(false);
  };

  const handleSignatureSave = (base64: string) => {
      if (patient) signConsent(patient.id, base64);
  };

  const getFriendlyDeviceInfo = (ua?: string) => {
    if (!ua) return 'Desconhecido';
    let browser = 'Navegador';
    if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Google Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
    else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
    
    let os = 'Sistema';
    if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone')) os = 'iOS';
    return `${browser} no ${os}`;
  };

  const AppointmentEvidenceModal = ({ appointment, onClose }: { appointment: Appointment, onClose: () => void }) => (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-primary-50 p-2 rounded-lg text-primary-600">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-xl text-slate-900 uppercase tracking-tight">Comprovante Digital</h3>
                        <p className="text-sm text-slate-500">{appointment.service} • {formatDate(appointment.date)}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                    <X className="w-6 h-6" />
                </button>
            </div>
            <div className="p-8 bg-slate-50 space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Assinatura Coletada</p>
                    <div className="border border-slate-100 rounded-lg p-4 mb-4 flex items-center justify-center bg-slate-50/50 min-h-[120px]">
                        <img src={appointment.signatureUrl} alt="Assinatura" className="h-24 object-contain" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">ID Registro: {appointment.id}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-500" /> Metadados de Auditoria
                    </h4>
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                            <span className="text-slate-500">Data/Hora exata</span>
                            <span className="font-bold text-slate-700">{formatDateTime(appointment.signatureMetadata?.signedAt)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-slate-50 pb-2">
                            <span className="text-slate-500">Endereço IP</span>
                            <span className="font-bold text-slate-700 font-mono">{appointment.signatureMetadata?.ipAddress}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Navegador/Sistema</span>
                            <span className="font-bold text-slate-700 truncate ml-4 max-w-[250px]">{getFriendlyDeviceInfo(appointment.signatureMetadata?.userAgent)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                <button onClick={onClose} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-colors shadow-lg">Fechar Documento</button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="space-y-6 mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
        {isEditing ? (
            <div className="w-full">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h2 className="text-lg font-bold text-slate-800">Editar Paciente</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="text-sm text-slate-500 px-3 py-1">Cancelar</button>
                        <button onClick={handleSaveEdit} className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg flex items-center gap-2 hover:bg-primary-700">
                            <Save className="w-4 h-4" /> Salvar
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" className="w-full p-2 border rounded-lg text-sm" placeholder="Nome" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                    <select className="w-full p-2 border rounded-lg text-sm bg-white" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value as any})}>
                        <option value="active">Ativo</option><option value="lead">Lead</option><option value="inactive">Inativo</option>
                    </select>
                </div>
            </div>
        ) : (
            <>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
                        {patient.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
                        <div className="flex wrap gap-3 mt-1 text-sm text-slate-500 items-center">
                            <span>{formatDate(patient.birthDate)}</span>
                            <span>•</span>
                            <span>{patient.phone}</span>
                            <button onClick={() => setIsEditing(true)} className="p-1 text-slate-400 hover:text-primary-600"><Edit className="w-3 h-3" /></button>
                        </div>
                    </div>
                </div>
                {!patient.anamnesisLinkSent ? (
                    <button onClick={sendAnamnesisLink} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" /> Solicitar Anamnese
                    </button>
                ) : (
                    <span className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-bold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Anamnese Solicitada
                    </span>
                )}
            </>
        )}
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {['overview', 'anamnesis', 'photos'].map((t) => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${activeTab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t === 'overview' ? 'Visão Geral' : t === 'anamnesis' ? 'Prontuário & IA' : 'Fotos Antes/Depois'}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Shield className="w-5 h-5 text-slate-600" /> Consentimento Geral (LGPD)</h3>
                  {patient.consentSignedAt ? (
                    <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Assinado em {formatDate(patient.consentSignedAt)}</span>
                  ) : (
                    <button onClick={() => setIsSignatureModalOpen(true)} className="text-xs px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-black">Assinar Digitalmente</button>
                  )}
                </div>
                {!patient.consentSignedAt && <p className="text-sm text-slate-500">O termo de consentimento está pendente.</p>}
                {patient.consentSignatureUrl && <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-center"><img src={patient.consentSignatureUrl} alt="Assinatura" className="h-16 object-contain" /></div>}
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4">Histórico de Procedimentos</h3>
                {patientAppointments.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {patientAppointments.map(appt => (
                      <div key={appt.id} className="py-4 flex items-center justify-between group transition-colors">
                         <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-lg ${appt.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>{appt.status === 'completed' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}</div>
                           <div><p className="font-bold text-slate-900 text-sm">{appt.service}</p><p className="text-xs text-slate-500">{formatDate(appt.date)} • {appt.professionalName}</p></div>
                         </div>
                         <div className="flex items-center gap-4">
                            {appt.signatureUrl && <button onClick={() => setViewingAppointment(appt)} className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-lg border border-green-100 hover:bg-green-100 transition-all shadow-sm"><Shield className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase">Assinado</span><Eye className="w-3 h-3 ml-0.5" /></button>}
                            <div className="text-right"><span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${appt.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{appt.status === 'completed' ? 'Concluído' : 'Agendado'}</span><p className="text-xs text-slate-400 mt-1 font-medium">{formatCurrency(appt.price)}</p></div>
                         </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-sm text-slate-400 italic p-4 text-center">Nenhum agendamento encontrado.</div>}
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 text-white shadow-lg">
                 <h3 className="font-bold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Aura Assistant</h3>
                 <p className="text-sm opacity-90 mb-4">Pós-venda e retenção inteligente.</p>
                 {!followUpMsg ? (
                   <button onClick={handleGenerateFollowUp} disabled={isGeneratingMsg} className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-bold transition-all">{isGeneratingMsg ? 'Processando IA...' : 'Gerar Mensagem WhatsApp'}</button>
                 ) : (
                   <div className="bg-white/10 rounded-lg p-3 text-sm mb-3">
                     <p className="italic mb-3">"{followUpMsg}"</p>
                     <button onClick={handleSendFollowUp} className="w-full bg-green-500 hover:bg-green-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"><Share2 className="w-3 h-3" /> Enviar Agora</button>
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'anamnesis' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h3 className="font-bold text-slate-800 mb-4">Anotações do Prontuário</h3>
              <textarea className="w-full h-64 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none text-sm leading-relaxed" value={anamnesisText} onChange={(e) => setAnamnesisText(e.target.value)} />
              <div className="mt-4 flex justify-end"><button className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold">Salvar</button></div>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 h-fit">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-500" /> Resumo Inteligente (IA)</h3>
                <button onClick={handleGenerateSummary} disabled={isGeneratingSummary} className="text-xs font-bold px-3 py-1 rounded-full bg-primary-100 text-primary-700">{isGeneratingSummary ? 'Gerando...' : 'Gerar Resumo'}</button>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-100 text-sm text-slate-600 min-h-[150px]">{summary ? <p>{summary}</p> : <p className="text-slate-400 italic text-center mt-10">Clique para processar o histórico com IA.</p>}</div>
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Evolução de Procedimentos</h3>
              <button onClick={() => openPhotoModal('before')} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Procedimento</button>
            </div>
            
            {Object.entries(photosByProcedure).map(([procName, setsByGroupId]) => (
                <div key={procName} className="bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-800">
                    <h4 className="text-white font-serif text-2xl mb-8 border-b border-white/10 pb-4">{procName}</h4>
                    
                    <div className="space-y-12">
                        {Object.entries(setsByGroupId).map(([groupId, setPhotos]) => (
                            <div key={groupId} className="animate-fade-in group/set">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="bg-white/10 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Conjunto: {groupId.split('_')[1] || '01'}</span>
                                    {!setPhotos.after && setPhotos.before && (
                                        <button 
                                            onClick={() => openPhotoModal('after', procName, true, groupId)} 
                                            className="text-[10px] font-bold px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-green-900/20"
                                        >
                                            <Plus className="w-3 h-3" /> Adicionar Resultado (Depois)
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Slot Antes */}
                                    <div className="relative group">
                                        <span className="absolute top-4 left-4 z-10 bg-black/60 text-white px-3 py-1 rounded text-[10px] font-bold uppercase backdrop-blur-md border border-white/10">Antes</span>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 rounded-lg z-20">
                                            <button onClick={() => setViewingPhoto(setPhotos.before!)} className="p-3 bg-white rounded-full text-slate-900 hover:scale-110 transition-transform"><Maximize2 className="w-6 h-6" /></button>
                                            <button onClick={() => setPhotoToDelete(setPhotos.before!.id)} className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"><Trash2 className="w-6 h-6" /></button>
                                        </div>
                                        {setPhotos.before ? (
                                            <img src={setPhotos.before.url} className="w-full h-80 object-cover rounded-lg border-2 border-slate-700 shadow-2xl" alt="Antes" />
                                        ) : (
                                            <div className="h-80 rounded-lg bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/30 italic"><AlertTriangle className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm">Registro ausente</p></div>
                                        )}
                                    </div>

                                    {/* Slot Depois */}
                                    <div className="relative group">
                                        <span className="absolute top-4 left-4 z-10 bg-green-500/80 text-white px-3 py-1 rounded text-[10px] font-bold uppercase backdrop-blur-md border border-white/10">Depois</span>
                                        {setPhotos.after ? (
                                            <>
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 rounded-lg z-20">
                                                    <button onClick={() => setViewingPhoto(setPhotos.after!)} className="p-3 bg-white rounded-full text-slate-900 hover:scale-110 transition-transform"><Maximize2 className="w-6 h-6" /></button>
                                                    <button onClick={() => setPhotoToDelete(setPhotos.after!.id)} className="p-3 bg-red-50 text-white rounded-full hover:scale-110 transition-transform"><Trash2 className="w-6 h-6" /></button>
                                                </div>
                                                <img src={setPhotos.after.url} className="w-full h-80 object-cover rounded-lg border-2 border-slate-700 shadow-2xl" alt="Depois" />
                                            </>
                                        ) : (
                                            <div className="h-80 rounded-lg bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/30 italic"><ImageIcon className="w-10 h-10 mb-2 opacity-10" /><p className="text-sm">Aguardando resultado</p></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {viewingAppointment && <AppointmentEvidenceModal appointment={viewingAppointment} onClose={() => setViewingAppointment(null)} />}
      {isSignatureModalOpen && <SignatureModal onClose={() => setIsSignatureModalOpen(false)} onSave={handleSignatureSave} />}
      {photoModalConfig.isOpen && id && (
        <NewPhotoModal 
            patientId={id} 
            onClose={() => setPhotoModalConfig(prev => ({ ...prev, isOpen: false }))} 
            initialType={photoModalConfig.initialType} 
            initialProcedure={photoModalConfig.initialProcedure} 
            lockFields={photoModalConfig.lockFields}
            initialGroupId={photoModalConfig.initialGroupId}
            availableProcedures={availableProceduresList} 
        />
      )}
      
      {viewingPhoto && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4">
           <button onClick={() => setViewingPhoto(null)} className="absolute top-4 right-4 text-white p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-8 h-8" /></button>
           <img src={viewingPhoto.url} alt="Ampliada" className="max-h-[85vh] max-w-full rounded-lg shadow-2xl" />
           <div className="mt-6 text-white text-center">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${viewingPhoto.type === 'before' ? 'bg-slate-700' : 'bg-green-600'}`}>{viewingPhoto.type}</span>
              <p className="mt-3 text-lg font-serif">{viewingPhoto.procedure} • {formatDate(viewingPhoto.date)}</p>
           </div>
        </div>
      )}

      {photoToDelete && (
        <div className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-fade-in">
                 <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Foto?</h3>
                 <p className="text-slate-500 text-sm mb-6">Esta ação removerá permanentemente a imagem da galeria do paciente.</p>
                 <div className="flex gap-3"><button onClick={() => setPhotoToDelete(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold">Cancelar</button><button onClick={confirmDeletePhoto} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold">Excluir</button></div>
             </div>
        </div>
      )}
    </div>
  );
};

export default PatientDetail;