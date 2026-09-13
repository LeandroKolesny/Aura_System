// __tests__/context/ClinicContext.test.tsx
// Testes do ClinicContext (dados públicos da clínica para o Portal do Paciente).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const getCompanyBySlug = vi.fn();

vi.mock('../../services/api', () => ({
  publicApi: {
    getCompanyBySlug: (...a: unknown[]) => getCompanyBySlug(...a),
  },
}));

import { ClinicProvider, useClinic } from '../../context/ClinicContext';

const wrapper = (slug: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <ClinicProvider slug={slug}>{children}</ClinicProvider>;
  };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('context/ClinicContext', () => {
  it('começa em isLoading=true e carrega a clínica com sucesso', async () => {
    getCompanyBySlug.mockResolvedValue({
      success: true,
      data: {
        company: {
          id: 'company-1',
          name: 'Clínica Bella',
          slug: 'clinica-bella',
          plan: 'PRO',
          subscriptionStatus: 'ACTIVE',
        },
        procedures: [
          { id: 'p1', name: 'Limpeza de pele', price: '150.5', cost: '30', durationMinutes: null, duration: 60 },
        ],
        professionals: [{ id: 'pr1', name: 'Dra. Ana' }],
      },
    });

    const { result } = renderHook(() => useClinic(), { wrapper: wrapper('clinica-bella') });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.clinic?.name).toBe('Clínica Bella');
    expect(result.current.clinic?.id).toBe('company-1');
    // plan/subscriptionStatus normalizados para lowercase
    expect(result.current.clinic?.plan).toBe('pro');
    expect(result.current.clinic?.subscriptionStatus).toBe('active');
    // preço/custo normalizados para Number
    expect(result.current.procedures).toHaveLength(1);
    expect(result.current.procedures[0].price).toBe(150.5);
    expect(result.current.procedures[0].cost).toBe(30);
    expect(result.current.procedures[0].durationMinutes).toBe(60);
    expect(result.current.professionals).toHaveLength(1);

    expect(getCompanyBySlug).toHaveBeenCalledWith('clinica-bella');
  });

  it('response.success=false define error="Clínica não encontrada"', async () => {
    getCompanyBySlug.mockResolvedValue({ success: false, error: 'not found' });

    const { result } = renderHook(() => useClinic(), { wrapper: wrapper('slug-inexistente') });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Clínica não encontrada');
    expect(result.current.clinic).toBeNull();
  });

  it('exceção de rede define error="Erro ao carregar dados da clínica"', async () => {
    getCompanyBySlug.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useClinic(), { wrapper: wrapper('clinica-bella') });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Erro ao carregar dados da clínica');
    expect(result.current.clinic).toBeNull();
  });

  it('useClinic fora de um ClinicProvider lança erro', () => {
    // Silencia o console.error do React sobre o erro não capturado do renderHook
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useClinic())).toThrow(
      'useClinic must be used within a ClinicProvider'
    );
    spy.mockRestore();
  });
});
