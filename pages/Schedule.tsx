import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, User as UserIcon, AlertCircle, X, CheckCircle, Bell, Info, XCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NewAppointmentModal, CheckoutModal, ReviewAppointmentModal, PatientAppointmentViewModal } from '../components/Modals';
import { Appointment, UserRole, AppNotification } from '../types';
import { isWithinBusinessHours, getUnavailabilityRule } from '../utils/availabilityUtils';
import { APPOINTMENT_VISUAL_CONFIG } from '../utils/statusUtils';

const Schedule: React.FC = () => {
  const { appointments, professionals, patients, currentCompany, user, isReadOnly, unavailabilityRules, notifications, markNotificationAsRead, loadAppointments, loadPatients, loadProcedures, loadingStates } = useApp();

  // Para pacientes logados, encontrar seu patientId pelo email
  const currentPatientId = useMemo(() => {
    if (user?.role === UserRole.PATIENT && user?.email) {
      const patientRecord = patients.find(p => p.email === user.email);
      return patientRecord?.id || null;
    }
    return null;
  }, [user, patients]);

  // Lazy loading: carregar dados quando a página montar
  useEffect(() => {
    loadAppointments();
    loadPatients();
    loadProcedures();
  }, [loadAppointments, loadPatients, loadProcedures]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('all');
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [preSelectedTime, setPreSelectedTime] = useState<Date | undefined>(undefined);

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          const [year, month, day] = e.target.value.split('-').map(Number);
          setSelectedDate(new Date(year, month - 1, day));
      }
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(appt => {
      const isSameDay = new Date(appt.date).toDateString() === selectedDate.toDateString();
      if (!isSameDay) return false;
      return selectedProfessionalId === 'all' || appt.professionalId === selectedProfessionalId;
    });
  }, [appointments, selectedDate, selectedProfessionalId]);

  const isPatient = user?.role === UserRole.PATIENT;

  // FILTRO INTELIGENTE DE NOTIFICAÇÕES
  const unreadNotifications = useMemo(() => {
    // O admin já gerencia as solicitações pelo Dashboard. 
    // Na agenda, mostramos alertas apenas para o Paciente (avisando que seu horário foi confirmado).
    if (!isPatient) return [];

    return notifications.filter(n => {
        if (n.read) return false;
        
        // Paciente vê apenas notificações com seu ID e do tipo SUCESSO (Confirmado)
        return n.recipientId === user?.id && n.type === 'success';
    });
  }, [notifications, isPatient, user]);

  const getNotifConfig = (type: AppNotification['type']) => {
      switch(type) {
          case 'success':
              return {
                  title: 'Agendamento Confirmado!',
                  bg: 'bg-green-50',
                  border: 'border-green-100',
                  text: 'text-green-900',
                  desc: 'text-green-700',
                  iconBg: 'bg-white text-green-600',
                  hover: 'hover:bg-green-100',
                  icon: CheckCircle
              };
          case 'error':
              return {
                  title: 'Atenção / Cancelamento',
                  bg: 'bg-red-50',
                  border: 'border-red-100',
                  text: 'text-red-900',
                  desc: 'text-red-700',
                  iconBg: 'bg-white text-green-600',
                  hover: 'hover:bg-green-100',
                  icon: XCircle
              };
          default:
              return {
                  title: 'Aviso da Clínica',
                  bg: 'bg-blue-50',
                  border: 'border-blue-100',
                  text: 'text-blue-900',
                  desc: 'text-blue-700',
                  iconBg: 'bg-white text-blue-600',
                  hover: 'hover:bg-blue-100',
                  icon: Info
              };
      }
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 17 }, (_, i) => i + 6);

    return (
      <div className="space-y-2">
        {hours.map(hour => {
          const dateRef = new Date(selectedDate);
          dateRef.setHours(hour, 0, 0, 0);
          
          const hourStart = dateRef.getTime();
          const hourEnd = hourStart + (60 * 60 * 1000);

          const prof = professionals.find(p => p.id === selectedProfessionalId);
          const isBusinessHour = isWithinBusinessHours(dateRef, prof?.businessHours || currentCompany?.businessHours);
          const unavRule = getUnavailabilityRule(dateRef, unavailabilityRules, selectedProfessionalId);
          const isBlocked = !!unavRule;

          const hourAppointments = filteredAppointments.filter(appt => {
              const apptStart = new Date(appt.date).getTime();
              const apptEnd = apptStart + (appt.durationMinutes * 60000);
              return Math.max(hourStart, apptStart) < Math.min(hourEnd, apptEnd);
          });

          return (
            <div key={hour} className={`flex min-h-[80px] border-b border-slate-100 relative ${!isBusinessHour ? 'bg-slate-50/50' : isBlocked ? 'bg-red-50/40' : ''}`}>
              <div className="w-16 py-2 text-xs font-medium text-slate-400 text-center border-r border-slate-100 flex flex-col justify-between">
                <span>{hour.toString().padStart(2, '0')}:00</span>
              </div>
              
              <div className="flex-1 p-2 relative group" onClick={() => {
                    if (isReadOnly || isBlocked || !isBusinessHour) return;
                    setPreSelectedTime(dateRef);
                    setIsNewAppointmentModalOpen(true);
                }}>
                {!isBusinessHour && <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-slate-50/30"><span className="text-[10px] text-slate-300 font-medium uppercase tracking-widest -rotate-12 select-none">Fechado</span></div>}
                {isBlocked && <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(254, 202, 202, 0.2) 0, rgba(254, 202, 202, 0.2) 10px, transparent 10px, transparent 20px)' }}><div className="bg-white/90 px-3 py-1 rounded-full border border-red-100 shadow-sm flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-red-500" /><span className="text-xs text-red-600 font-medium">{unavRule?.description || 'Indisponível'}</span></div></div>}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 relative z-10 h-full">
                    {hourAppointments.map(appt => {
                        const isOtherPatientAppt = isPatient && currentPatientId && appt.patientId !== currentPatientId;
                        const apptStart = new Date(appt.date);
                        const isContinuation = apptStart.getHours() < hour;

                        if (isOtherPatientAppt) {
                          return (
                            <div 
                              key={appt.id} 
                              className="h-full min-h-[40px] rounded-lg border border-red-100 bg-red-50/50 flex items-center justify-center relative overflow-hidden cursor-not-allowed shadow-sm select-none"
                              title="Horário ocupado por outro paciente"
                            >
                                <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest -rotate-12">
                                    Ocupado
                                </span>
                            </div>
                          );
                        }

                        const visual = APPOINTMENT_VISUAL_CONFIG[appt.status] || APPOINTMENT_VISUAL_CONFIG.scheduled;
                        const isCanceled = appt.status === 'canceled';

                        return (
                          <div 
                              key={appt.id} 
                              onClick={(e) => { e.stopPropagation(); setSelectedAppointment(appt); }} 
                              className={`p-2 rounded-lg text-xs border cursor-pointer hover:shadow-md transition-all relative ${visual.bg} ${visual.border} ${visual.text} ${isContinuation ? 'opacity-60 border-dashed' : ''} ${isCanceled ? 'opacity-70 grayscale-[0.3]' : ''}`}
                          >
                              <div className={`font-bold truncate ${isCanceled ? 'line-through decoration-2' : ''}`}>{appt.patientName}</div>
                              <div className={`truncate opacity-80 ${isCanceled ? 'line-through' : ''}`}>{appt.service} {isContinuation && '(continuação)'}</div>
                              <div className="flex justify-between items-center mt-1">
                                  <span>{apptStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  <span className="bg-white/50 px-1.5 rounded text-[10px] ml-1">{appt.durationMinutes} min</span>
                              </div>
                              {isCanceled && (
                                <div className="absolute top-1 right-1">
                                  <XCircle className="w-3 h-3 text-red-500" />
                                </div>
                              )}
                          </div>
                        );
                    })}
                </div>
                {isBusinessHour && !isBlocked && !isReadOnly && hourAppointments.length === 0 && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><button className="bg-primary-50 text-primary-600 rounded-full p-1 shadow-sm"><Plus className="w-4 h-4" /></button></div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const dateInputValue = selectedDate.toISOString().split('T')[0];

  // Loading state
  const isLoading = loadingStates.appointments && appointments.length === 0;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Carregando agenda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
        <style>{`.custom-date-input::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 0; cursor: pointer; opacity: 0; }`}</style>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
              <p className="text-slate-500">{isPatient ? 'Visualize e solicite seus agendamentos.' : 'Gerencie os atendimentos da clínica.'}</p>
            </div>
            {!isPatient && !isReadOnly && (
              <button onClick={() => { setPreSelectedTime(undefined); setIsNewAppointmentModalOpen(true); }} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors">
                <Plus className="w-4 h-4" /> Novo Agendamento
              </button>
            )}
        </div>

        {/* ÁREA DE NOTIFICAÇÕES (APENAS PARA PACIENTE NESTA TELA) */}
        {unreadNotifications.length > 0 && (
          <div className="mb-6 space-y-3 animate-fade-in">
              {unreadNotifications.map(notif => {
                const config = getNotifConfig(notif.type);
                const Icon = config.icon;
                return (
                    <div key={notif.id} className={`group relative p-4 rounded-xl border ${config.bg} ${config.border} flex items-center gap-4 shadow-sm transition-all hover:shadow-md`}>
                        <div className={`p-2.5 rounded-lg shadow-sm shrink-0 ${config.iconBg}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className={`font-bold text-sm tracking-tight mb-0.5 ${config.text}`}>{config.title}</p>
                            <p className={`text-xs leading-relaxed ${config.desc}`}>{notif.message}</p>
                        </div>
                        <button 
                            onClick={() => markNotificationAsRead(notif.id)}
                            className={`p-1.5 rounded-full transition-all shrink-0 ${config.desc} hover:bg-black/5`}
                            title="Marcar como lida"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                );
              })}
          </div>
        )}

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                <div className="relative group cursor-pointer">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-lg"><CalendarIcon className="w-5 h-5 text-primary-600" /><span className="capitalize">{selectedDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })}</span></div>
                    <input type="date" className="custom-date-input absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleDateSelect} value={dateInputValue} />
                </div>
                <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                <button onClick={() => setSelectedDate(new Date())} className="text-xs font-medium text-primary-600 hover:underline ml-2">Hoje</button>
            </div>
            {!isPatient && (
              <div className="relative w-full md:w-64">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select className="w-full pl-9 p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white outline-none" value={selectedProfessionalId} onChange={(e) => setSelectedProfessionalId(e.target.value)}>
                  <option value="all">Todos os Profissionais</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">{renderDayView()}</div>
        </div>

        {isNewAppointmentModalOpen && !isReadOnly && <NewAppointmentModal onClose={() => setIsNewAppointmentModalOpen(false)} preSelectedDate={preSelectedTime || selectedDate} preSelectedProfessionalId={selectedProfessionalId} />}
        
        {selectedAppointment && (
            isPatient ? (
                <PatientAppointmentViewModal 
                    appointment={selectedAppointment} 
                    onClose={() => setSelectedAppointment(null)} 
                />
            ) : (
                selectedAppointment.status === 'pending_approval' ? (
                    <ReviewAppointmentModal 
                        appointment={selectedAppointment} 
                        onClose={() => setSelectedAppointment(null)} 
                    />
                ) : (
                    <CheckoutModal 
                        appointment={selectedAppointment} 
                        onClose={() => setSelectedAppointment(null)} 
                    />
                )
            )
        )}
    </div>
  );
};

export default Schedule;