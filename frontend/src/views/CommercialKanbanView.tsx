import { useState, useEffect, useMemo } from 'react';
import {
  Handshake,
  Plus,
  Building2,
  DollarSign,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Package,
  Edit3,
  Warehouse as WarehouseIcon,
  Receipt,
  Check,
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  CommercialDeal,
  CommercialDealUpdatePayload,
  DealStage,
  DealItemPayload,
  WarehouseItem,
  SalesOrder,
} from '../types';

interface CommercialKanbanViewProps {
  onNavigateToTenders?: () => void;
}

interface ColumnConfig {
  id: DealStage | 'cierre';
  title: string;
  stages: DealStage[];
  color: string;
  borderColor: string;
  badgeBg: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'prospeccion',
    title: '1. Prospección',
    stages: ['prospeccion'],
    color: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-400 dark:border-blue-600',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  },
  {
    id: 'cotizacion',
    title: '2. En Cotización',
    stages: ['cotizacion'],
    color: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-400 dark:border-purple-600',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
  },
  {
    id: 'propuesta_enviada',
    title: '3. Propuesta Enviada',
    stages: ['propuesta_enviada'],
    color: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-400 dark:border-amber-600',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'negociacion',
    title: '4. Negociación',
    stages: ['negociacion'],
    color: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-sky-400 dark:border-sky-600',
    badgeBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
  },
  {
    id: 'cierre',
    title: '5. Cierre (Ganada / Perdida)',
    stages: ['ganada', 'perdida'],
    color: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-400 dark:border-emerald-600',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  },
];

export const CommercialKanbanView = ({ onNavigateToTenders }: CommercialKanbanViewProps) => {
  const [deals, setDeals] = useState<CommercialDeal[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('todos');

  // Modal Nuevo Trato
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newProyecto, setNewProyecto] = useState<string>('');
  const [newCliente, setNewCliente] = useState<string>('');
  const [newRut, setNewRut] = useState<string>('');
  const [newVendedor, setNewVendedor] = useState<string>('Martín Gómez');
  const [newMonto, setNewMonto] = useState<string>('15000');
  const [newMoneda, setNewMoneda] = useState<string>('USD');
  const [newEtapa, setNewEtapa] = useState<DealStage>('prospeccion');
  const [newObservaciones, setNewObservaciones] = useState<string>('');
  const [newItems, setNewItems] = useState<DealItemPayload[]>([
    { sku: 'LUM-6060', cantidad: 500, precio_unitario: 30 },
  ]);

  // Modal Editar Trato
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [editProyecto, setEditProyecto] = useState<string>('');
  const [editCliente, setEditCliente] = useState<string>('');
  const [editRut, setEditRut] = useState<string>('');
  const [editVendedor, setEditVendedor] = useState<string>('');
  const [editMonto, setEditMonto] = useState<string>('0');
  const [editMoneda, setEditMoneda] = useState<string>('USD');
  const [editEtapa, setEditEtapa] = useState<DealStage>('prospeccion');
  const [editObservaciones, setEditObservaciones] = useState<string>('');
  const [editItems, setEditItems] = useState<DealItemPayload[]>([]);

  // Modal Generar Orden de Venta (OV)
  const [isSalesOrderModalOpen, setIsSalesOrderModalOpen] = useState<boolean>(false);
  const [dealForSO, setDealForSO] = useState<CommercialDeal | null>(null);
  const [soWarehouseId, setSoWarehouseId] = useState<string>('DEP-CENTRAL-MVD');
  const [soObservaciones, setSoObservaciones] = useState<string>('');
  const [isEmittingSO, setIsEmittingSO] = useState<boolean>(false);
  const [issuedSO, setIssuedSO] = useState<SalesOrder | null>(null);

  const loadDeals = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiService.getDeals();
      setDeals(data);
    } catch (err: any) {
      console.error('Error al cargar tratos comerciales:', err);
      setErrorMsg('No se pudo conectar con el servicio de CRM. Verifique la conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      const whData = await apiService.getWarehouses();
      if (whData && whData.length > 0) {
        setWarehouses(whData);
      } else {
        setWarehouses([
          { id: 'DEP-CENTRAL-MVD', nombre: 'Depósito Central Montevideo', tipo: 'CENTRAL', ubicacion: 'Montevideo', capacidad_unidades: 20000, activo: true },
          { id: 'SHOWROOM-POCITOS', nombre: 'Showroom Pocitos', tipo: 'SUCURSAL', ubicacion: 'Pocitos', capacidad_unidades: 2000, activo: true },
          { id: 'DEP-SALTO', nombre: 'Depósito Regional Salto', tipo: 'SUCURSAL', ubicacion: 'Salto', capacidad_unidades: 5000, activo: true },
        ]);
      }
    } catch (e) {
      setWarehouses([
        { id: 'DEP-CENTRAL-MVD', nombre: 'Depósito Central Montevideo', tipo: 'CENTRAL', ubicacion: 'Montevideo', capacidad_unidades: 20000, activo: true },
        { id: 'SHOWROOM-POCITOS', nombre: 'Showroom Pocitos', tipo: 'SUCURSAL', ubicacion: 'Pocitos', capacidad_unidades: 2000, activo: true },
        { id: 'DEP-SALTO', nombre: 'Depósito Regional Salto', tipo: 'SUCURSAL', ubicacion: 'Salto', capacidad_unidades: 5000, activo: true },
      ]);
    }
  };

