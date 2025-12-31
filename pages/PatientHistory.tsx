import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, Clock, CheckCircle, XCircle, MapPin, ChevronRight, X, ImageIcon, Shield, PenTool, Info, Maximize2 } from 'lucide-react';
import { formatCurrency, formatDateTime, formatDate, getFriendlyDeviceInfo } from '../utils/formatUtils';
import { SignatureModal } from '../components/Modals';
import { Appointment, PhotoRecord, UserRole } from '../types';
import StatusBadge from '../components/StatusBadge';

const PatientHistory: React.FC = () => {
  const { appointments, patients, user, currentCompany, photos, signAppointmentConsent, loadAppointments, loadPatients } = useApp();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<PhotoRecord | null>(null);

  // Carregar dados ao montar
  useEffect(() => {
    loadAppointments(true); // Força reload para pegar dados atualizados
    loadPatients();
  }, [loadAppointments, loadPatients]);

  if (!user) return null;

  // Para pacientes, encontrar o patientId pelo email
  const currentPatientId = useMemo(() => {
    if (user.role === UserRole.PATIENT && user.email) {
      const patientRecord = patients.find(p => p.email === user.email);
      return patientRecord?.id || null;
    }
    return null;
  }, [user, patients]);

  const myAppointments = appointments
    .filter(a => currentPatientId && a.patientId === currentPatientId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const now = new Date();

  const upcoming = myAppointments.filter(a => {
      const apptDate = new Date(a.date);
      const isFuture = apptDate >= now;
      const isPending = a.status === 'pending_approval';
      return (isFuture && ['scheduled', 'confirmed'].includes(a.status)) || isPending;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const past = myAppointments.filter(a => {
      const apptDate = new Date(a.date);
      const isPast = apptDate < now;
      const isFinalized = ['completed', 'canceled'].includes(a.status);
      return (isPast && a.status !== 'pending_approval') || isFinalized;
  });

  const handleSignSave = (signatureBase64: string) => {
    if (selectedAppointment) {
      signAppointmentConsent(selectedAppointment.id, signatureBase64);
      setSelectedAppointment({
        ...selectedAppointment,
        signatureUrl: signatureBase64,
        signatureMetadata: {
          signedAt: new Date().toISOString(),
          ipAddress: 'Simulado',
          userAgent: navigator.userAgent,
          documentVersion: 'v1.0-appt-consent'
        }
      });
    }
  };

  const AppointmentDetailModal = ({ appointment, onClose }: { appointment: Appointment, onClose: () => void }) => {
    const relevantPhotos = photos.filter(p => 
      p.patientId === appointment.patientId && 
      p.procedure.toLowerCase() === appointment.service.toLowerCase()
    );

    const photosByGroup = useMemo(() => {
        return relevantPhotos.reduce((acc, photo) => {
            const gid = photo.groupId || 'default';
            if (!acc[gid]) acc[gid] = { before: undefined, after: undefined };
            acc[gid][photo.type] = photo;
            return acc;
        }, {} as Record<string, { before?: PhotoRecord; after?: PhotoRecord }>);
    }, [relevantPhotos]);

    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
          <div className="p-6 border-b border-slate-100 flex justify-between items-start shrink-0">
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900">{appointment.service}</h2>
              <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" /> {formatDateTime(appointment.date)}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                <StatusBadge status={appointment.status} showIcon />
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Profissional</p>
                <p className="font-bold text-slate-800">{appointment.professionalName}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary-600" /> Fotos de Evolução
              </h3>
              
              <div className="space-y-10">
                {Object.entries(photosByGroup).map(([groupId, setPhotos]: [string, { before?: PhotoRecord; after?: PhotoRecord }]) => (
                    <div key={groupId} className="animate-fade-in space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                Registro: {groupId.split('_')[1]?.slice(-6) || '01'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Antes</span>
                            {setPhotos.before ? (
                                <div 
                                  onClick={() => setViewingPhoto(setPhotos.before!)}
                                  className="aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm group relative cursor-pointer"
                                >
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                    <div className="p-2 bg-white/90 rounded-full text-slate-900 shadow-lg">
                                      <Maximize2 className="w-5 h-5" />
                                    </div>
                                  </div>
                                  <img src={setPhotos.before.url} alt="Antes" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                </div>
                            ) : (
                                <div className="aspect-square rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
                                <ImageIcon className="w-8 h-8 opacity-20" />
                                <span className="text-xs italic">Nenhuma foto</span>
                                </div>
                            )}
                            </div>
                            <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Depois</span>
                            {setPhotos.after ? (
                                <div 
                                  onClick={() => setViewingPhoto(setPhotos.after!)}
                                  className="aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm group relative cursor-pointer"
                                >
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                    <div className="p-2 bg-white/90 rounded-full text-slate-900 shadow-lg">
                                      <Maximize2 className="w-5 h-5" />
                                    </div>
                                  </div>
                                  <img src={setPhotos.after.url} alt="Depois" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                </div>
                            ) : (
                                <div className="aspect-square rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
                                <ImageIcon className="w-8 h-8 opacity-20" />
                                <span className="text-xs italic">Aguardando resultado</span>
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                ))}
                
                {Object.keys(photosByGroup).length === 0 && (
                    <div className="py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center gap-3">
                        <ImageIcon className="w-12 h-12 text-slate-200" />
                        <p className="text-sm text-slate-400 italic">Nenhum registro fotográfico para este atendimento.</p>
                    </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-slate-600" /> Assinatura do Procedimento
              </h3>
              {appointment.signatureUrl ? (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center text-center">
                  <div className="bg-white p-2 border border-slate-200 rounded mb-3">
                    <img src={appointment.signatureUrl} alt="Assinatura" className="h-16 object-contain" />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    <p>Assinado em {formatDateTime(appointment.signatureMetadata?.signedAt)}</p>
                    <p>Dispositivo: {getFriendlyDeviceInfo(appointment.signatureMetadata?.userAgent)}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500 mb-4 leading-relaxed">Confirme a realização deste procedimento assinando digitalmente.</p>
                  <button onClick={() => setIsSignModalOpen(true)} className="inline-flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-black transition-all shadow-lg">
                    <PenTool className="w-4 h-4" /> Assinar Digitalmente
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end">
            <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-100 transition-colors shadow-sm">Fechar Detalhes</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      <div><h1 className="text-2xl font-bold text-slate-900">Meu Histórico</h1><p className="text-slate-500">Acompanhe seus agendamentos futuros e consultas realizadas.</p></div>
      <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-primary-600" /> Próximas Consultas</h2>
          {upcoming.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">{upcoming.map(appt => (
                      <div key={appt.id} onClick={() => setSelectedAppointment(appt)} className="bg-white p-5 rounded-xl border border-primary-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden cursor-pointer hover:border-primary-400 hover:shadow-md transition-all group">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500"></div>
                          <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                  <StatusBadge status={appt.status} />
                                  <span className="text-sm text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(appt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <h3 className="font-bold text-lg text-slate-900 group-hover:text-primary-600 transition-colors">{appt.service}</h3>
                              <p className="text-sm text-slate-600 mt-1">Profissional: <strong>{appt.professionalName}</strong></p>
                          </div>
                          <div className="flex flex-col items-end gap-2 min-w-[120px]">
                              <div className="text-lg font-bold text-primary-600">{formatCurrency(appt.price)}</div>
                              <div className="text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-bold mt-1">Ver detalhes <ChevronRight className="w-3 h-3" /></div>
                          </div>
                      </div>))}</div>
          ) : (<div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center text-slate-500"><p>Você não tem agendamentos futuros.</p></div>)}
      </section>
      <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-slate-500" /> Histórico de Consultas</h2>
          {past.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="divide-y divide-slate-100">{past.map(appt => (
                          <div key={appt.id} onClick={() => setSelectedAppointment(appt)} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer group">
                              <div className="flex items-start gap-4">
                                  <div className={`p-3 rounded-full shrink-0 ${appt.status === 'completed' ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-600'}`}>{appt.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}</div>
                                  <div><h4 className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">{appt.service}</h4><p className="text-xs text-slate-500 mt-0.5">{formatDateTime(appt.date)} • {appt.professionalName}</p></div>
                              </div>
                              <div className="flex items-center gap-4 self-end sm:self-center">
                                  <div className="text-right mr-2"><span className="text-sm font-medium text-slate-600 block">{formatCurrency(appt.price)}</span></div>
                                  <StatusBadge status={appt.status} />
                                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-400 transition-colors" />
                              </div>
                          </div>))}</div>
              </div>
          ) : (<div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center text-slate-500"><p>Nenhum histórico disponível.</p></div>)}
      </section>
      {selectedAppointment && <AppointmentDetailModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} />}
      {isSignModalOpen && <SignatureModal onClose={() => setIsSignModalOpen(false)} onSave={handleSignSave} />}
      
      {/* Full Screen Photo Viewer */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in">
           <button 
            onClick={() => setViewingPhoto(null)} 
            className="absolute top-4 right-4 text-white p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all z-50 shadow-xl backdrop-blur-sm"
           >
             <X className="w-8 h-8" />
           </button>
           <div className="relative max-w-full max-h-[85vh] group">
            <img src={viewingPhoto.url} alt="Ampliada" className="max-h-[85vh] max-w-full rounded-lg shadow-2xl border border-white/10" />
           </div>
           <div className="mt-8 text-white text-center animate-fade-in">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${viewingPhoto.type === 'before' ? 'bg-slate-700' : 'bg-green-600'}`}>
                {viewingPhoto.type === 'before' ? 'Antes' : 'Depois'}
              </span>
              <p className="mt-4 text-xl font-serif">{viewingPhoto.procedure}</p>
              <p className="text-sm text-slate-400 mt-1">{formatDate(viewingPhoto.date)}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default PatientHistory;