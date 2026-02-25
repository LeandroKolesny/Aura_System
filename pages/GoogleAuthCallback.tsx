import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const { loginWithToken } = useApp() as any;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const returnTo = params.get('returnTo') || '/';

    if (!token) {
      navigate('/login?error=no_token');
      return;
    }

    loginWithToken(token).then((ok: boolean) => {
      if (ok) {
        navigate(decodeURIComponent(returnTo));
      } else {
        navigate('/login?error=invalid_token');
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
        <p className="text-secondary-600 font-sans">Autenticando com Google...</p>
      </div>
    </div>
  );
}
