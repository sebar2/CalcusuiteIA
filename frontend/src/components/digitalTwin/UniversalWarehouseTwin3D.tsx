import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as THREE from 'three';

// Suprimir advertencia interna de THREE.Clock en @react-three/fiber
if (typeof (THREE as any).setConsoleFunction === 'function') {
  (THREE as any).setConsoleFunction((type: string, message: string, ...params: any[]) => {
    if (type === 'warn' && typeof message === 'string' && message.includes('Clock: This module has been deprecated')) {
      return;
    }
    if (type === 'warn') console.warn(message, ...params);
    else if (type === 'error') console.error(message, ...params);
    else console.log(message, ...params);
  });
}

import {
  Boxes,
  Search,
  ArrowRightLeft,
  Sparkles,
  AlertTriangle,
  Download,
  Plus,
  Minus,
  X,
  Cpu,
  PackageCheck,
  RefreshCw,
  CheckCircle2,
  Lock,
  QrCode,
  Truck,
  Eye,
  Table,
  ChevronDown,
  ArrowLeft,
  Play,
  Pause,
  RotateCw,
  Compass,
  HelpCircle,
  Building2,
  BarChart2,
  ExternalLink,
  Trash2,
  Save,
  Check,
} from 'lucide-react';

import { WarehouseCanvasScene } from './Warehouse3DSceneElements';
import type {
  DigitalTwinWarehouse,
  DigitalTwinSlot,
  WarehouseIntelligenceSummary,
  OptimizeSlottingResponse,
  RealProductItem,
  ContainerLoadPlanResponse,
} from '../../services/digitalTwinApi';
import { digitalTwinApi } from '../../services/digitalTwinApi';
import { getWsBaseUrl } from '../../services/api';

interface UniversalWarehouseTwin3DProps {
  moduleScope: '3PL' | 'SUPPLY_CHAIN';
  initialWarehouseId?: string;
  kanbanFilter?: 'ALL' | 'CRITICO_ROP' | 'ALERTA_DOH' | 'OPTIMO';
  onTransferSuccess?: () => void;
  className?: string;
  active?: boolean;
}

