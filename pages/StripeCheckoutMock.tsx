
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Lock, CreditCard, CheckCircle, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AuraLogo from '../components/AuraLogo';

const StripeCheckoutMock: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { saasPlans } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const plan = saasPlans.find(p => p.id === planId) || saasPlans[0];

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simula tempo de processamento do pagamento
    setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);
        
        // Redireciona para o Login após "sucesso"
        setTimeout(() => {
            navigate('/login');
        }, 2000);
    }, 2000);
  };

  if (isSuccess) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-white">
              <div className="text-center animate-fade-in">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">Pagamento Confirmado!</h1>
                  <p className="text-slate-500 mb-8">Redirecionando para o seu acesso...</p>
                  <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Coluna Esquerda - Resumo do Pedido */}
      <div className="w-full md:w-1/2 p-8 md:p-12 bg-white border-r border-slate-200 flex flex-col justify-center relative overflow-hidden">
         {/* Stripe Pattern Mock */}
         <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
         
         <div className="max-w-md mx-auto w-full z-10">
             <div className="flex items-center gap-2 mb-8 text-slate-500 cursor-pointer hover:text-slate-800" onClick={() => navigate(-1)}>
                 <ArrowLeft className="w-4 h-4" /> <span className="text-sm font-medium">Voltar</span>
             </div>

             <div className="flex items-center gap-3 mb-6 text-slate-400">
                 <AuraLogo className="w-8 h-8 opacity-50 grayscale" /> 
                 <span className="font-semibold">Aura System Inc.</span>
             </div>

             <div className="mb-8">
                 <p className="text-slate-500 text-sm mb-1 uppercase tracking-wider font-bold">Assinatura</p>
                 <h1 className="text-3xl font-bold text-slate-900 mb-2">Plano {plan.name}</h1>
                 <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-900">R$ {plan.price.toFixed(2)}</span>
                    <span className="text-slate-500">/ mês</span>
                 </div>
             </div>

             <div className="space-y-4 border-t border-slate-100 pt-6">
                 {plan.features.slice(0, 4).map((feat, i) => (
                     <div key={i} className="flex items-center gap-3 text-slate-600">
                         <CheckCircle className="w-5 h-5 text-green-500" /> {feat}
                     </div>
                 ))}
                 <div className="text-slate-400 text-sm italic pt-2">+ outros benefícios exclusivos</div>
             </div>
         </div>
      </div>

      {/* Coluna Direita - Pagamento */}
      <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-slate-50">
          <div className="max-w-md mx-auto w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
              <form onSubmit={handlePayment} className="space-y-6">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-slate-800">Pagamento</h2>
                      <div className="flex gap-2">
                          <div className="w-8 h-5 bg-slate-200 rounded"></div>
                          <div className="w-8 h-5 bg-slate-200 rounded"></div>
                          <div className="w-8 h-5 bg-slate-200 rounded"></div>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                      <input required type="email" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="seu@email.com" />
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Informações do Cartão</label>
                      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                          <div className="flex items-center p-3 border-b border-slate-200">
                              <CreditCard className="w-5 h-5 text-slate-400 mr-3" />
                              <input required type="text" className="w-full outline-none" placeholder="Número do cartão" />
                          </div>
                          <div className="flex divide-x divide-slate-200">
                              <input required type="text" className="w-1/2 p-3 outline-none" placeholder="MM / AA" />
                              <input required type="text" className="w-1/2 p-3 outline-none" placeholder="CVC" />
                          </div>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome no Cartão</label>
                      <input required type="text" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Como aparece no cartão" />
                  </div>

                  <button 
                    type="submit" 
                    disabled={isProcessing}
                    className="w-full py-4 bg-slate-900 text-white rounded-lg font-bold text-lg hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
                  >
                      {isProcessing ? (
                          <>Processando...</>
                      ) : (
                          <>
                            <Lock className="w-4 h-4" /> Pagar R$ {plan.price.toFixed(2)}
                          </>
                      )}
                  </button>
                  
                  <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" /> Pagamento 100% seguro (Simulado)
                  </div>
              </form>
          </div>
      </div>
    </div>
  );
};

export default StripeCheckoutMock;
