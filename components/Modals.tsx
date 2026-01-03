import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, User as UserIcon, Clock, DollarSign, CheckCircle, Syringe, TrendingUp, Building, AlertTriangle, UserPlus, Trash2, Check, XCircle, Stethoscope, Plus, Package, FileText, Lock, Mail, Send, Camera, Image as ImageIcon, Upload, Link as LinkIcon, CreditCard, MapPin, Info, ExternalLink, ChevronDown, ChevronUp, CalendarOff, RefreshCw, Eraser, PenTool, Loader2 } from 'lucide-react';
import { Patient, Appointment, UserRole, User, Procedure, Supply, PhotoRecord, SystemAlert, BusinessHours, InventoryItem } from '../types';
import { useApp } from '../context/AppContext';
import { maskCpf, maskPhone, validateCPF, validateBirthDate } from '../utils/maskUtils';
import { formatCurrency, formatDateTime, formatDate } from '../utils/formatUtils';
import { PAYMENT_LABELS, PAYMENT_METHODS_LIST } from '../constants';
import { BusinessHoursEditor } from './BusinessHoursEditor';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const BaseModal: React.FC<ModalProps> = ({ onClose, children, title, subtitle }) => (
  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start bg-white shrink-0">
        <div>
          <h3 className="font-bold text-xl text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 overflow-y-auto bg-white">{children}</div>
    </div>
  </div>
);

