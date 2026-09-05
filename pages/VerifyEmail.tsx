import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import AuraLogo from '../components/AuraLogo';
import { SAAS_COMPANY_NAME } from '../constants';
import { API_BASE_URL as API_URL } from '../services/api';

type Status = 'loading' | 'success' | 'error' | 'idle';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>(token ? 'loading' : 'idle');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verificado com sucesso!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Token inválido ou expirado.');
        }
      } catch {
        setStatus('error');
        setMessage('Erro ao conectar ao servidor. Tente novamente.');
      }
    };

    verify();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendStatus('loading');
    try {
      await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
    } finally {
      setResendStatus('done');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5ebe0] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <AuraLogo className="w-8 h-8" />
            <span className="text-xl font-bold text-[#1c1917]">{SAAS_COMPANY_NAME}</span>
          </div>
          <p className="text-sm text-[#a09890]">Gestão Premium para Clínicas de Estética</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Loading */}
          {status === 'loading' && (
            <div className="text-center py-4">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-[#bd7b65]" />
              <h2 className="text-lg font-semibold text-[#1c1917]">Verificando seu email...</h2>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-[#1c1917] mb-2">Email verificado!</h2>
              <p className="text-[#57534e] mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-block px-8 py-3 bg-[#bd7b65] text-white font-semibold rounded-full hover:bg-[#a86a56] transition-colors"
              >
                Ir para o login →
              </Link>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-[#1c1917] mb-2">Link inválido</h2>
              <p className="text-[#57534e] mb-6">{message}</p>
              <p className="text-sm text-[#a09890] mb-4">Solicite um novo link de verificação:</p>
              <form onSubmit={handleResend} className="flex flex-col gap-3">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  placeholder="Seu email cadastrado"
                  className="w-full px-4 py-3 border border-[#e8ddd8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bd7b65]/30"
                  required
                />
                <button
                  type="submit"
                  disabled={resendStatus !== 'idle'}
                  className="w-full py-3 bg-[#bd7b65] text-white font-semibold rounded-full hover:bg-[#a86a56] transition-colors disabled:opacity-60"
                >
                  {resendStatus === 'loading' ? 'Enviando...' : resendStatus === 'done' ? 'Email enviado!' : 'Reenviar link'}
                </button>
              </form>
            </div>
          )}

          {/* No token */}
          {status === 'idle' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-[#f5ebe0] rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-[#bd7b65]" />
              </div>
              <h2 className="text-xl font-bold text-[#1c1917] mb-2">Verifique seu email</h2>
              <p className="text-[#57534e] mb-6">
                Enviamos um link de confirmação para o seu email. Clique no link para ativar sua conta.
              </p>
              <p className="text-sm text-[#a09890] mb-4">Não recebeu o email? Reenvie:</p>
              <form onSubmit={handleResend} className="flex flex-col gap-3">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  placeholder="Seu email cadastrado"
                  className="w-full px-4 py-3 border border-[#e8ddd8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bd7b65]/30"
                  required
                />
                <button
                  type="submit"
                  disabled={resendStatus !== 'idle'}
                  className="w-full py-3 bg-[#bd7b65] text-white font-semibold rounded-full hover:bg-[#a86a56] transition-colors disabled:opacity-60"
                >
                  {resendStatus === 'loading' ? 'Enviando...' : resendStatus === 'done' ? 'Email enviado!' : 'Reenviar link'}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-[#a09890] mt-6">
          <Link to="/login" className="text-[#bd7b65] hover:underline">← Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
