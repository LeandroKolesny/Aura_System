// components/PhotoAnnotationModal.tsx
//
// Permite marcar regiões nas fotos de evolução (antes/depois) — círculo, seta
// ou traço livre, por exemplo pra indicar onde um botox foi aplicado. Usa
// react-konva (Konva.js) em vez de canvas manual: já resolve pointer/touch de
// forma unificada e nos dá formas editáveis antes de "achatar" o resultado.
//
// O resultado marcado é salvo como uma NOVA foto (mesmo procedimento/tipo,
// groupId diferente) — não sobrescreve a foto original, que continua intacta
// na galeria do paciente.
import React, { useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Circle, Arrow, Line } from 'react-konva';
import useImage from 'use-image';
import { X, Circle as CircleIcon, ArrowUpRight, Pencil, Undo2, Trash2, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { PhotoRecord } from '../types';

type Tool = 'circle' | 'arrow' | 'pen';

type Shape =
  | { id: string; tool: 'circle'; x: number; y: number; radius: number; color: string }
  | { id: string; tool: 'arrow'; points: number[]; color: string }
  | { id: string; tool: 'pen'; points: number[]; color: string };

const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ffffff'];
const MAX_STAGE_WIDTH = 700;
const MAX_STAGE_HEIGHT = 520;

type KonvaPointerEvent = Konva.KonvaEventObject<MouseEvent> | Konva.KonvaEventObject<TouchEvent>;

export const PhotoAnnotationModal: React.FC<{
  photo: PhotoRecord;
  patientId: string;
  onClose: () => void;
}> = ({ photo, patientId, onClose }) => {
  const { addPhoto } = useApp();
  const { showAlert } = useDialog();
  const [image, status] = useImage(photo.url, 'anonymous');
  const [tool, setTool] = useState<Tool>('circle');
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);
  const currentShapeId = useRef<string | null>(null);

  // Escala a imagem original pro tamanho de exibição, mantendo proporção
  // (as fotos podem vir de câmeras com resolução bem maior que o modal).
  const scale = image ? Math.min(MAX_STAGE_WIDTH / image.width, MAX_STAGE_HEIGHT / image.height, 1) : 1;
  const stageWidth = image ? image.width * scale : MAX_STAGE_WIDTH;
  const stageHeight = image ? image.height * scale : MAX_STAGE_HEIGHT;

  const handlePointerDown = (e: KonvaPointerEvent) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setIsDrawing(true);
    const id = `shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    currentShapeId.current = id;
    setShapes(prev => [
      ...prev,
      tool === 'circle'
        ? { id, tool: 'circle', x: pos.x, y: pos.y, radius: 0, color }
        : { id, tool, points: [pos.x, pos.y], color },
    ]);
  };

  const handlePointerMove = (e: KonvaPointerEvent) => {
    if (!isDrawing || !currentShapeId.current) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setShapes(prev => prev.map(s => {
      if (s.id !== currentShapeId.current) return s;
      if (s.tool === 'circle') {
        const dx = pos.x - s.x;
        const dy = pos.y - s.y;
        return { ...s, radius: Math.sqrt(dx * dx + dy * dy) };
      }
      if (s.tool === 'arrow') {
        return { ...s, points: [s.points[0], s.points[1], pos.x, pos.y] };
      }
      return { ...s, points: [...s.points, pos.x, pos.y] };
    }));
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    currentShapeId.current = null;
  };

  const undo = () => setShapes(prev => prev.slice(0, -1));
  const clearAll = () => setShapes([]);

  const handleSave = async () => {
    if (!stageRef.current || shapes.length === 0) return;
    setIsSaving(true);
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
      const result = await addPhoto({
        patientId,
        date: photo.date,
        url: dataUrl,
        type: photo.type,
        procedure: photo.procedure,
        // Groupid diferente: aparece como um novo "conjunto" ao lado do
        // original, em vez de substituir a foto sem marcação na galeria.
        groupId: `${photo.groupId}_anotado_${Date.now()}`,
      });
      if (!result.success) {
        showAlert(result.error ?? 'Erro de sistema. Tente novamente.', { variant: 'danger' });
        setIsSaving(false);
        return;
      }
      onClose();
    } catch (error) {
      console.error('Erro ao salvar marcação na foto:', error);
      showAlert('Erro de sistema. Tente novamente.', { variant: 'danger' });
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Marcar Região no Registro Fotográfico</h3>
            <p className="text-xs text-slate-500 mt-0.5">{photo.procedure} • {photo.type === 'before' ? 'Antes' : 'Depois'}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-white shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setTool('circle')} className={`p-2 rounded-md transition-colors ${tool === 'circle' ? 'bg-white shadow text-primary-600' : 'text-slate-500 hover:text-slate-700'}`} title="Círculo"><CircleIcon className="w-4 h-4" /></button>
            <button onClick={() => setTool('arrow')} className={`p-2 rounded-md transition-colors ${tool === 'arrow' ? 'bg-white shadow text-primary-600' : 'text-slate-500 hover:text-slate-700'}`} title="Seta"><ArrowUpRight className="w-4 h-4" /></button>
            <button onClick={() => setTool('pen')} className={`p-2 rounded-md transition-colors ${tool === 'pen' ? 'bg-white shadow text-primary-600' : 'text-slate-500 hover:text-slate-700'}`} title="Traço livre"><Pencil className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 shadow transition-transform ${color === c ? 'border-slate-900 scale-110' : 'border-white'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={undo} disabled={shapes.length === 0} className="p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Desfazer"><Undo2 className="w-4 h-4" /></button>
            <button onClick={clearAll} disabled={shapes.length === 0} className="p-2 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Limpar tudo"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-800 flex items-center justify-center p-4 min-h-[300px]">
          {status === 'loading' && <p className="text-white/60 text-sm">Carregando imagem...</p>}
          {status === 'failed' && <p className="text-red-300 text-sm">Não foi possível carregar a imagem.</p>}
          {status === 'loaded' && image && (
            <Stage
              ref={stageRef}
              width={stageWidth}
              height={stageHeight}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
              className="rounded-lg overflow-hidden shadow-2xl cursor-crosshair"
            >
              <Layer>
                <KonvaImage image={image} width={stageWidth} height={stageHeight} />
                {shapes.map(s => {
                  if (s.tool === 'circle') {
                    return <Circle key={s.id} x={s.x} y={s.y} radius={s.radius} stroke={s.color} strokeWidth={3} />;
                  }
                  if (s.tool === 'arrow') {
                    return <Arrow key={s.id} points={s.points} stroke={s.color} fill={s.color} strokeWidth={3} pointerLength={12} pointerWidth={12} />;
                  }
                  return <Line key={s.id} points={s.points} stroke={s.color} strokeWidth={3} tension={0.4} lineCap="round" lineJoin="round" />;
                })}
              </Layer>
            </Stage>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white shrink-0">
          <button onClick={onClose} disabled={isSaving} className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button onClick={handleSave} disabled={isSaving || shapes.length === 0} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar Marcação'}
          </button>
        </div>
      </div>
    </div>
  );
};
