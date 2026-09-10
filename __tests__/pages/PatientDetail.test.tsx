// __tests__/pages/PatientDetail.test.tsx
// Testes de componente da ficha do paciente (pages/PatientDetail.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Patient, PhotoRecord, Appointment } from '../../types';

const updatePatient = vi.fn();
const signConsent = vi.fn();
const signAppointmentConsent = vi.fn();
const toggleAnamnesisSent = vi.fn();
const removePhoto = vi.fn();
const showAlert = vi.fn();
const loadPhotos = vi.fn();
const loadPatients = vi.fn();
const loadAppointments = vi.fn();

const st: {
  patients: Patient[];
  photos: PhotoRecord[];
  appointments: Appointment[];
  isReadOnly: boolean;
} = { patients: [], photos: [], appointments: [], isReadOnly: false };

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    patients: st.patients,
    photos: st.photos,
    appointments: st.appointments,
    isReadOnly: st.isReadOnly,
    currentCompany: { id: 'c1', name: 'Clínica X' },
    updatePatient,
    signConsent,
    signAppointmentConsent,
    toggleAnamnesisSent,
    removePhoto,
    loadPhotos,
    loadPatients,
    loadAppointments,
    loadedStates: { patients: true },
    loadingStates: { patients: false },
  }),
}));
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm: vi.fn() }),
}));
vi.mock('../../services/geminiService', () => ({
  summarizeAnamnesis: vi.fn(async () => 'resumo IA'),
  generateFollowUpMessage: vi.fn(async () => 'mensagem follow-up'),
}));
vi.mock('../../components/PhotoAnnotationModal', () => ({
  PhotoAnnotationModal: () => <div data-testid="annotation-modal" />,
}));
vi.mock('../../components/Modals', () => ({
  NewPhotoModal: () => <div data-testid="new-photo-modal" />,
  SignatureHistoryModal: () => <div data-testid="signature-history-modal" />,
  SignatureModal: ({
    onSave,
    isCorrection,
  }: {
    onSave: (b: string, r?: string) => void;
    isCorrection?: boolean;
  }) => (
    <button
      data-testid="sig-save"
      onClick={() => onSave('data:image/png;base64,SIG', isCorrection ? 'motivo teste' : undefined)}
    >
      stub sign save
    </button>
  ),
}));

import PatientDetail from '../../pages/PatientDetail';

function renderDetail() {
  return rtlRender(
    <MemoryRouter initialEntries={['/patients/p1']}>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

function patient(over: Partial<Patient> = {}): Patient {
  return {
    id: 'p1', companyId: 'c1', name: 'Maria Silva', phone: '11999990000',
    email: 'maria@example.com', status: 'active', birthDate: '1990-02-01', ...over,
  };
}
function photo(over: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: 'ph1', companyId: 'c1', patientId: 'p1', date: '2026-01-01',
    url: 'data:image/png;base64,AAA', type: 'before', procedure: 'Botox', groupId: 'g_1', ...over,
  };
}
function appointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a1', companyId: 'c1', patientId: 'p1', patientName: 'Maria Silva',
    professionalId: 'pro1', professionalName: 'Dra. Ana', service: 'Botox', price: 900,
    date: '2026-01-01T10:00:00.000Z', durationMinutes: 30, status: 'completed', ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  st.patients = [patient()];
  st.photos = [];
  st.appointments = [];
  st.isReadOnly = false;
  signConsent.mockResolvedValue({ success: true });
  signAppointmentConsent.mockResolvedValue({ success: true });
  removePhoto.mockResolvedValue({ success: true });
  updatePatient.mockResolvedValue({ success: true });
});

