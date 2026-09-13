// __tests__/pages/KingAppointments.test.tsx
// Testes da página pages/king/KingAppointments.tsx (visão global de agendamentos por clínica).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatUtils';

const brl = (n: number) => formatCurrency(n).replace(/\s/g, ' ');

const companiesMock = vi.fn();
const appointmentsMock = vi.fn();

vi.mock('../../services/api', () => ({
  kingApi: {
    companies: (...a: unknown[]) => companiesMock(...a),
    appointments: (...a: unknown[]) => appointmentsMock(...a),
  },
}));

import KingAppointments from '../../pages/king/KingAppointments';

const render = () =>
  rtlRender(<KingAppointments />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

interface CompanyFixture {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  _count: { patients: number; appointments: number; users: number };
}

interface AppointmentFixture {
  id: string;
  date: string;
  durationMinutes: number;
  price: number;
  status: string;
  notes: string | null;
  patient: { id: string; name: string };
  professional: { id: string; name: string };
  procedure: { id: string; name: string };
  company: { id: string; name: string; slug: string };
}

function makeCompany(over: Partial<CompanyFixture> = {}): CompanyFixture {
  return {
    id: 'c1',
    name: 'Clínica A',
    slug: 'clinica-a',
    plan: 'PROFESSIONAL',
    subscriptionStatus: 'ACTIVE',
    _count: { patients: 0, appointments: 1, users: 1 },
    ...over,
  };
}

function makeAppointment(over: Partial<AppointmentFixture> = {}): AppointmentFixture {
  return {
    id: 'a1',
    date: '2026-09-15T14:00:00.000Z',
    durationMinutes: 60,
    price: 150,
    status: 'SCHEDULED',
    notes: null,
    patient: { id: 'p1', name: 'Ana Lima' },
    professional: { id: 'pr1', name: 'Dra. Carla' },
    procedure: { id: 'proc1', name: 'Limpeza de Pele' },
    company: { id: 'c1', name: 'Clínica A', slug: 'clinica-a' },
    ...over,
  };
}

const companiesOk = (companies: CompanyFixture[]) => ({
  success: true,
  data: { success: true, data: { companies } },
});

const appointmentsOk = (appointments: AppointmentFixture[], total = appointments.length) => ({
  success: true,
  data: { success: true, data: { appointments, total } },
});

beforeEach(() => {
  vi.clearAllMocks();
  companiesMock.mockResolvedValue(companiesOk([makeCompany()]));
  appointmentsMock.mockResolvedValue(appointmentsOk([makeAppointment()]));
});

describe('pages/king/KingAppointments', () => {
  it('mostra o spinner de carregamento antes da resposta da API', async () => {
    let resolve: (v: unknown) => void = () => {};
    appointmentsMock.mockImplementation(() => new Promise((r) => { resolve = r; }));

    const { container } = render();
    expect(container.querySelector('.animate-spin')).toBeTruthy();

    resolve(appointmentsOk([makeAppointment()]));
    await screen.findByText('Clínica A');
  });

  it('agrupa agendamentos por clínica e mostra contagem + valor no cabeçalho', async () => {
    render();
    await screen.findByText('Clínica A');
    expect(screen.getByText('1 agendamentos')).toBeInTheDocument();
  });

  it('expande uma clínica e mostra o agendamento (sem misturar com outra clínica)', async () => {
    companiesMock.mockResolvedValue(companiesOk([makeCompany({ id: 'c1', name: 'Clínica A' }), makeCompany({ id: 'c2', name: 'Clínica B' })]));
    appointmentsMock.mockResolvedValue(appointmentsOk([
      makeAppointment({ id: 'a1', patient: { id: 'p1', name: 'Ana Lima' }, company: { id: 'c1', name: 'Clínica A', slug: 'clinica-a' } }),
      makeAppointment({ id: 'a2', patient: { id: 'p2', name: 'Beto Souza' }, company: { id: 'c2', name: 'Clínica B', slug: 'clinica-b' } }),
    ]));

    render();
    await screen.findByText('Clínica A');

    fireEvent.click(screen.getByText('Clínica A'));
    await screen.findByText('Ana Lima');
    expect(screen.queryByText('Beto Souza')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Clínica B'));
    await screen.findByText('Beto Souza');
  });

  it('calcula o valor total exibido a partir dos agendamentos carregados', async () => {
    appointmentsMock.mockResolvedValue(appointmentsOk([
      makeAppointment({ id: 'a1', price: 100 }),
      makeAppointment({ id: 'a2', price: 200 }),
    ]));
    render();
    await screen.findByText('Clínica A');

    const matches = screen.getAllByText((content) => content.replace(/\s/g, ' ') === brl(300));
    expect(matches.length).toBeGreaterThan(0);
  });

  it('usa o total retornado pela API (não o tamanho da página buscada) no KPI "Total de Agendamentos"', async () => {
    appointmentsMock.mockResolvedValue(appointmentsOk([makeAppointment()], 777));
    render();
    await screen.findByText('Clínica A');

    expect(screen.getByText('777')).toBeInTheDocument();
  });

  it('avisa quando a lista buscada é menor que o total real (truncamento)', async () => {
    appointmentsMock.mockResolvedValue(appointmentsOk([makeAppointment()], 777));
    render();
    await screen.findByText('Clínica A');

    expect(screen.getByText(/Mostrando os primeiros/)).toBeInTheDocument();
  });

  it('não mostra aviso de truncamento quando o total bate com o buscado', async () => {
    appointmentsMock.mockResolvedValue(appointmentsOk([makeAppointment()], 1));
    render();
    await screen.findByText('Clínica A');

    expect(screen.queryByText(/Mostrando os primeiros/)).not.toBeInTheDocument();
  });

  it('filtro de período "Hoje" recarrega com startDate/endDate do dia', async () => {
    render();
    await screen.findByText('Clínica A');

    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));

    await waitFor(() =>
      expect(appointmentsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) })
      )
    );
  });

  it('filtro de status recarrega com o status selecionado', async () => {
    render();
    await screen.findByText('Clínica A');

    fireEvent.change(screen.getByDisplayValue('Todos os Status'), { target: { value: 'COMPLETED' } });

    await waitFor(() =>
      expect(appointmentsMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'COMPLETED' }))
    );
  });

  it('erro ao buscar agendamentos é comunicado ao usuário (não fica silencioso)', async () => {
    appointmentsMock.mockResolvedValue({ success: false, error: 'Acesso restrito ao Owner' });
    render();

    await waitFor(() => expect(screen.getByText(/Acesso restrito ao Owner/)).toBeInTheDocument());
  });

  it('erro ao buscar empresas é comunicado ao usuário (não fica silencioso)', async () => {
    companiesMock.mockResolvedValue({ success: false, error: 'Erro interno' });
    render();

    await waitFor(() => expect(screen.getByText(/Erro interno/)).toBeInTheDocument());
  });

  it('erro de rede (exceção) exibe "Erro de conexão"', async () => {
    appointmentsMock.mockRejectedValueOnce(new Error('network down'));
    render();

    await screen.findByText('Erro de conexão');
  });

  it('botão "Atualizar" recarrega os dados', async () => {
    render();
    await screen.findByText('Clínica A');
    expect(appointmentsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Atualizar/i }));
    await waitFor(() => expect(appointmentsMock).toHaveBeenCalledTimes(2));
  });

  it('mostra estado vazio quando não há empresas cadastradas', async () => {
    companiesMock.mockResolvedValue(companiesOk([]));
    appointmentsMock.mockResolvedValue(appointmentsOk([]));
    render();

    await screen.findByText('Nenhuma empresa cadastrada.');
  });
});
