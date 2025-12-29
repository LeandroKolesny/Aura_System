
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Ticket, UserRole } from '../types';
import { MessageCircle, Send, Plus, CheckCircle, Lock, Clock } from 'lucide-react';
import { SAAS_COMPANY_NAME } from '../constants';

const Support: React.FC = () => {
  const { tickets, createTicket, replyTicket, closeTicket, user } = useApp();
  
  // ALTERAÇÃO CRÍTICA: Usar apenas o ID para referenciar o ticket selecionado
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isOwner = user?.role === UserRole.OWNER;

  // Derivar o ticket selecionado diretamente da lista atualizada do contexto
  const selectedTicket = useMemo(() => 
    tickets.find(t => t.id === selectedTicketId) || null
  , [tickets, selectedTicketId]);

  const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      if (newTicketSubject && newTicketMessage) {
          createTicket(newTicketSubject, newTicketMessage);
          setIsCreating(false);
          setNewTicketSubject('');
          setNewTicketMessage('');
      }
  };

  const handleReply = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedTicket && replyMessage) {
          replyTicket(selectedTicket.id, replyMessage);
          setReplyMessage('');
      }
  };

  // Scroll para o final do chat quando novas mensagens chegarem
  useEffect(() => {
      if (selectedTicket) {
          const chatContainer = document.getElementById('chat-container');
          if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
          }
      }
  }, [selectedTicket?.messages]);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
        <div className="mb-6 flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Central de Suporte</h1>
                <p className="text-slate-500">{isOwner ? 'Gerencie os chamados das clínicas.' : 'Abra chamados e tire suas dúvidas.'}</p>
            </div>
            {!isOwner && !isCreating && (
                <button 
                    onClick={() => { setIsCreating(true); setSelectedTicketId(null); }}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                >
                    <Plus className="w-4 h-4" /> Novo Chamado
                </button>
            )}
        </div>

        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex">
            {/* Lista de Tickets (Sidebar) */}
            <div className={`${selectedTicket || isCreating ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-slate-100 flex-col`}>
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700">Tickets</h3>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                    {tickets.map(ticket => (
                        <div 
                            key={ticket.id} 
                            onClick={() => { setSelectedTicketId(ticket.id); setIsCreating(false); }}
                            className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedTicketId === ticket.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {ticket.status === 'open' ? 'Aberto' : 'Fechado'}
                                </span>
                                <span className="text-xs text-slate-400">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <h4 className="font-bold text-slate-800 mb-1 truncate">{ticket.subject}</h4>
                            <p className="text-xs text-slate-500 truncate">
                                {isOwner && <span className="font-bold text-primary-600 mr-1">{ticket.companyName}:</span>}
                                {ticket.messages[ticket.messages.length - 1]?.content || 'Sem mensagens'}
                            </p>
                        </div>
                    ))}
                    {tickets.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">Nenhum ticket encontrado.</div>
                    )}
                </div>
            </div>

            {/* Área de Conteúdo */}
            <div className="flex-1 flex flex-col bg-slate-50/30">
                {isCreating ? (
                    <div className="p-8 max-w-lg mx-auto w-full animate-fade-in">
                        <h3 className="text-xl font-bold text-slate-800 mb-6">Abrir Novo Chamado</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Assunto</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="Ex: Problema com Faturamento"
                                    value={newTicketSubject}
                                    onChange={e => setNewTicketSubject(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem</label>
                                <textarea 
                                    required 
                                    rows={5}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                                    placeholder="Descreva seu problema..."
                                    value={newTicketMessage}
                                    onChange={e => setNewTicketMessage(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">Enviar Chamado</button>
                            </div>
                        </form>
                    </div>
                ) : selectedTicket ? (
                    <>
                        {/* Ticket Header */}
                        <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-start shadow-sm z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <button 
                                        onClick={() => setSelectedTicketId(null)}
                                        className="md:hidden mr-2 text-slate-400 hover:text-slate-600"
                                    >
                                        ←
                                    </button>
                                    <h2 className="text-xl font-bold text-slate-900">{selectedTicket.subject}</h2>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${selectedTicket.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {selectedTicket.status === 'open' ? 'Aberto' : 'Fechado'}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500">
                                    Ticket #{selectedTicket.id} • {isOwner ? `Empresa: ${selectedTicket.companyName}` : `Criado em ${new Date(selectedTicket.createdAt).toLocaleDateString()}`}
                                </p>
                            </div>
                            {selectedTicket.status === 'open' && (
                                <button 
                                    onClick={() => closeTicket(selectedTicket.id)}
                                    className="text-xs border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1"
                                >
                                    <Lock className="w-3 h-3" /> Encerrar
                                </button>
                            )}
                        </div>

                        {/* Messages */}
                        <div id="chat-container" className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                            {selectedTicket.messages.map(msg => {
                                const isMe = msg.senderId === user?.id;
                                const isSupport = msg.isAdmin; 
                                
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm ${
                                            isSupport 
                                                ? 'bg-slate-800 text-white rounded-tl-none' 
                                                : isMe 
                                                    ? 'bg-primary-600 text-white rounded-tr-none' 
                                                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                                        }`}>
                                            <div className="flex justify-between items-center mb-1 gap-4">
                                                <span className={`text-xs font-bold ${isSupport || isMe ? 'text-white/90' : 'text-primary-600'}`}>
                                                    {isSupport ? `${SAAS_COMPANY_NAME} (Suporte)` : msg.senderName}
                                                </span>
                                                <span className={`text-[10px] ${isSupport || isMe ? 'text-white/60' : 'text-slate-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Reply Area */}
                        {selectedTicket.status === 'open' ? (
                            <div className="p-4 bg-white border-t border-slate-200">
                                <form onSubmit={handleReply} className="flex gap-3">
                                    <input 
                                        type="text" 
                                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                                        placeholder="Digite sua resposta..."
                                        value={replyMessage}
                                        onChange={e => setReplyMessage(e.target.value)}
                                        autoFocus
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!replyMessage.trim()}
                                        className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl disabled:opacity-50 transition-colors shadow-lg shadow-primary-200"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-100 border-t border-slate-200 text-center text-slate-500 text-sm font-medium flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Este chamado foi encerrado.
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
                        <p>Selecione um ticket para visualizar</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Support;