  useEffect(() => {
    loadDeals();
    loadWarehouses();
  }, []);

  // Vendedores únicos para filtro
  const vendedoresList = useMemo(() => {
    const setV = new Set<string>();
    deals.forEach((d) => {
      if (d.vendedor) setV.add(d.vendedor);
    });
    return Array.from(setV);
  }, [deals]);

  // Tratos filtrados
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const matchSearch =
        d.proyecto_nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.rut && d.rut.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.observaciones && d.observaciones.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchVend = selectedVendedor === 'todos' || d.vendedor === selectedVendedor;
      return matchSearch && matchVend;
    });
  }, [deals, searchQuery, selectedVendedor]);

  // KPIs
  const kpis = useMemo(() => {
    const totalPipeline = deals
      .filter((d) => d.etapa !== 'perdida')
      .reduce((sum, d) => sum + Number(d.monto_total || 0), 0);
    const ganados = deals.filter((d) => d.etapa === 'ganada');
    const ganadosMonto = ganados.reduce((sum, d) => sum + Number(d.monto_total || 0), 0);
    const activos = deals.filter((d) => d.etapa !== 'ganada' && d.etapa !== 'perdida').length;
    const tasaCierre = deals.length > 0 ? (ganados.length / deals.length) * 100 : 0;

    return { totalPipeline, ganadosMonto, activos, tasaCierre, totalDeals: deals.length };
  }, [deals]);

  // Manejo de cambio de etapa
  const handleStageChange = async (dealId: string, newStage: DealStage) => {
    try {
      const updated = await apiService.updateDealStage(dealId, newStage);
      setDeals((prev) => prev.map((d) => (d.id === dealId ? updated : d)));
      if (newStage === 'ganada') {
        const warning = updated.stock_reservation_warning
          ? ` Alerta: ${updated.stock_reservation_warning}`
          : ' Stock reservado exitosamente en Depósito Central.';
        setSuccessBanner(`¡Trato ${updated.proyecto_nombre} marcado como GANADO!${warning}`);
      } else {
        setSuccessBanner(`Trato movido a la etapa "${newStage.toUpperCase()}".`);
      }
      setTimeout(() => setSuccessBanner(null), 7000);
    } catch (err: any) {
      console.error('Error al cambiar etapa:', err);
      setErrorMsg('Error al actualizar la etapa del trato comercial.');
    }
  };

  // Manejo de borrado
  const handleDeleteDeal = async (dealId: string) => {
    if (!window.confirm('¿Desea eliminar este trato del pipeline?')) return;
    try {
      await apiService.deleteDeal(dealId);
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      setSuccessBanner('Trato eliminado exitosamente.');
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: any) {
      console.error('Error al eliminar trato:', err);
      setErrorMsg('No se pudo eliminar el trato.');
    }
  };

  // Agregar ítem en modal nuevo
  const handleAddItem = () => {
    setNewItems((prev) => [...prev, { sku: 'LUM-6060', cantidad: 50, precio_unitario: 30 }]);
  };

  const handleRemoveItem = (index: number) => {
    setNewItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof DealItemPayload, value: any) => {
    setNewItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, [field]: value } : it))
    );
  };

  // Enviar nuevo trato
  const handleCreateDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProyecto.trim() || !newCliente.trim()) {
      alert('Por favor complete los campos obligatorios (Proyecto y Cliente).');
      return;
    }

    try {
      const payload = {
        proyecto_nombre: newProyecto.trim(),
        cliente: newCliente.trim(),
        rut: newRut.trim() || undefined,
        vendedor: newVendedor.trim(),
        monto_total: parseFloat(newMonto) || 0,
        moneda: newMoneda,
        etapa: newEtapa,
        observaciones: newObservaciones.trim() || undefined,
        items: newItems.map((it) => ({
          sku: it.sku,
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
        })),
      };

      const created = await apiService.createDeal(payload);
      setDeals((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setSuccessBanner(`Trato "${created.proyecto_nombre}" creado exitosamente.`);
      setTimeout(() => setSuccessBanner(null), 5000);

      // Reset form
      setNewProyecto('');
      setNewCliente('');
      setNewRut('');
      setNewMonto('15000');
      setNewObservaciones('');
    } catch (err: any) {
      console.error('Error al crear trato comercial:', err);
      alert('Error al registrar el trato. Verifique los datos ingresados.');
    }
  };

  // Abrir Modal de Edición de Trato
  const handleOpenEditModal = (deal: CommercialDeal) => {
    setEditingDealId(deal.id);
    setEditProyecto(deal.proyecto_nombre);
    setEditCliente(deal.cliente);
    setEditRut(deal.rut || '');
    setEditVendedor(deal.vendedor || '');
    setEditMonto(String(deal.monto_total || 0));
    setEditMoneda(deal.moneda || 'USD');
    setEditEtapa(deal.etapa);
    setEditObservaciones(deal.observaciones || '');
    setEditItems(
      deal.items && deal.items.length > 0
        ? deal.items.map((it) => ({
            sku: it.sku,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
          }))
        : [{ sku: 'LUM-6060', cantidad: 100, precio_unitario: 30 }]
    );
    setIsEditModalOpen(true);
  };

  const handleEditAddItem = () => {
    setEditItems((prev) => [...prev, { sku: 'LUM-6060', cantidad: 50, precio_unitario: 30 }]);
  };

  const handleEditRemoveItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleEditItemChange = (index: number, field: keyof DealItemPayload, value: any) => {
    setEditItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, [field]: value } : it))
    );
  };

  const handleUpdateDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDealId || !editProyecto.trim() || !editCliente.trim()) {
      alert('Proyecto y Cliente son campos requeridos.');
      return;
    }

    try {
      const payload: CommercialDealUpdatePayload = {
        proyecto_nombre: editProyecto.trim(),
        cliente: editCliente.trim(),
        rut: editRut.trim() || undefined,
        vendedor: editVendedor.trim(),
        monto_total: parseFloat(editMonto) || 0,
        moneda: editMoneda,
        etapa: editEtapa,
        observaciones: editObservaciones.trim() || undefined,
        items: editItems.map((it) => ({
          sku: it.sku,
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
        })),
      };

      const updated = await apiService.updateDeal(editingDealId, payload);
      setDeals((prev) => prev.map((d) => (d.id === editingDealId ? updated : d)));
      setIsEditModalOpen(false);
      setSuccessBanner(`Trato "${updated.proyecto_nombre}" actualizado correctamente.`);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      console.error('Error al actualizar trato:', err);
      alert('No se pudo actualizar el trato. Verifique los datos.');
    }
  };

  // Abrir Modal de Orden de Venta
  const handleOpenSalesOrderModal = (deal: CommercialDeal) => {
    setDealForSO(deal);
    setSoWarehouseId('DEP-CENTRAL-MVD');
    setSoObservaciones(deal.observaciones ? `Ref: ${deal.observaciones}` : '');
    setIssuedSO(null);
    setIsSalesOrderModalOpen(true);
  };

  const handleEmitSalesOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealForSO) return;

    setIsEmittingSO(true);
    try {
      const result = await apiService.generateSalesOrder(dealForSO.id, {
        warehouse_id: soWarehouseId,
        observaciones: soObservaciones.trim() || undefined,
      });

      setIssuedSO(result);
      // Actualizar el trato en la vista local a etapa 'ganada'
      setDeals((prev) =>
        prev.map((d) => (d.id === dealForSO.id ? { ...d, etapa: 'ganada' } : d))
      );
      setSuccessBanner(
        `¡Orden de Venta ${result.numero_ov} generada con éxito! Stock físico descontado de ${result.warehouse_nombre || result.warehouse_id}.`
      );
      setTimeout(() => setSuccessBanner(null), 8000);
    } catch (err: any) {
      console.error('Error al generar Orden de Venta:', err);
      const detail = err.response?.data?.detail || 'Error al emitir la orden de venta.';
      alert(`No se pudo generar la OV: ${detail}`);
    } finally {
      setIsEmittingSO(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Handshake size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Pipeline Comercial (CRM)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                Bitrix24 B2B
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gestión visual de obras, cotizaciones técnicas, reservas de stock y cierres comerciales.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {onNavigateToTenders && (
            <button
              onClick={onNavigateToTenders}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition-colors"
              title="Abrir Licitaciones & Proyectos B2B Serlux"
            >
              <Building2 size={15} />
              <span>Licitaciones B2B</span>
              <ExternalLink size={13} />
            </button>
          )}

          <button
            onClick={loadDeals}
            disabled={isLoading}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            title="Refrescar Pipeline"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-600/30 transition-all hover:scale-[1.02]"
          >
            <Plus size={16} />
            <span>+ Nuevo Trato</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Pipeline Total Activo</span>
            <DollarSign size={15} className="text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            USD {kpis.totalPipeline.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {kpis.activos} tratos en curso
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Tratos Ganados</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            USD {kpis.ganadosMonto.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Stock reservado automáticamente
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Tasa de Conversión</span>
            <Building2 size={15} className="text-purple-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            {kpis.tasaCierre.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Sobre {kpis.totalDeals} oportunidades totales
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Ejecutivo Asignado</span>
            <User size={15} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
            {selectedVendedor === 'todos' ? 'Martín Gómez & Equipo' : selectedVendedor}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Responsable comercial Serlux
          </div>
        </div>
      </div>

      {/* Banner de Éxito / Warning */}
      {successBanner && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-800 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Barra de Filtros Rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <span className="text-slate-400">Buscar:</span>
          <input
            type="text"
            placeholder="Proyecto, cliente o palabras clave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400">Vendedor:</span>
          <select
            value={selectedVendedor}
            onChange={(e) => setSelectedVendedor(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="todos">Todos los vendedores</option>
            {vendedoresList.map((vend) => (
              <option key={vend} value={vend}>
                {vend}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tablero Kanban (5 Columnas) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start min-h-[600px]">
        {COLUMNS.map((col) => {
          const colDeals = filteredDeals.filter((d) => col.stages.includes(d.etapa));
          const colTotalMonto = colDeals.reduce((sum, d) => sum + Number(d.monto_total || 0), 0);

          return (
            <div
              key={col.id}
              className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
            >
              {/* Cabecera de Columna */}
              <div className={`p-3 border-t-4 ${col.borderColor} bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 tracking-tight">
                    {col.title}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${col.badgeBg}`}>
                    {colDeals.length}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  USD {colTotalMonto.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
                </div>
              </div>

              {/* Lista de Tarjetas de Trato */}
              <div className="p-2.5 space-y-3 min-h-[350px] max-h-[750px] overflow-y-auto">
                {colDeals.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-center p-3 text-slate-400 text-xs italic">
                    Sin tratos en esta etapa
                  </div>
                ) : (
                  colDeals.map((deal) => {
                    const isGanada = deal.etapa === 'ganada';
                    const isPerdida = deal.etapa === 'perdida';

                    return (
                      <div
                        key={deal.id}
                        className={`bg-white dark:bg-slate-800 p-3.5 rounded-lg border transition-all duration-150 shadow-sm hover:shadow-md ${
                          isGanada
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : isPerdida
                            ? 'border-rose-300 dark:border-rose-700 opacity-70'
                            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        {/* Header de la Tarjeta */}
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 leading-snug">
                            {deal.proyecto_nombre}
                          </h4>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleOpenEditModal(deal)}
                              className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-0.5"
                              title="Editar Trato Comercial"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteDeal(deal.id)}
                              className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors p-0.5"
                              title="Eliminar Trato"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Cliente & RUT */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <Building2 size={12} className="mr-0.5 flex-shrink-0 text-slate-400" />
                          <span className="truncate font-medium">{deal.cliente}</span>
                          {deal.rut && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              RUT: {deal.rut}
                            </span>
                          )}
                        </div>

                        {/* Vendedor */}
                        <div className="mt-1 flex items-center text-[11px] text-slate-500 dark:text-slate-400">
                          <User size={12} className="mr-1 flex-shrink-0 text-indigo-400" />
                          <span className="truncate">{deal.vendedor}</span>
                        </div>

                        {/* Monto y Moneda */}
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {deal.moneda}{' '}
                            {Number(deal.monto_total).toLocaleString('es-UY', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </span>

                          {isGanada && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 flex items-center space-x-1">
                              <CheckCircle2 size={10} />
                              <span>GANADA</span>
                            </span>
                          )}
                          {isPerdida && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 flex items-center space-x-1">
                              <XCircle size={10} />
                              <span>PERDIDA</span>
                            </span>
                          )}
                        </div>

                        {/* SKUs asociados */}
                        {deal.items && deal.items.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {deal.items.map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center justify-between text-[10px] bg-slate-50 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                <div className="flex items-center space-x-1 truncate mr-2">
                                  <Package size={10} className="text-blue-500" />
                                  <span className="font-mono font-medium">{it.sku}</span>
                                </div>
                                <span className="font-bold whitespace-nowrap">{it.cantidad} u.</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Observaciones */}
                        {deal.observaciones && (
                          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 italic line-clamp-2">
                            "{deal.observaciones}"
                          </p>
                        )}

                        {/* Botón de Emisión de Orden de Venta (OV) */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <button
                            onClick={() => handleOpenSalesOrderModal(deal)}
                            className="w-full py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center space-x-1 transition-all bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            title="Generar Orden de Venta formal con descuento de inventario"
                          >
                            <Receipt size={12} className="text-emerald-600 dark:text-emerald-400" />
                            <span>{isGanada ? '📄 Ver / Reemitir OV' : '📄 Generar Orden de Venta'}</span>
                          </button>
                        </div>

                        {/* Botones de Cambio Rápido de Etapa */}
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[10px]">
                          {deal.etapa !== 'prospeccion' && !isGanada && !isPerdida && (
                            <button
                              onClick={() => {
                                const stageOrder: DealStage[] = [
                                  'prospeccion',
                                  'cotizacion',
                                  'propuesta_enviada',
                                  'negociacion',
                                ];
                                const currIdx = stageOrder.indexOf(deal.etapa);
                                if (currIdx > 0) {
                                  handleStageChange(deal.id, stageOrder[currIdx - 1]);
                                }
                              }}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center space-x-0.5"
                              title="Retroceder etapa"
                            >
                              <ArrowLeft size={11} />
                              <span>Atrás</span>
                            </button>
                          )}

                          {deal.etapa === 'negociacion' ? (
                            <div className="flex items-center space-x-1.5 ml-auto">
                              <button
                                onClick={() => handleStageChange(deal.id, 'ganada')}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center space-x-1 transition-all"
                                title="Cerrar y Reservar Stock"
                              >
                                <CheckCircle2 size={11} />
                                <span>Ganar</span>
                              </button>
                              <button
                                onClick={() => handleStageChange(deal.id, 'perdida')}
                                className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold flex items-center space-x-1 transition-all"
                              >
                                <XCircle size={11} />
                                <span>Perdida</span>
                              </button>
                            </div>
                          ) : deal.etapa !== 'ganada' && deal.etapa !== 'perdida' ? (
                            <button
                              onClick={() => {
                                const stageOrder: DealStage[] = [
                                  'prospeccion',
                                  'cotizacion',
                                  'propuesta_enviada',
                                  'negociacion',
                                ];
                                const currIdx = stageOrder.indexOf(deal.etapa);
                                if (currIdx >= 0 && currIdx < stageOrder.length - 1) {
                                  handleStageChange(deal.id, stageOrder[currIdx + 1]);
                                }
                              }}
                              className="ml-auto text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium flex items-center space-x-0.5"
                              title="Avanzar etapa"
                            >
                              <span>Avanzar</span>
                              <ArrowRight size={11} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStageChange(deal.id, 'negociacion')}
                              className="text-slate-400 hover:text-slate-600 text-[10px] ml-auto underline"
                            >
                              Reabrir trato
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal [+ Nuevo Trato] */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Handshake size={20} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Nuevo Trato Comercial (CRM)
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateDealSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Proyecto / Nombre de Obra *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Edificio Pocitos, Torre Bahía, Shopping Punta Carretas"
                  value={newProyecto}
                  onChange={(e) => setNewProyecto(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cliente / Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Constructora Bahía / Ing. Rossi"
                    value={newCliente}
                    onChange={(e) => setNewCliente(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    RUT del Cliente (12 dígitos)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 219876540019"
                    value={newRut}
                    onChange={(e) => setNewRut(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Vendedor Asignado
                  </label>
                  <input
                    type="text"
                    value={newVendedor}
                    onChange={(e) => setNewVendedor(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Monto Total
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMonto}
                    onChange={(e) => setNewMonto(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Moneda
                  </label>
                  <select
                    value={newMoneda}
                    onChange={(e) => setNewMoneda(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD (Dólares)</option>
                    <option value="UYU">UYU (Pesos)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Etapa Inicial
                  </label>
                  <select
                    value={newEtapa}
                    onChange={(e) => setNewEtapa(e.target.value as DealStage)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="prospeccion">1. Prospección</option>
                    <option value="cotizacion">2. En Cotización</option>
                    <option value="propuesta_enviada">3. Propuesta Enviada</option>
                    <option value="negociacion">4. Negociación</option>
                    <option value="ganada">5. Ganada</option>
                  </select>
                </div>
              </div>

              {/* Partidas de SKUs */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Artículos / SKUs Requeridos
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    + Agregar SKU
                  </button>
                </div>

                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {newItems.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <select
                        value={item.sku}
                        onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-slate-100 font-mono text-xs"
                      >
                        <option value="LUM-6060">LUM-6060 (Panel LED 60x60)</option>
                        <option value="UFO-150W">UFO-150W (Campana 150W)</option>
                        <option value="DRV-DALI">DRV-DALI (Driver DALI-2)</option>
                        <option value="PRY-100W">PRY-100W (Proyector Exterior)</option>
                      </select>

                      <input
                        type="number"
                        placeholder="Cant"
                        value={item.cantidad}
                        onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)}
                        className="w-20 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right"
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio"
                        value={item.precio_unitario}
                        onChange={(e) => handleItemChange(idx, 'precio_unitario', e.target.value)}
                        className="w-20 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right"
                      />

                      {newItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-500 hover:text-rose-700 px-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones Técnicas o Comerciales
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre normativas requeridas, plazos de obra, etc."
                  value={newObservaciones}
                  onChange={(e) => setNewObservaciones(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shadow-blue-500/30 transition-all hover:scale-[1.02]"
                >
                  Guardar Trato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal [✏️ Editar Trato Comercial] */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 size={20} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Editar Trato Comercial
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateDealSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Proyecto / Nombre de Obra *
                </label>
                <input
                  type="text"
                  required
                  value={editProyecto}
                  onChange={(e) => setEditProyecto(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cliente / Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCliente}
                    onChange={(e) => setEditCliente(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    RUT del Cliente
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 219876540019"
                    value={editRut}
                    onChange={(e) => setEditRut(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Vendedor Asignado
                  </label>
                  <input
                    type="text"
                    value={editVendedor}
                    onChange={(e) => setEditVendedor(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Monto Total
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMonto}
                    onChange={(e) => setEditMonto(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Moneda
                  </label>
                  <select
                    value={editMoneda}
                    onChange={(e) => setEditMoneda(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD (Dólares)</option>
                    <option value="UYU">UYU (Pesos)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Etapa Actual
                  </label>
                  <select
                    value={editEtapa}
                    onChange={(e) => setEditEtapa(e.target.value as DealStage)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="prospeccion">1. Prospección</option>
                    <option value="cotizacion">2. En Cotización</option>
                    <option value="propuesta_enviada">3. Propuesta Enviada</option>
                    <option value="negociacion">4. Negociación</option>
                    <option value="ganada">5. Ganada</option>
                    <option value="perdida">Perdida</option>
                  </select>
                </div>
              </div>

              {/* Partidas de SKUs Editables */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Artículos / SKUs del Trato
                  </label>
                  <button
                    type="button"
                    onClick={handleEditAddItem}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    + Agregar SKU
                  </button>
                </div>

                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <select
                        value={item.sku}
                        onChange={(e) => handleEditItemChange(idx, 'sku', e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-slate-100 font-mono text-xs"
                      >
                        <option value="LUM-6060">LUM-6060 (Panel LED 60x60)</option>
                        <option value="UFO-150W">UFO-150W (Campana 150W)</option>
                        <option value="DRV-DALI">DRV-DALI (Driver DALI-2)</option>
                        <option value="PRY-100W">PRY-100W (Proyector Exterior)</option>
                      </select>

                      <input
                        type="number"
                        placeholder="Cant"
                        value={item.cantidad}
                        onChange={(e) => handleEditItemChange(idx, 'cantidad', e.target.value)}
                        className="w-20 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right"
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio"
                        value={item.precio_unitario}
                        onChange={(e) => handleEditItemChange(idx, 'precio_unitario', e.target.value)}
                        className="w-20 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-right"
                      />

                      {editItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleEditRemoveItem(idx)}
                          className="text-rose-500 hover:text-rose-700 px-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones
                </label>
                <textarea
                  rows={2}
                  value={editObservaciones}
                  onChange={(e) => setEditObservaciones(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shadow-blue-500/30 transition-all hover:scale-[1.02]"
                >
                  Actualizar Trato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal [📄 Generación Formal de Orden de Venta (OV)] */}
      {isSalesOrderModalOpen && dealForSO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  <Receipt size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Emisión Formal de Orden de Venta (OV)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Genera el comprobante de venta, liquida IVA 22% y descuenta inventario físico.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSalesOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {issuedSO ? (
              /* Comprobante emitido con éxito */
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm tracking-wide">
                        ¡ORDEN DE VENTA EMITIDA: {issuedSO.numero_ov}!
                      </h4>
                      <p className="text-xs opacity-90">
                        El stock físico de los artículos ha sido descontado del almacén{' '}
                        <strong>{issuedSO.warehouse_nombre || issuedSO.warehouse_id}</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{issuedSO.cliente}</span>
                      {issuedSO.rut && <span className="block text-[11px] font-mono text-slate-500">RUT: {issuedSO.rut}</span>}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Depósito de Despacho</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{issuedSO.warehouse_nombre || issuedSO.warehouse_id}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Subtotal ({issuedSO.moneda}):</span>
                      <span className="font-mono font-medium">
                        {Number(issuedSO.subtotal).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">IVA 22% (Tasa Básica UY):</span>
                      <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        +{Number(issuedSO.iva_monto).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-t border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-900 dark:text-slate-100">
                      <span>Total Facturado:</span>
                      <span className="font-mono">
                        {issuedSO.moneda} {Number(issuedSO.total).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setIsSalesOrderModalOpen(false)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    Cerrar Comprobante
                  </button>
                </div>
              </div>
            ) : (
              /* Formulario de Confirmación y Emisión */
              <form onSubmit={handleEmitSalesOrderSubmit} className="space-y-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Proyecto</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {dealForSO.proyecto_nombre}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente / Razón Social</span>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{dealForSO.cliente}</span>
                        {dealForSO.rut && (
                          <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded font-mono text-[10px]">
                            {dealForSO.rut}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selector de Depósito */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1.5">
                    <WarehouseIcon size={14} className="text-emerald-600" />
                    <span>Almacén / Depósito de Origen para Despacho Físico *</span>
                  </label>
                  <select
                    value={soWarehouseId}
                    onChange={(e) => setSoWarehouseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nombre} ({wh.id}) - Capacidad: {wh.capacidad_unidades?.toLocaleString() || 'N/A'} u.
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    El inventario físico disponible en este depósito será rebajado de forma inmediata y registrada en el libro diario.
                  </p>
                </div>

                {/* Desglose de Artículos */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Artículos a Liquidar en la Orden:
                  </label>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2">SKU</th>
                          <th className="p-2 text-right">Cantidad</th>
                          <th className="p-2 text-right">Precio Unit.</th>
                          <th className="p-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                        {dealForSO.items && dealForSO.items.length > 0 ? (
                          dealForSO.items.map((it) => (
                            <tr key={it.id || it.sku} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-2 font-mono font-medium text-slate-900 dark:text-slate-100">
                                {it.sku}
                              </td>
                              <td className="p-2 text-right font-semibold">{it.cantidad} u.</td>
                              <td className="p-2 text-right font-mono">
                                {dealForSO.moneda} {Number(it.precio_unitario).toFixed(2)}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                {dealForSO.moneda}{' '}
                                {(it.cantidad * it.precio_unitario).toLocaleString('es-UY', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-3 text-center text-slate-400 italic">
                              Trato sin ítems específicos. Se liquidará el monto global pactado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resumen Impositivo UY */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal Neto:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {dealForSO.moneda} {Number(dealForSO.monto_total || 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">IVA 22% (Tasa General UY):</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      +{dealForSO.moneda}{' '}
                      {(Number(dealForSO.monto_total || 0) * 0.22).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-slate-100">
                    <span>Total Factura Final:</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-300">
                      {dealForSO.moneda}{' '}
                      {(Number(dealForSO.monto_total || 0) * 1.22).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Instrucciones de Despacho / Observaciones
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Entregar en obra 8:00 AM con remito valorizado."
                    value={soObservaciones}
                    onChange={(e) => setSoObservaciones(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSalesOrderModalOpen(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isEmittingSO}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-lg shadow-sm shadow-emerald-600/30 transition-all hover:scale-[1.02] flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isEmittingSO ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Emitiendo OV...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Confirmar y Descontar Stock Físico</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
