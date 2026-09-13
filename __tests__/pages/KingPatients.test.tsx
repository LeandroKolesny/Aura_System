// __tests__/pages/KingPatients.test.tsx
// Testes da página pages/king/KingPatients.tsx (visão global de pacientes por clínica).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const companiesMock = vi.fn();
const patientsMock = vi.fn();

vi.mock('../../services/api', () => ({
  kingApi: {
    companies: (...a: unknown[]) => companiesMock(...a),
    patients: (...a: unknown[]) => patientsMock(...a),
  },
}));

import KingPatients from '../../pages/king/KingPatients';

const render = () =>
  rtlRender(<KingPatients />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

interface CompanyFixture {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  _count: { patients: number; appointments: number; users: number };
}

interface PatientFixture {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  birthDate: string | null;
  lastVisit: string | null;
  createdAt: string;
  company: { id: string; name: string; slug: string };
}

function makeCompany(over: Partial<CompanyFixture> = {}): CompanyFixture {
  return {
    id: 'c1',
    name: 'Clínica A',
    slug: 'clinica-a',
    plan: 'PROFESSIONAL',
    subscriptionStatus: 'ACTIVE',
    _count: { patients: 1, appointments: 0, users: 1 },
    ...over,
  };
}

function makePatient(over: Partial<PatientFixture> = {}): PatientFixture {
  return {
    id: 'p1',
    name: 'Ana Lima',
    email: 'ana@example.com',
    phone: '11999990000',
    status: 'ACTIVE',
    birthDate: null,
    lastVisit: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    company: { id: 'c1', name: 'Clínica A', slug: 'clinica-a' },
    ...over,
  };
}

const companiesOk = (companies: CompanyFixture[]) => ({
  success: true,
  data: { success: true, data: { companies } },
});

const patientsOk = (patients: PatientFixture[], total = patients.length) => ({
  success: true,
  data: { success: true, data: { patients, total } },
});

beforeEach(() => {
  vi.clearAllMocks();
  companiesMock.mockResolvedValue(companiesOk([makeCompany()]));
  patientsMock.mockResolvedValue(patientsOk([makePatient()]));
});

describe('pages/king/KingPatients', () => {
  it('mostra o spinner de carregamento antes da resposta da API', async () => {
    let resolve: (v: unknown) => void = () => {};
    patientsMock.mockImplementation(() => new Promise((r) => { resolve = r; }));

    const { container } = render();
    expect(container.querySelector('.animate-spin')).toBeTruthy();

    resolve(patientsOk([makePatient()]));
    await screen.findByText('Clínica A');
  });

  it('agrupa pacientes por clínica e mostra a contagem no cabeçalho do acordeão', async () => {
    render();
    await screen.findByText('Clínica A');
    expect(screen.getByText('1 pacientes')).toBeInTheDocument();
  });

  it('expande uma clínica ao clicar e mostra os dados do paciente (sem misturar com outra clínica)', async () => {
    companiesMock.mockResolvedValue(companiesOk([makeCompany({ id: 'c1', name: 'Clínica A' }), makeCompany({ id: 'c2', name: 'Clínica B' })]));
    patientsMock.mockResolvedValue(patientsOk([
      makePatient({ id: 'p1', name: 'Ana Lima', company: { id: 'c1', name: 'Clínica A', slug: 'clinica-a' } }),
      makePatient({ id: 'p2', name: 'Beto Souza', email: 'beto@example.com', company: { id: 'c2', name: 'Clínica B', slug: 'clinica-b' } }),
    ]));

    render();
    await screen.findByText('Clínica A');

    fireEvent.click(screen.getByText('Clínica A'));
    await screen.findByText('Ana Lima');
    // Paciente da OUTRA clínica não deve aparecer na seção da Clínica A
    expect(screen.queryByText('Beto Souza')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Clínica B'));
    await screen.findByText('Beto Souza');
  });

  it('busca filtra por nome, email ou telefone', async () => {
    patientsMock.mockResolvedValue(patientsOk([
      makePatient({ id: 'p1', name: 'Ana Lima', email: 'ana@example.com' }),
      makePatient({ id: 'p2', name: 'Beto Souza', email: 'beto@example.com' }),
    ]));
    render();
    await screen.findByText('Clínica A');
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Tudo' }));
    await screen.findByText('Ana Lima');
    expect(screen.getByText('Beto Souza')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome, email ou telefone...'), {
      target: { value: 'ana' },
    });

    await waitFor(() => expect(screen.queryByText('Beto Souza')).not.toBeInTheDocument());
    expect(screen.getByText('Ana Lima')).toBeInTheDocument();
  });

  it('usa o total retornado pela API (não o tamanho da página buscada) no KPI "Total de Pacientes"', async () => {
    patientsMock.mockResolvedValue(patientsOk([makePatient()], 1234));
    render();
    await screen.findByText('Clínica A');

    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('avisa quando a lista buscada é menor que o total real (truncamento)', async () => {
    patientsMock.mockResolvedValue(patientsOk([makePatient()], 1234));
    render();
    await screen.findByText('Clínica A');

    expect(screen.getByText(/Mostrando os primeiros/)).toBeInTheDocument();
  });

  it('não mostra aviso de truncamento quando o total bate com o buscado', async () => {
    patientsMock.mockResolvedValue(patientsOk([makePatient()], 1));
    render();
    await screen.findByText('Clínica A');

    expect(screen.queryByText(/Mostrando os primeiros/)).not.toBeInTheDocument();
  });

  it('erro ao buscar pacientes é comunicado ao usuário (não fica silencioso)', async () => {
    patientsMock.mockResolvedValue({ success: false, error: 'Acesso restrito ao Owner' });
    render();

    await waitFor(() => expect(screen.getByText(/Acesso restrito ao Owner/)).toBeInTheDocument());
  });

  it('erro ao buscar empresas é comunicado ao usuário (não fica silencioso)', async () => {
    companiesMock.mockResolvedValue({ success: false, error: 'Erro interno' });
    render();

    await waitFor(() => expect(screen.getByText(/Erro interno/)).toBeInTheDocument());
  });

  it('erro de rede (exceção) exibe "Erro de conexão"', async () => {
    patientsMock.mockRejectedValueOnce(new Error('network down'));
    render();

    await screen.findByText('Erro de conexão');
  });

  it('botão "Atualizar" recarrega os dados', async () => {
    render();
    await screen.findByText('Clínica A');
    expect(patientsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Atualizar/i }));
    await waitFor(() => expect(patientsMock).toHaveBeenCalledTimes(2));
  });

  it('mostra estado vazio quando não há empresas cadastradas', async () => {
    companiesMock.mockResolvedValue(companiesOk([]));
    patientsMock.mockResolvedValue(patientsOk([]));
    render();

    await screen.findByText('Nenhuma empresa cadastrada.');
  });
});
