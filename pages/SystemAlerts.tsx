
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BellRing, Plus, Info, AlertTriangle, XCircle, CheckCircle, Calendar, Building, Eye, EyeOff } from 'lucide-react';
import { SystemAlert } from '../types';

const SystemAlerts: React.FC = () => {
  const { systemAlerts, addSystemAlert, companies, toggleSystemAlertStatus } = useApp();
  const [formData, setFormData] = useState({ title: '', message: '', type: 'info' as SystemAlert['type'], target: 'all' });

  const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      if (formData.title && formData.message) {
          addSystemAlert(formData);
          setFormData({ title: '', message: '', type: 'info', target: 'all' });
      }
  };

  const getTypeIcon = (type: SystemAlert['type']) => {
      switch (type) {
          case 'info': return <Info className="w-5 h-5 text-blue-500" />;
          case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
          case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
          case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      }
  };

  const getTargetLabel = (target: string) => {
      if (target === 'all') return 'Todas as Clínicas';
      const company = companies.find(c => c.id === target);
      return company ? company.name : 'Desconhecido';
  };

  return (
    <div className="space-y-8">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Alertas do Sistema</h1>
            <p className="text-slate-500">Gerencie os comunicados enviados para as clínicas.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Formulário de Criação */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary-600" /> Novo Alerta
                </h3>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                        <input 
                            type="text" 
                            required
                            className="w-full p-2 border rounded-lg"
                            placeholder="Ex: Manutenção Programada"
                            value={formData.title}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                        <select 
                            className="w-full p-2 border rounded-lg bg-white"
                            value={formData.type}
                            onChange={e => setFormData({...formData, type: e.target.value as any})}
                        >
                            <option value="info">Informação (Azul)</option>
                            <option value="warning">Aviso (Amarelo)</option>
                            <option value="error">Crítico (Vermelho)</option>
                            <option value="success">Sucesso (Verde)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Destinatário</label>
                        <select 
                            className="w-full p-2 border rounded-lg bg-white"
                            value={formData.target}
                            onChange={e => setFormData({...formData, target: e.target.value})}
                        >
                            <option value="all">Todas as Clínicas</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem</label>
                        <textarea 
                            required
                            rows={4}
                            className="w-full p-2 border rounded-lg resize-none"
                            placeholder="Escreva o comunicado aqui..."
                            value={formData.message}
                            onChange={e => setFormData({...formData, message: e.target.value})}
                        />
                    </div>
                    <button type="submit" className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm">
                        Enviar Alerta
                    </button>
                </form>
            </div>

            {/* Histórico */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-slate-500" /> Histórico de Envios
                </h3>
                
                {systemAlerts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        Nenhum alerta enviado ainda.
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {systemAlerts.map(alert => (
                                <div key={alert.id} className={`p-4 hover:bg-slate-50 transition-colors ${alert.status === 'inactive' ? 'opacity-60 grayscale' : ''}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            {getTypeIcon(alert.type)}
                                            <div>
                                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                    {alert.title}
                                                    {alert.status === 'inactive' && (
                                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-full uppercase">
                                                            Inativo
                                                        </span>
                                                    )}
                                                </h4>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> {new Date(alert.createdAt).toLocaleDateString()}
                                            </span>
                                            <button 
                                                onClick={() => toggleSystemAlertStatus(alert.id)}
                                                className={`p-1 rounded-full transition-colors ${alert.status === 'active' ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-200'}`}
                                                title={alert.status === 'active' ? 'Desativar' : 'Ativar'}
                                            >
                                                {alert.status === 'active' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-3 ml-8">{alert.message}</p>
                                    <div className="ml-8 flex items-center gap-2">
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded flex items-center gap-1">
                                            <Building className="w-3 h-3" /> {getTargetLabel(alert.target)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default SystemAlerts;
