import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowDownCircle, ArrowUpCircle, FileText, MinusCircle, Building, X, Calendar, Download, ChevronUp, ChevronDown, Save, CreditCard, Loader2, Package } from 'lucide-react';
import { UserRole, Transaction } from '../types';
import { NewExpenseModal } from '../components/Modals';
import { formatCurrency, formatDate } from '../utils/formatUtils';
import StatusBadge from '../components/StatusBadge';
import { PAYMENT_METHODS_LIST } from '../constants';
import { FinancialSkeleton } from '../components/LoadingSkeleton';

const TransactionDetailModal: React.FC<{ transaction: any; onClose: () => void }> = ({ transaction, onClose }) => (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start shrink-0">
                <div><h3 className="font-bold text-xl text-slate-900">Detalhes da Transação</h3><p className="text-xs text-slate-400 mt-1 uppercase font-mono">ID: {transaction.id}</p></div>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 bg-slate-50">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${transaction.type === 'expense' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    <div className="flex justify-between items-start mb-6">
                        <div><p className="text-xs font-bold text-slate-400 uppercase mb-1">Descrição</p><p className="font-bold text-slate-800 text-lg leading-tight">{transaction.description}</p></div>
                        <div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Valor</p><p className={`text-2xl font-bold ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>{transaction.type === 'expense' ? '- ' : '+ '}{formatCurrency(transaction.amount)}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                        <div><p className="text-xs text-slate-400 mb-1 uppercase font-bold">Data</p><div className="flex items-center gap-2 text-slate-700 text-sm font-medium"><Calendar className="w-4 h-4 text-slate-400" />{formatDate(transaction.date)}</div></div>
                        <div><p className="text-xs text-slate-400 mb-1 uppercase font-bold">Status</p><StatusBadge status={transaction.status} type="financial" showIcon /></div>
                    </div>
                </div>
                <div className="flex justify-end gap-3"><button className="px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm font-bold flex items-center gap-2 transition-colors"><Download className="w-4 h-4" /> Recibo</button><button onClick={onClose} className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-colors">Fechar</button></div>
            </div>
        </div>
    </div>
);

const SaaSFinancial: React.FC = () => {
  const { companies, transactions, user, saasPlans } = useApp();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const subscriptionIncomes = useMemo(() => companies.map(company => {
      const plan = saasPlans.find(p => p.id === company.plan);
      const lastChar = company.id.slice(-1);
      const status = (['2', '5', '8'].includes(lastChar) ? 'pending' : (['3', '6'].includes(lastChar) ? 'overdue' : 'paid')) as any;
      return { id: `sub_${company.id}`, date: new Date().toISOString(), description: company.name, category: 'Mensalidade', amount: plan?.price || 0, type: 'income' as const, status, plan: company.plan };
  }), [companies, saasPlans]);

  const ownerExpenses = useMemo(() => transactions.filter(t => t.companyId === user?.companyId && t.type === 'expense'), [transactions, user]);
  const allRecords = useMemo(() => [...subscriptionIncomes, ...ownerExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [subscriptionIncomes, ownerExpenses]);
  const balance = useMemo(() => subscriptionIncomes.filter(i => i.status === 'paid').reduce((a, c) => a + c.amount, 0) - ownerExpenses.reduce((a, c) => a + c.amount, 0), [subscriptionIncomes, ownerExpenses]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-900">Gestão Financeira SaaS</h1><p className="text-slate-500">Controle de mensalidades e despesas.</p></div>
        <div className="flex gap-4 items-center">
           <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg flex items-center gap-2 border border-red-200 font-medium"><MinusCircle className="w-4 h-4" /> Despesa</button>
           <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm"><span className="text-sm text-slate-500 block">Saldo</span><span className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(balance)}</span></div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><table className="w-full text-left"><thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold"><th className="px-6 py-3">Data Ref.</th><th className="px-6 py-3">Clínica</th><th className="px-6 py-3 text-right">Valor</th><th className="px-6 py-3 text-center">Status</th><th className="px-6 py-3 text-center">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{allRecords.map((item: any) => (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 text-sm text-slate-600">{formatDate(item.date)}</td>
            <td className="px-6 py-4"><div className="flex items-center gap-3">{item.type === 'expense' ? <div className="p-2 bg-red-50 rounded-lg"><ArrowDownCircle className="w-4 h-4 text-red-500" /></div> : <div className="p-2 bg-green-50 rounded-lg"><Building className="w-4 h-4 text-green-500" /></div>}<div><span className="font-medium text-slate-800 text-sm block">{item.description}</span>{item.type !== 'expense' && <span className="text-xs text-slate-400 capitalize">Plano {item.plan}</span>}</div></div></td>
            <td className={`px-6 py-4 text-right text-sm font-bold ${item.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>{item.type === 'expense' ? '- ' : '+ '} {formatCurrency(item.amount)}</td>
            <td className="px-6 py-4 text-center"><StatusBadge status={item.status} type="financial" /></td>
            <td className="px-6 py-4 text-center"><button onClick={() => setSelectedTransaction(item)} className="text-slate-400 hover:text-primary-600"><FileText className="w-4 h-4 mx-auto" /></button></td>
          </tr>))}</tbody></table></div>
      {isExpenseModalOpen && <NewExpenseModal onClose={() => setIsExpenseModalOpen(false)} />}
      {selectedTransaction && <TransactionDetailModal transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />}
    </div>
  );
}