describe('PatientDetail — agrupamento photosByProcedure', () => {
  beforeEach(() => {
    st.photos = [
      // Conjunto completo (antes + depois) do procedimento "Botox"
      photo({ id: 'b1', procedure: 'Botox', groupId: 'g_1', type: 'before' }),
      photo({ id: 'a1p', procedure: 'Botox', groupId: 'g_1', type: 'after' }),
      // Conjunto incompleto (só antes) do procedimento "Peeling"
      photo({ id: 'b2', procedure: 'Peeling', groupId: 'g_2', type: 'before' }),
    ];
  });

  it('renderiza os dois procedimentos como seções distintas', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Fotos Antes/Depois' }));
    expect(screen.getByRole('heading', { name: 'Botox' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Peeling' })).toBeInTheDocument();
  });

  it('preenche os dois slots do conjunto completo e deixa "Aguardando resultado" no incompleto', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Fotos Antes/Depois' }));

    // 2 slots "Antes" preenchidos (Botox + Peeling), 1 slot "Depois" preenchido (Botox)
    expect(screen.getAllByAltText('Antes')).toHaveLength(2);
    expect(screen.getAllByAltText('Depois')).toHaveLength(1);

    // O conjunto incompleto mostra o placeholder de resultado pendente
    expect(screen.getByText('Aguardando resultado')).toBeInTheDocument();
    // Nenhum conjunto está sem o "antes"
    expect(screen.queryByText('Registro ausente')).not.toBeInTheDocument();
    // ...e oferece adicionar o "depois"
    expect(screen.getByText(/Adicionar Resultado \(Depois\)/i)).toBeInTheDocument();
  });
});

describe('PatientDetail — paciente sem birthDate', () => {
  it('não quebra a ficha quando birthDate é undefined', () => {
    st.patients = [patient({ birthDate: undefined })];
    renderDetail();
    // nome renderiza normalmente
    expect(screen.getByRole('heading', { name: 'Maria Silva' })).toBeInTheDocument();
    // formatDate(undefined) => "-"
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });
});

describe('PatientDetail — badge de correção de consentimento', () => {
  it('mostra "Corrigida em ..." quando consentCorrectionCount > 0', () => {
    st.patients = [
      patient({
        consentSignedAt: '2026-01-01T00:00:00.000Z',
        consentSignatureUrl: 'data:image/png;base64,SIG',
        consentCorrectionCount: 2,
        lastConsentCorrectionAt: '2026-02-03T00:00:00.000Z',
      }),
    ];
    renderDetail();
    expect(screen.getByText(/Corrigida em/i)).toBeInTheDocument();
  });

  it('não mostra badge de correção sem consentCorrectionCount', () => {
    st.patients = [
      patient({
        consentSignedAt: '2026-01-01T00:00:00.000Z',
        consentSignatureUrl: 'data:image/png;base64,SIG',
      }),
    ];
    renderDetail();
    expect(screen.queryByText(/Corrigida em/i)).not.toBeInTheDocument();
  });
});

describe('PatientDetail — falhas de API são comunicadas (nunca em silêncio)', () => {
  it('signConsent { success:false } dispara showAlert', async () => {
    signConsent.mockResolvedValue({ success: false, error: 'Falha ao assinar' });
    st.patients = [patient({ consentSignedAt: undefined })];
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: /Assinar Digitalmente/i }));
    fireEvent.click(screen.getByTestId('sig-save'));

    await waitFor(() => expect(showAlert).toHaveBeenCalled());
    expect(showAlert.mock.calls[0][0]).toBe('Falha ao assinar');
  });

  it('removePhoto { success:false } dispara showAlert', async () => {
    st.photos = [photo({ id: 'b1', procedure: 'Botox', groupId: 'g_1', type: 'before' })];
    removePhoto.mockResolvedValue({ success: false, error: 'Não foi possível remover' });
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Fotos Antes/Depois' }));

    const trashIcon = document.querySelector('.lucide-trash-2');
    fireEvent.click(trashIcon!.closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(showAlert).toHaveBeenCalled());
    expect(showAlert.mock.calls[0][0]).toBe('Não foi possível remover');
  });

  it('signAppointmentConsent { success:false } dispara showAlert', async () => {
    st.appointments = [
      appointment({
        id: 'a1', signatureUrl: 'data:image/png;base64,SIG',
        signatureMetadata: { signedAt: '2026-01-01T10:00:00.000Z', ipAddress: '1.2.3.4', userAgent: 'Mozilla/5.0', documentVersion: 'v1' },
      }),
    ];
    signAppointmentConsent.mockResolvedValue({ success: false, error: 'Correção rejeitada' });
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: /Assinado/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir assinatura' }));
    fireEvent.click(screen.getByTestId('sig-save'));

    await waitFor(() => expect(showAlert).toHaveBeenCalled());
    expect(showAlert.mock.calls[0][0]).toBe('Correção rejeitada');
  });
});
