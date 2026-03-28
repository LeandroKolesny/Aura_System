import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Upload } from 'lucide-react';
import { subscriptionsApi, SubscriptionPlan } from '../services/api';

interface Procedure {
  id: string;
  name: string;
  price: number;
}

interface PlanItem {
  procedureId: string;
  sessionsPerCycle: number;
}

interface Props {
  plan?: SubscriptionPlan | null;
  procedures: Procedure[];
  onClose: () => void;
  onSaved: () => void;
}

const SubscriptionPlanModal: React.FC<Props> = ({ plan, procedures, onClose, onSaved }) => {
  const isEditing = !!plan;

  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(plan?.price != null ? String(plan.price) : '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [items, setItems] = useState<PlanItem[]>(
    plan?.items.map((i) => ({ procedureId: i.procedureId, sessionsPerCycle: i.sessionsPerCycle })) ?? [
      { procedureId: '', sessionsPerCycle: 1 },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(plan?.imageUrl ?? '');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const addItem = () => setItems((prev) => [...prev, { procedureId: '', sessionsPerCycle: 1 }]);

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const updateItem = (index: number, field: keyof PlanItem, value: string | number) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) { setError('Nome do plano é obrigatório'); return; }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) { setError('Preço deve ser maior que zero'); return; }
    if (items.length === 0) { setError('Adicione pelo menos um procedimento ao plano'); return; }
    for (const item of items) {
      if (!item.procedureId) { setError('Selecione o procedimento para todos os itens'); return; }
      if (item.sessionsPerCycle < 1) { setError('Sessões por ciclo deve ser no mínimo 1'); return; }
    }
    // Check duplicates
    const ids = items.map((i) => i.procedureId);
    if (new Set(ids).size !== ids.length) { setError('Cada procedimento pode aparecer apenas uma vez no plano'); return; }

    setSaving(true);
    const payload = { name: name.trim(), price: parsedPrice, description: description.trim() || undefined, items, imageUrl: imageUrl || undefined };

    const res = isEditing
      ? await subscriptionsApi.updatePlan(plan!.id, payload)
      : await subscriptionsApi.createPlan(payload);

    setSaving(false);
    if (res.success) {
      onSaved();
    } else {
      setError(res.error ?? 'Erro ao salvar plano');
    }
  };

  const usedProcedureIds = new Set(items.map((i) => i.procedureId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {isEditing ? 'Editar Plano' : 'Novo Plano de Assinatura'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome do plano *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Plano Mensal de Limpeza de Pele"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Preço mensal (R$) *</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              min="0"
              step="0.01"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que está incluído no plano..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none"
            />
          </div>

          {/* Imagem do Plano */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Imagem do Plano (opcional)
            </label>
            {!imageUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-primary-400 transition-all">
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <p className="text-sm text-slate-500"><span className="font-semibold text-primary-600">Clique para enviar</span></p>
                <p className="text-xs text-slate-400">PNG, JPG ou WEBP (max. 2MB)</p>
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
                      let width = img.width, height = img.height;
                      if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
                      else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
                      canvas.width = width; canvas.height = height;
                      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
                      setImageUrl(canvas.toDataURL('image/jpeg', 0.8));
                    };
                    img.src = event.target?.result as string;
                  };
                  reader.readAsDataURL(file);
                }} />
              </label>
            ) : (
              <div className="relative rounded-lg overflow-hidden h-32 bg-slate-100 group">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button type="button" onClick={() => setImageUrl('')} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> Remover
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Procedures */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Procedimentos incluídos *</label>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select
                    value={item.procedureId}
                    onChange={(e) => updateItem(index, 'procedureId', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value="">Selecione o procedimento</option>
                    {procedures.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={usedProcedureIds.has(p.id) && item.procedureId !== p.id}
                      >
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      value={item.sessionsPerCycle}
                      onChange={(e) => updateItem(index, 'sessionsPerCycle', parseInt(e.target.value) || 1)}
                      min={1}
                      max={99}
                      className="w-16 px-2 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm text-center"
                    />
                    <span className="text-xs text-slate-400">ses.</span>
                  </div>

                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              "Ses." = sessões incluídas por mês para cada procedimento
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Salvar alterações' : 'Criar plano'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPlanModal;
