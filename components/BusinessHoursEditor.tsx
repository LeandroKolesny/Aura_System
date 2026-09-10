import React from 'react';
import { BusinessHours, DaySchedule } from '../types';

interface BusinessHoursEditorProps {
  value: BusinessHours;
  onChange: (newValue: BusinessHours) => void;
  disabled?: boolean;
  compact?: boolean;
}

/** Converte "HH:mm" para minutos desde a meia-noite (NaN se formato inesperado). */
const hhmmToMinutes = (time: string): number => {
  const [h, m] = (time ?? '').split(':').map(Number);
  return h * 60 + m;
};

/** Um dia aberto com abertura >= fechamento é inválido (a validação forte é no backend). */
export const isDayRangeInvalid = (day: DaySchedule): boolean => {
  if (!day?.isOpen) return false;
  const start = hhmmToMinutes(day.start);
  const end = hhmmToMinutes(day.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start >= end;
};

export const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({ value, onChange, disabled, compact = false }) => {
  const dayLabels: Record<keyof BusinessHours, string> = {
      monday: 'Segunda-feira',
      tuesday: 'Terça-feira',
      wednesday: 'Quarta-feira',
      thursday: 'Quinta-feira',
      friday: 'Sexta-feira',
      saturday: 'Sábado',
      sunday: 'Domingo'
  };

  // Valores padrão: Segunda a Sexta abertos das 08:00 às 18:00
  const defaultBusinessHours: BusinessHours = {
    monday: { isOpen: true, start: '08:00', end: '18:00' },
    tuesday: { isOpen: true, start: '08:00', end: '18:00' },
    wednesday: { isOpen: true, start: '08:00', end: '18:00' },
    thursday: { isOpen: true, start: '08:00', end: '18:00' },
    friday: { isOpen: true, start: '08:00', end: '18:00' },
    saturday: { isOpen: false, start: '08:00', end: '12:00' },
    sunday: { isOpen: false, start: '08:00', end: '12:00' },
  };

  // Garante que todos os dias tenham valores válidos
  const safeValue: BusinessHours = {
    monday: value?.monday || defaultBusinessHours.monday,
    tuesday: value?.tuesday || defaultBusinessHours.tuesday,
    wednesday: value?.wednesday || defaultBusinessHours.wednesday,
    thursday: value?.thursday || defaultBusinessHours.thursday,
    friday: value?.friday || defaultBusinessHours.friday,
    saturday: value?.saturday || defaultBusinessHours.saturday,
    sunday: value?.sunday || defaultBusinessHours.sunday,
  };

  // Decisão (item 1c da auditoria): NÃO impedimos o valor inválido no input —
  // sempre propagamos via onChange (o backend rejeita com 400 abertura >=
  // fechamento). Aqui só marcamos o campo visualmente e mostramos um aviso,
  // pra o usuário não salvar sem perceber.
  const handleDayChange = (day: keyof BusinessHours, field: keyof DaySchedule, fieldValue: string | boolean) => {
      onChange({
          ...safeValue,
          [day]: {
              ...safeValue[day],
              [field]: fieldValue
          }
      });
  };

  return (
    <div className={`space-y-${compact ? '2' : '4'}`}>
        {(Object.keys(dayLabels) as Array<keyof BusinessHours>).map(day => {
            const dayData = safeValue[day];
            const invalidRange = isDayRangeInvalid(dayData);
            const timeInputClass = `${compact ? 'p-1 w-20 text-xs' : 'p-2 text-sm'} border rounded-lg text-center ${invalidRange ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200'}`;
            return (
            <div key={day} className={`flex flex-wrap items-center justify-between ${compact ? 'p-2 text-sm' : 'p-3'} border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors`}>
                <div className={`flex items-center ${compact ? 'gap-2 w-32' : 'gap-4 w-40'}`}>
                    <input
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        checked={dayData.isOpen}
                        onChange={(e) => handleDayChange(day, 'isOpen', e.target.checked)}
                        disabled={disabled}
                        aria-label={`${dayLabels[day]} aberto`}
                    />
                    <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} ${dayData.isOpen ? 'text-slate-800' : 'text-slate-400'}`}>{dayLabels[day]}</span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="time"
                        className={timeInputClass}
                        value={dayData.start}
                        onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                        disabled={!dayData.isOpen || disabled}
                        aria-invalid={invalidRange}
                        aria-label={`${dayLabels[day]} horário de abertura`}
                    />
                    <span className="text-slate-400">-</span>
                    <input
                        type="time"
                        className={timeInputClass}
                        value={dayData.end}
                        onChange={(e) => handleDayChange(day, 'end', e.target.value)}
                        disabled={!dayData.isOpen || disabled}
                        aria-invalid={invalidRange}
                        aria-label={`${dayLabels[day]} horário de fechamento`}
                    />
                </div>
                {invalidRange && (
                    <p className="w-full text-xs text-red-600 mt-1 text-right" role="alert">
                        O horário de abertura deve ser menor que o de fechamento.
                    </p>
                )}
            </div>
            );
        })}
    </div>
  );
};