export const SubscriptionModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { currentCompany, saasPlans } = useApp();
    if (!currentCompany) return null;
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
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
                <div className="bg-slate-900 text-white p-6 shrink-0 flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-serif font-bold mb-1">Gerenciar Assinatura</h3>
                        <p className="text-slate-400 text-sm">Escolha o plano ideal para sua clínica.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <p className="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">Status da Conta</p>
                            <div className="flex items-center gap-2">
                                <span className={`text-2xl font-bold capitalize ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
                                    {currentCompany.plan === 'basic' ? 'Basic (Inativo)' : currentCompany.plan}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {isExpired ? 'Expirado' : 'Ativo'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                                <Calendar className="w-4 h-4" /> Vencimento: {formatDate(currentCompany.subscriptionExpiresAt)}
                            </p>
                        </div>
                        <div className="w-full md:w-1/3">
                            <div className="flex justify-between text-xs mb-1 font-medium text-slate-500">
                                <span>Tempo Restante</span>
                                <span>{daysRemaining} dias</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                <div className={`h-2.5 rounded-full ${daysRemaining > 7 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.max(0, (daysRemaining / 30) * 100))}%` }}></div>
                            </div>
                        </div>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-4 text-lg">Planos Disponíveis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {saasPlans.map(plan => {
                            const isCurrent = currentCompany.plan === plan.id && !isExpired;
                            return (
                                <div key={plan.id} className={`rounded-xl p-6 border flex flex-col relative transition-all duration-300 ${isCurrent ? 'bg-white border-green-500 shadow-md ring-2 ring-green-500 ring-opacity-20' : 'bg-white border-slate-200 hover:shadow-lg hover:-translate-y-1'}`}>
                                    {isCurrent && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">Plano Atual</div>}
                                    <h5 className="font-bold text-xl text-slate-900 capitalize mb-2">{plan.name}</h5>
                                    <div className="mb-4"><span className="text-3xl font-bold text-slate-900">R$ {plan.price}</span><span className="text-slate-500 text-sm">/mês</span></div>
                                    <ul className="space-y-2 mb-6 flex-1">
                                        {plan.features.slice(0, 5).map((feat, i) => (
                                            <li key={i} className="text-xs text-slate-600 flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5" />{feat}</li>
                                        ))}
                                    </ul>
                                    <a 
                                        href={plan.stripePaymentLink || '#'} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors ${isCurrent ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-slate-900 text-white hover:bg-black shadow-lg'}`}
                                        onClick={(e) => {
                                            if (isCurrent) e.preventDefault();
                                            else if (!plan.stripePaymentLink) {
                                                e.preventDefault();
                                                alert("Link de pagamento indisponível no modo demo.");
                                            }
                                        }}
                                    >
                                        {isCurrent ? 'Ativo' : isExpired ? 'Renovar Agora' : 'Mudar Plano'}
                                        {!isCurrent && <ExternalLink className="w-3 h-3" />}
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AlertDetailsModal: React.FC<{ alert: SystemAlert; onClose: () => void }> = ({ alert, onClose }) => {
    const iconColor = { info: 'text-blue-600 bg-blue-100', warning: 'text-amber-600 bg-amber-100', error: 'text-red-600 bg-red-100', success: 'text-green-600 bg-green-100' }[alert.type];
    const Icon = { info: Info, warning: AlertTriangle, error: XCircle, success: CheckCircle }[alert.type];
    return (
        <BaseModal title="Detalhes do Alerta" onClose={onClose}>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${iconColor}`}><Icon className="w-8 h-8" /></div>
                    <div><h3 className="text-lg font-bold text-slate-900">{alert.title}</h3><p className="text-sm text-slate-500">{formatDateTime(alert.createdAt)}</p></div>
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">{alert.message}</div>
                <div className="flex justify-end"><button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors">Entendido</button></div>
            </div>
        </BaseModal>
    );
};

export const NewPatientModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addPatient } = useApp();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', birthDate: '', cpf: '' });
  const [sendInvite, setSendInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
        if (!formData.name || !formData.phone) { throw new Error("Por favor, preencha pelo menos nome e telefone."); }
        if (formData.cpf && !validateCPF(formData.cpf)) { throw new Error("CPF inválido."); }
        if (formData.birthDate && !validateBirthDate(formData.birthDate)) { throw new Error("Data de nascimento inválida. Verifique o ano."); }
        setIsSubmitting(true);
        await addPatient({ ...formData, status: 'active', lastVisit: undefined });
        if (sendInvite) { console.log(`Convite enviado para ${formData.email}`); }
        onClose();
    } catch (err: any) { setError(err.message || "Erro ao cadastrar paciente."); setIsSubmitting(false); }
  };
  return (
    <BaseModal title="Novo Paciente" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label><input required type="text" className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label><input required type="text" className="w-full p-2 border rounded-lg" placeholder="(99) 99999-9999" value={formData.phone} onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})} maxLength={15} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Nascimento</label><input required type="date" className="w-full p-2 border rounded-lg" max={new Date().toISOString().split('T')[0]} value={formData.birthDate} onChange={e => { if (e.target.value && e.target.value.split('-')[0].length > 4) return; setFormData({...formData, birthDate: e.target.value}); }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input required type="email" className="w-full p-2 border rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">CPF</label><input type="text" className="w-full p-2 border rounded-lg" placeholder="000.000.000-00" value={formData.cpf} onChange={e => setFormData({...formData, cpf: maskCpf(e.target.value)})} maxLength={14} /></div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100"><h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2"><Lock className="w-4 h-4" /> Acesso ao Portal do Paciente</h4><div className={`p-4 rounded-xl border transition-all ${sendInvite ? 'bg-primary-50 border-primary-200' : 'bg-slate-50 border-slate-200'}`}><div className="flex items-start gap-3"><div className="pt-0.5"><input type="checkbox" id="sendInvite" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500" /></div><div><label htmlFor="sendInvite" className="block text-sm font-bold text-slate-800 cursor-pointer select-none">Enviar convite de acesso automaticamente</label><p className="text-xs text-slate-500 mt-1 leading-relaxed">Ao cadastrar, enviaremos um link seguro para o e-mail <strong>{formData.email || 'do paciente'}</strong>. O paciente poderá definir sua própria senha para acessar o App e agendar consultas.</p>{sendInvite && (<div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-white/50 px-3 py-1.5 rounded-lg border border-primary-100"><Send className="w-3 h-3" /> O e-mail será enviado ao salvar o cadastro.</div>)}</div></div></div></div>
        {error && (<div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>)}
        <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg" disabled={isSubmitting}>Cancelar</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-lg shadow-primary-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 transition-all">{isSubmitting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Cadastrando...</>) : (sendInvite ? 'Cadastrar e Enviar Convite' : 'Cadastrar Apenas')}</button></div>
      </form>
    </BaseModal>
  );
};

export const NewAppointmentModal: React.FC<{ onClose: () => void, preSelectedDate?: Date, preSelectedProfessionalId?: string, preSelectedProcedureId?: string }> = ({ onClose, preSelectedDate, preSelectedProfessionalId, preSelectedProcedureId }) => {
  const { addAppointment, patients, procedures, user, professionals } = useApp();
  const isPatientUser = user?.role === UserRole.PATIENT;
  const [patientId, setPatientId] = useState(isPatientUser ? user.id : '');
  const [selectedProcId, setSelectedProcId] = useState(preSelectedProcedureId || '');
  const [serviceName, setServiceName] = useState('');
  const medicalStaff = professionals.filter(p => p.role === UserRole.OWNER || p.role === UserRole.ADMIN || p.role === UserRole.ESTHETICIAN);
  const [professionalId, setProfessionalId] = useState(() => {
      if (preSelectedProfessionalId && preSelectedProfessionalId !== 'all') { return preSelectedProfessionalId; }
      if (user && (user.role === UserRole.OWNER || user.role === UserRole.ESTHETICIAN || user.role === UserRole.ADMIN)) { return user.id; }
      if (medicalStaff.length > 0) { return medicalStaff[0].id; }
      return '';
  });
  const initialDate = preSelectedDate ? new Date(preSelectedDate.getTime() - (preSelectedDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '';
  const [date, setDate] = useState(initialDate);
  const [duration, setDuration] = useState<string | number>('');
  const [price, setPrice] = useState<string | number>('');
  const [roomId, setRoomId] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [simulateClientRequest, setSimulateClientRequest] = useState(isPatientUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    if (selectedProcId) {
        const proc = procedures.find(p => p.id === selectedProcId);
        if (proc) { setServiceName(proc.name); setPrice(proc.price); setDuration(proc.durationMinutes); }
    }
  }, [selectedProcId, procedures]);
  const handleProcedureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const procId = e.target.value;
    setSelectedProcId(procId);
    const proc = procedures.find(p => p.id === procId);
    if (proc) { setServiceName(proc.name); setPrice(proc.price); setDuration(proc.durationMinutes); } else { setServiceName(''); setPrice(''); setDuration(''); }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) { setError("Erro de autenticação."); return; }
    if (!professionalId) { setError("Selecione um profissional."); return; }
    if (!selectedProcId) { setError("Selecione um procedimento."); return; }
    if (!date) { setError("Selecione data e hora."); return; }

    // Para paciente logado, buscar o patientId pelo email
    let finalPatientId = patientId;
    let patient;
    if (isPatientUser) {
      // Buscar paciente pelo email do usuário logado
      patient = patients.find(p => p.email === user.email);
      if (!patient) { setError("Seu cadastro de paciente não foi encontrado. Entre em contato com a clínica."); return; }
      finalPatientId = patient.id;
    } else {
      if (!patientId) { setError("Selecione um paciente."); return; }
      patient = patients.find(p => p.id === patientId);
      if (!patient) { setError("Paciente não encontrado."); return; }
    }

    const professional = professionals.find(p => p.id === professionalId);
    if (!professional) { setError("Profissional não encontrado."); return; }

    setIsSubmitting(true);
    try {
      const isoDate = new Date(date).toISOString();
      const status = simulateClientRequest ? 'pending_approval' : 'confirmed';
      const result = await addAppointment({
        patientId: finalPatientId,
        patientName: patient.name,
        professionalId: professional.id,
        professionalName: professional.name,
        procedureId: selectedProcId,
        service: serviceName,
        date: isoDate,
        durationMinutes: Number(duration) || 60,
        price: Number(price) || 0,
        status: status,
        roomId: roomId
      }, false);
      if (result.success) { onClose(); } else if (result.conflict) { setError("Este horário já está ocupado. Por favor, selecione outro horário ou sala."); setIsSubmitting(false); } else { setError(result.error || "Erro desconhecido ao agendar."); setIsSubmitting(false); }
    } catch (error) { console.error(error); setError("Erro ao processar data. Verifique o campo Data/Hora."); setIsSubmitting(false); }
  };
  return (
    <BaseModal title={isPatientUser ? "Solicitar Agendamento" : "Novo Agendamento"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {!isPatientUser ? (
             <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label><select required className="w-full p-2 border rounded-lg bg-white" value={patientId} onChange={e => setPatientId(e.target.value)}><option value="">Selecione...</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          ) : (
             <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2 text-slate-600 text-sm"><UserIcon className="w-4 h-4 text-slate-400" /><span>Agendamento para: <strong>{user?.name}</strong></span></div>
          )}
          <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Profissional Responsável</label><select required className="w-full p-2 border rounded-lg bg-white" value={professionalId} onChange={e => setProfessionalId(e.target.value)}><option value="">Selecione o Profissional...</option>{medicalStaff.map(p => (<option key={p.id} value={p.id}>{p.name} {p.title ? `- ${p.title}` : ''}</option>))}</select></div>
        </div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Procedimento</label><select required className="w-full p-2 border rounded-lg" value={selectedProcId} onChange={handleProcedureChange}><option value="">Selecione da lista...</option>{procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-4">
            <div className={isPatientUser ? "col-span-2" : ""}><label className="block text-sm font-medium text-slate-700 mb-1">Data/Hora</label><input required type="datetime-local" className="w-full p-2 border rounded-lg" value={date} onChange={e => { if (e.target.value && e.target.value.split('-')[0].length > 4) return; setDate(e.target.value); }} max="9999-12-31T23:59" /></div>
            {!isPatientUser && (<div><label className="block text-sm font-medium text-slate-700 mb-1">Sala</label><select required className="w-full p-2 border rounded-lg" value={roomId} onChange={e => setRoomId(Number(e.target.value))}><option value={1}>Consultório 1</option><option value={2}>Consultório 2</option><option value={3}>Sala VIP</option></select></div>)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label><input required type="number" className="w-full p-2 border rounded-lg bg-slate-50" value={price} readOnly placeholder="0.00" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Duração (min)</label><input required type="number" className={`w-full p-2 border rounded-lg ${isPatientUser ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : 'bg-white'}`} value={duration} onChange={e => !isPatientUser && setDuration(e.target.value === '' ? '' : Number(e.target.value))} readOnly={isPatientUser} placeholder="60" /></div>
        </div>
        {!isPatientUser && user?.role !== UserRole.RECEPTIONIST && ( <div className="flex items-center gap-2 py-2"><input type="checkbox" id="simulateClient" checked={simulateClientRequest} onChange={e => setSimulateClientRequest(e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500" /><label htmlFor="simulateClient" className="text-sm text-slate-600 select-none cursor-pointer">Simular solicitação do cliente (Pendente de Aprovação)</label></div> )}
        {error && ( <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div> )}
        <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg" disabled={isSubmitting}>Cancelar</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 transition-all">{isSubmitting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Agendando...</>) : (isPatientUser ? 'Solicitar Horário' : 'Agendar')}</button></div>
      </form>
    </BaseModal>
  );
};

export const ReviewAppointmentModal: React.FC<{ appointment: Appointment; onClose: () => void }> = ({ appointment, onClose }) => {
    const { updateAppointmentStatus, addNotification, currentCompany } = useApp();
    const [isProcessing, setIsProcessing] = useState(false);
    const [showConfirmCancel, setShowConfirmCancel] = useState(false);

    const handleApprove = () => {
        setIsProcessing(true);
        updateAppointmentStatus(appointment.id, 'confirmed');
        addNotification({
            companyId: appointment.companyId,
            message: `Olá ${appointment.patientName}, seu agendamento para ${appointment.service} em ${formatDate(appointment.date)} às ${new Date(appointment.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} foi APROVADO pela clínica ${currentCompany?.name}.`,
            type: 'success'
        });
        setTimeout(() => {
            setIsProcessing(false);
            onClose();
        }, 800);
    };

    const handleCancel = () => {
        updateAppointmentStatus(appointment.id, 'canceled');
        onClose();
    };

    return (
        <BaseModal title="Revisar Solicitação" subtitle="Aprove o agendamento antes de liberar o pagamento." onClose={onClose}>
            <div className="space-y-6">
                <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Status Atual</p>
                            <h4 className="text-xl font-bold text-amber-800 flex items-center gap-2">
                                <Clock className="w-5 h-5" /> Aguardando Aprovação
                            </h4>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Duração</p>
                            <p className="text-lg font-bold text-slate-800">{appointment.durationMinutes} min</p>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-amber-200/50 text-sm text-amber-900 space-y-2">
                        <p>Paciente: <strong className="text-slate-900">{appointment.patientName}</strong></p>
                        <p>Serviço: <strong className="text-slate-900">{appointment.service}</strong></p>
                        <p>Profissional: <strong className="text-slate-900">{appointment.professionalName}</strong></p>
                        <p>Data solicitada: <strong className="text-slate-900">{formatDateTime(appointment.date)}</strong></p>
                    </div>
                </div>

                {!showConfirmCancel ? (
                    <>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex gap-3">
                            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Ao clicar em <strong>"Aprovar"</strong>, o paciente receberá um alerta confirmando o horário. 
                                Após isso, o agendamento aparecerá em azul na sua agenda e o botão de pagamento será liberado.
                            </p>
                        </div>

                        <div className="pt-4 flex flex-wrap gap-3 border-t border-slate-100">
                            <button onClick={onClose} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors">Voltar</button>
                            <button 
                                onClick={() => setShowConfirmCancel(true)} 
                                className="px-6 py-3 border border-red-200 rounded-xl text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <XCircle className="w-4 h-4" /> Cancelar
                            </button>
                            <button 
                                onClick={handleApprove} 
                                disabled={isProcessing}
                                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                            >
                                {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                {isProcessing ? 'Processando...' : 'Aprovar Agendamento'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-red-50 p-6 rounded-xl border border-red-200 animate-fade-in">
                        <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Confirmar Cancelamento?
                        </h4>
                        <p className="text-sm text-red-700 mb-6">Deseja realmente recusar esta solicitação? O paciente será notificado.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirmCancel(false)} className="flex-1 py-3 bg-white border border-red-200 rounded-xl text-red-700 font-bold hover:bg-red-50 transition-colors">Não, Voltar</button>
                            <button onClick={handleCancel} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg">Sim, Cancelar</button>
                        </div>
                    </div>
                )}
            </div>
        </BaseModal>
    );
};

export const PatientAppointmentViewModal: React.FC<{ appointment: Appointment; onClose: () => void }> = ({ appointment, onClose }) => {
    const { currentCompany } = useApp();
    return (
        <BaseModal title="Detalhes do seu Agendamento" onClose={onClose}>
            <div className="space-y-6">
                <div className={`p-6 rounded-xl border flex flex-col items-center text-center ${appointment.status === 'pending_approval' ? 'bg-amber-50 border-amber-100' : appointment.status === 'canceled' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${appointment.status === 'pending_approval' ? 'bg-amber-100 text-amber-600' : appointment.status === 'canceled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {appointment.status === 'pending_approval' ? <Clock className="w-8 h-8" /> : appointment.status === 'canceled' ? <XCircle className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
                    </div>
                    <h4 className={`text-xl font-bold ${appointment.status === 'pending_approval' ? 'text-amber-800' : appointment.status === 'canceled' ? 'text-red-800' : 'text-blue-800'}`}>
                        {appointment.status === 'pending_approval' ? 'Aguardando Clínica' : appointment.status === 'canceled' ? 'Agendamento Cancelado' : 'Horário Confirmado'}
                    </h4>
                    <p className="text-sm mt-1 opacity-80">
                        {appointment.status === 'pending_approval' ? 'A clínica recebeu seu pedido e em breve irá aprovar.' : appointment.status === 'canceled' ? 'Este agendamento foi cancelado.' : 'Tudo certo para o seu atendimento!'}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Procedimento</p>
                        <p className={`font-bold text-slate-800 ${appointment.status === 'canceled' ? 'line-through opacity-50' : ''}`}>{appointment.service}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Valor do Serviço</p>
                        <p className="font-bold text-slate-800">{formatCurrency(appointment.price)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Data e Hora</p>
                        <p className="font-bold text-slate-800">{formatDateTime(appointment.date)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Profissional</p>
                        <p className="font-bold text-slate-800">{appointment.professionalName}</p>
                    </div>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-xl shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-primary-400" />
                        <span className="font-bold text-sm">{currentCompany?.address || 'Localização da Clínica'}</span>
                    </div>
                    <p className="text-xs text-slate-300">Comparecer com 10 minutos de antecedência. Em caso de cancelamento, favor avisar com 24h.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Fechar</button>
                </div>
            </div>
        </BaseModal>
    );
};

export const NewExpenseModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addTransaction } = useApp();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
        if (!description || !amount) { throw new Error("Preencha a descrição e o valor."); }
        if (Number(amount) <= 0) { throw new Error("O valor deve ser positivo."); }
        setIsSubmitting(true);
        await addTransaction({ date: new Date(date).toISOString(), description, amount: Number(amount), type: 'expense', category: 'Despesas', status: 'paid' });
        onClose();
    } catch (err: any) { setError(err.message || "Erro ao registrar despesa."); setIsSubmitting(false); }
  };
  return (
    <BaseModal title="Registrar Despesa" onClose={onClose}>
       <form onSubmit={handleSubmit} className="space-y-4">
         <div><label className="block text-sm font-medium text-slate-700 mb-1">Descrição da Despesa</label><input required type="text" className="w-full p-2 border rounded-lg" placeholder="Ex: Conta de Luz..." value={description} onChange={e => setDescription(e.target.value)} /></div>
         <div className="grid grid-cols-2 gap-4">
           <div><label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label><div className="relative"><DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required type="number" step="0.01" className="w-full pl-9 p-2 border rounded-lg" value={amount} onChange={e => setAmount(e.target.value)} /></div></div>
           <div><label className="block text-sm font-medium text-slate-700 mb-1">Data</label><input required type="date" className="w-full p-2 border rounded-lg" value={date} onChange={e => { if (e.target.value && e.target.value.split('-')[0].length > 4) return; setDate(e.target.value); }} max="9999-12-31" /></div>
         </div>
         {error && ( <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div> )}
         <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg" disabled={isSubmitting}>Cancelar</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 transition-all">{isSubmitting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Registrando...</>) : 'Registrar Despesa'}</button></div>
       </form>
    </BaseModal>
  );
};

