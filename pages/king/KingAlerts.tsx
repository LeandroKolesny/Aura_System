import React, { useState } from 'react';
import {
  BellRing, Plus, Info, AlertTriangle, XCircle, CheckCircle,
  Calendar, Building, Eye, EyeOff, Send, History, Megaphone
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SystemAlert } from '../../types';

const KingAlerts: React.FC = () => {
  const { systemAlerts, addSystemAlert, companies, toggleSystemAlertStatus } = useApp();
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as SystemAlert['type'],
    target: 'all'
  });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && formData.message) {
      addSystemAlert(formData);
      setFormData({ title: '', message: '', type: 'info', target: 'all' });
      setIsFormOpen(false);
    }
  };

  const getTypeConfig = (type: SystemAlert['type']) => {
    switch (type) {
      case 'info':
        return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Informativo' };
      case 'warning':
        return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Aviso' };
      case 'error':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', label: 'Urgente' };
      case 'success':
        return { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Sucesso' };
    }
  };

  const getTargetLabel = (target: string) => {
    if (target === 'all') return 'Todas as Clínicas';
    const company = companies.find(c => c.id === target);
    return company ? company.name : 'Clínica Específica';
  };

  // Stats
  const activeAlerts = systemAlerts.filter(a => a.status === 'active').length;
  const totalAlerts = systemAlerts.length;
  const inactiveAlerts = systemAlerts.filter(a => a.status === 'inactive').length;
  const globalAlerts = systemAlerts.filter(a => a.target === 'all').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-amber-500" />
            Alertas do Sistema
          </h1>
          <p className="text-slate-500 mt-1">
            Envie comunicados e avisos para as clínicas cadastradas
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center gap-2 shadow-sm transition-colors font-medium"
        >
          <Plus className="w-4 h-4" /> Novo Alerta
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total de Alertas</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{totalAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <BellRing className="w-6 h-6 text-slate-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ativos</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{activeAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Eye className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Inativos</p>
              <p className="text-3xl font-bold text-slate-400 mt-1">{inactiveAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <EyeOff className="w-6 h-6 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Globais</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{globalAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Building className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-3">
          <History className="w-5 h-5 text-slate-500" />
          <h2 className="font-bold text-slate-800">Histórico de Alertas</h2>
        </div>

        {systemAlerts.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400">Nenhum alerta enviado</h3>
            <p className="text-sm text-slate-400 mt-1">Clique em "Novo Alerta" para criar um comunicado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {systemAlerts.map(alert => {
              const config = getTypeConfig(alert.type);
              const Icon = config.icon;

              return (
                <div
                  key={alert.id}
                  className={`p-5 hover:bg-slate-50 transition-colors ${
                    alert.status === 'inactive' ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-bold text-slate-800">{alert.title}</h4>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                        {alert.status === 'inactive' && (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-full uppercase">
                            Inativo
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-600 mb-3">{alert.message}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(alert.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {getTargetLabel(alert.target)}
                        </span>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => toggleSystemAlertStatus(alert.id)}
                      className={`p-2 rounded-xl transition-all ${
                        alert.status === 'active'
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                      title={alert.status === 'active' ? 'Desativar alerta' : 'Ativar alerta'}
                    >
                      {alert.status === 'active' ? (
                        <Eye className="w-5 h-5" />
                      ) : (
                        <EyeOff className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                Novo Alerta do Sistema
              </h3>
              <p className="text-amber-100 text-sm">Envie um comunicado para as clínicas</p>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Título do Alerta *
                </label>
                <input
                  type="text"
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  placeholder="Ex: Manutenção Programada"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Type & Target */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Tipo
                  </label>
                  <select
                    className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="info">Informativo (Azul)</option>
                    <option value="warning">Aviso (Amarelo)</option>
                    <option value="error">Urgente (Vermelho)</option>
                    <option value="success">Sucesso (Verde)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Destinatário
                  </label>
                  <select
                    className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    value={formData.target}
                    onChange={e => setFormData({ ...formData, target: e.target.value })}
                  >
                    <option value="all">Todas as Clínicas</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Mensagem *
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none transition-all"
                  placeholder="Escreva o comunicado que será exibido para as clínicas..."
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              {/* Preview */}
              {formData.title && formData.message && (
                <div className={`p-4 rounded-xl border ${getTypeConfig(formData.type).bg} ${getTypeConfig(formData.type).border}`}>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Prévia do Alerta</p>
                  <div className="flex items-start gap-3">
                    {React.createElement(getTypeConfig(formData.type).icon, {
                      className: `w-5 h-5 ${getTypeConfig(formData.type).color}`
                    })}
                    <div>
                      <p className="font-bold text-slate-800">{formData.title}</p>
                      <p className="text-sm text-slate-600">{formData.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium flex items-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  Enviar Alerta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KingAlerts;
