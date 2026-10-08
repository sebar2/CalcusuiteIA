import { useState, useEffect, useMemo } from 'react';
import {
  Ship,
  Factory,
  Warehouse,
  Store,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  PackageCheck,
  Settings,
  MapPin,
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  StockBatchItem,
  BatchStage,
  WarehouseTransferPayload,
  WarehouseAssignStockPayload,
  WarehouseItem,
} from '../types';

interface StageColumnConfig {
  id: BatchStage;
  warehouseId: string;
  title: string;
  subtitle: string;
  icon: any;
  badgeBg: string;
  borderColor: string;
  accentColor: string;
}

const STAGES: StageColumnConfig[] = [
  {
    id: 'fabricacion',
    warehouseId: 'FAB-CHINA',
    title: '1. Fábrica Origen',
    subtitle: 'Shenzhen / Ningbo (Producción ROP)',
    icon: Factory,
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-400 dark:border-amber-600',
    accentColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'transito',
    warehouseId: 'TRANSITO-MAR',
    title: '2. Tránsito Marítimo',
    subtitle: 'En Alta Mar & Aduana con ETA',
    icon: Ship,
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-400 dark:border-blue-600',
    accentColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'deposito_central',
    warehouseId: 'DEP-CENTRAL-MVD',
    title: '3. Depósito Central MVD',
    subtitle: 'Montevideo (Stock Nacionalizado)',
    icon: Warehouse,
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-400 dark:border-emerald-600',
    accentColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'deposito_salto',
    warehouseId: 'DEP-SALTO',
    title: '4. Depósito Regional Salto',
    subtitle: 'Salto Litoral (Distribución)',
    icon: Warehouse,
    badgeBg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300',
    borderColor: 'border-teal-400 dark:border-teal-600',
    accentColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'showroom_pocitos',
    warehouseId: 'SHOWROOM-POCITOS',
    title: '5. Showroom Pocitos',
    subtitle: 'Pocitos MVD (Exhibición & Retail)',
    icon: Store,
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-400 dark:border-purple-600',
    accentColor: 'text-purple-600 dark:text-purple-400',
  },
];