export const NewProcedureModal: React.FC<{ onClose: () => void; initialData?: Procedure }> = ({ onClose, initialData }) => {
  const { addProcedure, updateProcedure, inventory } = useApp();
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [price, setPrice] = useState<string | number>(initialData?.price || '');
  const [duration, setDuration] = useState<string | number>(initialData?.durationMinutes || '');
  const [supplies, setSupplies] = useState<Supply[]>(initialData?.supplies || []);
  
  const [selectedInvId, setSelectedInvId] = useState('');
  const [supplyQty, setSupplyQty] = useState('');
  const [customSupplyName, setCustomSupplyName] = useState('');
  const [customSupplyCost, setCustomSupplyCost] = useState('');

  const [maintenanceRequired, setMaintenanceRequired] = useState(initialData?.maintenanceRequired || false);
  const [maintenanceInterval, setMaintenanceInterval] = useState<string | number>(initialData?.maintenanceIntervalDays || 120);
  
  const [error, setError] = useState<string | null>(null);
  const [showPendingConfirm, setShowPendingConfirm] = useState(false);
  const [pendingSupplyObj, setPendingSupplyObj] = useState<Supply | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSupply = () => {
    let newSupply: Supply;
    if (selectedInvId) {
        const invItem = inventory.find(i => i.id === selectedInvId);
        if (invItem && supplyQty) {
            const qty = parseFloat(supplyQty);
            const calculatedCost = qty * invItem.costPerUnit;
            newSupply = { id: `sup_${Date.now()}`, inventoryItemId: invItem.id, name: invItem.name, quantityUsed: qty, cost: calculatedCost };
        } else { return; }
    } else {
        if (customSupplyName && customSupplyCost) {
            newSupply = { id: `sup_${Date.now()}`, name: customSupplyName, quantityUsed: 1, cost: parseFloat(customSupplyCost) };
        } else { return; }
    }
    setSupplies([...supplies, newSupply]);
    setSelectedInvId(''); setSupplyQty(''); setCustomSupplyName(''); setCustomSupplyCost('');
  };

  const handleRemoveSupply = (id: string) => { setSupplies(supplies.filter(s => s.id !== id)); };
  const totalCost = supplies.reduce((acc, curr) => acc + curr.cost, 0);

  const doFinalSave = async (finalSuppliesList: Supply[]) => {
    try {
        if (!name) throw new Error("O nome do procedimento é obrigatório.");
        const numPrice = Number(price);
        if (isNaN(numPrice) || numPrice <= 0) throw new Error("Preço inválido.");
        const numDuration = Number(duration);
        if (isNaN(numDuration) || numDuration <= 0) throw new Error("Duração inválida.");
        setIsSubmitting(true);
        const finalTotalCost = finalSuppliesList.reduce((acc, curr) => acc + curr.cost, 0);
        const procedureData: Partial<Procedure> = { name, description, imageUrl, price: numPrice, cost: finalTotalCost, durationMinutes: numDuration, supplies: finalSuppliesList, maintenanceRequired, maintenanceIntervalDays: maintenanceRequired ? Number(maintenanceInterval) : undefined };
        if (initialData) { await updateProcedure(initialData.id, procedureData); } else { await addProcedure(procedureData as any); }
        onClose();
    } catch (err: any) { setError(err.message || "Erro ao salvar procedimento."); setShowPendingConfirm(false); setIsSubmitting(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const isPendingInventory = selectedInvId && supplyQty && parseFloat(supplyQty) > 0;
    const isPendingCustom = customSupplyName && customSupplyCost && parseFloat(customSupplyCost) > 0;
    if (isPendingInventory || isPendingCustom) {
        let pending: Supply | null = null;
        if (isPendingInventory) {
            const invItem = inventory.find(i => i.id === selectedInvId);
            if (invItem) { pending = { id: `sup_pending_${Date.now()}`, inventoryItemId: invItem.id, name: invItem.name, quantityUsed: parseFloat(supplyQty), cost: parseFloat(supplyQty) * invItem.costPerUnit }; }
        } else { pending = { id: `sup_pending_${Date.now()}`, name: customSupplyName, quantityUsed: 1, cost: parseFloat(customSupplyCost) }; }
        if (pending) { setPendingSupplyObj(pending); setShowPendingConfirm(true); return; }
    }
    doFinalSave(supplies);
  };

  return (
    <BaseModal title={initialData ? "Editar Procedimento" : "Novo Procedimento"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome do Procedimento</label><input required type="text" className="w-full p-2 border border-slate-200 rounded-lg" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label><textarea className="w-full p-2 border border-slate-200 rounded-lg text-sm" rows={2} placeholder="Breve descrição do procedimento..." value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Imagem do Procedimento (opcional)</label>
          {!imageUrl ? (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-primary-400 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500"><span className="font-semibold text-primary-600">Clique para enviar</span> ou arraste</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG ou WEBP (max. 2MB)</p>
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande. Máximo 2MB.'); return; }
                const reader = new FileReader();
                reader.onload = (event) => {
                  const img = new window.Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
                    else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    setImageUrl(compressedBase64);
                  };
                  img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
              }} />
            </label>
          ) : (
            <div className="relative rounded-lg overflow-hidden h-40 bg-slate-100 group">
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button type="button" onClick={() => setImageUrl('')} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 text-sm font-medium"><Trash2 className="w-4 h-4" /> Remover</button>
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-1">A imagem será exibida como fundo do card do procedimento para os pacientes.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
           <div><label className="block text-sm font-medium text-slate-700 mb-1">Preço de Venda (R$)</label><div className="relative"><DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required type="number" className="w-full pl-9 p-2 border border-slate-200 rounded-lg" value={price} onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))} /></div></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Duração Padrão (min)</label><div className="relative"><Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required type="number" className="w-full pl-9 p-2 border border-slate-200 rounded-lg" value={duration} onChange={e => setDuration(e.target.value === '' ? '' : Number(e.target.value))} /></div></div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mt-2">
            <div className="flex items-center gap-2 mb-3"><input type="checkbox" id="maintenanceCheck" className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" checked={maintenanceRequired} onChange={(e) => setMaintenanceRequired(e.target.checked)} /><label htmlFor="maintenanceCheck" className="font-bold text-slate-800 text-sm flex items-center gap-2 cursor-pointer select-none"><RefreshCw className="w-4 h-4 text-purple-600" /> Requer Manutenção / Retoque?</label></div>
            {maintenanceRequired && (<div className="animate-fade-in pl-6"><label className="block text-xs font-medium text-slate-600 mb-1">Dias para retorno ideal</label><div className="flex items-center gap-2"><input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={maintenanceInterval} onChange={(e) => setMaintenanceInterval(e.target.value)} placeholder="Ex: 120" /><span className="text-xs text-slate-500">dias</span></div><p className="text-[10px] text-slate-500 mt-1 italic">O sistema irá sugerir automaticamente o retorno do cliente após este período no painel de Marketing.</p></div>)}
        </div>
        <div className="border-t border-slate-100 pt-4 mt-2">
            <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Insumos & Custos Operacionais</h4>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2"><select className="flex-1 p-2 border border-slate-200 rounded-lg text-sm bg-white" value={selectedInvId} onChange={(e) => { setSelectedInvId(e.target.value); if (e.target.value) { setCustomSupplyName(''); setCustomSupplyCost(''); } }}><option value="">-- Inserir Manualmente --</option>{inventory.map(item => (<option key={item.id} value={item.id}>{item.name} ({item.unit})</option>))}</select></div>
                    <div className="flex gap-2 items-end">
                        {selectedInvId ? (<><div className="flex-1"><label className="block text-xs font-medium text-slate-500 mb-1">Quantidade</label><input type="number" step="0.1" className="w-full p-2 border rounded-lg text-sm" placeholder="Qtd" value={supplyQty} onChange={(e) => setSupplyQty(e.target.value)} /></div><div className="w-32"><label className="block text-xs font-medium text-slate-500 mb-1">Custo Estimado</label><input type="text" disabled className="w-full p-2 border rounded-lg text-sm bg-slate-100 text-slate-500" value={(() => { const item = inventory.find(i => i.id === selectedInvId); const qty = parseFloat(supplyQty) || 0; return item ? formatCurrency(item.costPerUnit * qty) : 'R$ 0,00'; })()} /></div></>) : (<><div className="flex-1"><label className="block text-xs font-medium text-slate-500 mb-1">Nome do Insumo</label><input type="text" className="w-full p-2 border rounded-lg text-sm" placeholder="Ex: Luvas..." value={customSupplyName} onChange={(e) => setCustomSupplyName(e.target.value)} /></div><div className="w-24"><label className="block text-xs font-medium text-slate-500 mb-1">Custo (R$)</label><input type="number" step="0.01" className="w-full p-2 border rounded-lg text-sm" placeholder="0.00" value={customSupplyCost} onChange={(e) => setCustomSupplyCost(e.target.value)} /></div></>)}
                        <button type="button" onClick={handleAddSupply} className="p-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"><Plus className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>
            {supplies.length > 0 && (<div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-3"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left font-medium">Insumo</th><th className="px-3 py-2 text-right font-medium">Qtd/Custo</th><th className="px-3 py-2 w-10"></th></tr></thead><tbody className="divide-y divide-slate-100">{supplies.map(supply => (<tr key={supply.id}><td className="px-3 py-2 text-slate-700">{supply.name}{supply.inventoryItemId && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Estoque</span>}</td><td className="px-3 py-2 text-right text-slate-700">{supply.inventoryItemId && <span className="text-xs text-slate-500 mr-2">{supply.quantityUsed} un.</span>}{formatCurrency(supply.cost)}</td><td className="px-3 py-2 text-right"><button type="button" onClick={() => handleRemoveSupply(supply.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button></td></tr>))}</tbody><tfoot className="bg-slate-50 font-bold text-slate-800"><tr><td className="px-3 py-2">Custo Total</td><td className="px-3 py-2 text-right text-red-600">- {formatCurrency(totalCost)}</td><td></td></tr></tfoot></table></div>)}
        </div>
        {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
        {showPendingConfirm && (
            <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl animate-fade-in my-4 shadow-sm">
                <div className="flex gap-3"><div className="bg-amber-100 p-2 rounded-full h-fit"><AlertTriangle className="w-5 h-5 text-amber-600" /></div><div className="flex-1"><p className="font-bold text-slate-800 text-sm">Deseja salvar o insumo no procedimento?</p><p className="text-xs text-slate-600 mt-1">Identificamos que você preencheu o insumo <strong>"{pendingSupplyObj?.name}"</strong> mas não o adicionou à lista.</p>
                        <div className="flex gap-3 mt-4"><button type="button" onClick={() => doFinalSave([...supplies, pendingSupplyObj!])} className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 shadow-sm">Sim, incluir e salvar</button><button type="button" onClick={() => doFinalSave(supplies)} className="px-4 py-2 bg-white border border-amber-300 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-50">Não, salvar sem ele</button></div></div></div>
            </div>
        )}
        {!showPendingConfirm && (<div className="pt-2 flex justify-end gap-3 border-t border-slate-100 mt-4"><button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg" disabled={isSubmitting}>Cancelar</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 font-bold transition-all shadow-lg shadow-secondary-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">{isSubmitting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</>) : (initialData ? 'Salvar Alterações' : 'Salvar Procedimento')}</button></div>)}
      </form>
    </BaseModal>
  );
};

export const ProfessionalModal: React.FC<{ onClose: () => void; initialData?: User }> = ({ onClose, initialData }) => {
  const { addProfessional, updateProfessional, currentCompany } = useApp();
  const [formData, setFormData] = useState<Partial<User>>({
    name: initialData?.name || '',
    email: initialData?.email || '',
    password: initialData?.password || '123456',
    role: initialData?.role || UserRole.ESTHETICIAN,
    title: initialData?.title || '',
    phone: initialData?.phone || '',
    contractType: initialData?.contractType || 'PJ',
    remunerationType: initialData?.remunerationType || 'comissao',
    commissionRate: initialData?.commissionRate || 0,
    fixedSalary: initialData?.fixedSalary || 0,
    businessHours: initialData?.businessHours || currentCompany?.businessHours || {
        monday: { isOpen: true, start: '08:00', end: '18:00' },
        tuesday: { isOpen: true, start: '08:00', end: '18:00' },
        wednesday: { isOpen: true, start: '08:00', end: '18:00' },
        thursday: { isOpen: true, start: '08:00', end: '18:00' },
        friday: { isOpen: true, start: '08:00', end: '18:00' },
        saturday: { isOpen: true, start: '09:00', end: '13:00' },
        sunday: { isOpen: false, start: '00:00', end: '00:00' }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData) { updateProfessional(initialData.id, formData); } else { addProfessional(formData); }
    onClose();
  };

  return (
    <BaseModal title={initialData ? "Editar Profissional" : "Novo Profissional"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label><input required type="text" className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">E-mail (Login)</label><input required type="email" className="w-full p-2 border rounded-lg" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label><input type="text" className="w-full p-2 border rounded-lg" placeholder="(99) 99999-9999" value={formData.phone} onChange={e => setFormData({ ...formData, phone: maskPhone(e.target.value) })} maxLength={15} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Cargo / Especialidade</label><input type="text" className="w-full p-2 border rounded-lg" placeholder="Ex: Biomédica Esteta" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Nível de Acesso</label><select className="w-full p-2 border rounded-lg" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}><option value={UserRole.ADMIN}>Administrador (Gestão)</option><option value={UserRole.ESTHETICIAN}>Esteticista / Profissional</option><option value={UserRole.RECEPTIONIST}>Recepção</option></select></div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <h4 className="font-bold text-slate-800 text-sm mb-3">Remuneração & Contrato</h4>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Contrato</label><select className="w-full p-2 border rounded-lg" value={formData.contractType} onChange={e => setFormData({ ...formData, contractType: e.target.value as any })}><option value="PJ">PJ</option><option value="CLT">CLT</option><option value="Freelancer">Freelancer</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Modelo de Pagamento</label><select className="w-full p-2 border rounded-lg" value={formData.remunerationType} onChange={e => setFormData({ ...formData, remunerationType: e.target.value as any })}><option value="fixo">Apenas Salário Fixo</option><option value="comissao">Apenas Comissão</option><option value="misto">Misto (Fixo + Comissão)</option></select></div>
            {(formData.remunerationType === 'fixo' || formData.remunerationType === 'misto') && (<div><label className="block text-sm font-medium text-slate-700 mb-1">Salário Fixo Mensal</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><input type="number" className="w-full pl-9 p-2 border rounded-lg" value={formData.fixedSalary} onChange={e => setFormData({ ...formData, fixedSalary: Number(e.target.value) })} /></div></div>)}
            {(formData.remunerationType === 'comissao' || formData.remunerationType === 'misto') && (<div><label className="block text-sm font-medium text-slate-700 mb-1">Comissão (%)</label><div className="relative"><span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span><input type="number" className="w-full p-2 border rounded-lg pr-8" value={formData.commissionRate} onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })} /></div></div>)}
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4"><h4 className="font-bold text-slate-800 text-sm mb-3">Horário Específico (Opcional)</h4><BusinessHoursEditor compact value={formData.businessHours!} onChange={hours => setFormData({ ...formData, businessHours: hours })} /></div>
        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100"><button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold">Salvar Profissional</button></div>
      </form>
    </BaseModal>
  );
};

export const InventoryModal: React.FC<{ onClose: () => void; initialData?: InventoryItem }> = ({ onClose, initialData }) => {
  const { addInventoryItem, updateInventoryItem } = useApp();
  const [formData, setFormData] = useState({ name: initialData?.name || '', unit: initialData?.unit || 'un', currentStock: initialData?.currentStock !== undefined ? initialData.currentStock.toString() : '', minStock: initialData?.minStock !== undefined ? initialData.minStock.toString() : '', costPerUnit: initialData?.costPerUnit !== undefined ? initialData.costPerUnit.toString() : '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { name: formData.name, unit: formData.unit, currentStock: Number(formData.currentStock) || 0, minStock: Number(formData.minStock) || 0, costPerUnit: Number(formData.costPerUnit) || 0 };
    if (initialData) { updateInventoryItem(initialData.id, dataToSave); } else { addInventoryItem(dataToSave as any); }
    onClose();
  };

  return (
    <BaseModal title={initialData ? "Editar Insumo" : "Novo Insumo no Estoque"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome do Insumo / Produto</label><input required type="text" className="w-full p-2 border rounded-lg" placeholder="Ex: Toxina Botulínica 100U" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Unidade de Medida</label><select className="w-full p-2 border rounded-lg bg-white" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}><option value="un">Unidade (un)</option><option value="ml">Mililitro (ml)</option><option value="g">Grama (g)</option><option value="cx">Caixa (cx)</option><option value="par">Par</option><option value="pct">Pacote (pct)</option></select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Custo Unitário (R$)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><input required type="number" step="0.01" className="w-full pl-9 p-2 border rounded-lg" placeholder="" value={formData.costPerUnit} onChange={e => setFormData({ ...formData, costPerUnit: e.target.value })} /></div></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Estoque Atual</label><input required type="number" step="0.1" className="w-full p-2 border rounded-lg" placeholder="" value={formData.currentStock} onChange={e => setFormData({ ...formData, currentStock: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Alerta de Estoque Mínimo</label><input required type="number" step="0.1" className="w-full p-2 border rounded-lg" placeholder="" value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: e.target.value })} /></div>
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100"><button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold">Salvar Item</button></div>
      </form>
    </BaseModal>
  );
};

// Constantes de validação de upload
const MAX_FILE_SIZE_MB = 5; // Tamanho máximo em MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];

export const NewPhotoModal: React.FC<{
  patientId: string;
  onClose: () => void;
  initialType: 'before' | 'after';
  initialProcedure: string;
  lockFields: boolean;
  initialGroupId?: string;
  availableProcedures?: string[];
}> = ({ patientId, onClose, initialType, initialProcedure, lockFields, initialGroupId, availableProcedures }) => {
  const { addPhoto } = useApp();
  const [url, setUrl] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [procedure, setProcedure] = useState(initialProcedure || '');
  const [type, setType] = useState<'before' | 'after'>(initialType);
  const [groupId] = useState(initialGroupId || `group_${Date.now()}`);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);

    if (!file) return;

    // Validar tipo de arquivo
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Só é permitido enviar imagens (JPEG, PNG, GIF ou WebP).');
      e.target.value = ''; // Limpa o input
      return;
    }

    // Validar tamanho do arquivo
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE_MB}MB.`);
      e.target.value = ''; // Limpa o input
      return;
    }

    // Arquivo válido - converter para base64
    const reader = new FileReader();
    reader.onloadend = () => setUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !procedure || isSaving) return;

    setIsSaving(true);
    try {
      await addPhoto({ patientId, date, url, type, procedure, groupId });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar foto:', error);
      setIsSaving(false);
    }
  };

  return (
    <BaseModal title="Registrar Evolução Fotográfica" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            <div className={`w-64 h-64 rounded-2xl border-2 border-dashed ${uploadError ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'} flex items-center justify-center overflow-hidden ${!url ? 'hover:bg-slate-100' : ''}`}>
              {url ? <img src={url} alt="Evolução" className="w-full h-full object-cover" /> : (
                <div className="text-center text-slate-400">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold uppercase tracking-wider">Selecionar Foto</p>
                  <p className="text-xs mt-1 opacity-60">Máx. {MAX_FILE_SIZE_MB}MB</p>
                </div>
              )}
            </div>
            <label className={`absolute inset-0 ${isSaving ? 'cursor-not-allowed' : 'cursor-pointer'} opacity-0`}><input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isSaving} /></label>
          </div>
          {uploadError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm max-w-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Procedimento Referente</label>{availableProcedures && availableProcedures.length > 0 ? (<select required className="w-full p-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-500 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all" value={procedure} onChange={e => setProcedure(e.target.value)} disabled={lockFields || isSaving}><option value="">Selecione o procedimento realizado...</option>{availableProcedures.map(p => <option key={p} value={p}>{p}</option>)}</select>) : (<input required type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all" placeholder="Ex: Preenchimento Labial" value={procedure} onChange={e => setProcedure(e.target.value)} disabled={lockFields || isSaving} />)}</div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Data do Registro</label><input required type="date" className="w-full p-2 border border-slate-200 rounded-lg disabled:bg-slate-50" value={date} onChange={e => setDate(e.target.value)} disabled={isSaving} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Fase</label><select className="w-full p-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-50" value={type} onChange={e => setType(e.target.value as any)} disabled={lockFields || isSaving}><option value="before">Antes do Procedimento</option><option value="after">Depois / Resultado</option></select></div>
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50" disabled={isSaving}>Cancelar</button>
          <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center" disabled={!url || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Foto'
            )}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

export const SignatureModal: React.FC<{ onClose: () => void; onSave: (base64: string) => void }> = ({ onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; }
    }
  }, []);
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (canvas && ctx) { const rect = canvas.getBoundingClientRect(); const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX; const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY; ctx.beginPath(); ctx.moveTo(x, y); }
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (canvas && ctx) { const rect = canvas.getBoundingClientRect(); const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX; const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY; ctx.lineTo(x, y); ctx.stroke(); }
  };
  const stopDrawing = () => setIsDrawing(false);
  const clear = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext('2d', { willReadFrequently: true }); if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); };
  const handleSave = () => { const canvas = canvasRef.current; if (canvas) { onSave(canvas.toDataURL()); onClose(); } };
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><PenTool className="w-5 h-5" /> Assinatura Digital</h3><button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button></div>
        <div className="p-6"><p className="text-sm text-slate-500 mb-4">Desenhe sua assinatura no campo abaixo:</p><div className="border-2 border-slate-200 rounded-xl bg-slate-50 relative overflow-hidden touch-none"><canvas ref={canvasRef} width={400} height={200} className="w-full cursor-crosshair" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} /><button onClick={clear} className="absolute bottom-4 right-4 p-2 bg-white text-slate-400 hover:text-red-500 rounded-lg shadow border border-slate-100 transition-colors flex items-center gap-1 text-xs font-bold"><Eraser className="w-4 h-4" /> Limpar</button></div><div className="mt-6 flex gap-3"><button onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50">Cancelar</button><button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black shadow-lg">Confirmar Assinatura</button></div></div>
      </div>
    </div>
  );
};

