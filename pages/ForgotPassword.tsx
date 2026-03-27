import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import AuraLogo from '../components/AuraLogo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('sent');
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao processar solicitação.');
        setStatus('idle');
      }
    } catch {
      setError('Erro ao conectar ao servidor. Tente novamente.');
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5ebe0] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <AuraLogo className="w-8 h-8" />
            <span className="text-xl font-bold text-[#1c1917]">Aura System</span>
          </div>
          <p className="text-sm text-[#a09890]">Gestão Premium para Clínicas de Estética</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {status === 'sent' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-[#1c1917] mb-2">Email enviado!</h2>
              <p className="text-[#57534e] text-sm">
                Se o email <strong>{email}</strong> estiver cadastrado, você receberá as instruções para redefinir sua senha em instantes.
              </p>
              <p className="text-[#a09890] text-xs mt-4">O link expira em 2 horas.</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 bg-[#f5ebe0] rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-[#bd7b65]" />
              </div>
              <h2 className="text-xl font-bold text-[#1c1917] mb-1 text-center">Esqueceu sua senha?</h2>
              <p className="text-sm text-[#57534e] text-center mb-6">
                Digite seu email e enviaremos um link para você criar uma nova senha.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1c1917] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 border border-[#e8ddd8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bd7b65]/30"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3 bg-[#bd7b65] text-white font-semibold rounded-full hover:bg-[#a86a56] transition-colors disabled:opacity-60"
                >
                  {status === 'loading' ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-[#a09890] mt-6">
          <Link to="/login" className="text-[#bd7b65] hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
