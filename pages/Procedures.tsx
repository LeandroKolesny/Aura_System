
import React, { useState, useEffect } from 'react';
import { Plus, Syringe, Clock, Trash2, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NewProcedureModal } from '../components/Modals';
import { UserRole, Procedure } from '../types';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatUtils';
import { ProceduresSkeleton } from '../components/LoadingSkeleton';

const Procedures: React.FC = () => {
  const { procedures, user, removeProcedure, isReadOnly, loadProcedures, loadInventory, loadingStates } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Lazy loading
  useEffect(() => {
    loadProcedures();
    loadInventory();
  }, [loadProcedures, loadInventory]);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | undefined>(undefined);
  const navigate = useNavigate();

  // Permissões
  const isPatient = user?.role === UserRole.PATIENT;
  const canEdit = (user?.role === UserRole.ADMIN || user?.role === UserRole.OWNER) && !isReadOnly;
  const showFinancials = user?.role === UserRole.ADMIN || user?.role === UserRole.OWNER;

  const handleCardClick = (proc: Procedure) => {
    if (isPatient) {
        navigate('/schedule', { state: { procedureId: proc.id } });
    } else if (canEdit) {
        handleEdit(proc);
    }
  };

  const handleEdit = (proc: Procedure) => {
    setEditingProcedure(proc);
    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Tem certeza que deseja excluir este procedimento?")) {
        removeProcedure(id);
    }
  };

  const handleCloseModal = () => {
    setEditingProcedure(undefined);
    setIsModalOpen(false);
  };

  // Loading state - usar skeleton
  if (loadingStates.procedures && procedures.length === 0) {
    return <ProceduresSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
             {isPatient ? 'Procedimentos Disponíveis' : 'Catálogo de Procedimentos'}
          </h1>
          <p className="text-slate-500">
             {isPatient ? 'Clique em um procedimento para agendar.' : 'Gerencie preços, custos e detalhes dos serviços oferecidos.'}
          </p>
        </div>
        
        {canEdit && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-secondary-600 hover:bg-secondary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Procedimento
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {procedures.map((proc) => {
          const margin = proc.price - proc.cost;
          const marginPercent = (margin / proc.price) * 100;

          return (
            <div
                key={proc.id}
                onClick={() => handleCardClick(proc)}
                className={`rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative group
                    ${canEdit || isPatient ? 'cursor-pointer hover:shadow-lg hover:border-primary-300 transition-all' : ''}
                    ${proc.imageUrl ? 'min-h-[280px]' : 'bg-white'}
                `}
                title={isPatient ? "Clique para agendar este procedimento" : ""}
            >
              {/* Background Image com overlay */}
              {proc.imageUrl && (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${proc.imageUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                </>
              )}

              {canEdit && (
                  <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleDelete(e, proc.id)}
                        className="p-2 bg-white/90 text-red-500 rounded-full hover:bg-red-50 hover:text-red-700 shadow-sm border border-slate-100"
                        title="Excluir Procedimento"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
              )}

              <div className={`p-6 flex-1 flex flex-col justify-end relative z-[1] ${proc.imageUrl ? '' : 'bg-white'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${proc.imageUrl ? 'bg-white/20 backdrop-blur-sm' : 'bg-secondary-50'}`}>
                    <Syringe className={`w-6 h-6 ${proc.imageUrl ? 'text-white' : 'text-secondary-600'}`} />
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${proc.imageUrl ? 'bg-white/20 backdrop-blur-sm text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Clock className="w-3 h-3" /> {proc.durationMinutes} min
                  </span>
                </div>
                <h3 className={`text-lg font-bold mb-2 ${proc.imageUrl ? 'text-white drop-shadow-lg' : 'text-slate-900'}`}>{proc.name}</h3>
                <p className={`text-sm mb-4 line-clamp-2 ${proc.imageUrl ? 'text-white/80' : 'text-slate-500'}`}>{proc.description || "Sem descrição."}</p>

                <div className={`grid ${showFinancials ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mt-2 pt-2 ${proc.imageUrl ? 'border-t border-white/20' : 'border-t border-slate-100'}`}>
                  <div>
                    <p className={`text-xs uppercase font-bold mb-1 ${proc.imageUrl ? 'text-white/60' : 'text-slate-400'}`}>Valor</p>
                    <p className={`text-lg font-bold ${proc.imageUrl ? 'text-white' : 'text-slate-800'}`}>{formatCurrency(proc.price)}</p>
                  </div>

                  {showFinancials && (
                    <div>
                        <p className={`text-xs uppercase font-bold mb-1 ${proc.imageUrl ? 'text-white/60' : 'text-slate-400'}`}>Custo Insumos</p>
                        <p className={`text-lg font-medium ${proc.imageUrl ? 'text-red-300' : 'text-red-500'}`}>{formatCurrency(proc.cost)}</p>
                    </div>
                  )}
                </div>
              </div>

              {showFinancials && (
                <div className={`px-6 py-3 flex items-center justify-between relative z-[1] ${proc.imageUrl ? 'bg-black/30 backdrop-blur-sm border-t border-white/10' : 'bg-slate-50 border-t border-slate-100'}`}>
                    <span className={`text-xs font-medium ${proc.imageUrl ? 'text-white/70' : 'text-slate-500'}`}>Margem de Lucro</span>
                    <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${proc.imageUrl ? 'text-green-300' : 'text-green-600'}`}>{formatCurrency(margin)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${proc.imageUrl ? 'bg-green-500/30 text-green-200' : 'bg-green-100 text-green-800'}`}>
                        {marginPercent.toFixed(0)}%
                    </span>
                    </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {procedures.length === 0 && (
         <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
           <Syringe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <p className="text-slate-500">Nenhum procedimento cadastrado.</p>
         </div>
      )}

      {isModalOpen && canEdit && (
        <NewProcedureModal 
            onClose={handleCloseModal} 
            initialData={editingProcedure}
        />
      )}
    </div>
  );
};

export default Procedures;
