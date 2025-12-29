import React from 'react';
import { BusinessHours, DaySchedule } from '../types';

interface BusinessHoursEditorProps {
  value: BusinessHours;
  onChange: (newValue: BusinessHours) => void;
  disabled?: boolean;
  compact?: boolean;
}

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

  const handleDayChange = (day: keyof BusinessHours, field: keyof DaySchedule, fieldValue: any) => {
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
            return (
            <div key={day} className={`flex items-center justify-between ${compact ? 'p-2 text-sm' : 'p-3'} border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors`}>
                <div className={`flex items-center ${compact ? 'gap-2 w-32' : 'gap-4 w-40'}`}>
                    <input
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        checked={dayData.isOpen}
                        onChange={(e) => handleDayChange(day, 'isOpen', e.target.checked)}
                        disabled={disabled}
                    />
                    <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} ${dayData.isOpen ? 'text-slate-800' : 'text-slate-400'}`}>{dayLabels[day]}</span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="time"
                        className={`${compact ? 'p-1 w-20 text-xs' : 'p-2 text-sm'} border border-slate-200 rounded-lg text-center`}
                        value={dayData.start}
                        onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                        disabled={!dayData.isOpen || disabled}
                    />
                    <span className="text-slate-400">-</span>
                    <input
                        type="time"
                        className={`${compact ? 'p-1 w-20 text-xs' : 'p-2 text-sm'} border border-slate-200 rounded-lg text-center`}
                        value={dayData.end}
                        onChange={(e) => handleDayChange(day, 'end', e.target.value)}
                        disabled={!dayData.isOpen || disabled}
                    />
                </div>
            </div>
            );
        })}
    </div>
  );
};
