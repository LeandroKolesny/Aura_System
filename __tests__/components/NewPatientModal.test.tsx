// __tests__/components/NewPatientModal.test.tsx
// Testes de componente do NewPatientModal (components/Modals.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const addPatient = vi.fn();
const showAlert = vi.fn();

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ addPatient }),
}));
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm: vi.fn() }),
}));

import { NewPatientModal } from '../../components/Modals';

function form(): HTMLFormElement {
  return document.querySelector('form') as HTMLFormElement;
}
const dateInput = () => document.querySelector('input[type="date"]') as HTMLInputElement;
const emailInput = () => document.querySelector('input[type="email"]') as HTMLInputElement;

function fillValid({ birthDate = '1990-05-15', cpf = '' } = {}) {
  fireEvent.change(screen.getByLabelText('Nome Completo'), { target: { value: 'Maria Souza' } });
  fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '11999998888' } });
  fireEvent.change(emailInput(), { target: { value: 'maria@example.com' } });
  if (birthDate) fireEvent.change(dateInput(), { target: { value: birthDate } });
  if (cpf) fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: cpf } });
}

beforeEach(() => {
  vi.clearAllMocks();
  addPatient.mockResolvedValue({ success: true });
});

describe('NewPatientModal — validação client-side', () => {
  it('bloqueia o submit quando nome e telefone estão vazios', async () => {
    render(<NewPatientModal onClose={vi.fn()} />);
    fireEvent.submit(form());

    expect(await screen.findByText(/preencha pelo menos nome e telefone/i)).toBeInTheDocument();
    expect(addPatient).not.toHaveBeenCalled();
  });

  it('bloqueia o submit quando só o telefone está preenchido (nome obrigatório)', async () => {
    render(<NewPatientModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '11999998888' } });
    fireEvent.submit(form());

    expect(await screen.findByText(/preencha pelo menos nome e telefone/i)).toBeInTheDocument();
    expect(addPatient).not.toHaveBeenCalled();
  });

  it('bloqueia o submit com CPF inválido', async () => {
    render(<NewPatientModal onClose={vi.fn()} />);
    fillValid({ cpf: '111.111.111-11' });
    fireEvent.submit(form());

    expect(await screen.findByText('CPF inválido.')).toBeInTheDocument();
    expect(addPatient).not.toHaveBeenCalled();
  });

  it('bloqueia o submit com data de nascimento no futuro', async () => {
    render(<NewPatientModal onClose={vi.fn()} />);
    fillValid({ birthDate: '2099-01-01' });
    fireEvent.submit(form());

    expect(await screen.findByText(/Data de nascimento inválida/i)).toBeInTheDocument();
    expect(addPatient).not.toHaveBeenCalled();
  });

  it('bloqueia o submit com ano de nascimento inválido (anterior a 1900)', async () => {
    render(<NewPatientModal onClose={vi.fn()} />);
    fillValid({ birthDate: '1800-01-01' });
    fireEvent.submit(form());

    expect(await screen.findByText(/Data de nascimento inválida/i)).toBeInTheDocument();
    expect(addPatient).not.toHaveBeenCalled();
  });
});

describe('NewPatientModal — resultado da API', () => {
  it('exibe a mensagem de erro quando addPatient retorna { success: false }', async () => {
    addPatient.mockResolvedValue({ success: false, error: 'Já existe um paciente com este e-mail' });
    const onClose = vi.fn();
    render(<NewPatientModal onClose={onClose} />);
    fillValid();
    fireEvent.submit(form());

    expect(await screen.findByText('Já existe um paciente com este e-mail')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('fecha o modal ao cadastrar com sucesso', async () => {
    const onClose = vi.fn();
    render(<NewPatientModal onClose={onClose} />);
    fillValid();
    fireEvent.submit(form());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addPatient).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria Souza', status: 'active' })
    );
  });

  it('com "enviar convite" marcado, avisa que o recurso ainda não está disponível (não promete e-mail falso)', async () => {
    render(<NewPatientModal onClose={vi.fn()} />);
    fillValid();
    fireEvent.click(document.getElementById('sendInvite') as HTMLInputElement);
    fireEvent.submit(form());

    await waitFor(() => expect(showAlert).toHaveBeenCalled());
    expect(showAlert.mock.calls[0][0]).toMatch(/convite de acesso ainda não está disponível/i);
  });
});
