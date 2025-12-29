export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">
          🌟 Aura System
        </h1>
        <p className="text-xl text-purple-200 mb-8">
          Backend API - Sistema de Gestão Inteligente
        </p>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 max-w-md mx-auto">
          <h2 className="text-lg font-semibold mb-4">Status da API</h2>
          <div className="flex items-center justify-center gap-2 text-green-400">
            <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
            <span>Online</span>
          </div>
          <p className="text-sm text-purple-300 mt-4">
            Acesse <code className="bg-white/20 px-2 py-1 rounded">/api/health</code> para verificar o status
          </p>
        </div>
      </div>
    </main>
  );
}