export const CheckoutModal: React.FC<{ appointment: Appointment; onClose: () => void }> = ({ appointment, onClose }) => {
  const { processPayment, updateAppointmentStatus, currentCompany } = useApp();
  const [method, setMethod] = useState('pix');
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      await processPayment(appointment, method);
      onClose();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      setIsProcessing(false);
    }
  };
  const handleCancelAppointment = () => { updateAppointmentStatus(appointment.id, 'canceled'); onClose(); };
  const canCancel = appointment.status === 'scheduled' || appointment.status === 'confirmed';
  return (
    <BaseModal title="Checkout de Atendimento" onClose={onClose}>
      <div className="space-y-6">
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <div className="flex justify-between items-start mb-4"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Procedimento</p><h4 className={`text-xl font-bold text-slate-800 ${appointment.status === 'canceled' ? 'line-through opacity-50' : ''}`}>{appointment.service}</h4></div><div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valor</p><p className={`text-2xl font-bold ${appointment.status === 'canceled' ? 'text-slate-400' : 'text-green-600'}`}>{formatCurrency(appointment.price)}</p></div></div>
          <div className="pt-4 border-t border-slate-200 text-sm text-slate-600 space-y-1"><p>Paciente: <strong className={appointment.status === 'canceled' ? 'line-through opacity-50' : ''}>{appointment.patientName}</strong></p><p>Profissional: <strong className={appointment.status === 'canceled' ? 'line-through opacity-50' : ''}>{appointment.professionalName}</strong></p><p>Data: {formatDate(appointment.date)}</p></div>
        </div>
        {!showConfirmCancel ? (<>{appointment.status !== 'completed' && appointment.status !== 'canceled' && (<div><h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Forma de Pagamento</h4><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{(currentCompany?.paymentMethods || ['money', 'credit_card', 'pix']).map(m => (<button key={m} onClick={() => setMethod(m)} className={`p-3 rounded-xl border text-center transition-all ${method === m ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500 ring-opacity-10' : 'border-slate-200 hover:border-slate-300'}`}><span className={`text-xs font-bold uppercase ${method === m ? 'text-primary-700' : 'text-slate-500'}`}>{PAYMENT_LABELS[m] || m}</span></button>))}</div></div>)}{appointment.status === 'canceled' && (<div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-center gap-2 font-bold"><XCircle className="w-5 h-5" /> Este agendamento já foi cancelado.</div>)}<div className="pt-4 flex flex-wrap gap-3 border-t border-slate-100"><button onClick={onClose} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors">Voltar</button>{appointment.status !== 'completed' && appointment.status !== 'canceled' && (<>{canCancel && (<button onClick={() => setShowConfirmCancel(true)} className="px-4 py-3 border border-red-200 rounded-xl text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"><XCircle className="w-4 h-4" /> Cancelar</button>)}<button onClick={handleComplete} disabled={isProcessing} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all">{isProcessing ? (<><RefreshCw className="w-5 h-5 animate-spin" /> Processando...</>) : (<><CheckCircle className="w-5 h-5" /> Finalizar e Receber</>)}</button></>)}</div></>) : (
            <div className="bg-red-50 p-6 rounded-xl border border-red-200 animate-fade-in"><h4 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Confirmar Cancelamento?</h4><p className="text-sm text-red-700 mb-6">Deseja realmente cancelar este agendamento? Esta ação não pode ser desfeita.</p><div className="flex gap-3"><button onClick={() => setShowConfirmCancel(false)} className="flex-1 py-3 bg-white border border-red-200 rounded-xl text-red-700 font-bold hover:bg-red-50 transition-colors">Não, Voltar</button><button onClick={handleCancelAppointment} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg">Sim, Cancelar</button></div></div>
        )}
      </div>
    </BaseModal>
  );
};