export const UniversalWarehouseTwin3D: React.FC<UniversalWarehouseTwin3DProps> = ({
  moduleScope,
  initialWarehouseId,
  kanbanFilter: propKanbanFilter = 'ALL',
  onTransferSuccess,
  className = '',
  active = true,
}) => {
  // Warehouses & Inventory
  const [warehouses, setWarehouses] = useState<DigitalTwinWarehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    initialWarehouseId || (moduleScope === '3PL' ? '3PL-WH-01' : 'DEP-CENTRAL-MVD')
  );
  const [slots, setSlots] = useState<DigitalTwinSlot[]>([]);
  const [summary, setSummary] = useState<WarehouseIntelligenceSummary | null>(null);
  const [realProducts, setRealProducts] = useState<RealProductItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Selected State
  const [selectedCuerpo, setSelectedCuerpo] = useState<string>('ALL');
  const [kanbanFilter, setKanbanFilter] = useState<string>(propKanbanFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showEmptySlots, setShowEmptySlots] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'OPERATIVO' | 'RIESGOS' | 'CAPACIDAD'>('OPERATIVO');

  // Inspection & Editing
  const [inspectedSlot, setInspectedSlot] = useState<DigitalTwinSlot | null>(null);
  const [slotEditForm, setSlotEditForm] = useState<{
    estado: string;
    sku: string;
    descripcion: string;
    cajas_count: number;
    unit_weight_kg: number;
    box_width_m: number;
    box_height_m: number;
    box_length_m: number;
    rack_width_m: number;
    rack_height_m: number;
    rack_depth_m: number;
    real_product_id: number | null;
  }>({
    estado: 'VACIA',
    sku: '',
    descripcion: '',
    cajas_count: 0,
    unit_weight_kg: 10,
    box_width_m: 0.4,
    box_height_m: 0.3,
    box_length_m: 0.4,
    rack_width_m: 2.4,
    rack_height_m: 6.0,
    rack_depth_m: 1.2,
    real_product_id: null,
  });
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [isSavingSlot, setIsSavingSlot] = useState<boolean>(false);

  // 3D Camera & Controls
  const [rotationMode, setRotationMode] = useState<'AUTO_360' | 'PAUSED' | 'MANUAL'>('AUTO_360');
  const [cameraViewPreset, setCameraViewPreset] = useState<'ISOMETRIC' | 'TOP' | 'FRONT' | 'AISLE' | 'DOCK' | null>(null);
  const [focusTargetPosition, setFocusTargetPosition] = useState<[number, number, number] | null>(null);
  const [highlightedRiskType, setHighlightedRiskType] = useState<string | null>(null);

  // Dropdown menus states in top bar
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isExpandedRiskModalOpen, setIsExpandedRiskModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferTargetWh, setTransferTargetWh] = useState<string>('');
  const [transferTargetSlot, setTransferTargetSlot] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(0);
  const [transferMoveAll, setTransferMoveAll] = useState<boolean>(true);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);

  // AI & Extra Tools Modals
  const [isLoadPlannerModalOpen, setIsLoadPlannerModalOpen] = useState<boolean>(false);
  const [loadPlanContainerType, setLoadPlanContainerType] = useState<'40HQ' | '20ST' | 'TRUCK_3PL'>('40HQ');
  const [enforceLifoRoute, setEnforceLifoRoute] = useState<boolean>(true);
  const [loadPlanData, setLoadPlanData] = useState<ContainerLoadPlanResponse | null>(null);
  const [isCalculatingPlan, setIsCalculatingPlan] = useState<boolean>(false);

  const [isReserveModalOpen, setIsReserveModalOpen] = useState<boolean>(false);
  const [reserveForm, setReserveForm] = useState<{
    reservation_type: 'SOFT_RESERVED' | 'HARD_RESERVED';
    order_id: string;
    organism: string;
    duration_days: number;
  }>({
    reservation_type: 'HARD_RESERVED',
    order_id: 'SICE-LIC-2026-088',
    organism: 'Intendencia de Montevideo',
    duration_days: 7,
  });
  const [isReserving, setIsReserving] = useState<boolean>(false);

  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [qrScanInput, setQrScanInput] = useState<string>('');
  const [isScanningQR, setIsScanningQR] = useState<boolean>(false);

  const [isAiSlottingModalOpen, setIsAiSlottingModalOpen] = useState<boolean>(false);
  const [aiSlottingData, setAiSlottingData] = useState<OptimizeSlottingResponse | null>(null);
  const [isOptimizingAi, setIsOptimizingAi] = useState<boolean>(false);
  const [isSyncingInventory, setIsSyncingInventory] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // WebSocket Live
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [liveArrivalAlert, setLiveArrivalAlert] = useState<{
    message: string;
    slot_code: string;
    sku: string;
    units: number;
  } | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update edit form when inspected slot changes
  useEffect(() => {
    if (inspectedSlot) {
      setSlotEditForm({
        estado: inspectedSlot.estado || 'VACIA',
        sku: inspectedSlot.sku || '',
        descripcion: inspectedSlot.descripcion || '',
        cajas_count: inspectedSlot.cajas_count || (inspectedSlot.cantidad ? Number(inspectedSlot.cantidad) : 0),
        unit_weight_kg: inspectedSlot.unit_weight_kg || 10,
        box_width_m: inspectedSlot.box_width_m || 0.4,
        box_height_m: inspectedSlot.box_height_m || 0.3,
        box_length_m: inspectedSlot.box_length_m || 0.4,
        rack_width_m: inspectedSlot.rack_width_m || 2.4,
        rack_height_m: inspectedSlot.rack_height_m || 6.0,
        rack_depth_m: inspectedSlot.rack_depth_m || 1.2,
        real_product_id: inspectedSlot.real_product_id || null,
      });
      setProductSearchQuery(inspectedSlot.sku || '');
    }
  }, [inspectedSlot]);

  // Load Initial Data
  const loadWarehouses = useCallback(async () => {
    try {
      const whList = await digitalTwinApi.getWarehouses(moduleScope);
      setWarehouses(whList);
      if (whList.length > 0 && !whList.some((w) => w.id === selectedWarehouseId)) {
        setSelectedWarehouseId(whList[0].id);
      }
    } catch (err) {
      console.error('Error fetching warehouses:', err);
    }
  }, [moduleScope, selectedWarehouseId]);

  const loadWarehouseData = useCallback(async (whId: string) => {
    setIsLoading(true);
    try {
      const [slotData, summaryData] = await Promise.all([
        digitalTwinApi.getSlots({
          warehouse_id: whId,
          cuerpo: selectedCuerpo !== 'ALL' ? selectedCuerpo : undefined,
          rop_status: kanbanFilter !== 'ALL' ? kanbanFilter : undefined,
        }),
        digitalTwinApi.getIntelligenceSummary(whId),
      ]);
      setSlots(slotData);
      setSummary(summaryData);
    } catch (err) {
      console.error('Error loading warehouse data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCuerpo, kanbanFilter]);

  const loadRealProducts = useCallback(async () => {
    try {
      const prods = await digitalTwinApi.getRealProducts();
      setRealProducts(prods);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
    loadRealProducts();
  }, [loadWarehouses, loadRealProducts]);

  useEffect(() => {
    if (selectedWarehouseId) {
      loadWarehouseData(selectedWarehouseId);
    }
  }, [selectedWarehouseId, loadWarehouseData]);

  // WebSocket Live Hub
  useEffect(() => {
    const wsUrl = `${getWsBaseUrl()}/api/v1/digital-twin/ws`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'LIVE_ARRIVAL') {
            setLiveArrivalAlert({
              message: data.message,
              slot_code: data.slot_code,
              sku: data.sku,
              units: data.units,
            });
            if (selectedWarehouseId) loadWarehouseData(selectedWarehouseId);
            setTimeout(() => setLiveArrivalAlert(null), 8000);
          }
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      };
    } catch (err) {
      console.warn('WebSocket connection not supported in this context:', err);
    }
    return () => {
      if (ws) ws.close();
    };
  }, [selectedWarehouseId, loadWarehouseData]);

  // Derived Properties
  const selectedWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === selectedWarehouseId) || null;
  }, [warehouses, selectedWarehouseId]);

  const isMaritimeScene = useMemo(() => {
    return (
      selectedWarehouseId === 'TRANSITO-MAR' ||
      selectedWarehouseId.includes('MAR') ||
      selectedWarehouseId.includes('VESSEL') ||
      selectedWarehouse?.tipo === 'TRANSITO'
    );
  }, [selectedWarehouseId, selectedWarehouse]);

  const uniqueCuerpos = useMemo(() => {
    return Array.from(new Set(slots.map((s) => s.cuerpo))).sort();
  }, [slots]);

  const slotsByCuerpo = useMemo(() => {
    const map: Record<string, DigitalTwinSlot[]> = {};
    slots.forEach((s) => {
      if (!map[s.cuerpo]) map[s.cuerpo] = [];
      map[s.cuerpo].push(s);
    });
    return map;
  }, [slots]);

  // Computación de Riesgos y Posiciones Afectadas
  const riskSlotsMap = useMemo(() => {
    const peso: DigitalTwinSlot[] = [];
    const vol: DigitalTwinSlot[] = [];
    const alt: DigitalTwinSlot[] = [];
    const rop: DigitalTwinSlot[] = [];
    const calidad: DigitalTwinSlot[] = [];
    const fefo: DigitalTwinSlot[] = [];

    slots.forEach((s) => {
      const clearH = (s.rack_height_m || 6.0) / Math.max(1, s.levels_count || 4);
      if (s.peso_actual_kg > (s.peso_max_kg || 1500) || s.desvios?.includes('EXCESO_PESO')) peso.push(s);
      if (s.volumen_actual_m3 > (s.volumen_max_m3 || 2.4) || s.desvios?.includes('EXCESO_VOLUMEN')) vol.push(s);
      if ((s.altura_m || 0) > clearH || s.desvios?.includes('EXCESO_ALTURA')) alt.push(s);
      if (s.rop_status === 'CRITICO_ROP') rop.push(s);
      if (s.material_retenido || s.material_calidad) calidad.push(s);
      if (s.fecha_vencimiento) fefo.push(s);
    });

    return { peso, vol, alt, rop, calidad, fefo };
  }, [slots]);

  const highlightedSlotIds = useMemo(() => {
    if (!highlightedRiskType) return [];
    if (highlightedRiskType === 'PESO') return riskSlotsMap.peso.map((s) => s.id);
    if (highlightedRiskType === 'VOLUMEN') return riskSlotsMap.vol.map((s) => s.id);
    if (highlightedRiskType === 'ALTURA') return riskSlotsMap.alt.map((s) => s.id);
    if (highlightedRiskType === 'ROP') return riskSlotsMap.rop.map((s) => s.id);
    if (highlightedRiskType === 'CALIDAD') return riskSlotsMap.calidad.map((s) => s.id);
    if (highlightedRiskType === 'FEFO') return riskSlotsMap.fefo.map((s) => s.id);
    if (highlightedRiskType === 'ALL') {
      const allSet = new Set<string>();
      Object.values(riskSlotsMap).forEach((arr) => arr.forEach((s) => allSet.add(s.id)));
      return Array.from(allSet);
    }
    return [];
  }, [highlightedRiskType, riskSlotsMap]);

  // Donut SVG & Progress calculations
  const capacityMetrics = useMemo(() => {
    const total = Math.max(1, slots.length);
    const occupied = slots.filter((s) => s.estado === 'OCUPADA' || s.estado === 'RESERVADA').length;
    const reserved = slots.filter((s) => s.estado === 'RESERVADA' || s.reservation_type).length;
    const blocked = slots.filter((s) => s.estado === 'BLOQUEADA').length;
    const available = slots.filter((s) => s.estado === 'VACIA').length;

    const occPct = Math.round((occupied / total) * 100);
    const resPct = Math.round((reserved / total) * 100);
    const blkPct = Math.round((blocked / total) * 100);
    const avlPct = Math.max(0, 100 - occPct - blkPct);

    const totalWeightKg = slots.reduce((acc, s) => acc + (s.peso_actual_kg || 0), 0);
    const totalVolM3 = slots.reduce((acc, s) => acc + (s.volumen_actual_m3 || 0), 0);
    const totalValueUsd = slots.reduce((acc, s) => acc + (s.valor_estimado || 0), 0);
    const totalValueUyu = totalValueUsd * 42.5; // Tasa oficial UYU de referencia

    return {
      total,
      occupied,
      reserved,
      blocked,
      available,
      occPct,
      resPct,
      blkPct,
      avlPct,
      totalWeightKg,
      totalVolM3,
      totalValueUsd,
      totalValueUyu,
    };
  }, [slots]);

  // Autocompletado Predictivo >= 3 Caracteres para el buscador general
  const predictiveSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 3) return [];
    return slots
      .filter((s) => {
        const code = s.slot_code.toLowerCase();
        const sku = (s.sku || '').toLowerCase();
        const desc = (s.descripcion || '').toLowerCase();
        const lot = (s.lote || '').toLowerCase();
        return code.includes(q) || sku.includes(q) || desc.includes(q) || lot.includes(q);
      })
      .slice(0, 8);
  }, [searchQuery, slots]);

  // Autocompletado Predictivo para SKU en la Ficha de Posición
  const productSuggestions = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (q.length < 3) return [];
    return realProducts
      .filter((p) => p.sku.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q))
      .slice(0, 6);
  }, [productSearchQuery, realProducts]);

  // Fly-to slot helper
  const flyToSlot = useCallback((slot: DigitalTwinSlot) => {
    setInspectedSlot(slot);
    setSelectedCuerpo(slot.cuerpo);

    const cuerpoIdx = Math.max(0, slot.cuerpo.charCodeAt(0) - 65);
    const rackNum = parseInt(slot.rack.replace(/\D/g, '')) || 1;
    const rw = slot.rack_width_m || 2.4;
    const rh = slot.rack_height_m || 6.0;
    const rd = slot.rack_depth_m || 1.2;
    const lev = Math.max(1, slot.levels_count || 4);
    const levelH = rh / lev;

    const posX = cuerpoIdx * (rd * 2 + 4.8) + (rackNum - 1) * (rd + 1.6) - 12;
    const posZ = (slot.posicion - 2) * (rw / 3.0);
    const posY = (slot.nivel - 1) * levelH + 0.15;

    setFocusTargetPosition([posX, posY, posZ]);
  }, []);

  // Guardar Cambios en Ficha de Posición
  const handleSaveSlot = async () => {
    if (!inspectedSlot) return;
    setIsSavingSlot(true);
    try {
      await digitalTwinApi.updateSlotItemSpecs(inspectedSlot.id, {
        box_width_m: slotEditForm.box_width_m,
        box_height_m: slotEditForm.box_height_m,
        box_length_m: slotEditForm.box_length_m,
        unit_weight_kg: slotEditForm.unit_weight_kg,
        units_count: slotEditForm.cajas_count,
        real_product_id: slotEditForm.real_product_id,
        descripcion: slotEditForm.descripcion,
        estado: slotEditForm.estado,
        rack_width_m: slotEditForm.rack_width_m,
        rack_height_m: slotEditForm.rack_height_m,
        rack_depth_m: slotEditForm.rack_depth_m,
      });

      // Refrescar datos
      if (selectedWarehouseId) {
        await loadWarehouseData(selectedWarehouseId);
      }
      if (onTransferSuccess) onTransferSuccess();
      setSyncToast(`Posición ${inspectedSlot.slot_code} actualizada exitosamente.`);
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err) {
      console.error('Error saving slot specs:', err);
      alert('Error al guardar especificaciones del slot');
    } finally {
      setIsSavingSlot(false);
    }
  };

  // Vaciar Posición Directamente
  const handleEmptySlot = async () => {
    if (!inspectedSlot) return;
    if (!window.confirm(`¿Seguro que deseas vaciar la posición ${inspectedSlot.slot_code}?`)) return;
    setIsSavingSlot(true);
    try {
      await digitalTwinApi.updateSlotItemSpecs(inspectedSlot.id, {
        box_width_m: slotEditForm.box_width_m,
        box_height_m: slotEditForm.box_height_m,
        box_length_m: slotEditForm.box_length_m,
        unit_weight_kg: 0,
        units_count: 0,
        estado: 'VACIA',
      });
      if (selectedWarehouseId) {
        await loadWarehouseData(selectedWarehouseId);
      }
      setInspectedSlot(null);
      setSyncToast(`Posición vaciada con éxito.`);
      setTimeout(() => setSyncToast(null), 3500);
    } catch (err) {
      console.error('Error emptying slot:', err);
      alert('Error al vaciar posición');
    } finally {
      setIsSavingSlot(false);
    }
  };

  // Exportar Excel / CSV
  const handleExportExcel = () => {
    const rows = [
      ['Coordenada', 'Cuerpo', 'Rack', 'Nivel', 'Posicion', 'Estado', 'SKU', 'Descripcion', 'Cajas', 'Peso_kg', 'Volumen_m3', 'Desvios'],
      ...slots.map((s) => [
        s.slot_code,
        s.cuerpo,
        s.rack,
        s.nivel,
        s.posicion,
        s.estado,
        s.sku || '',
        `"${(s.descripcion || '').replace(/"/g, '""')}"`,
        s.cajas_count || s.cantidad,
        s.peso_actual_kg,
        s.volumen_actual_m3,
        `"${s.desvios || ''}"`,
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gemelo3D_${selectedWarehouseId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none ${className}`}>
      {/* ========================================================= */}
      {/* 1. BARRA SUPERIOR ESTILO SIMULADOR INDUSTRIAL             */}
      {/* ========================================================= */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/95 px-4 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {moduleScope === 'SUPPLY_CHAIN' ? (
              <Boxes className="text-sky-400" size={20} />
            ) : (
              <Building2 className="text-amber-400" size={20} />
            )}
            <h1 className="font-bold text-xs sm:text-sm tracking-wider uppercase text-slate-100 flex items-center gap-2">
              <span>{moduleScope === 'SUPPLY_CHAIN' ? 'Gemelo 3D Supply Chain' : 'Gemelo 3D 3PL Distribución'}</span>
              <span className="text-slate-500 font-normal hidden md:inline">| {selectedWarehouse?.nombre || selectedWarehouseId}</span>
            </h1>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Simulación activa</span>
            <span className="text-[10px] text-slate-400 font-mono ml-1">({wsConnected ? 'Hub Live' : 'Local'})</span>
            {isLoading && <RefreshCw size={11} className="animate-spin text-sky-400 ml-1" />}
          </div>

          <button
            onClick={() => setActiveTab('OPERATIVO')}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <span>Centro de Control - Abierto</span>
          </button>
        </div>

        {/* Menús Desplegables Limpios */}
        <div className="flex items-center space-x-1 sm:space-x-1.5" ref={dropdownRef}>
          {/* Ubicaciones */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'wh' ? null : 'wh')}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center gap-1.5 transition"
            >
              <span>Ubicaciones</span>
              <ChevronDown size={14} className={activeDropdown === 'wh' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {activeDropdown === 'wh' && (
              <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Depósitos Disponibles</div>
                {warehouses.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWarehouseId(w.id);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                      w.id === selectedWarehouseId ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{w.nombre}</div>
                      <div className="text-[10px] text-slate-500">{w.ubicacion} · {w.tipo}</div>
                    </div>
                    {w.id === selectedWarehouseId && <Check size={14} className="text-sky-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vistas Predefinidas */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'views' ? null : 'views')}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center gap-1.5 transition"
            >
              <span>Vistas</span>
              <ChevronDown size={14} />
            </button>
            {activeDropdown === 'views' && (
              <div className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in">
                {[
                  { label: 'Isométrica General', preset: 'ISOMETRIC' },
                  { label: 'Frontal Almacén', preset: 'FRONT' },
                  { label: 'Cenital / Planta', preset: 'TOP' },
                  { label: 'Rasante Pasillo', preset: 'AISLE' },
                  { label: 'Zona Dársenas', preset: 'DOCK' },
                ].map((v) => (
                  <button
                    key={v.preset}
                    onClick={() => {
                      setCameraViewPreset(v.preset as any);
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-300 transition"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pausa / Reanudar 360 */}
          <button
            onClick={() => setRotationMode(rotationMode === 'AUTO_360' ? 'PAUSED' : 'AUTO_360')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
              rotationMode === 'AUTO_360'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Pausar o reanudar rotación 360°"
          >
            {rotationMode === 'AUTO_360' ? <Pause size={13} /> : <Play size={13} />}
            <span className="hidden sm:inline">{rotationMode === 'AUTO_360' ? 'Pausa' : 'Giro 360°'}</span>
          </button>

          {/* Acciones IA */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'ai' ? null : 'ai')}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-linear-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition"
            >
              <Sparkles size={13} />
              <span>Acciones IA</span>
              <ChevronDown size={14} />
            </button>
            {activeDropdown === 'ai' && (
              <div className="absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in">
                <button
                  onClick={async () => {
                    setActiveDropdown(null);
                    setIsSyncingInventory(true);
                    try {
                      await digitalTwinApi.syncRealInventory({ warehouse_id: selectedWarehouseId });
                      await loadWarehouseData(selectedWarehouseId);
                      setSyncToast('Stock Real Calcu sincronizado con éxito.');
                      setTimeout(() => setSyncToast(null), 3500);
                    } catch (e) {
                      alert('Error sincronizando inventario');
                    } finally {
                      setIsSyncingInventory(false);
                    }
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <RefreshCw size={14} className={`text-sky-400 ${isSyncingInventory ? 'animate-spin' : ''}`} />
                  <div>
                    <div className="font-semibold">Sincronizar Stock Real</div>
                    <div className="text-[10px] text-slate-400">Actualiza existencias y SKUs</div>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    setActiveDropdown(null);
                    setIsOptimizingAi(true);
                    try {
                      const res = await digitalTwinApi.optimizeSlotting(selectedWarehouseId);
                      setAiSlottingData(res);
                      setIsAiSlottingModalOpen(true);
                    } catch (e) {
                      alert('Error al optimizar slotting');
                    } finally {
                      setIsOptimizingAi(false);
                    }
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <Cpu size={14} className={`text-emerald-400 ${isOptimizingAi ? 'animate-spin' : ''}`} />
                  <div>
                    <div className="font-semibold">Optimizar Slotting IA</div>
                    <div className="text-[10px] text-slate-400">Rebalancea rotación ABC</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    setIsLoadPlannerModalOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <PackageCheck size={14} className="text-amber-400" />
                  <div>
                    <div className="font-semibold">Cubicaje 98% IA</div>
                    <div className="text-[10px] text-slate-400">Simulador de contenedor y camión</div>
                  </div>
                </button>
                <div className="my-1 border-t border-slate-800" />
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    setIsReserveModalOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <Lock size={14} className="text-blue-400" />
                  <div>
                    <div className="font-semibold">Doble Candado SICE</div>
                    <div className="text-[10px] text-slate-400">Reserva física de licitaciones</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    setIsQRModalOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                >
                  <QrCode size={14} className="text-purple-400" />
                  <div>
                    <div className="font-semibold">Recepción Inteligente QR</div>
                    <div className="text-[10px] text-slate-400">Escaneo y alta en dársena</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Guía Interactiva */}
          <button
            onClick={() => setIsGuideModalOpen(true)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition"
            title="Cómo usar el Gemelo 3D"
          >
            <HelpCircle size={14} className="text-amber-400" />
            <span className="hidden md:inline">Cómo usar</span>
          </button>
        </div>
      </header>

      {/* Sync Toast Notification */}
      {syncToast && (
        <div className="absolute top-16 right-4 z-50 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span className="text-xs font-medium">{syncToast}</span>
        </div>
      )}

      {/* Live Arrival Banner */}
      {liveArrivalAlert && (
        <div className="absolute top-16 left-4 z-50 bg-sky-950/95 border border-sky-500/50 text-sky-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <Truck size={20} className="text-sky-400 animate-bounce" />
          <div>
            <div className="text-xs font-bold text-white">{liveArrivalAlert.message}</div>
            <div className="text-[11px] text-sky-300">
              Posición: <span className="font-mono font-bold text-white">{liveArrivalAlert.slot_code}</span> | SKU: {liveArrivalAlert.sku} ({liveArrivalAlert.units} cajas)
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. LAYOUT SPLIT-SCREEN 60/40 A PANTALLA COMPLETA          */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ========================================== */}
        {/* COLUMNA IZQUIERDA: 60% LIENZO 3D REALISTA */}
        {/* ========================================== */}
        <section className="w-full lg:w-[60%] h-[48vh] lg:h-full relative bg-slate-900 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          {/* LIENZO 3D CANVAS */}
          <WarehouseCanvasScene
            active={active}
            isMaritimeScene={isMaritimeScene}
            slots={slots}
            inspectedSlotId={inspectedSlot?.id || null}
            onSelectSlot={(slot) => flyToSlot(slot)}
            selectedWarehouse={selectedWarehouse}
            uniqueCuerpos={uniqueCuerpos}
            slotsByCuerpo={slotsByCuerpo}
            selectedCuerpo={selectedCuerpo}
            onSelectRackCuerpo={(cuerpo, sample) => {
              setSelectedCuerpo(cuerpo);
              flyToSlot(sample);
            }}
            showEmptySlots={showEmptySlots}
            rotationMode={rotationMode}
            cameraViewPreset={cameraViewPreset}
            highlightedSlotIds={highlightedSlotIds}
            focusTargetPosition={focusTargetPosition}
          />

          {/* RECUADRO FLOTANTE: "CONTEXTO 3D" (ESQUINA SUPERIOR IZQUIERDA) */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-xl p-3 shadow-2xl min-w-[200px]">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  Contexto 3D
                </span>
                <span className="text-slate-500 font-mono">{selectedWarehouse?.tipo || 'DEP'}</span>
              </div>
              <div className="mt-2 space-y-1">
                <div className="text-xs font-semibold text-white flex items-center justify-between">
                  <span>Cuerpo Activo:</span>
                  <span className="text-sky-300 font-mono font-bold">{selectedCuerpo === 'ALL' ? 'Todos (General)' : `Cuerpo ${selectedCuerpo}`}</span>
                </div>
                {inspectedSlot ? (
                  <>
                    <div className="text-[11px] text-slate-300 flex items-center justify-between">
                      <span>Ubicación:</span>
                      <span className="font-mono text-amber-300 font-bold">{inspectedSlot.slot_code}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Nivel / Pos:</span>
                      <span>Nivel {inspectedSlot.nivel} · Pos {inspectedSlot.posicion}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Cajas:</span>
                      <span className="text-emerald-400 font-medium">{inspectedSlot.cajas_count || inspectedSlot.cantidad} bultos</span>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">Haz clic en un rack o slot para inspeccionar</div>
                )}
              </div>
            </div>
          </div>

          {/* BOTONERA VERTICAL FLOTANTE (BORDE DERECHO DEL LIENZO 3D) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col space-y-2 bg-slate-900/85 border border-slate-700/80 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl">
            <button
              onClick={() => setRotationMode('AUTO_360')}
              className={`p-2.5 rounded-xl text-xs flex flex-col items-center gap-1 transition ${
                rotationMode === 'AUTO_360' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Giro 360° Continuo"
            >
              <RotateCw size={16} className={rotationMode === 'AUTO_360' ? 'animate-spin' : ''} />
              <span className="text-[9px] font-bold">360°</span>
            </button>
            <button
              onClick={() => setRotationMode('PAUSED')}
              className={`p-2.5 rounded-xl text-xs flex flex-col items-center gap-1 transition ${
                rotationMode === 'PAUSED' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Pausar movimiento"
            >
              <Pause size={16} />
              <span className="text-[9px] font-bold">Pausa</span>
            </button>
            <button
              onClick={() => {
                setRotationMode('MANUAL');
                setCameraViewPreset(null);
                setFocusTargetPosition(null);
              }}
              className={`p-2.5 rounded-xl text-xs flex flex-col items-center gap-1 transition ${
                rotationMode === 'MANUAL' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Control Manual Libre"
            >
              <Compass size={16} />
              <span className="text-[9px] font-bold">Manual</span>
            </button>
          </div>
        </section>

        {/* ======================================================== */}
        {/* COLUMNA DERECHA: 40% DASHBOARD "WAREHOUSE INTELLIGENCE" */}
        {/* ======================================================== */}
        <aside className="w-full lg:w-[40%] h-[52vh] lg:h-full flex flex-col bg-slate-900/90 border-l border-slate-800 overflow-hidden">
          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4">
            {/* ------------------------------------------------------ */}
            {/* BLOQUE 1: RESUMEN INTELIGENTE (3 PESTAÑAS)            */}
            {/* ------------------------------------------------------ */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 size={15} className="text-sky-400" />
                  Warehouse Intelligence
                </span>
                <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveTab('OPERATIVO')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                      activeTab === 'OPERATIVO' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📦 Operativo
                  </button>
                  <button
                    onClick={() => setActiveTab('RIESGOS')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                      activeTab === 'RIESGOS' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ⚠️ Riesgos
                  </button>
                  <button
                    onClick={() => setActiveTab('CAPACIDAD')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                      activeTab === 'CAPACIDAD' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📐 Capacidad
                  </button>
                </div>
              </div>

              {/* Tab: OPERATIVO */}
              {activeTab === 'OPERATIVO' && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Lotes Activos</div>
                    <div className="text-xl font-bold text-white mt-1">
                      {summary?.operativo.lotes_activos ?? slots.filter((s) => s.lote).length}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">En custodia física</div>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Posiciones Ocupadas</div>
                    <div className="text-xl font-bold text-sky-400 mt-1">
                      {capacityMetrics.occupied} <span className="text-xs text-slate-400 font-normal">/ {capacityMetrics.total}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{capacityMetrics.occPct}% ocupación física</div>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Cajas Totales</div>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {slots.reduce((acc, s) => acc + (s.cajas_count || s.cantidad || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Bultos inventariados</div>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Valorización Stock</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1 truncate">
                      ${capacityMetrics.totalValueUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {moduleScope === 'SUPPLY_CHAIN' ? (
                        <span>${capacityMetrics.totalValueUyu.toLocaleString('es-UY', { maximumFractionDigits: 0 })} UYU</span>
                      ) : (
                        <span>{capacityMetrics.totalVolM3.toFixed(1)} m³ facturables</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: RIESGOS (Tarjetas Grandes con Ojo 👁️ y Tabla 📄) */}
              {activeTab === 'RIESGOS' && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-3 gap-2">
                    {/* Exceso de Peso */}
                    <div className="bg-slate-950/90 p-2.5 rounded-xl border border-rose-900/40 relative">
                      <div className="text-[9px] font-bold text-slate-400 uppercase truncate">Exceso Peso</div>
                      <div className="text-xl font-bold text-rose-400 mt-1">{riskSlotsMap.peso.length}</div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          onClick={() => setHighlightedRiskType(highlightedRiskType === 'PESO' ? null : 'PESO')}
                          className={`p-1 rounded-md transition ${highlightedRiskType === 'PESO' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                          title="Aislar posiciones en 3D"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setIsExpandedRiskModalOpen(true)}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Ver tabla completa"
                        >
                          <Table size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Exceso de Volumen */}
                    <div className="bg-slate-950/90 p-2.5 rounded-xl border border-amber-900/40 relative">
                      <div className="text-[9px] font-bold text-slate-400 uppercase truncate">Exceso Vol.</div>
                      <div className="text-xl font-bold text-amber-400 mt-1">{riskSlotsMap.vol.length}</div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          onClick={() => setHighlightedRiskType(highlightedRiskType === 'VOLUMEN' ? null : 'VOLUMEN')}
                          className={`p-1 rounded-md transition ${highlightedRiskType === 'VOLUMEN' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                          title="Aislar posiciones en 3D"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setIsExpandedRiskModalOpen(true)}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Ver tabla completa"
                        >
                          <Table size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Exceso de Altura */}
                    <div className="bg-slate-950/90 p-2.5 rounded-xl border border-orange-900/40 relative">
                      <div className="text-[9px] font-bold text-slate-400 uppercase truncate">Exceso Altura</div>
                      <div className="text-xl font-bold text-orange-400 mt-1">{riskSlotsMap.alt.length}</div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          onClick={() => setHighlightedRiskType(highlightedRiskType === 'ALTURA' ? null : 'ALTURA')}
                          className={`p-1 rounded-md transition ${highlightedRiskType === 'ALTURA' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                          title="Aislar posiciones en 3D"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setIsExpandedRiskModalOpen(true)}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Ver tabla completa"
                        >
                          <Table size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Crítico ROP */}
                    <div className="bg-slate-950/90 p-2.5 rounded-xl border border-red-900/40 relative">
                      <div className="text-[9px] font-bold text-slate-400 uppercase truncate">Crítico ROP</div>
                      <div className="text-xl font-bold text-red-500 mt-1">{riskSlotsMap.rop.length}</div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          onClick={() => setHighlightedRiskType(highlightedRiskType === 'ROP' ? null : 'ROP')}
                          className={`p-1 rounded-md transition ${highlightedRiskType === 'ROP' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                          title="Aislar posiciones en 3D"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setIsExpandedRiskModalOpen(true)}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Ver tabla completa"
                        >
                          <Table size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Calidad / Retenido */}
                    <div className="bg-slate-950/90 p-2.5 rounded-xl border border-purple-900/40 relative">
                      <div className="text-[9px] font-bold text-slate-400 uppercase truncate">Retenido / QC</div>
                      <div className="text-xl font-bold text-purple-400 mt-1">{riskSlotsMap.calidad.length}</div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          onClick={() => setHighlightedRiskType(highlightedRiskType === 'CALIDAD' ? null : 'CALIDAD')}
                          className={`p-1 rounded-md transition ${highlightedRiskType === 'CALIDAD' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                          title="Aislar posiciones en 3D"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setIsExpandedRiskModalOpen(true)}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Ver tabla completa"
                        >
                          <Table size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Vencimiento FEFO */}
                    <div className="bg-slate-950/90 p-2.5 rounded-xl border border-yellow-900/40 relative">
                      <div className="text-[9px] font-bold text-slate-400 uppercase truncate">Vence Próx.</div>
                      <div className="text-xl font-bold text-yellow-400 mt-1">{riskSlotsMap.fefo.length}</div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          onClick={() => setHighlightedRiskType(highlightedRiskType === 'FEFO' ? null : 'FEFO')}
                          className={`p-1 rounded-md transition ${highlightedRiskType === 'FEFO' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                          title="Aislar posiciones en 3D"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setIsExpandedRiskModalOpen(true)}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Ver tabla completa"
                        >
                          <Table size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      {highlightedRiskType ? `Aisladas en rojo: ${highlightedSlotIds.length} posiciones` : 'Toca el ojo 👁️ para iluminar en 3D'}
                    </span>
                    <button
                      onClick={() => setIsExpandedRiskModalOpen(true)}
                      className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                    >
                      <span>Abrir vista ampliada</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* Tab: CAPACIDAD REAL */}
              {activeTab === 'CAPACIDAD' && (
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Volumen en custodia:</span>
                    <span className="font-semibold text-white">{capacityMetrics.totalVolM3.toFixed(1)} m³ / {selectedWarehouse?.volumen_max_m3 || 7200} m³</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Peso en carga:</span>
                    <span className="font-semibold text-white">{(capacityMetrics.totalWeightKg / 1000).toFixed(1)} t / {((selectedWarehouse?.capacidad_peso_kg || 500000) / 1000).toFixed(0)} t</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Superficie nave:</span>
                    <span className="font-semibold text-white">{selectedWarehouse?.superficie_m2 || 1200} m²</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Altura libre bajo viga:</span>
                    <span className="font-semibold text-white">{selectedWarehouse?.clear_height_m || 10.5} m</span>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------ */}
            {/* BLOQUE 2: GRÁFICOS VISUALES DE CAPACIDAD Y OCUPACIÓN    */}
            {/* ------------------------------------------------------ */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Ocupación & Saturación</span>
                <span className="text-[11px] text-sky-400 font-mono font-bold">{capacityMetrics.occPct}%</span>
              </div>

              {/* Gráfico de Dona SVG Interactivo */}
              <div className="flex items-center justify-around py-1">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    {/* Círculo base gris */}
                    <path
                      className="text-slate-800"
                      strokeWidth="3.6"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Círculo ocupado azul/cyan */}
                    <path
                      className="text-sky-500 transition-all duration-700 ease-out"
                      strokeDasharray={`${capacityMetrics.occPct}, 100`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black text-white">{capacityMetrics.occPct}%</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Ocupado</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span className="text-slate-300">Ocupadas: <strong>{capacityMetrics.occupied}</strong> slots</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                    <span className="text-slate-400">Libres: <strong>{capacityMetrics.available}</strong> slots</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-400">Bloqueadas: <strong>{capacityMetrics.blocked}</strong> slots</span>
                  </div>
                </div>
              </div>

              {/* Barra de progreso inferior segmentada */}
              <div className="space-y-1">
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex">
                  <div style={{ width: `${capacityMetrics.occPct}%` }} className="bg-sky-500 h-full" title={`Ocupadas: ${capacityMetrics.occPct}%`} />
                  <div style={{ width: `${capacityMetrics.resPct}%` }} className="bg-blue-600 h-full" title={`Reservadas SICE: ${capacityMetrics.resPct}%`} />
                  <div style={{ width: `${capacityMetrics.blkPct}%` }} className="bg-rose-500 h-full" title={`Bloqueadas: ${capacityMetrics.blkPct}%`} />
                  <div style={{ width: `${capacityMetrics.avlPct}%` }} className="bg-slate-800 h-full" title={`Disponibles: ${capacityMetrics.avlPct}%`} />
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------ */}
            {/* BLOQUE 3: ESTRUCTURA POR CUERPO Y BARRAS COMPARATIVAS   */}
            {/* ------------------------------------------------------ */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Estructura por Cuerpo (Racks)</span>
                <span className="text-[10px] text-slate-500">Aislar en Wireframe</span>
              </div>

              {/* Botonera de Selección Rápida de Cuerpo */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCuerpo('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    selectedCuerpo === 'ALL'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  General
                </button>
                {uniqueCuerpos.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setSelectedCuerpo(c);
                      const sample = slotsByCuerpo[c]?.[0];
                      if (sample) flyToSlot(sample);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      selectedCuerpo === c
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Gráfico de Barras Horizontales "Comparativa por cuerpo" */}
              <div className="space-y-2 pt-1">
                {uniqueCuerpos.map((cuerpo) => {
                  const cuerpoSlots = slotsByCuerpo[cuerpo] || [];
                  const tot = Math.max(1, cuerpoSlots.length);
                  const occ = cuerpoSlots.filter((s) => s.estado === 'OCUPADA' || s.estado === 'RESERVADA').length;
                  const pct = Math.round((occ / tot) * 100);

                  let barColor = 'bg-emerald-500';
                  if (pct > 85) barColor = 'bg-rose-500';
                  else if (pct > 65) barColor = 'bg-amber-500';

                  return (
                    <div
                      key={cuerpo}
                      onClick={() => {
                        setSelectedCuerpo(cuerpo);
                        const sample = cuerpoSlots[0];
                        if (sample) flyToSlot(sample);
                      }}
                      className="cursor-pointer group"
                    >
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-300 group-hover:text-sky-300 transition">
                          Cuerpo {cuerpo}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {occ}/{tot} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                        <div style={{ width: `${pct}%` }} className={`h-full ${barColor} transition-all duration-500`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------ */}
            {/* BLOQUE 4: EXPLORACIÓN INTELIGENTE (BUSCADOR >= 3 CHARS) */}
            {/* ------------------------------------------------------ */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-3 relative">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Exploración Inteligente</span>
                <span className="text-[10px] text-slate-500">&gt;= 3 caracteres</span>
              </div>

              {/* Input Buscador Predictivo */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar Coordenada (A-01-01), SKU, Producto o Lote..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Desplegable de Sugerencias Predictivas */}
              {predictiveSuggestions.length > 0 && (
                <div className="absolute left-3 right-3 top-20 bg-slate-900/98 border border-sky-500/40 rounded-xl shadow-2xl p-1.5 z-40 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider px-2 py-1">
                    Sugerencias ({predictiveSuggestions.length}) · Clic para volar
                  </div>
                  {predictiveSuggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        flyToSlot(s);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-800/90 text-xs flex items-center justify-between transition border border-transparent hover:border-slate-700"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono font-bold text-[10px] shrink-0">
                          {s.slot_code}
                        </span>
                        <div className="truncate">
                          <div className="font-semibold text-slate-200 truncate">{s.sku || 'Sin SKU'} · {s.descripcion || 'Sin descripción'}</div>
                          <div className="text-[10px] text-slate-400">
                            {s.cajas_count || s.cantidad || 0} cajas · {s.peso_actual_kg || 0} kg {s.lote ? `· Lote ${s.lote}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md shrink-0 font-medium ${
                        s.estado === 'OCUPADA' ? 'bg-emerald-500/20 text-emerald-300' : s.estado === 'VACIA' ? 'bg-slate-800 text-slate-400' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {s.estado}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Botones de Filtro Rápido */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button
                  onClick={() => setShowEmptySlots(!showEmptySlots)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition ${
                    showEmptySlots ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Vacías
                </button>
                <button
                  onClick={() => setKanbanFilter(kanbanFilter === 'OPTIMO' ? 'ALL' : 'OPTIMO')}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition ${
                    kanbanFilter === 'OPTIMO' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Ocupadas
                </button>
                <button
                  onClick={() => {
                    setKanbanFilter('ALL');
                    setShowEmptySlots(true);
                    setSelectedCuerpo('ALL');
                  }}
                  className="py-1.5 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 hover:text-white"
                >
                  Mostradas
                </button>
                <button
                  onClick={() => setHighlightedRiskType(highlightedRiskType === 'CALIDAD' ? null : 'CALIDAD')}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition ${
                    highlightedRiskType === 'CALIDAD' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Bloqueadas
                </button>
              </div>
            </div>

            {/* ------------------------------------------------------ */}
            {/* BLOQUE 5: FICHA DE POSICIÓN / EDICIÓN DIRECTA GUIADA   */}
            {/* ------------------------------------------------------ */}
            {inspectedSlot ? (
              <div className="bg-slate-900/95 border-2 border-sky-500/40 rounded-2xl p-4 shadow-xl space-y-3.5 animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInspectedSlot(null)}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Volver al resumen general"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span>Ubicación {inspectedSlot.slot_code}</span>
                        <span className="text-xs text-sky-400 font-mono font-normal">({inspectedSlot.cuerpo}-R{inspectedSlot.rack}-N{inspectedSlot.nivel})</span>
                      </h3>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    slotEditForm.estado === 'OCUPADA' ? 'bg-emerald-500/20 text-emerald-400' : slotEditForm.estado === 'VACIA' ? 'bg-slate-800 text-slate-300' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {slotEditForm.estado}
                  </span>
                </div>

                {/* Selector de Estado */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Estado Operativo</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['VACIA', 'OCUPADA', 'BLOQUEADA', 'CALIDAD', 'RESERVADA'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setSlotEditForm({ ...slotEditForm, estado: st })}
                        className={`py-1 text-[11px] font-semibold rounded-lg border transition ${
                          slotEditForm.estado === st
                            ? 'bg-sky-600 border-sky-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buscador Predictivo de SKU Real (>= 3 chars) */}
                <div className="space-y-1 relative">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Material / SKU Calcu</label>
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setSlotEditForm({ ...slotEditForm, sku: e.target.value });
                    }}
                    placeholder="Escribe >= 3 letras de SKU o Nombre..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                  />
                  {productSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-14 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50 space-y-1">
                      {productSuggestions.map((prod) => (
                        <button
                          key={prod.id}
                          onClick={() => {
                            setSlotEditForm({
                              ...slotEditForm,
                              sku: prod.sku,
                              descripcion: prod.nombre,
                              real_product_id: prod.id,
                              estado: 'OCUPADA',
                            });
                            setProductSearchQuery(prod.sku);
                          }}
                          className="w-full text-left p-1.5 rounded-lg hover:bg-slate-800 text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-mono font-bold text-sky-400">{prod.sku}</span>
                            <span className="text-slate-300 ml-1.5">{prod.nombre}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">${prod.precio_lista}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Steppers Numéricos: Cajas & Peso */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Cantidad Cajas</label>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setSlotEditForm({ ...slotEditForm, cajas_count: Math.max(0, slotEditForm.cajas_count - 1) })}
                        className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        value={slotEditForm.cajas_count}
                        onChange={(e) => setSlotEditForm({ ...slotEditForm, cajas_count: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full bg-transparent text-center font-bold text-xs text-white focus:outline-hidden"
                      />
                      <button
                        onClick={() => setSlotEditForm({ ...slotEditForm, cajas_count: slotEditForm.cajas_count + 1 })}
                        className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Peso Unitario (kg)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setSlotEditForm({ ...slotEditForm, unit_weight_kg: Math.max(0.5, slotEditForm.unit_weight_kg - 1) })}
                        className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        value={slotEditForm.unit_weight_kg}
                        onChange={(e) => setSlotEditForm({ ...slotEditForm, unit_weight_kg: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full bg-transparent text-center font-bold text-xs text-white focus:outline-hidden"
                      />
                      <button
                        onClick={() => setSlotEditForm({ ...slotEditForm, unit_weight_kg: slotEditForm.unit_weight_kg + 1 })}
                        className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Medidas de Caja (Ancho x Alto x Largo) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Medidas Caja (Ancho x Alto x Largo en m)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="0.05"
                      value={slotEditForm.box_width_m}
                      onChange={(e) => setSlotEditForm({ ...slotEditForm, box_width_m: parseFloat(e.target.value) || 0.4 })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                      title="Ancho caja (m)"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={slotEditForm.box_height_m}
                      onChange={(e) => setSlotEditForm({ ...slotEditForm, box_height_m: parseFloat(e.target.value) || 0.3 })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                      title="Alto caja (m)"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={slotEditForm.box_length_m}
                      onChange={(e) => setSlotEditForm({ ...slotEditForm, box_length_m: parseFloat(e.target.value) || 0.4 })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                      title="Largo caja (m)"
                    />
                  </div>
                </div>

                {/* Medidas de la Estantería (Rack) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Dimensiones Estantería (Ancho, Alto, Prof. en m)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={slotEditForm.rack_width_m}
                      onChange={(e) => setSlotEditForm({ ...slotEditForm, rack_width_m: parseFloat(e.target.value) || 2.4 })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                      title="Ancho Rack (m)"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={slotEditForm.rack_height_m}
                      onChange={(e) => setSlotEditForm({ ...slotEditForm, rack_height_m: parseFloat(e.target.value) || 6.0 })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                      title="Alto Rack (m)"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={slotEditForm.rack_depth_m}
                      onChange={(e) => setSlotEditForm({ ...slotEditForm, rack_depth_m: parseFloat(e.target.value) || 1.2 })}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                      title="Profundidad Rack (m)"
                    />
                  </div>
                </div>

                {/* Botones de Acción Directa */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleSaveSlot}
                    disabled={isSavingSlot}
                    className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    <Save size={14} />
                    <span>{isSavingSlot ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setTransferTargetWh(selectedWarehouseId);
                      setIsTransferModalOpen(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
                  >
                    <ArrowRightLeft size={14} />
                    <span>Mover</span>
                  </button>

                  <button
                    onClick={handleEmptySlot}
                    disabled={isSavingSlot}
                    className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-rose-500/30 transition"
                    title="Vaciar slot y liberar espacio"
                  >
                    <Trash2 size={14} />
                    <span>Vaciar</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* ========================================================= */}
      {/* 3. MODAL: VISTA AMPLIADA DE AUDITORÍA Y RIESGOS           */}
      {/* ========================================================= */}
      {isExpandedRiskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="text-rose-500" size={20} />
                <div>
                  <h3 className="font-bold text-base text-white">Auditoría Ampliada de Desvíos & Riesgos</h3>
                  <p className="text-xs text-slate-400">Inspecciona y exporta todas las posiciones con excesos físicos o alertas de stock</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download size={14} />
                  <span>Exportar a Excel</span>
                </button>
                <button
                  onClick={() => setIsExpandedRiskModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Posición</th>
                    <th className="pb-3">Cuerpo / Rack</th>
                    <th className="pb-3">SKU & Descripción</th>
                    <th className="pb-3">Cajas</th>
                    <th className="pb-3">Peso / Vol</th>
                    <th className="pb-3">Desvío Detectado</th>
                    <th className="pb-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {slots
                    .filter((s) => s.desvios || s.rop_status === 'CRITICO_ROP' || s.material_retenido || (s.peso_actual_kg > (s.peso_max_kg || 1500)))
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 font-mono font-bold text-sky-400">{s.slot_code}</td>
                        <td className="py-2.5 text-slate-300">Cuerpo {s.cuerpo} · Nivel {s.nivel}</td>
                        <td className="py-2.5 text-white font-medium truncate max-w-[200px]">
                          {s.sku || 'N/A'} - {s.descripcion || 'Sin descripción'}
                        </td>
                        <td className="py-2.5 text-slate-300">{s.cajas_count || s.cantidad}</td>
                        <td className="py-2.5 text-slate-400">
                          {s.peso_actual_kg} kg · {s.volumen_actual_m3} m³
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-semibold text-[10px]">
                            {s.desvios || (s.rop_status === 'CRITICO_ROP' ? 'QUIEBRE_ROP' : 'DESVIO_ESTRUCTURAL')}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              flyToSlot(s);
                              setIsExpandedRiskModalOpen(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11px] transition inline-flex items-center gap-1"
                          >
                            <Eye size={12} />
                            <span>Ver en 3D</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MODAL: "CÓMO USAR EL GEMELO 3D" (TOUR VISUAL 4 CARDS)  */}
      {/* ========================================================= */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl flex flex-col shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="text-amber-400" size={22} />
                <div>
                  <h3 className="font-bold text-base text-white">Guía Rápida · Cómo Operar el Gemelo 3D</h3>
                  <p className="text-xs text-slate-400">Domina la navegación, el buscador predictivo y la edición guiada</p>
                </div>
              </div>
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-amber-400 font-bold text-sm flex items-center gap-2">
                  <span>🎮 1. Navegación 3D</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Usa el <strong>clic izquierdo</strong> para rotar 360°, la <strong>rueda</strong> para acercar/alejar zoom y el <strong>clic derecho</strong> para desplazar la cámara. En el borde derecho del lienzo tienes la botonera para activar giro automático o pausar.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-sky-400 font-bold text-sm flex items-center gap-2">
                  <span>🔍 2. Buscador Predictivo</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Escribe <strong>3 o más caracteres</strong> en el buscador para encontrar al instante Coordenadas (ej. <em>A-01-01</em>), SKUs, nombres de producto o lotes. Al hacer clic en un resultado, la cámara <strong>vuela directamente</strong> a esa estantería.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-rose-400 font-bold text-sm flex items-center gap-2">
                  <span>⚠️ 3. Auditoría de Riesgos</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  En la pestaña <em>Riesgos</em>, toca el ícono del <strong>ojo 👁️</strong> para encender en rojo brillante solo las posiciones afectadas en el galpón 3D, o toca la <strong>tabla 📄</strong> para ver la lista completa con exportación a Excel.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                  <span>✏️ 4. Edición In-Situ</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Haz clic en cualquier estantería en el 3D para abrir la <strong>Ficha de Posición</strong>. Podrás cambiar el estado, asignar SKU con autocompletado, ajustar cajas y medidas con botones - / + y guardar sin modales ocultos.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                ¡Entendido, comenzar a operar!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL: TRANSFERENCIA / MOVIMIENTO DE STOCK             */}
      {/* ========================================================= */}
      {isTransferModalOpen && inspectedSlot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ArrowRightLeft className="text-sky-400" size={18} />
                <span>Reubicar / Transferir Stock</span>
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <div>Origen: <span className="font-mono font-bold text-white">{inspectedSlot.slot_code}</span> ({selectedWarehouse?.nombre})</div>
              <div>Material: <span className="font-semibold text-sky-300">{inspectedSlot.sku || 'Sin SKU'}</span> · {inspectedSlot.cajas_count || inspectedSlot.cantidad} cajas</div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase">Depósito Destino</label>
                <select
                  value={transferTargetWh}
                  onChange={(e) => setTransferTargetWh(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.nombre} ({w.ubicacion})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase">Coordenada Destino (ej. B-01-02)</label>
                <input
                  type="text"
                  value={transferTargetSlot}
                  onChange={(e) => setTransferTargetSlot(e.target.value)}
                  placeholder="Código de slot destino..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="moveAll"
                  checked={transferMoveAll}
                  onChange={(e) => setTransferMoveAll(e.target.checked)}
                  className="rounded border-slate-700 text-sky-500"
                />
                <label htmlFor="moveAll" className="text-xs text-slate-300 font-medium">Mover lote completo</label>
              </div>

              {!transferMoveAll && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Cantidad a mover</label>
                  <input
                    type="number"
                    value={transferQty}
                    onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                disabled={isSubmittingTransfer || !transferTargetSlot}
                onClick={async () => {
                  setIsSubmittingTransfer(true);
                  try {
                    await digitalTwinApi.transferStock({
                      source_warehouse_id: selectedWarehouseId,
                      source_slot_code: inspectedSlot.slot_code,
                      target_warehouse_id: transferTargetWh,
                      target_slot_code: transferTargetSlot,
                      mover_lote_completo: transferMoveAll,
                      cantidad_a_mover: transferMoveAll ? undefined : transferQty,
                    });
                    await loadWarehouseData(selectedWarehouseId);
                    setIsTransferModalOpen(false);
                    if (onTransferSuccess) onTransferSuccess();
                    setSyncToast(`Transferencia a ${transferTargetSlot} completada.`);
                    setTimeout(() => setSyncToast(null), 3500);
                  } catch (e) {
                    alert('Error en transferencia de stock');
                  } finally {
                    setIsSubmittingTransfer(false);
                  }
                }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {isSubmittingTransfer ? 'Transfiriendo...' : 'Confirmar Reubicación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL: CUBICAJE 98% (CARGA DE CONTENEDOR / CAMIÓN)     */}
      {/* ========================================================= */}
      {isLoadPlannerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <PackageCheck className="text-emerald-400" size={20} />
                <span>Simulador 3D de Cubicaje & Optimización 98% IA</span>
              </h3>
              <button onClick={() => setIsLoadPlannerModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Calcula la distribución óptima de pallets y bultos para maximizar la ocupación del contenedor o camión 3PL respetando pesos por eje y secuencia LIFO de descarga.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: '40HQ', label: 'Contenedor 40 HQ (76 m³)' },
                { id: '20ST', label: 'Contenedor 20 ST (33 m³)' },
                { id: 'TRUCK_3PL', label: 'Camión Semi 3PL (85 m³)' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setLoadPlanContainerType(c.id as any)}
                  className={`p-3 rounded-xl border text-xs font-semibold text-center transition ${
                    loadPlanContainerType === c.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="lifo"
                checked={enforceLifoRoute}
                onChange={(e) => setEnforceLifoRoute(e.target.checked)}
                className="rounded border-slate-700 text-sky-500"
              />
              <label htmlFor="lifo" className="text-xs text-slate-300">
                Respetar secuencia LIFO de descarga (Último en entrar, primero en salir)
              </label>
            </div>

            {loadPlanData && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                <div className="font-bold text-emerald-400">Resultado de Cubicaje IA:</div>
                <div className="text-slate-300">Ocupación Volumétrica: <span className="font-bold text-white">{loadPlanData.occupied_volume_pct.toFixed(1)}%</span> ({loadPlanData.total_volume_m3.toFixed(1)} m³)</div>
                <div className="text-slate-300">Cajas acomodadas: <span className="font-bold text-white">{loadPlanData.placed_boxes_count}</span> | Peso total: <span className="font-bold text-white">{loadPlanData.total_weight_kg.toFixed(0)} kg</span></div>
              </div>
            )}

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={() => setIsLoadPlannerModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
              <button
                disabled={isCalculatingPlan}
                onClick={async () => {
                  setIsCalculatingPlan(true);
                  try {
                    const items = slots
                      .filter((s) => (s.cajas_count || s.cantidad) > 0)
                      .slice(0, 15)
                      .map((s) => ({
                        sku: s.sku || 'SKU-001',
                        quantity: Number(s.cajas_count || s.cantidad || 1),
                        box_width_m: s.box_width_m || 0.4,
                        box_height_m: s.box_height_m || 0.3,
                        box_length_m: s.box_length_m || 0.4,
                        unit_weight_kg: s.unit_weight_kg || 10,
                      }));
                    const res = await digitalTwinApi.planContainerLoad(loadPlanContainerType, items, enforceLifoRoute);
                    setLoadPlanData(res);
                    setSyncToast(`Plan calculado: ${res.occupied_volume_pct.toFixed(1)}% ocupación volumétrica.`);
                  } catch (e) {
                    alert('Error calculando cubicaje');
                  } finally {
                    setIsCalculatingPlan(false);
                  }
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                {isCalculatingPlan ? 'Calculando...' : 'Calcular Cubicaje 98%'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. MODAL: DOBLE CANDADO SICE (RESERVA FÍSICA)              */}
      {/* ========================================================= */}
      {isReserveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Lock className="text-blue-400" size={18} />
                <span>Reserva Doble Candado SICE</span>
              </h3>
              <button onClick={() => setIsReserveModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Bloquea posiciones físicas para licitaciones públicas SICE o cotizaciones B2B, evitando roturas de stock.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase">Organismo Público / Cliente</label>
                <input
                  type="text"
                  value={reserveForm.organism}
                  onChange={(e) => setReserveForm({ ...reserveForm, organism: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase">Número de Licitación / Orden</label>
                <input
                  type="text"
                  value={reserveForm.order_id}
                  onChange={(e) => setReserveForm({ ...reserveForm, order_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>
            <div className="pt-3 flex justify-end gap-2">
              <button onClick={() => setIsReserveModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold">
                Cancelar
              </button>
              <button
                disabled={isReserving}
                onClick={async () => {
                  if (!inspectedSlot) {
                    alert('Selecciona primero una posición para reservar');
                    return;
                  }
                  setIsReserving(true);
                  try {
                    await digitalTwinApi.reserveSlot({
                      warehouse_id: selectedWarehouseId,
                      slot_code: inspectedSlot.slot_code,
                      reservation_type: reserveForm.reservation_type,
                      order_id: reserveForm.order_id,
                      organism: reserveForm.organism,
                      duration_days: reserveForm.duration_days,
                    });
                    await loadWarehouseData(selectedWarehouseId);
                    setIsReserveModalOpen(false);
                    setSyncToast(`Posición ${inspectedSlot.slot_code} reservada para ${reserveForm.organism}`);
                  } catch (e) {
                    alert('Error al reservar slot');
                  } finally {
                    setIsReserving(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
              >
                {isReserving ? 'Reservando...' : 'Aplicar Candado SICE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. MODAL: RECEPCIÓN INTELIGENTE QR                        */}
      {/* ========================================================= */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <QrCode className="text-purple-400" size={18} />
                <span>Recepción Inteligente con QR</span>
              </h3>
              <button onClick={() => setIsQRModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Escanea el token criptográfico QR impreso en el pallet para validar procedencia y ubicarlo en rack.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                value={qrScanInput}
                onChange={(e) => setQrScanInput(e.target.value)}
                placeholder="Pega o escanea token QR..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button onClick={() => setIsQRModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold">
                Cerrar
              </button>
              <button
                disabled={isScanningQR || !qrScanInput}
                onClick={async () => {
                  setIsScanningQR(true);
                  try {
                    const res = await digitalTwinApi.scanQRReceive(qrScanInput);
                    if (res.success) {
                      await loadWarehouseData(selectedWarehouseId);
                      setIsQRModalOpen(false);
                      setSyncToast(res.message);
                    } else {
                      alert(res.message);
                    }
                  } catch (e) {
                    alert('Token QR inválido o expirado');
                  } finally {
                    setIsScanningQR(false);
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
              >
                {isScanningQR ? 'Validando...' : 'Confirmar Recepción'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Optimización Slotting IA */}
      {isAiSlottingModalOpen && aiSlottingData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Cpu className="text-emerald-400" size={18} />
                <span>Recomendaciones de Slotting IA</span>
              </h3>
              <button onClick={() => setIsAiSlottingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="text-slate-400">Reducción estimada recorrido picking: <span className="font-bold text-emerald-400">-{aiSlottingData.reduccion_recorrido_picking_pct}%</span></div>
                <div className="text-slate-400">Posiciones reubicables: <span className="font-bold text-white">{aiSlottingData.posiciones_reubicables}</span></div>
              </div>
              <div className="font-semibold text-slate-300 pt-1">Acciones Sugeridas:</div>
              <ul className="space-y-1.5">
                {aiSlottingData.recomendaciones.map((rec, idx) => (
                  <li key={idx} className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 font-bold shrink-0">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsAiSlottingModalOpen(false)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold"
              >
                Aplicar Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