export const MultiLocationStockView = () => {
  const [unifiedBatches, setUnifiedBatches] = useState<StockBatchItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filtros
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedOrigenTipo, setSelectedOrigenTipo] = useState<string>('todos');

  // Modal de Transferencia entre Almacenes
  const [transferModalBatch, setTransferModalBatch] = useState<StockBatchItem | null>(null);
  const [transferDestinoWh, setTransferDestinoWh] = useState<string>('SHOWROOM-POCITOS');
  const [transferCantidad, setTransferCantidad] = useState<string>('');
  const [transferNotas, setTransferNotas] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Modal Asignar Stock Directo
  const [isDirectStockModalOpen, setIsDirectStockModalOpen] = useState<boolean>(false);
  const [directLote, setDirectLote] = useState<string>('LOT-DIR-2026-');
  const [directSku, setDirectSku] = useState<string>('LUM-6060');
  const [directCantidad, setDirectCantidad] = useState<number>(100);
  const [directWhId, setDirectWhId] = useState<string>('DEP-CENTRAL-MVD');
  const [directTracking, setDirectTracking] = useState<string>('');
  const [directFechaEta, setDirectFechaEta] = useState<string>('');
  const [directNotas, setDirectNotas] = useState<string>('');
  const [isSavingDirect, setIsSavingDirect] = useState<boolean>(false);

  // Gobernanza de Depósitos Físicos (Configuración)
  const [warehouseModalOpen, setWarehouseModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
  const [whFormId, setWhFormId] = useState<string>('');
  const [whFormNombre, setWhFormNombre] = useState<string>('');
  const [whFormTipo, setWhFormTipo] = useState<string>('SUCURSAL');
  const [whFormUbicacion, setWhFormUbicacion] = useState<string>('');
  const [whFormCapacidad, setWhFormCapacidad] = useState<number>(10000);
  const [whFormActivo, setWhFormActivo] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [batchesData, whData] = await Promise.all([
        apiService.getUnifiedBatches(),
        apiService.getWarehouses().catch(() => []),
      ]);
      setUnifiedBatches(batchesData);
      setWarehouses(whData && whData.length > 0 ? whData : [
        { id: 'FAB-CHINA', nombre: 'Fábrica Origen Shenzhen', tipo: 'FABRICA', ubicacion: 'China', capacidad_unidades: 50000, activo: true },
        { id: 'TRANSITO-MAR', nombre: 'Tránsito Marítimo / Aduana', tipo: 'TRANSITO', ubicacion: 'Océano Atlántico', capacidad_unidades: 30000, activo: true },
        { id: 'DEP-CENTRAL-MVD', nombre: 'Depósito Central Montevideo', tipo: 'CENTRAL', ubicacion: 'Montevideo', capacidad_unidades: 20000, activo: true },
        { id: 'DEP-SALTO', nombre: 'Depósito Regional Salto', tipo: 'SUCURSAL', ubicacion: 'Salto', capacidad_unidades: 5000, activo: true },
        { id: 'SHOWROOM-POCITOS', nombre: 'Showroom Pocitos', tipo: 'SUCURSAL', ubicacion: 'Pocitos', capacidad_unidades: 2000, activo: true },
      ]);
    } catch (err: any) {
      console.error('Error al cargar datos de trazabilidad unificada:', err);
      setErrorMsg('No se pudieron obtener los lotes sincronizados de inventario.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lotes filtrados con blindaje defensivo integral ante valores undefined / null
  const filteredBatches = useMemo(() => {
    if (!Array.isArray(unifiedBatches)) return [];

    const term = String(searchFilter ?? '').trim().toLowerCase();

    return unifiedBatches.filter((b) => {
      if (!b) return false;

      const id = String(b.id ?? b.lote ?? '').toLowerCase();
      const lote = String(b.lote ?? '').toLowerCase();
      const sku = String(b.sku ?? '').toLowerCase();
      const nombre = String(b.producto_nombre ?? '').toLowerCase();
      const tracking = String(b.buque_o_tracking ?? '').toLowerCase();
      const warehouseId = String(b.warehouse_id ?? '').toLowerCase();

      const matchSearch =
        !term ||
        id.includes(term) ||
        lote.includes(term) ||
        sku.includes(term) ||
        nombre.includes(term) ||
        tracking.includes(term) ||
        warehouseId.includes(term);

      const origenTipo = String(b.origen_tipo ?? 'ROP');
      const matchOrigen =
        selectedOrigenTipo === 'todos' || origenTipo === selectedOrigenTipo;

      return matchSearch && matchOrigen;
    });
  }, [unifiedBatches, searchFilter, selectedOrigenTipo]);

  // Manejador de Transferencia entre Almacenes
  const handleOpenTransferModal = (batch: StockBatchItem) => {
    setTransferModalBatch(batch);
    // Sugerir destino por defecto diferente al origen
    const defaultDest =
      batch.warehouse_id === 'DEP-CENTRAL-MVD'
        ? 'SHOWROOM-POCITOS'
        : batch.warehouse_id === 'FAB-CHINA'
        ? 'TRANSITO-MAR'
        : batch.warehouse_id === 'TRANSITO-MAR'
        ? 'DEP-CENTRAL-MVD'
        : 'DEP-CENTRAL-MVD';
    setTransferDestinoWh(defaultDest);
    setTransferCantidad(String(batch.cantidad));
    setTransferNotas('');
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalBatch) return;

    const cant = parseInt(transferCantidad, 10);
    if (isNaN(cant) || cant <= 0 || cant > transferModalBatch.cantidad) {
      alert(`La cantidad debe ser entre 1 y ${transferModalBatch.cantidad}.`);
      return;
    }

    if (transferModalBatch.warehouse_id === transferDestinoWh) {
      alert('El depósito de destino debe ser diferente al depósito de origen.');
      return;
    }

    setIsTransferring(true);
    try {
      const payload: WarehouseTransferPayload = {
        batch_id: transferModalBatch.id,
        origen_warehouse_id: transferModalBatch.warehouse_id,
        destino_warehouse_id: transferDestinoWh,
        cantidad: cant,
        observaciones: transferNotas.trim() || undefined,
      };

      const res = await apiService.transferWarehouseStock(payload);
      setTransferModalBatch(null);
      setSuccessBanner(res.message);
      setTimeout(() => setSuccessBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      console.error('Error al transferir lote:', err);
      const detail = err.response?.data?.detail || 'Error al ejecutar la transferencia.';
      alert(detail);
    } finally {
      setIsTransferring(false);
    }
  };

  // Manejador de Arribo Automático
  const handleAutoArrive = async () => {
    try {
      const res = await apiService.autoArriveStockBatches();
      setSuccessBanner(res.message);
      setTimeout(() => setSuccessBanner(null), 6000);
      await loadData();
    } catch (err: any) {
      console.error('Error al procesar arribos automáticos:', err);
      setErrorMsg('No se pudieron procesar los arribos automáticos.');
    }
  };

  // Manejador de Asignar Stock Directo
  const handleDirectStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directLote.trim() || !directSku.trim() || directCantidad <= 0) {
      alert('Lote, SKU y cantidad mayor a 0 son obligatorios.');
      return;
    }

    setIsSavingDirect(true);
    try {
      const payload: WarehouseAssignStockPayload = {
        lote: directLote.trim(),
        sku: directSku.trim(),
        cantidad: Number(directCantidad),
        warehouse_id: directWhId,
        buque_o_tracking: directTracking.trim() || undefined,
        fecha_eta: directFechaEta || undefined,
        observaciones: directNotas.trim() || undefined,
      };

      const res = await apiService.assignDirectStock(payload);
      setIsDirectStockModalOpen(false);
      setSuccessBanner(res.message);
      setTimeout(() => setSuccessBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      console.error('Error al asignar stock directo:', err);
      const detail = err.response?.data?.detail || 'Error al asignar stock directo.';
      alert(detail);
    } finally {
      setIsSavingDirect(false);
    }
  };

  // Handlers para Almacenes / Depósitos (Configuración)
  const handleOpenNewWarehouse = () => {
    setEditingWarehouse(null);
    setWhFormId('dep-');
    setWhFormNombre('');
    setWhFormTipo('SUCURSAL');
    setWhFormUbicacion('Montevideo, Uruguay');
    setWhFormCapacidad(10000);
    setWhFormActivo(true);
    setWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (wh: WarehouseItem) => {
    setEditingWarehouse(wh);
    setWhFormId(wh.id);
    setWhFormNombre(wh.nombre);
    setWhFormTipo(wh.tipo);
    setWhFormUbicacion(wh.ubicacion);
    setWhFormCapacidad(wh.capacidad_unidades);
    setWhFormActivo(wh.activo);
    setWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await apiService.updateWarehouse(editingWarehouse.id, {
          nombre: whFormNombre,
          tipo: whFormTipo,
          ubicacion: whFormUbicacion,
          capacidad_unidades: whFormCapacidad,
          activo: whFormActivo,
        });
        setSuccessBanner(`Depósito '${whFormNombre}' actualizado correctamente.`);
      } else {
        await apiService.createWarehouse({
          id: whFormId,
          nombre: whFormNombre,
          tipo: whFormTipo,
          ubicacion: whFormUbicacion,
          capacidad_unidades: whFormCapacidad,
          activo: whFormActivo,
        });
        setSuccessBanner(`Depósito '${whFormNombre}' creado exitosamente.`);
      }
      setWarehouseModalOpen(false);
      const whList = await apiService.getWarehouses();
      setWarehouses(whList);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      console.error('Error al guardar depósito:', err);
      setErrorMsg(err.response?.data?.detail || 'Error al persistir depósito.');
    }
  };

  // KPIs dinámicos calculados desde los lotes unificados
  const stageStats = useMemo(() => {
    const stats: Record<string, { units: number; lots: number }> = {
      fabricacion: { units: 0, lots: 0 },
      transito: { units: 0, lots: 0 },
      deposito_central: { units: 0, lots: 0 },
      deposito_salto: { units: 0, lots: 0 },
      showroom_pocitos: { units: 0, lots: 0 },
    };

    unifiedBatches.forEach((b) => {
      const stage = b.etapa_logistica;
      if (stats[stage]) {
        stats[stage].units += b.cantidad;
        stats[stage].lots += 1;
      }
    });

    return stats;
  }, [unifiedBatches]);

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Ship size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Monitor Multi-Depósito & Tránsito Sincronizado
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-200">
                ROP Sync & Batches
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Trazabilidad unificada por Lote: Fábrica Origen, Alta Mar, Depósito Central MVD, Depósito Salto y Showroom Pocitos.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleAutoArrive}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 border border-emerald-300 dark:border-emerald-800 transition-colors shadow-sm"
            title="Ingresar a Depósito Central todos los lotes cuya fecha ETA ya se cumplió"
          >
            <PackageCheck size={15} />
            <span>⚡ Arribo Automático (ETA ≤ 0)</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            title="Refrescar Lotes"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => {
              setDirectLote(`LOT-DIR-2026-${Math.floor(100 + Math.random() * 900)}`);
              setIsDirectStockModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            title="Asignar stock de ingreso directo en un almacén físico"
          >
            <Plus size={16} />
            <span>+ Asignar Stock Directo</span>
          </button>

          <button
            onClick={handleOpenNewWarehouse}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-500/20 transition-all hover:scale-[1.02]"
            title="Crear un nuevo centro logístico o depósito"
          >
            <Plus size={15} />
            <span>+ Nuevo Almacén</span>
          </button>
        </div>
      </div>

      {/* Gobernanza Multi-Depósito: Almacenes & Hubs Físicos */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Warehouse size={16} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Nodos Logísticos Registrados ({warehouses.length}):
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="flex items-center space-x-2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs shadow-xs"
            >
              <MapPin size={12} className="text-slate-400" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">{wh.nombre}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {wh.id}
              </span>
              <button
                onClick={() => handleOpenEditWarehouse(wh)}
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                title="Configurar depósito"
              >
                <Settings size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards de los 5 Nodos Logísticos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>1. Fábrica Origen</span>
            <Factory size={16} className="text-amber-500" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-900 dark:text-slate-100">
            {stageStats.fabricacion.units.toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {stageStats.fabricacion.lots} lotes en producción
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>2. Tránsito Marítimo</span>
            <Ship size={16} className="text-blue-500" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-blue-600 dark:text-blue-400">
            {stageStats.transito.units.toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {stageStats.transito.lots} lotes con tracking ETA
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>3. Dep. Central MVD</span>
            <Warehouse size={16} className="text-emerald-500" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {stageStats.deposito_central.units.toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {stageStats.deposito_central.lots} lotes nacionalizados
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>4. Dep. Regional Salto</span>
            <Warehouse size={16} className="text-teal-500" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-teal-600 dark:text-teal-400">
            {stageStats.deposito_salto.units.toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {stageStats.deposito_salto.lots} lotes en Salto
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>5. Showroom Pocitos</span>
            <Store size={16} className="text-purple-500" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-purple-600 dark:text-purple-400">
            {stageStats.showroom_pocitos.units.toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {stageStats.showroom_pocitos.lots} lotes exhibición
          </div>
        </div>
      </div>

      {/* Banners */}
      {successBanner && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <span className="text-slate-400">Buscar Lote / SKU:</span>
          <input
            type="text"
            placeholder="LOT-2026, SKU, Buque o BL..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400">Tipo Origen:</span>
          <select
            value={selectedOrigenTipo}
            onChange={(e) => setSelectedOrigenTipo(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="todos">Todos los orígenes</option>
            <option value="ROP">ROP (Kanban Abastecimiento)</option>
            <option value="STOCK_DIRECTO">Stock Directo</option>
          </select>
        </div>
      </div>

      {/* Tablero de los 5 Estadios Logísticos Unificados */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start min-h-[580px]">
        {STAGES.map((stg) => {
          const stageBatches = filteredBatches.filter(
            (b) =>
              String(b?.etapa_logistica ?? (b as any)?.etapa ?? '') === String(stg?.id ?? '') ||
              String(b?.warehouse_id ?? '') === String(stg?.warehouseId ?? '')
          );
          const totalUnits = stageBatches.reduce((acc, b) => acc + (Number(b?.cantidad) || 0), 0);
          const IconComp = stg.icon;

          return (
            <div
              key={stg.id}
              className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
            >
              {/* Encabezado del Estadio */}
              <div className={`p-3 border-t-4 ${stg.borderColor} bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <IconComp size={15} className={stg.accentColor} />
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                      {stg.title}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stg.badgeBg}`}>
                    {stageBatches.length} lotes
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate pr-1 text-[10px]">{stg.subtitle}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {totalUnits.toLocaleString('es-UY')} u.
                  </span>
                </div>
              </div>

              {/* Lista de Tarjetas de Lote */}
              <div className="p-2 space-y-2.5 min-h-[350px] max-h-[750px] overflow-y-auto">
                {stageBatches.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-center p-3 text-slate-400 text-xs italic">
                    Sin inventario en este estadio
                  </div>
                ) : (
                  stageBatches.map((batch) => {
                    const daysLeft = batch.dias_restantes_eta;
                    const isROP = batch.origen_tipo === 'ROP';

                    return (
                      <div
                        key={batch.id}
                        className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all duration-150 shadow-sm hover:shadow-md"
                      >
                        {/* Cabecera Lote y Origen Badge */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded truncate">
                            {batch.lote}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isROP
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {isROP ? 'ROP' : 'DIRECTO'}
                          </span>
                        </div>

                        {/* SKU y Cantidad */}
                        <div className="mt-2">
                          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center justify-between">
                            <span className="font-mono">{batch.sku}</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                              {batch.cantidad.toLocaleString('es-UY')} u.
                            </span>
                          </div>
                          {batch.producto_nombre && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {batch.producto_nombre}
                            </p>
                          )}
                        </div>

                        {/* Almacén Físico */}
                        <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                          <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{batch.warehouse_nombre || batch.warehouse_id}</span>
                        </div>

                        {/* Buque / Tracking */}
                        {batch.buque_o_tracking && (
                          <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-1 rounded border border-slate-100 dark:border-slate-800 flex items-center space-x-1">
                            <Ship size={10} className="text-cyan-500 flex-shrink-0" />
                            <span className="truncate">{batch.buque_o_tracking}</span>
                          </div>
                        )}

                        {/* Fechas & Contador ETA */}
                        {batch.fecha_eta && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/80">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400 flex items-center space-x-1">
                                <Calendar size={10} />
                                <span>ETA: {batch.fecha_eta}</span>
                              </span>

                              {daysLeft !== null && daysLeft !== undefined && (
                                <span
                                  className={`px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center space-x-0.5 ${
                                    daysLeft <= 0
                                      ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200'
                                      : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                  }`}
                                >
                                  <Clock size={9} />
                                  <span>{daysLeft <= 0 ? 'Arribado' : `${daysLeft}d`}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Observaciones */}
                        {batch.observaciones && (
                          <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 italic line-clamp-1">
                            "{batch.observaciones}"
                          </p>
                        )}

                        {/* Botón de Transferencia */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                            {batch.estado}
                          </span>
                          <button
                            onClick={() => handleOpenTransferModal(batch)}
                            className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 hover:bg-cyan-50 dark:bg-slate-700 dark:hover:bg-cyan-950/60 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-600 flex items-center space-x-1 transition-colors"
                          >
                            <ArrowRightLeft size={10} />
                            <span>Transferir</span>
                          </button>
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

      {/* Modal de Transferencia entre Almacenes Físicos */}
      {transferModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft size={20} className="text-cyan-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Transferir Stock entre Almacenes
                </h3>
              </div>
              <button
                onClick={() => setTransferModalBatch(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3.5 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between font-mono font-bold text-blue-600 dark:text-blue-400">
                  <span>{transferModalBatch.lote}</span>
                  <span>{transferModalBatch.sku}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Depósito Origen Actual:</span>
                  <span className="font-semibold">{transferModalBatch.warehouse_nombre || transferModalBatch.warehouse_id}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Stock Disponible en Lote:</span>
                  <span className="font-bold">{transferModalBatch.cantidad} unidades</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Depósito Destino *
                </label>
                <select
                  value={transferDestinoWh}
                  onChange={(e) => setTransferDestinoWh(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
                >
                  {warehouses
                    .filter((w) => w.id !== transferModalBatch.warehouse_id)
                    .map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nombre} ({wh.id})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cantidad a Transferir (Unidades) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={transferModalBatch.cantidad}
                  value={transferCantidad}
                  onChange={(e) => setTransferCantidad(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Si transfiere una cantidad parcial, el sistema dividirá el lote de forma automática y trazable.
                </span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notas de Movimiento / Remito
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. Remito interno R-1082 hacia Showroom Pocitos."
                  value={transferNotas}
                  onChange={(e) => setTransferNotas(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferModalBatch(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg shadow-sm shadow-cyan-500/30 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  {isTransferring ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal [+ Asignar Stock Directo] */}
      {isDirectStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Warehouse size={20} className="text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Asignar Stock de Ingreso Directo
                </h3>
              </div>
              <button
                onClick={() => setIsDirectStockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleDirectStockSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Código de Lote *
                  </label>
                  <input
                    type="text"
                    required
                    value={directLote}
                    onChange={(e) => setDirectLote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    SKU del Producto *
                  </label>
                  <select
                    value={directSku}
                    onChange={(e) => setDirectSku(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="LUM-6060">LUM-6060 (Panel LED 60x60)</option>
                    <option value="UFO-150W">UFO-150W (Campana 150W)</option>
                    <option value="DRV-DALI">DRV-DALI (Driver DALI-2)</option>
                    <option value="PRY-100W">PRY-100W (Proyector Exterior)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cantidad a Ingresar *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={directCantidad}
                    onChange={(e) => setDirectCantidad(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Almacén / Depósito de Entrada *
                  </label>
                  <select
                    value={directWhId}
                    onChange={(e) => setDirectWhId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nombre} ({wh.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Buque / Tracking (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Maersk / Guía 99201"
                    value={directTracking}
                    onChange={(e) => setDirectTracking(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fecha ETA (opcional)
                  </label>
                  <input
                    type="date"
                    value={directFechaEta}
                    onChange={(e) => setDirectFechaEta(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones de Recepción
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre factura comercial o remito de aduana..."
                  value={directNotas}
                  onChange={(e) => setDirectNotas(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDirectStockModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDirect}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm shadow-emerald-500/30 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  {isSavingDirect ? 'Guardando...' : 'Asignar Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Creación / Edición de Depósito */}
      {warehouseModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Warehouse size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {editingWarehouse ? `Configurar Depósito (${editingWarehouse.id})` : 'Registrar Nuevo Depósito'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Gobernanza física y capacidad operativa del centro logístico.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWarehouseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3.5 text-xs">
              {!editingWarehouse && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Identificador Único (Código ID)
                  </label>
                  <input
                    type="text"
                    required
                    value={whFormId}
                    onChange={(e) => setWhFormId(e.target.value)}
                    placeholder="ej. dep-norte-salto"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Comercial del Depósito
                </label>
                <input
                  type="text"
                  required
                  value={whFormNombre}
                  onChange={(e) => setWhFormNombre(e.target.value)}
                  placeholder="ej. Centro Logístico Salto & Litoral"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Centro
                  </label>
                  <select
                    value={whFormTipo}
                    onChange={(e) => setWhFormTipo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CENTRAL">CENTRAL (Montevideo)</option>
                    <option value="SUCURSAL">SUCURSAL (Regional)</option>
                    <option value="TRANSITO">TRANSITO (Zona Franca/Aduana)</option>
                    <option value="FABRICA">FABRICA (Planta Origen)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Capacidad (Unidades)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={whFormCapacidad}
                    onChange={(e) => setWhFormCapacidad(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ubicación Física / Dirección
                </label>
                <input
                  type="text"
                  required
                  value={whFormUbicacion}
                  onChange={(e) => setWhFormUbicacion(e.target.value)}
                  placeholder="ej. Ruta 3 Km 480, Salto, Uruguay"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="whActivo"
                  checked={whFormActivo}
                  onChange={(e) => setWhFormActivo(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="whActivo" className="text-slate-700 dark:text-slate-300 font-medium">
                  Depósito Activo para Operaciones
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWarehouseModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm shadow-indigo-500/30 transition-all hover:scale-[1.02]"
                >
                  {editingWarehouse ? 'Actualizar Depósito' : 'Registrar Depósito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
