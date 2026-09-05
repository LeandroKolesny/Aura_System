import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import AuraLogo from '../components/AuraLogo';
import { SAAS_COMPANY_NAME } from '../constants';
import { API_BASE_URL as API_URL } from '../services/api';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen bg-[#f5ebe0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1c1917] mb-2">Link inválido</h2>
          <p className="text-[#57534e] mb-4">Este link de recuperação está incompleto.</p>
          <Link to="/esqueci-senha" className="text-[#bd7b65] hover:underline text-sm">
            Solicitar um novo link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setErrorMsg(data.error || 'Erro ao redefinir senha.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Erro ao conectar ao servidor. Tente novamente.');
      setStatus('error');
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
          {status === 'success' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-[#1c1917] mb-2">Senha redefinida!</h2>
              <p className="text-[#57534e] text-sm">
                Sua senha foi atualizada com sucesso. Redirecionando para o login...
              </p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 bg-[#f5ebe0] rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-[#bd7b65]" />
              </div>
              <h2 className="text-xl font-bold text-[#1c1917] mb-1 text-center">Nova senha</h2>
              <p className="text-sm text-[#57534e] text-center mb-6">
                Crie uma nova senha segura para sua conta.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1c1917] mb-1.5">Nova senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-4 py-3 pr-10 border border-[#e8ddd8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bd7b65]/30"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a09890] hover:text-[#57534e]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1c1917] mb-1.5">Confirmar nova senha</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full px-4 py-3 border border-[#e8ddd8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bd7b65]/30"
                    required
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3 bg-[#bd7b65] text-white font-semibold rounded-full hover:bg-[#a86a56] transition-colors disabled:opacity-60"
                >
                  {status === 'loading' ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-[#a09890] mt-6">
          <Link to="/login" className="text-[#bd7b65] hover:underline">← Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