const ClinicFinancial: React.FC = () => {
  const { transactions, user, appointments, currentCompany, updateCompany, isReadOnly, loadTransactions, loadAppointments, loadingStates } = useApp();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [saveMsg, setSaveMsg] = useState('');

  // Lazy loading
  useEffect(() => {
    loadTransactions();
    loadAppointments();
  }, [loadTransactions, loadAppointments]);

  useEffect(() => { if (currentCompany?.paymentMethods) setSelectedPaymentMethods(currentCompany.paymentMethods); }, [currentCompany]);

  const visibleTransactions = useMemo(() => {
    if (!user || user.role === UserRole.ADMIN) return transactions;
    const myAppIds = appointments.filter(a => a.patientId === user.id).map(a => a.id);
    return transactions.filter(t => t.appointmentId && myAppIds.includes(t.appointmentId) && t.type === 'income');
  }, [transactions, user, appointments]);

  // Agrupar transações por appointmentId para mostrar receita + despesa juntas
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, { income?: Transaction; expense?: Transaction; standalone?: Transaction }> = {};

    visibleTransactions.forEach(t => {
      if (t.appointmentId) {
        if (!groups[t.appointmentId]) {
          groups[t.appointmentId] = {};
        }
        if (t.type === 'income') {
          groups[t.appointmentId].income = t;
        } else {
          groups[t.appointmentId].expense = t;
        }
      } else {
        // Transações sem appointmentId (despesas avulsas)
        groups[t.id] = { standalone: t };
      }
    });

    // Converter para array e ordenar por data
    return Object.entries(groups)
      .map(([key, group]) => ({
        key,
        ...group,
        date: group.income?.date || group.expense?.date || group.standalone?.date || '',
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visibleTransactions]);

  const balance = visibleTransactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);

  // Loading state - usar skeleton
  if (loadingStates.transactions && transactions.length === 0) {
    return <FinancialSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-900">Financeiro Clínica</h1><p className="text-slate-500">Fluxo de caixa e lançamentos.</p></div>
        <div className="flex gap-4 items-center">
          {user?.role === UserRole.ADMIN && <button onClick={() => setIsExpenseModalOpen(true)} disabled={isReadOnly} className={`px-4 py-2 rounded-lg flex items-center gap-2 border font-medium ${isReadOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'}`}><MinusCircle className="w-4 h-4" /> Despesas</button>}
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm"><span className="text-sm text-slate-500 block">Saldo Atual</span><span className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(balance)}</span></div>
        </div>
      </div>
      {user?.role === UserRole.ADMIN && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button type="button" onClick={() => setIsPaymentMethodsOpen(!isPaymentMethodsOpen)} className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 transition-colors"><div className="flex items-center gap-3"><div className="bg-blue-100 p-2 rounded-lg text-blue-600"><CreditCard className="w-5 h-5" /></div><div className="text-left"><h2 className="text-lg font-bold text-slate-800">Formas de Pagamento</h2><p className="text-xs text-slate-500">Configure os métodos aceitos.</p></div></div>{isPaymentMethodsOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</button>
              {isPaymentMethodsOpen && (
                  <div className="p-6 border-t border-slate-100 animate-fade-in"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">{PAYMENT_METHODS_LIST.map(method => (
                              <label key={method.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-primary-300 transition-all bg-slate-50/50">
                                  <input type="checkbox" className="w-5 h-5 text-primary-600 rounded border-gray-300" checked={selectedPaymentMethods.includes(method.id)} onChange={() => { if (selectedPaymentMethods.includes(method.id)) setSelectedPaymentMethods(selectedPaymentMethods.filter(m => m !== method.id)); else setSelectedPaymentMethods([...selectedPaymentMethods, method.id]); }} disabled={isReadOnly} /><span className="text-sm font-medium text-slate-700">{method.label}</span></label>))}</div>
                      <div className="flex justify-end">{saveMsg && <span className="text-green-600 font-medium text-sm mr-4 animate-fade-in">{saveMsg}</span>}<button onClick={() => { if (currentCompany && !isReadOnly) { updateCompany(currentCompany.id, { paymentMethods: selectedPaymentMethods }); setSaveMsg('Salvo!'); setTimeout(() => setSaveMsg(''), 2000); } }} disabled={isReadOnly} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold ${isReadOnly ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-slate-800 text-white'}`}><Save className="w-4 h-4" /> Salvar</button></div></div>)}</section>)}

      {/* Tabela de transações agrupadas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <th className="px-6 py-3">Data</th>
              <th className="px-6 py-3">Procedimento</th>
              <th className="px-6 py-3 text-right">Receita</th>
              <th className="px-6 py-3 text-right">Custo Insumos</th>
              <th className="px-6 py-3 text-right">Lucro</th>
              <th className="px-6 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupedTransactions.map((group) => {
              // Transação standalone (despesa avulsa)
              if (group.standalone) {
                const t = group.standalone;
                return (
                  <tr key={group.key} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(t.date)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="w-4 h-4 text-red-500" />
                        <span className="font-medium text-slate-800 text-sm">{t.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-400">-</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-red-600">- {formatCurrency(t.amount)}</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-red-600">- {formatCurrency(t.amount)}</td>
                    <td className="px-6 py-4 text-center"><StatusBadge status={t.status} type="financial" /></td>
                  </tr>
                );
              }

              // Transação de procedimento (com receita e possivelmente despesa)
              const income = group.income;
              const expense = group.expense;
              const revenue = income ? Number(income.amount) : 0;
              const cost = expense ? Number(expense.amount) : 0;
              const profit = revenue - cost;
              const description = income?.description?.replace('Atendimento: ', '') || expense?.description?.replace('Custo Insumos: ', '') || '';

              return (
                <tr key={group.key} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{formatDate(group.date)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-slate-800 text-sm">{description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-green-600">+ {formatCurrency(revenue)}</td>
                  <td className="px-6 py-4 text-right">
                    {cost > 0 ? (
                      <div className="flex items-center justify-end gap-1">
                        <Package className="w-3 h-3 text-red-400" />
                        <span className="text-sm font-medium text-red-600">- {formatCurrency(cost)}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className={`px-6 py-4 text-right text-sm font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(profit)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={income?.status || expense?.status || 'paid'} type="financial" />
                  </td>
                </tr>
              );
            })}
            {groupedTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  Nenhuma transação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isExpenseModalOpen && !isReadOnly && <NewExpenseModal onClose={() => setIsExpenseModalOpen(false)} />}
    </div>
  );
};

const Financial: React.FC = () => {
  const { user } = useApp();
  return user?.role === UserRole.OWNER ? <SaaSFinancial /> : <ClinicFinancial />;
};

export default Financial;