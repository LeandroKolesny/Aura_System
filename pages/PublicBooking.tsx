import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Procedure, User, Appointment, UserRole, PublicLayoutConfig, BusinessHours, UnavailabilityRule, OnlineBookingConfig } from '../types';
import AuraLogo from '../components/AuraLogo';
import { ChevronLeft, ChevronRight, CheckCircle, Star, LogOut, MapPin, Clock, Lock, Calendar as CalendarIcon, AlertTriangle, Info, XCircle, ArrowRight, RefreshCw, User as UserIcon } from 'lucide-react';
import { maskPhone } from '../utils/maskUtils';
import { formatCurrency } from '../utils/formatUtils';
import { publicApi, appointmentsApi } from '../services/api';
import { getClinicSlug, getPortalBasePath } from '../utils/subdomain';

interface PublicBookingProps {
  clinicSlug?: string; // Pode receber o slug como prop
}

const PublicBooking: React.FC<PublicBookingProps> = ({ clinicSlug }) => {
  // Tenta pegar o slug de múltiplas fontes:
  // 1. Prop passada diretamente
  // 2. Parâmetro da URL (/:slug)
  // 3. Detecção automática (subdomínio ou path)
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = clinicSlug || urlSlug || getClinicSlug();
  const { user, logout } = useApp();
  const navigate = useNavigate();

  const [companyId, setCompanyId] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [unavailabilityRules, setUnavailabilityRules] = useState<UnavailabilityRule[]>([]);
  const [layoutConfig, setLayoutConfig] = useState<PublicLayoutConfig | undefined>(undefined);
  const [businessHours, setBusinessHours] = useState<BusinessHours | undefined>(undefined);
  const [onlineConfig, setOnlineConfig] = useState<OnlineBookingConfig | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Wizard State
  const [step, setStep] = useState(1);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [patientData, setPatientData] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const canGoBackToSystem = user && (
    user.role === UserRole.ADMIN ||
    user.role === UserRole.OWNER ||
    user.role === UserRole.RECEPTIONIST ||
    user.role === UserRole.ESTHETICIAN
  );

  // Verifica se é um paciente logado
  const isLoggedInPatient = user && user.role === UserRole.PATIENT;

  useEffect(() => {
    const loadCompanyData = async () => {
      if (!slug) {
        setLoadError('Link inválido');
        setLoading(false);
        return;
      }

      try {
        const response = await publicApi.getCompanyBySlug(slug);

        if (response.success && response.data) {
          const { company, procedures: procs, professionals: profs, appointments: appts, unavailabilityRules: rules } = response.data;

          setCompanyId(company.id);
          setCompanySlug(company.slug);
          setCompanyName(company.name);
          setCompanyAddress(company.address || '');
          setCompanyLogo(company.logo || '');
          setProcedures(procs);
          setProfessionals(profs);
          setAppointments(appts);
          setUnavailabilityRules(rules || []);
          setLayoutConfig(company.layoutConfig);
          setBusinessHours(company.businessHours);
          setOnlineConfig(company.onlineBookingConfig);
        } else {
          setLoadError('Clínica não encontrada');
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setLoadError('Erro ao carregar dados da clínica');
      }

      setLoading(false);
    };

    loadCompanyData();
  }, [slug]);

  // Preenche dados do paciente quando está logado
  useEffect(() => {
    if (isLoggedInPatient && user) {
      setPatientData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
      }));
    }
  }, [isLoggedInPatient, user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Carregando...</div>;
  if (loadError || !companyName) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">{loadError || 'Clínica não encontrada.'}</div>;

  const isDarkBackground = (hex?: string) => {
    if (!hex) return false;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 50; 
  };

  const isDark = isDarkBackground(layoutConfig?.backgroundColor);

  const getCustomStyles = () => {
      if (!layoutConfig) return {};
      const fontFamily = layoutConfig.fontFamily === 'serif' ? '"Playfair Display", serif' : layoutConfig.fontFamily === 'system' ? 'system-ui, sans-serif' : '"Inter", sans-serif';
      const fontSizeMap = { 'sm': '14px', 'md': '16px', 'lg': '18px' };
      return {
          backgroundColor: layoutConfig.backgroundColor,
          color: layoutConfig.textColor || (isDark ? '#ffffff' : '#1e293b'),
          fontFamily: fontFamily,
          fontSize: fontSizeMap[layoutConfig.baseFontSize],
          '--primary-color': layoutConfig.primaryColor,
      } as React.CSSProperties;
  };

  const customStyles = getCustomStyles();
  const primaryColor = layoutConfig?.primaryColor || '#bd7b65';
  const textColor = layoutConfig?.textColor || (isDark ? '#ffffff' : '#1e293b');
  const cardBgColor = layoutConfig?.cardBackgroundColor || (isDark ? '#171717' : '#ffffff');
  const cardTxtColor = layoutConfig?.cardTextColor || (isDark ? '#e5e5e5' : '#334155');

  // Função para derivar cor do header a partir do backgroundColor
  const deriveHeaderColor = (bgColor?: string): string => {
    if (!bgColor) return isDark ? '#0a0a0a' : '#ffffff';
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Se fundo escuro, header fica um pouco mais claro. Se claro, fica mais escuro.
    const adjustment = isDark ? 15 : -10;
    const newR = Math.min(255, Math.max(0, r + adjustment));
    const newG = Math.min(255, Math.max(0, g + adjustment));
    const newB = Math.min(255, Math.max(0, b + adjustment));
    return `rgb(${newR}, ${newG}, ${newB})`;
  };

  const headerBgColor = layoutConfig?.headerBackgroundColor || deriveHeaderColor(layoutConfig?.backgroundColor);
  const headerTxtColor = layoutConfig?.headerTextColor || textColor;

  const cardStyle = { 
    backgroundColor: cardBgColor, 
    color: cardTxtColor, 
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    boxShadow: isDark ? '0 10px 30px -15px rgba(0,0,0,0.5)' : '0 10px 30px -15px rgba(0,0,0,0.05)'
  };
  
  const inputStyle = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
    color: isDark ? '#ffffff' : '#1e293b',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
  };

  const headerStyle = { backgroundColor: headerBgColor, color: headerTxtColor, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' };
  const headingStyle = { color: textColor };
  const descriptionStyle = { color: textColor, opacity: 0.7 };

  const getAvailableSlots = () => {
    const slots: { time: string, available: boolean, isPast: boolean }[] = [];
    let bizStartHour = 8;
    let bizEndHour = 18;
    let isOpenDay = true;

    if (businessHours) {
        const dayKey = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof BusinessHours;
        const schedule = businessHours[dayKey];
        if (schedule) {
            isOpenDay = schedule.isOpen;
            bizStartHour = parseInt(schedule.start.split(':')[0]);
            bizEndHour = parseInt(schedule.end.split(':')[0]);
        } else {
            isOpenDay = false;
        }
    }

    if (!isOpenDay) return [];

    const intervalMinutes = onlineConfig?.slotInterval || 60; 
    const minAdvanceMinutes = onlineConfig?.minAdvanceTime || 0; 
    const today = new Date();
    const minBookingTime = new Date(today.getTime() + minAdvanceMinutes * 60000);
    const selDateStart = new Date(selectedDate);
    selDateStart.setHours(0,0,0,0);
    const todayStart = new Date(today);
    todayStart.setHours(0,0,0,0);
    if (selDateStart < todayStart) return [];
    
    const startTotalMinutes = bizStartHour * 60;
    const endTotalMinutes = bizEndHour * 60; 

    for (let currentMinutes = startTotalMinutes; currentMinutes < endTotalMinutes; currentMinutes += intervalMinutes) {
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const slotTime = new Date(selectedDate);
        slotTime.setHours(h, m, 0, 0);
        const slotEndTime = new Date(slotTime.getTime() + (selectedProcedure?.durationMinutes || intervalMinutes) * 60000);
        const isPastOrTooSoon = slotTime < minBookingTime;

        let isBlockedByRule = false;
        const offset = selectedDate.getTimezoneOffset();
        const localDate = new Date(selectedDate.getTime() - (offset*60*1000));
        const localDateStr = localDate.toISOString().split('T')[0];

        isBlockedByRule = unavailabilityRules.some(rule => {
            if (!rule.dates.includes(localDateStr)) return false;
            const [rStartH, rStartM] = rule.startTime.split(':').map(Number);
            const [rEndH, rEndM] = rule.endTime.split(':').map(Number);
            const ruleStartMin = rStartH * 60 + (rStartM || 0);
            const ruleEndMin = rEndH * 60 + (rEndM || 0);
            if (currentMinutes < ruleStartMin || currentMinutes >= ruleEndMin) return false;
            if (!selectedProfessional) return rule.professionalIds.includes('all');
            return rule.professionalIds.includes('all') || rule.professionalIds.includes(selectedProfessional.id);
        });

        let isOccupied = false;
        if (!isPastOrTooSoon && !isBlockedByRule) {
            if (selectedProfessional) {
                const profBusy = appointments.some(a => {
                    if (a.professionalId !== selectedProfessional.id || a.status === 'canceled') return false;
                    const aStart = new Date(a.date);
                    const aEnd = new Date(aStart.getTime() + a.durationMinutes * 60000);
                    return (slotTime >= aStart && slotTime < aEnd) || (slotEndTime > aStart && slotEndTime <= aEnd) || (slotTime <= aStart && slotEndTime >= aEnd);
                });
                if (profBusy) isOccupied = true;
            }
            if (!isOccupied) {
                const busyRooms = [1, 2, 3].filter(r => {
                    return appointments.some(a => {
                        if (a.roomId !== r || a.status === 'canceled') return false;
                        const aStart = new Date(a.date);
                        const aEnd = new Date(aStart.getTime() + a.durationMinutes * 60000);
                        return (slotTime >= aStart && slotTime < aEnd) || (slotEndTime > aStart && slotEndTime <= aEnd) || (slotTime <= aStart && slotEndTime >= aEnd);
                    });
                });
                if (busyRooms.length >= 3) isOccupied = true;
            }
        }

        const showAsUnavailable = isPastOrTooSoon || isBlockedByRule || isOccupied;
        const isAvailable = !showAsUnavailable;

        slots.push({
            time: timeString,
            available: isAvailable,
            isPast: showAsUnavailable
        });
    }
    return slots;
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    // Validação de senha apenas para novos pacientes (não logados)
    if (!isLoggedInPatient && patientData.password !== patientData.confirmPassword) {
      setBookingError("As senhas informadas não coincidem. Por favor, verifique.");
      return;
    }

    if (!selectedProcedure || !selectedTimeSlot || !companyId) return;

    try {
      const [hours, minutes] = selectedTimeSlot.split(':').map(Number);
      const isoDate = new Date(selectedDate);
      isoDate.setHours(hours, minutes, 0, 0);
      const finalPro = selectedProfessional || professionals[0];

      let result;

      if (isLoggedInPatient) {
        // Paciente logado: usar API autenticada
        // O backend vai buscar o patientId pelo email do usuário logado
        result = await appointmentsApi.create({
          patientId: '', // O backend vai sobrescrever com o ID correto
          procedureId: selectedProcedure.id,
          professionalId: finalPro.id,
          date: isoDate.toISOString(),
          durationMinutes: selectedProcedure.durationMinutes,
          price: selectedProcedure.price,
          notes: `Agendamento via portal - ${patientData.phone || user?.email}`,
        });
      } else {
        // Novo paciente: usar API pública
        result = await appointmentsApi.createPublic({
          companyId,
          procedureId: selectedProcedure.id,
          professionalId: finalPro.id,
          date: isoDate.toISOString(),
          patientInfo: {
            name: patientData.name,
            email: patientData.email,
            phone: patientData.phone,
            password: patientData.password,
          },
        });
      }

      if (result.success) {
        setBookingSuccess(true);
      } else {
        setBookingError(result.error || "Desculpe, este horário não está disponível.");
      }
    } catch (err) {
      console.error('Erro ao agendar:', err);
      setBookingError("Erro ao processar sua solicitação.");
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (newDate < today) return;
    const maxDays = onlineConfig?.maxBookingPeriod || 30;
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + maxDays);
    if (newDate > maxDate) return;
    setSelectedDate(newDate);
    setSelectedTimeSlot(null);
  };

  const handleDirectDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.value) return;
      const [year, month, day] = e.target.value.split('-').map(Number);
      const newDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (newDate < today) return;
      const maxDays = onlineConfig?.maxBookingPeriod || 30;
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + maxDays);
      if (newDate > maxDate) return;
      setSelectedDate(newDate);
      setSelectedTimeSlot(null);
  };
  
  const isTodayDate = selectedDate.toDateString() === new Date().toDateString();
  const isMaxDateReached = () => {
      const maxDays = onlineConfig?.maxBookingPeriod || 30;
      const today = new Date();
      today.setHours(0,0,0,0);
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + maxDays);
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate > maxDate;
  };

  if (bookingSuccess) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" style={customStyles}>
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] blur-[120px] rounded-full opacity-20" style={{ backgroundColor: primaryColor }}></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] blur-[120px] rounded-full opacity-10" style={{ backgroundColor: primaryColor }}></div>

            <div className="p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center relative z-10 backdrop-blur-md border" style={cardStyle}>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"><CheckCircle className="w-8 h-8" /></div>
                <h2 className="text-2xl font-serif font-bold mb-2">Solicitação Enviada!</h2>
                <p className="mb-6 opacity-70">Sua solicitação na <strong>{companyName}</strong> foi recebida. Enviaremos um WhatsApp ({patientData.phone}) em breve.</p>
                <div className="rounded-xl p-4 text-left space-y-2 text-sm mb-8 bg-white/5">
                    <p><strong>Procedimento:</strong> {selectedProcedure?.name}</p>
                    <p><strong>Data:</strong> {selectedDate.toLocaleDateString()} às {selectedTimeSlot}</p>
                    <p><strong>Profissional:</strong> {selectedProfessional ? selectedProfessional.name : 'A definir'}</p>
                </div>
                <button onClick={() => { logout(); navigate('/login'); }} className="w-full text-white py-4 rounded-2xl font-bold transition-all hover:scale-105" style={{ backgroundColor: '#1c1917' }}>Acessar Portal do Paciente</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen font-sans relative transition-colors duration-300 overflow-x-hidden" style={customStyles}>
      {/* Ambient Glows Reforçados */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] blur-[180px] rounded-full opacity-20 pointer-events-none" style={{ backgroundColor: primaryColor }}></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[700px] h-[700px] blur-[180px] rounded-full opacity-15 pointer-events-none" style={{ backgroundColor: primaryColor }}></div>

      <style>{`
        .custom-date-input::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: auto; height: auto; color: transparent; background: transparent; cursor: pointer; }
        ::placeholder { color: ${isDark ? primaryColor : 'rgba(0,0,0,0.3)'} !important; opacity: 0.5; }
        .glass-card { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}; }
        .btn-glow:hover { box-shadow: 0 0 25px -5px ${primaryColor}; }
      `}</style>

      {canGoBackToSystem && (
        <button onClick={() => navigate('/access-link')} className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 hover:bg-slate-900 border-2 border-slate-700 transition-all active:scale-95"><LogOut className="w-4 h-4" /> Voltar ao Painel</button>
      )}

      <div className="p-6 shadow-sm sticky top-0 z-30 flex justify-between items-center backdrop-blur-md border-b" style={headerStyle}>
        <div className="flex items-center gap-3">
           {companyLogo ? <img src={companyLogo} alt={companyName} className="h-9 w-auto max-w-[140px] object-contain" /> : <AuraLogo className="w-9 h-9" />}
           <span className="font-serif font-bold truncate max-w-[200px] text-lg">{companyName}</span>
        </div>
        <div className="flex items-center gap-3">
          {step > 1 && <button onClick={() => setStep(step - 1)} className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 px-5 py-2 hover:bg-white/5 rounded-full transition-all border border-transparent hover:border-white/10">Voltar</button>}
          {isLoggedInPatient ? (
            <Link
              to={`${getPortalBasePath()}/minha-conta`}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: primaryColor,
                color: '#ffffff',
                boxShadow: `0 4px 14px -3px ${primaryColor}66`
              }}
            >
              <UserIcon className="w-4 h-4" />
              <span>{user?.name?.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link
              to={`${getPortalBasePath()}/login`}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: primaryColor,
                color: '#ffffff',
                boxShadow: `0 4px 14px -3px ${primaryColor}66`
              }}
            >
              <UserIcon className="w-4 h-4" />
              <span>Entrar</span>
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 pb-24 relative z-10">
        <div className="flex gap-2 mb-14 mt-6 px-12">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-1 flex-1 rounded-full transition-all duration-700" style={{ backgroundColor: step >= i ? primaryColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }}></div>
            ))}
        </div>

        {step === 1 && (
            <div className="space-y-10 animate-fade-in text-center">
                <div className="mb-12">
                    <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4" style={headingStyle}>Escolha o tratamento</h2>
                    <p className="text-lg font-light" style={descriptionStyle}>Selecione um dos nossos procedimentos premium.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {procedures.map(proc => (
                        <div key={proc.id} onClick={() => { setSelectedProcedure(proc); setStep(2); }} className={`group relative overflow-hidden rounded-[3rem] h-72 border shadow-2xl hover:shadow-primary-500/20 transition-all duration-500 cursor-pointer bg-black/40 glass-card`}>
                            {proc.imageUrl ? (
                                <><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10 group-hover:from-black/70 transition-all"></div><img src={proc.imageUrl} alt={proc.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s]" /></>
                            ) : (
                                <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(135deg, #121212, ${primaryColor}44)` }}></div>
                            )}
                            <div className="relative z-20 h-full p-10 flex flex-col justify-end text-left text-white">
                                <h3 className="font-serif font-bold text-2xl leading-tight mb-4 drop-shadow-md">{proc.name}</h3>
                                <div className="flex items-center gap-4 text-white/95 text-[10px] font-bold uppercase tracking-widest">
                                    <span className="bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full flex items-center gap-2 border border-white/10"><Clock className="w-3.5 h-3.5 text-primary-400" /> {proc.durationMinutes} min</span>
                                    <span className="px-4 py-2 rounded-full shadow-xl" style={{ backgroundColor: primaryColor }}>{formatCurrency(proc.price)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-10 animate-fade-in text-center py-10">
                <h2 className="text-4xl font-serif font-bold mb-4" style={headingStyle}>Qual especialista?</h2>
                <p className="mb-14 text-lg font-light" style={descriptionStyle}>Selecione seu especialista de preferência.</p>
                <div className="grid grid-cols-2 gap-6 md:gap-10">
                    <div onClick={() => { setSelectedProfessional(null); setStep(3); }} className="p-10 rounded-[3rem] border shadow-2xl cursor-pointer hover:shadow-primary-500/10 transition-all duration-500 group glass-card relative overflow-hidden" style={cardStyle}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg group-hover:scale-110 transition-transform bg-gradient-to-br from-slate-700 to-slate-900" style={{ backgroundColor: primaryColor }}><Star className="w-8 h-8" /></div>
                        <h3 className="font-bold text-xl">Próximo disponível</h3>
                    </div>
                    {professionals.map(pro => (
                        <div key={pro.id} onClick={() => { setSelectedProfessional(pro); setStep(3); }} className="p-10 rounded-[3rem] border shadow-2xl cursor-pointer hover:shadow-primary-500/10 transition-all duration-500 group glass-card relative overflow-hidden" style={cardStyle}>
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 font-bold text-2xl shadow-inner group-hover:scale-110 transition-transform" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: cardTxtColor, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'transparent'}` }}>{pro.name.charAt(0)}</div>
                            <h3 className="font-bold text-xl truncate">{pro.name}</h3>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {step === 3 && (
            <div className="space-y-10 animate-fade-in">
                <h2 className="text-4xl font-serif font-bold text-center" style={headingStyle}>Escolha o melhor horário</h2>
                <div className="p-8 rounded-[2.5rem] border shadow-2xl flex items-center justify-between glass-card mb-10" style={cardStyle}>
                     <button onClick={() => changeDate(-1)} disabled={isTodayDate} className={`p-5 rounded-full transition-all ${isTodayDate ? 'opacity-10 cursor-not-allowed' : 'hover:bg-white/5 active:scale-90 border border-white/5'}`}><ChevronLeft className="w-8 h-8" /></button>
                     <div className="text-center flex-1 relative cursor-pointer group">
                         <div className="pointer-events-none group-hover:scale-105 transition-transform">
                             <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 mb-3">{selectedDate.getFullYear()}</p>
                             <p className="text-2xl font-bold capitalize flex items-center justify-center gap-3">{selectedDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })} <CalendarIcon className="w-5 h-5 text-primary-500" /></p>
                         </div>
                         <input type="date" className="custom-date-input" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }} value={selectedDate.toISOString().split('T')[0]} onChange={handleDirectDateChange} />
                     </div>
                     <button onClick={() => changeDate(1)} disabled={isMaxDateReached()} className={`p-5 rounded-full transition-all ${isMaxDateReached() ? 'opacity-10 cursor-not-allowed' : 'hover:bg-white/5 active:scale-90 border border-white/5'}`}><ChevronRight className="w-8 h-8" /></button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-6">
                    {getAvailableSlots().map(slot => (
                        <button
                            key={slot.time}
                            onClick={() => slot.available && setSelectedTimeSlot(slot.time)}
                            disabled={!slot.available}
                            className={`py-6 rounded-[1.5rem] border text-sm font-bold transition-all relative flex flex-col items-center justify-center overflow-hidden shadow-sm
                                ${!slot.available 
                                    ? 'bg-red-500/10 border-red-500/30 text-rose-500 cursor-not-allowed' 
                                    : selectedTimeSlot === slot.time
                                        ? 'text-white shadow-primary-500/40 scale-110 z-10 border-transparent shadow-2xl'
                                        : `hover:shadow-md ${isDark ? 'border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white hover:border-primary-400'}`
                                }
                            `}
                            style={slot.available && selectedTimeSlot === slot.time ? { backgroundColor: primaryColor } : { color: !slot.available ? '#f43f5e' : cardTxtColor }}
                        >
                            <span className="text-base tracking-widest">{slot.time}</span>
                            {!slot.available && (
                                <span className="text-[9px] font-bold uppercase mt-2 opacity-80 tracking-tighter">Indisponível</span>
                            )}
                        </button>
                    ))}
                </div>

                <button 
                    disabled={!selectedTimeSlot} 
                    onClick={() => setStep(4)} 
                    className="w-full text-white py-7 rounded-[2.5rem] font-bold text-xl disabled:opacity-30 mt-12 shadow-2xl transition-all active:scale-95 hover:scale-[1.02] btn-glow" 
                    style={{ backgroundColor: primaryColor, boxShadow: `0 20px 40px -15px ${primaryColor}66` }}
                >
                    Confirmar Horário Selecionado
                </button>
            </div>
        )}

        {step === 4 && (
            <div className="space-y-10 animate-fade-in max-w-xl mx-auto py-6">
                <h2 className="text-4xl font-serif font-bold text-center" style={headingStyle}>
                    {isLoggedInPatient ? 'Confirmar Agendamento' : 'Dados Pessoais'}
                </h2>

                {/* Aviso para paciente logado */}
                {isLoggedInPatient && (
                    <div className="p-4 rounded-2xl flex items-center gap-3 text-sm" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        <span>Você está logado como <strong>{user?.name}</strong>. Seu agendamento ficará pendente até aprovação.</span>
                    </div>
                )}

                <div className="p-10 rounded-[3rem] border border-dashed text-sm mb-12 glass-card shadow-inner" style={{ ...cardStyle, borderLeft: `10px solid ${primaryColor}`, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                    <p className="font-bold text-3xl mb-2" style={headingStyle}>{selectedProcedure?.name}</p>
                    <p className="opacity-70 text-xl font-medium" style={descriptionStyle}>{selectedDate.toLocaleDateString()} às {selectedTimeSlot}</p>
                </div>
                <form onSubmit={handleBooking} className="space-y-6">
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.25em] mb-3 ml-2" style={headingStyle}>Nome Completo</label>
                        <input
                            required
                            type="text"
                            className="w-full p-6 border rounded-[2rem] outline-none focus:ring-4 transition-all shadow-xl"
                            style={{ ...inputStyle, '--tw-ring-color': `${primaryColor}44`, opacity: isLoggedInPatient ? 0.7 : 1 } as any}
                            placeholder="Ex: Maria Oliveira"
                            value={patientData.name}
                            onChange={e => setPatientData({...patientData, name: e.target.value})}
                            readOnly={isLoggedInPatient}
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.25em] mb-3 ml-2" style={headingStyle}>WhatsApp para Confirmação</label>
                        <input required type="tel" className="w-full p-6 border rounded-[2rem] outline-none focus:ring-4 transition-all shadow-xl" style={{ ...inputStyle, '--tw-ring-color': `${primaryColor}44` } as any} placeholder="(11) 99999-9999" value={patientData.phone} onChange={e => setPatientData({...patientData, phone: maskPhone(e.target.value)})} maxLength={15} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.25em] mb-3 ml-2" style={headingStyle}>E-mail Principal</label>
                        <input
                            required
                            type="email"
                            className="w-full p-6 border rounded-[2rem] outline-none focus:ring-4 transition-all shadow-xl"
                            style={{ ...inputStyle, '--tw-ring-color': `${primaryColor}44`, opacity: isLoggedInPatient ? 0.7 : 1 } as any}
                            placeholder="seu@email.com"
                            value={patientData.email}
                            onChange={e => setPatientData({...patientData, email: e.target.value})}
                            readOnly={isLoggedInPatient}
                        />
                    </div>

                    {/* Campos de senha apenas para novos pacientes */}
                    {!isLoggedInPatient && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-[0.25em] mb-3 ml-2" style={headingStyle}>Sua Senha</label>
                                <input required type="password" placeholder="••••••••" className="w-full p-6 border rounded-[2rem] outline-none focus:ring-4 transition-all shadow-xl" style={{ ...inputStyle, '--tw-ring-color': `${primaryColor}44` } as any} value={patientData.password} onChange={e => setPatientData({...patientData, password: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-[0.25em] mb-3 ml-2" style={headingStyle}>Confirmar Senha</label>
                                <input required type="password" placeholder="••••••••" className="w-full p-6 border rounded-[2rem] outline-none focus:ring-4 transition-all shadow-xl" style={{ ...inputStyle, '--tw-ring-color': `${primaryColor}44` } as any} value={patientData.confirmPassword} onChange={e => setPatientData({...patientData, confirmPassword: e.target.value})} />
                            </div>
                        </div>
                    )}

                    {bookingError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-[1.5rem] flex items-center gap-3 text-rose-500 text-sm animate-fade-in font-bold">
                            <XCircle className="w-5 h-5 shrink-0" />
                            {bookingError}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full py-6 mt-12 font-bold text-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform text-white shadow-2xl"
                        style={{ backgroundColor: '#16a34a', borderRadius: '2rem', boxShadow: '0 20px 40px -10px rgba(22,163,74,0.4)' }}
                    >
                        Solicitar Agendamento <ArrowRight className="w-6 h-6" />
                    </button>

                    <p
                        className="text-[11px] text-center font-bold uppercase tracking-tight px-12 leading-relaxed mt-6"
                        style={{ color: isDark ? primaryColor : '#64748b' }}
                    >
                        Ao agendar, você concorda com nossos termos de privacidade e política de cancelamento.
                    </p>
                </form>
            </div>
        )}
      </div>
    </div>
  );
};

export default PublicBooking;