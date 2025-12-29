import { BusinessHours, UnavailabilityRule, User } from '../types';

/**
 * Verifica se um horário específico está dentro do funcionamento da clínica ou profissional.
 */
export const isWithinBusinessHours = (date: Date, hours?: BusinessHours): boolean => {
    if (!hours) return true; // Default aberto se não configurado
    const dayKey = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof BusinessHours;
    const schedule = hours[dayKey];
    if (!schedule || !schedule.isOpen) return false;

    const [startH, startM] = schedule.start.split(':').map(Number);
    const [endH, endM] = schedule.end.split(':').map(Number);
    
    const currentH = date.getHours();
    const currentM = date.getMinutes();
    
    const currentTotal = currentH * 60 + currentM;
    const startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;
    if (endTotal === 0) endTotal = 1440; // Meia noite

    return currentTotal >= startTotal && currentTotal < endTotal;
};

/**
 * Verifica se existe uma regra de indisponibilidade ativa para o momento e profissional.
 */
export const getUnavailabilityRule = (date: Date, rules: UnavailabilityRule[], professionalId: string): UnavailabilityRule | undefined => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    const dateStr = localDate.toISOString().split('T')[0];

    return rules.find(rule => {
        if (!rule.dates.includes(dateStr)) return false;
        
        const affectsUser = rule.professionalIds.includes('all') || rule.professionalIds.includes(professionalId);
        if (!affectsUser) return false;

        const [startH, startM] = rule.startTime.split(':').map(Number);
        const [endH, endM] = rule.endTime.split(':').map(Number);

        const slotStartMin = date.getHours() * 60 + date.getMinutes();
        const ruleStartMin = startH * 60 + startM;
        const ruleEndMin = endH * 60 + endM;

        return slotStartMin >= ruleStartMin && slotStartMin < ruleEndMin;
    });
};