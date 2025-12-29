
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryModal } from '../components/Modals';
import { InventoryItem } from '../types';
import { Package, Plus, Search, Edit, Trash2, AlertTriangle, Filter } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';

const Inventory: React.FC = () => {
  const { inventory, removeInventoryItem, isReadOnly } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  const filteredItems = inventory.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLowStock = filterLowStock ? item.currentStock <= item.minStock : true;
      return matchesSearch && matchesLowStock;
  });

  const handleEdit = (item: InventoryItem) => {
      if (isReadOnly) return;
      setEditingItem(item);
      setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
      if (isReadOnly) return;
      if (window.confirm('Tem certeza que deseja remover este item do estoque?')) {
          removeInventoryItem(id);
      }
  };

  const handleClose = () => {
      setEditingItem(undefined);
      setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-6 h-6 text-primary-600" /> Controle de Estoque
                </h1>
                <p className="text-slate-500">Gerencie insumos, produtos e controle de baixa automática.</p>
            </div>
            
            <button 
                onClick={() => setIsModalOpen(true)}
                disabled={isReadOnly}
                className={`bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm
                    ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <Plus className="w-4 h-4" /> Novo Item
            </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar insumo..." 
                    className="w-full pl-9 p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={() => setFilterLowStock(!filterLowStock)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 transition-colors
                    ${filterLowStock ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                `}
            >
                <AlertTriangle className={`w-4 h-4 ${filterLowStock ? 'text-red-500' : 'text-slate-400'}`} />
                Estoque Baixo
            </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Item</th>
                            <th className="px-6 py-3 text-center">Unidade</th>
                            <th className="px-6 py-3 text-center">Estoque Atual</th>
                            <th className="px-6 py-3 text-center">Estoque Mínimo</th>
                            <th className="px-6 py-3 text-right">Custo Unit.</th>
                            <th className="px-6 py-3 text-right">Valor Total</th>
                            <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredItems.map(item => {
                            const isLow = item.currentStock <= item.minStock;
                            return (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {item.name}
                                        {isLow && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Repor</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-500 uppercase text-xs">{item.unit}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                                            {item.currentStock}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-500">{item.minStock}</td>
                                    <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(item.costPerUnit)}</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-800">{formatCurrency(item.costPerUnit * item.currentStock)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {filteredItems.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400">Nenhum item encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {isModalOpen && !isReadOnly && (
            <InventoryModal onClose={handleClose} initialData={editingItem} />
        )}
    </div>
  );
};

export default Inventory;
