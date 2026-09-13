// __tests__/pages/KingCompanies.test.tsx
// Testes da página pages/king/KingCompanies.tsx (listagem global de clínicas do King).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const companiesMock = vi.fn();

vi.mock('../../services/api', () => ({
  kingApi: { companies: (...a: unknown[]) => companiesMock(...a) },
}));

import KingCompanies from '../../pages/king/KingCompanies';

const render = () =>
  rtlRender(<KingCompanies />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

interface CompanyFixture {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  _count: { patients: number; appointments: number; users: number };
}

function company(over: Partial<CompanyFixture> = {}): CompanyFixture {
  return {
    id: 'c1',
    name: 'Clínica Bela Vida',
    slug: 'bela-vida',
    plan: 'PROFESSIONAL',
    subscriptionStatus: 'ACTIVE',
    subscriptionExpiresAt: '2026-12-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    _count: { patients: 10, appointments: 20, users: 3 },
    ...over,
  };
}

const okResponse = (companies: CompanyFixture[], total = companies.length) => ({
  success: true,
  data: { success: true, data: { companies, total, page: 1, limit: 10 } },
});

beforeEach(() => {
  vi.clearAllMocks();
  companiesMock.mockResolvedValue(okResponse([company()]));
});

describe('pages/king/KingCompanies', () => {
  it('mostra o spinner de carregamento antes da resposta da API', async () => {
    let resolve: (v: unknown) => void = () => {};
    companiesMock.mockImplementation(() => new Promise((r) => { resolve = r; }));

    const { container } = render();
    expect(container.querySelector('.animate-spin')).toBeTruthy();

    resolve(okResponse([company()]));
    await screen.findByText('Clínica Bela Vida');
  });

  it('renderiza a lista de empresas com plano, status e métricas', async () => {
    render();
    await screen.findByText('Clínica Bela Vida');

    expect(screen.getByText('bela-vida')).toBeInTheDocument();
    expect(screen.getByText('PROFESSIONAL')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // pacientes
    expect(screen.getByText('20')).toBeInTheDocument(); // agendamentos
    expect(screen.getByText('3')).toBeInTheDocument(); // usuários
  });

  it('mostra estado vazio quando não há empresas', async () => {
    companiesMock.mockResolvedValue(okResponse([]));
    render();
    await screen.findByText('Nenhuma empresa encontrada');
  });

  it('resposta HTTP de erro (ex.: 403) exibe a mensagem real do backend, não um texto genérico', async () => {
    companiesMock.mockResolvedValue({ success: false, error: 'Acesso restrito ao Owner' });
    render();

    await waitFor(() => expect(screen.getByText('Acesso restrito ao Owner')).toBeInTheDocument());
  });

  it('resposta HTTP 200 mas com success:false no corpo exibe o erro do corpo da API', async () => {
    companiesMock.mockResolvedValue({ success: true, data: { success: false, error: 'Erro interno' } });
    render();

    await waitFor(() => expect(screen.getByText('Erro interno')).toBeInTheDocument());
  });

  it('erro de rede (exceção) exibe "Erro de conexão"', async () => {
    companiesMock.mockRejectedValueOnce(new Error('network down'));
    render();

    await screen.findByText('Erro de conexão');
  });

  it('filtro de status reinicia a página e recarrega com o status selecionado', async () => {
    render();
    await screen.findByText('Clínica Bela Vida');

    fireEvent.change(screen.getByDisplayValue('Todos os Status'), { target: { value: 'OVERDUE' } });

    await waitFor(() =>
      expect(companiesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'OVERDUE', page: 1 })
      )
    );
  });

  it('busca (debounced) recarrega com o termo digitado', async () => {
    render();
    await screen.findByText('Clínica Bela Vida');

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome ou slug...'), {
      target: { value: 'bela' },
    });

    await waitFor(
      () => expect(companiesMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'bela' })),
      { timeout: 2000 }
    );
  });

  it('paginação: botão "próxima página" avança e busca a página seguinte', async () => {
    companiesMock.mockResolvedValue(
      okResponse([company({ id: 'c1' })], 25)
    );
    render();
    await screen.findByText('Clínica Bela Vida');

    // O botão de próxima página é o segundo botão dentro do bloco de paginação (ChevronRight)
    const pageBlock = screen.getByText('1 / 3').parentElement;
    const next = pageBlock?.querySelectorAll('button')[1];
    expect(next).toBeTruthy();
    fireEvent.click(next as HTMLButtonElement);

    await waitFor(() =>
      expect(companiesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    );
  });

  it('botão "Atualizar" recarrega a lista', async () => {
    render();
    await screen.findByText('Clínica Bela Vida');
    expect(companiesMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Atualizar/i }));
    await waitFor(() => expect(companiesMock).toHaveBeenCalledTimes(2));
  });

  it('não renderiza nenhuma ação de escrita (suspender/editar plano) — tela é somente leitura', async () => {
    render();
    await screen.findByText('Clínica Bela Vida');

    expect(screen.queryByRole('button', { name: /suspender/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar plano/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });
});
