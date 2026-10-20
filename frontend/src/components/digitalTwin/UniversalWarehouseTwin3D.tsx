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
  ChevronUp,
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

import { WarehouseCanvasScene, getCuerpoIndex } from './Warehouse3DSceneElements';
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

  // Pestaña Activa en Ficha Lateral Derecha: RACK COMPLETO vs CASILLERO INDIVIDUAL
  const [activeRightPanelTab, setActiveRightPanelTab] = useState<'RACK' | 'SLOT'>('RACK');

  // Modo Traslado Espacial de Rack Entero en el Piso 3D
  const [isMoveRackModeActive, setIsMoveRackModeActive] = useState<boolean>(false);
  const [ghostPosition, setGhostPosition] = useState<[number, number, number] | null>(null);
  const [isGhostValid, setIsGhostValid] = useState<boolean>(true);

  // Inspection & Editing
  // Active Selected Rack/Cuerpo state from 3D Raycasting
  const [selectedRackInfo, setSelectedRackInfo] = useState<{
    rack_id: string;
    cuerpo: string;
    zone_code: string;
    rack_width_m: number;
    rack_height_m: number;
    rack_depth_m: number;
    levels_count: number;
    max_weight_kg: number;
    pos_x_m?: number;
    pos_z_m?: number;
    rotation_y_deg?: number;
    position_x?: number;
    position_y?: number;
    position_z?: number;
    total_slots?: number;
  } | null>(null);

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
    levels_count: number;
    max_rack_weight_kg: number;
    pos_x_m?: number;
    pos_z_m?: number;
    rotation_y_deg?: number;
    position_x?: number;
    position_y?: number;
    position_z?: number;
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
    levels_count: 4,
    max_rack_weight_kg: 3000.0,
    pos_x_m: 0,
    pos_z_m: 0,
    rotation_y_deg: 0,
    position_x: undefined,
    position_y: undefined,
    position_z: undefined,
    real_product_id: null,
  });
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [isSavingSlot, setIsSavingSlot] = useState<boolean>(false);

  // 3D Camera & Controls
  const [rotationMode, setRotationMode] = useState<'AUTO_360' | 'PAUSED' | 'MANUAL'>('AUTO_360');
  const [cameraViewPreset, setCameraViewPreset] = useState<'ISOMETRIC' | 'TOP' | 'FRONT' | 'AISLE' | 'DOCK' | null>(null);
  const [focusTargetPosition, setFocusTargetPosition] = useState<[number, number, number] | null>(null);
  const [highlightedRiskType, setHighlightedRiskType] = useState<string | null>(null);

  // Interactive 3D Relocation Mode
  const [isInteractiveRelocationActive, setIsInteractiveRelocationActive] = useState<boolean>(false);
  const [relocationSourceSlot, setRelocationSourceSlot] = useState<DigitalTwinSlot | null>(null);

  // Free Coordinates Matrix State & Location Guide
  const [isFreeCoordsOpen, setIsFreeCoordsOpen] = useState<boolean>(true);
  const [freeCoordFilter, setFreeCoordFilter] = useState<string>('');
  const [freeCoordCuerpo, setFreeCoordCuerpo] = useState<string>('ALL');

  // Create Rack Modal State
  const [isCreateRackModalOpen, setIsCreateRackModalOpen] = useState<boolean>(false);
  const [isCreatingRack, setIsCreatingRack] = useState<boolean>(false);
  const [createRackForm, setCreateRackForm] = useState({
    warehouse_id: '',
    zone_code: 'GENERAL',
    rack_code: '',
    rack_width_m: 2.4,
    rack_height_m: 6.0,
    rack_depth_m: 1.2,
    levels_count: 4,
    max_weight_kg: 3000.0,
    racks_count: 2,
    positions_per_level: 3,
  });

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

  // WebSocket Live & Resiliencia con Reconexión Automática / Backoff Exponencial y Polling de Respaldo
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'reconnecting' | 'polling' | 'disconnected'>('connecting');
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isUnmountedRef = useRef<boolean>(false);
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
        levels_count: inspectedSlot.levels_count || 4,
        max_rack_weight_kg: inspectedSlot.max_rack_weight_kg || 3000.0,
        position_x: (inspectedSlot as any).position_x,
        position_y: (inspectedSlot as any).position_y,
        position_z: (inspectedSlot as any).position_z,
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

  // WebSocket Live Hub con Reconexión Automática, Backoff Exponencial y Polling Silencioso de Respaldo
  useEffect(() => {
    isUnmountedRef.current = false;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const INITIAL_BACKOFF_MS = 3000;
    const wsUrl = `${getWsBaseUrl()}/api/v1/digital-twin/ws`;

    const startPollingFallback = () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      setWsStatus('polling');
      // Polling silencioso controlado cada 30s
      pollingIntervalRef.current = setInterval(() => {
        if (!isUnmountedRef.current && selectedWarehouseId) {
          loadWarehouseData(selectedWarehouseId);
        }
      }, 30000);
    };

    const connectWebSocket = () => {
      if (isUnmountedRef.current) return;

      // Limpiar conexión previa si existiera
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch {
          // No-op
        }
        wsRef.current = null;
      }

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmountedRef.current) return;
          setWsStatus('connected');
          setReconnectAttempt(0);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        };

        ws.onclose = () => {
          if (isUnmountedRef.current) return;
    
          setReconnectAttempt((prev) => {
            const nextAttempt = prev + 1;
            if (nextAttempt <= MAX_RECONNECT_ATTEMPTS) {
              setWsStatus('reconnecting');
              const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(1.2, nextAttempt - 1), 10000);
              reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
            } else {
              startPollingFallback();
            }
            return nextAttempt;
          });
        };

        ws.onerror = () => {
          // Intercepción silenciosa de error de socket para evitar saturar la consola del navegador
            };

        ws.onmessage = (event) => {
          if (isUnmountedRef.current) return;
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
              setTimeout(() => {
                if (!isUnmountedRef.current) setLiveArrivalAlert(null);
              }, 8000);
            } else if (data.type === 'HEARTBEAT') {
              try {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'pong' }));
                }
              } catch {
                // Silenciado
              }
            }
          } catch {
            // Silenciado
          }
        };
      } catch {
        startPollingFallback();
      }
    };

    connectWebSocket();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch {
          // No-op
        }
        wsRef.current = null;
      }
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

  // Matriz de Coordenadas Libres y Disponibilidad
  const availableEmptySlots = useMemo(() => {
    return slots.filter((s) => s.estado === 'VACIA');
  }, [slots]);

  const uniqueCuerposWithEmpty = useMemo(() => {
    const set = new Set<string>();
    availableEmptySlots.forEach((s) => {
      if (s.cuerpo) set.add(s.cuerpo);
    });
    return Array.from(set).sort();
  }, [availableEmptySlots]);

  const filteredFreeSlots = useMemo(() => {
    return availableEmptySlots.filter((s) => {
      if (freeCoordCuerpo !== 'ALL' && s.cuerpo !== freeCoordCuerpo) return false;
      if (freeCoordFilter) {
        const q = freeCoordFilter.trim().toLowerCase();
        return (
          s.slot_code.toLowerCase().includes(q) ||
          (s.cuerpo && s.cuerpo.toLowerCase().includes(q)) ||
          `n${s.nivel}`.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [availableEmptySlots, freeCoordCuerpo, freeCoordFilter]);

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

  // Fly-to slot helper (Calcula coordenadas espaciales reales considerando pos_x_m, pos_z_m y rotación)
  const flyToSlot = useCallback((slot: DigitalTwinSlot) => {
    setInspectedSlot(slot);
    setSelectedCuerpo(slot.cuerpo);

    const cuerpoIdx = getCuerpoIndex(slot.cuerpo);
    const rackNum = parseInt(slot.rack.replace(/\D/g, '')) || 1;
    const rw = slot.rack_width_m || 2.4;
    const rh = slot.rack_height_m || 6.0;
    const rd = slot.rack_depth_m || 1.2;
    const lev = Math.max(1, slot.levels_count || 4);
    const levelH = rh / lev;
    const baysCount = slot.bays_count || 2;

    const basePosX = (slot.pos_x_m !== undefined && slot.pos_x_m !== null)
      ? slot.pos_x_m
      : (slot.position_x !== undefined && slot.position_x !== null ? slot.position_x : -14 + cuerpoIdx * 7.0);
    const basePosZ = (slot.pos_z_m !== undefined && slot.pos_z_m !== null)
      ? slot.pos_z_m
      : (slot.position_z !== undefined && slot.position_z !== null ? slot.position_z : 0);
    const rotDeg = slot.rotation_y_deg || 0;
    const rotRad = (rotDeg * Math.PI) / 180;

    const localBayX = (rackNum - 1 - (baysCount - 1) / 2) * (rd + 0.1);
    const localSlotZ = (slot.posicion - 2) * (rw / 3.0);
    const posX = basePosX + localBayX * Math.cos(rotRad) - localSlotZ * Math.sin(rotRad);
    const posZ = basePosZ + localBayX * Math.sin(rotRad) + localSlotZ * Math.cos(rotRad);
    const posY = (slot.nivel - 1) * levelH + 0.15;

    setFocusTargetPosition([posX, posY, posZ]);
  }, []);

  // Validación de Colisión 2D AABB y Límites de Nave en Cliente para Holograma de Rack
  const checkClientCollisionAndBounds = useCallback(
    (targetX: number, targetZ: number, rotDeg: number, targetCuerpo: string) => {
      if (!selectedWarehouse) return true;
      const movingSlots = slotsByCuerpo[targetCuerpo] || [];
      const sample = movingSlots[0];
      const rw = sample?.rack_width_m || slotEditForm.rack_width_m || 2.4;
      const rd = sample?.rack_depth_m || slotEditForm.rack_depth_m || 1.2;
      const bays = sample?.bays_count || 2;

      const isRot90 = rotDeg === 90 || rotDeg === 270;
      const extX = isRot90 ? rw / 2 : (rd * bays) / 2;
      const extZ = isRot90 ? (rd * bays) / 2 : rw / 2;

      // 1. Límites del depósito
      const halfW = (selectedWarehouse.width_m || 50) / 2;
      const halfL = (selectedWarehouse.length_m || 70) / 2;
      if (
        targetX - extX < -halfW ||
        targetX + extX > halfW ||
        targetZ - extZ < -halfL ||
        targetZ + extZ > halfL
      ) {
        return false;
      }

      // 2. Colisión con otros racks
      const cleanTarget = targetCuerpo.replace(/^Cuerpo\s*/i, '').trim().toUpperCase();
      for (const [cName, cSlots] of Object.entries(slotsByCuerpo)) {
        const cleanOther = cName.replace(/^Cuerpo\s*/i, '').trim().toUpperCase();
        if (cleanOther === cleanTarget || cSlots.length === 0) continue;
        const otherSample = cSlots[0];
        const otherCIdx = getCuerpoIndex(cName);
        const otherRw = otherSample.rack_width_m || 2.4;
        const otherRd = otherSample.rack_depth_m || 1.2;
        const otherBays = otherSample.bays_count || 2;
        const otherRot = otherSample.rotation_y_deg || 0;
        const otherPx = otherSample.pos_x_m ?? otherSample.position_x ?? (-14 + otherCIdx * 7.0);
        const otherPz = otherSample.pos_z_m ?? otherSample.position_z ?? 0;

        const otherIsRot90 = otherRot === 90 || otherRot === 270;
        const otherExtX = otherIsRot90 ? otherRw / 2 : (otherRd * otherBays) / 2;
        const otherExtZ = otherIsRot90 ? (otherRd * otherBays) / 2 : otherRw / 2;

        const overlapX =
          Math.max(targetX - extX, otherPx - otherExtX) <
          Math.min(targetX + extX, otherPx + otherExtX) - 0.1;
        const overlapZ =
          Math.max(targetZ - extZ, otherPz - otherExtZ) <
          Math.min(targetZ + extZ, otherPz + otherExtZ) - 0.1;

        if (overlapX && overlapZ) {
          return false;
        }
      }

      return true;
    },
    [selectedWarehouse, slotsByCuerpo, slotEditForm]
  );

  // Mover puntero sobre el piso 3D durante el Modo Traslado de Rack
  const handleFloorPointerMove = useCallback(
    (x: number, z: number) => {
      if (!isMoveRackModeActive) return;
      const snapX = Math.round(x * 2) / 2; // Snap a retícula de 0.5m
      const snapZ = Math.round(z * 2) / 2;
      const activeCuerpo = selectedRackInfo?.cuerpo || selectedCuerpo;
      const rot = slotEditForm.rotation_y_deg ?? 0;
      const isValid = checkClientCollisionAndBounds(snapX, snapZ, rot, activeCuerpo);
      setGhostPosition([snapX, 0, snapZ]);
      setIsGhostValid(isValid);
    },
    [isMoveRackModeActive, selectedRackInfo, selectedCuerpo, slotEditForm.rotation_y_deg, checkClientCollisionAndBounds]
  );

  // Ejecutar Traslado Atómico del Rack Completo en Backend y Frontend
  const handleExecuteTransformRack = async (
    rackIdentifier: string,
    targetX: number,
    targetZ: number,
    targetRot?: number
  ) => {
    if (!selectedWarehouseId || !rackIdentifier || rackIdentifier === 'ALL') return;
    setIsSavingSlot(true);
    try {
      const rot = targetRot !== undefined ? targetRot : (slotEditForm.rotation_y_deg ?? 0);
      await digitalTwinApi.transformRack(rackIdentifier, {
        warehouse_id: selectedWarehouseId,
        pos_x_m: targetX,
        pos_z_m: targetZ,
        rotation_y_deg: rot,
        rack_width_m: slotEditForm.rack_width_m,
        rack_height_m: slotEditForm.rack_height_m,
        rack_depth_m: slotEditForm.rack_depth_m,
        levels_count: slotEditForm.levels_count || 4,
        max_weight_kg: slotEditForm.max_rack_weight_kg || 3000.0,
      });

      // Actualizar estado reactivo local de slots de inmediato para refresco visual instantáneo en 3D
      setSlots((prev) =>
        prev.map((s) => {
          const cClean = s.cuerpo.replace(/^Cuerpo\s*/i, '').trim().toUpperCase();
          const targetClean = rackIdentifier.replace(/^Cuerpo\s*/i, '').trim().toUpperCase();
          if (cClean === targetClean) {
            return {
              ...s,
              pos_x_m: targetX,
              pos_z_m: targetZ,
              position_x: targetX,
              position_z: targetZ,
              rotation_y_deg: rot,
              rack_width_m: slotEditForm.rack_width_m,
              rack_height_m: slotEditForm.rack_height_m,
              rack_depth_m: slotEditForm.rack_depth_m,
              levels_count: slotEditForm.levels_count || 4,
              max_rack_weight_kg: slotEditForm.max_rack_weight_kg || 3000.0,
            };
          }
          return s;
        })
      );

      setSelectedRackInfo((prev) =>
        prev
          ? {
              ...prev,
              pos_x_m: targetX,
              pos_z_m: targetZ,
              rotation_y_deg: rot,
              position_x: targetX,
              position_z: targetZ,
            }
          : null
      );

      setSlotEditForm((prev) => ({
        ...prev,
        pos_x_m: targetX,
        pos_z_m: targetZ,
        rotation_y_deg: rot,
        position_x: targetX,
        position_z: targetZ,
      }));

      setSyncToast(`Rack ${rackIdentifier} reubicado en piso (X=${targetX.toFixed(1)}m, Z=${targetZ.toFixed(1)}m, Rot=${rot}°).`);
      setTimeout(() => setSyncToast(null), 4000);

      // Cargar en background para sincronizar cálculos de volumen libre y desvíos
      await loadWarehouseData(selectedWarehouseId);
      if (onTransferSuccess) onTransferSuccess();
    } catch (err: any) {
      console.error('Error transforming rack:', err);
      const detail = err?.response?.data?.detail || err?.message || 'Error al trasladar rack';
      alert(`Error de Traslado Espacial: ${detail}`);
    } finally {
      setIsSavingSlot(false);
    }
  };

  // Clic en el suelo del almacén 3D para asentar el rack
  const handleFloorClick = useCallback(
    async (x: number, z: number) => {
      if (!isMoveRackModeActive) return;
      const snapX = Math.round(x * 2) / 2;
      const snapZ = Math.round(z * 2) / 2;
      const activeCuerpo = selectedRackInfo?.cuerpo || selectedCuerpo;
      const rot = slotEditForm.rotation_y_deg ?? 0;

      const isValid = checkClientCollisionAndBounds(snapX, snapZ, rot, activeCuerpo);
      if (!isValid) {
        alert("No es posible asentar el rack aquí: colisiona con otra estantería o excede los límites perimetrales del depósito.");
        return;
      }

      await handleExecuteTransformRack(activeCuerpo, snapX, snapZ, rot);
      setIsMoveRackModeActive(false);
    },
    [isMoveRackModeActive, selectedRackInfo, selectedCuerpo, slotEditForm.rotation_y_deg, checkClientCollisionAndBounds]
  );

  // Guardar Cambios en Ficha de Posición y Geometría de Estantería
  const handleSaveSlot = async () => {
    if (!inspectedSlot) return;
    setIsSavingSlot(true);
    try {
      // 1. Guardar especificaciones físicas de contenido del slot
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

      // 2. Si se ajustaron dimensiones o coordenadas estructurales del rack, actualizar en PostgreSQL 16 via transform_rack
      const targetRackId = selectedRackInfo?.rack_id || inspectedSlot.cuerpo;
      if (selectedWarehouseId && targetRackId) {
        await digitalTwinApi.transformRack(targetRackId, {
          warehouse_id: selectedWarehouseId,
          pos_x_m: slotEditForm.pos_x_m ?? slotEditForm.position_x ?? 0,
          pos_z_m: slotEditForm.pos_z_m ?? slotEditForm.position_z ?? 0,
          rotation_y_deg: slotEditForm.rotation_y_deg ?? 0,
          rack_width_m: slotEditForm.rack_width_m,
          rack_height_m: slotEditForm.rack_height_m,
          rack_depth_m: slotEditForm.rack_depth_m,
          levels_count: slotEditForm.levels_count || 4,
          max_weight_kg: slotEditForm.max_rack_weight_kg || 3000.0,
        });
      }

      // Refrescar datos y renderizado 3D en vivo
      if (selectedWarehouseId) {
        await loadWarehouseData(selectedWarehouseId);
      }
      if (onTransferSuccess) onTransferSuccess();
      setSyncToast(`Posición ${inspectedSlot.slot_code} y medidas de estantería guardadas con éxito.`);
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err: any) {
      console.error('Error saving slot specs:', err);
      const detail = err?.response?.data?.detail || err?.message || 'Error al guardar especificaciones';
      alert(`Error al guardar: ${detail}`);
    } finally {
      setIsSavingSlot(false);
    }
  };

  // Guardar Cambios Exclusivo para Estructura de Rack Seleccionada
  const handleSaveRackStructureOnly = async () => {
    const rackId = selectedRackInfo?.rack_id || selectedCuerpo;
    if (!rackId || rackId === 'ALL') return;
    const targetX = slotEditForm.pos_x_m ?? slotEditForm.position_x ?? 0;
    const targetZ = slotEditForm.pos_z_m ?? slotEditForm.position_z ?? 0;
    const targetRot = slotEditForm.rotation_y_deg ?? 0;
    await handleExecuteTransformRack(rackId, targetX, targetZ, targetRot);
  };

  // Reubicación Interactiva Directa en 3D
  const handleExecuteRelocation = async (sourceSlot: DigitalTwinSlot, targetSlot: DigitalTwinSlot) => {
    if (sourceSlot.id === targetSlot.id) {
      alert("La posición de destino debe ser diferente a la posición origen.");
      return;
    }
    if (targetSlot.estado === 'BLOQUEADA') {
      alert(`La posición de destino ${targetSlot.slot_code} está BLOQUEADA por mantenimiento.`);
      return;
    }
    if (targetSlot.estado === 'OCUPADA') {
      const confirmMove = window.confirm(
        `La posición de destino ${targetSlot.slot_code} ya está OCUPADA (${targetSlot.sku || 'Carga'}). ¿Deseas transferir de todos modos?`
      );
      if (!confirmMove) return;
    }
    setIsSavingSlot(true);
    try {
      await digitalTwinApi.transferStock({
        source_warehouse_id: sourceSlot.warehouse_id,
        source_slot_code: sourceSlot.slot_code,
        target_warehouse_id: targetSlot.warehouse_id,
        target_slot_code: targetSlot.slot_code,
        mover_lote_completo: true,
      });

      if (selectedWarehouseId) {
        await loadWarehouseData(selectedWarehouseId);
      }
      setIsInteractiveRelocationActive(false);
      setRelocationSourceSlot(null);
      setSyncToast(`Carga de ${sourceSlot.slot_code} reubicada exitosamente en ${targetSlot.slot_code}`);
      setTimeout(() => setSyncToast(null), 4000);
      if (onTransferSuccess) onTransferSuccess();
    } catch (err: any) {
      console.error('Error in interactive relocation:', err);
      alert(`Error al reubicar carga: ${err?.response?.data?.detail || err?.message || 'Error desconocido'}`);
    } finally {
      setIsSavingSlot(false);
    }
  };

  // Alta de Nuevo Rack Transaccional en 3D
  const handleCreateRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRackForm.rack_code.trim()) {
      alert("Por favor ingresa un código para el nuevo rack o cuerpo (ej. Cuerpo I).");
      return;
    }
    if (
      createRackForm.rack_width_m <= 0 ||
      createRackForm.rack_height_m <= 0 ||
      createRackForm.rack_depth_m <= 0 ||
      createRackForm.max_weight_kg <= 0 ||
      createRackForm.levels_count <= 0
    ) {
      alert("Todas las dimensiones y capacidades deben ser números estrictamente positivos (> 0).");
      return;
    }
    setIsCreatingRack(true);
    try {
      const targetWh = createRackForm.warehouse_id || selectedWarehouseId;
      const res = await digitalTwinApi.createRack({
        warehouse_id: targetWh,
        zone_code: createRackForm.zone_code || 'GENERAL',
        rack_code: createRackForm.rack_code.trim(),
        rack_width_m: createRackForm.rack_width_m,
        rack_height_m: createRackForm.rack_height_m,
        rack_depth_m: createRackForm.rack_depth_m,
        levels_count: createRackForm.levels_count,
        max_weight_kg: createRackForm.max_weight_kg,
        racks_count: createRackForm.racks_count,
        positions_per_level: createRackForm.positions_per_level,
      });

      // Recargar datos para que InstancedMesh redibuje en caliente
      await loadWarehouseData(targetWh);

      // Enfocar el nuevo cuerpo creado
      const cleanCuerpo = res.cuerpo || createRackForm.rack_code.replace(/^Cuerpo\s*/i, '').trim();
      setSelectedCuerpo(cleanCuerpo);

      setIsCreateRackModalOpen(false);
      setSyncToast(`Rack ${createRackForm.rack_code} creado e instanciado en 3D exitosamente (${res.slots_created} slots).`);
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err: any) {
      console.error('Error creating rack:', err);
      alert(`Error al crear rack: ${err?.response?.data?.detail || err?.message || 'Error desconocido'}`);
    } finally {
      setIsCreatingRack(false);
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
            {wsStatus === 'connected' && (
              <span className="text-[10px] text-emerald-400 font-mono ml-1 font-bold">🟢 En Línea</span>
            )}
            {wsStatus === 'reconnecting' && (
              <span className="text-[10px] text-amber-400 font-mono ml-1 animate-pulse font-bold">
                🔌 Reconectando ({reconnectAttempt}/5)...
              </span>
            )}
            {wsStatus === 'polling' && (
              <span className="text-[10px] text-sky-400 font-mono ml-1 font-bold">
                🔄 Modo Respaldo (Sync)
              </span>
            )}
            {wsStatus === 'disconnected' && (
              <span className="text-[10px] text-slate-400 font-mono ml-1">Local</span>
            )}
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
          {/* Botón Rápido Crear Rack */}
          <button
            onClick={() => {
              setCreateRackForm((prev) => ({ ...prev, warehouse_id: selectedWarehouseId }));
              setIsCreateRackModalOpen(true);
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white flex items-center gap-1.5 shadow-sm transition"
            title="Crear un nuevo rack o cuerpo en este almacén"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">+ Crear Rack</span>
          </button>

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
                <div className="border-t border-slate-800 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setActiveDropdown(null);
                      setCreateRackForm((prev) => ({ ...prev, warehouse_id: selectedWarehouseId }));
                      setIsCreateRackModalOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-sky-400 hover:bg-sky-500/10 flex items-center gap-2 transition"
                  >
                    <Plus size={14} className="text-sky-400" />
                    <span>+ Crear Nuevo Rack / Cuerpo</span>
                  </button>
                </div>
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
            onSelectSlot={(slot) => {
              if (isInteractiveRelocationActive && relocationSourceSlot) {
                handleExecuteRelocation(relocationSourceSlot, slot);
                return;
              }
              flyToSlot(slot);
              setActiveRightPanelTab('SLOT');
            }}
            selectedWarehouse={selectedWarehouse}
            uniqueCuerpos={uniqueCuerpos}
            slotsByCuerpo={slotsByCuerpo}
            selectedCuerpo={selectedCuerpo}
            onSelectRackCuerpo={(cuerpo, sample) => {
              setSelectedCuerpo(cuerpo);
              flyToSlot(sample);
              const rw = sample.rack_width_m || 2.4;
              const rh = sample.rack_height_m || 6.0;
              const rd = sample.rack_depth_m || 1.2;
              const lev = sample.levels_count || 4;
              const maxWt = sample.max_rack_weight_kg || 3000.0;
              const cuerpoSlots = slots.filter((s) => s.cuerpo === cuerpo);
              const zone = sample.descripcion?.match(/\((.*?)\)/)?.[1] || 'GENERAL';
              const cuerpoIdx = getCuerpoIndex(cuerpo);
              const px = sample.pos_x_m ?? (sample as any).position_x ?? (-14 + cuerpoIdx * 7.0);
              const pz = sample.pos_z_m ?? (sample as any).position_z ?? 0;
              const rot = sample.rotation_y_deg ?? 0;

              setSelectedRackInfo({
                rack_id: cuerpo,
                cuerpo,
                zone_code: zone,
                rack_width_m: rw,
                rack_height_m: rh,
                rack_depth_m: rd,
                levels_count: lev,
                max_weight_kg: maxWt,
                pos_x_m: px,
                pos_z_m: pz,
                rotation_y_deg: rot,
                position_x: px,
                position_y: 0,
                position_z: pz,
                total_slots: cuerpoSlots.length,
              });

              setSlotEditForm((prev) => ({
                ...prev,
                rack_width_m: rw,
                rack_height_m: rh,
                rack_depth_m: rd,
                levels_count: lev,
                max_rack_weight_kg: maxWt,
                pos_x_m: px,
                pos_z_m: pz,
                rotation_y_deg: rot,
                position_x: px,
                position_y: 0,
                position_z: pz,
              }));
              setActiveRightPanelTab('RACK');
            }}
            showEmptySlots={showEmptySlots}
            rotationMode={rotationMode}
            cameraViewPreset={cameraViewPreset}
            highlightedSlotIds={highlightedSlotIds}
            focusTargetPosition={focusTargetPosition}
            isMoveRackModeActive={isMoveRackModeActive}
            movingRackCuerpo={selectedRackInfo?.cuerpo || selectedCuerpo}
            ghostPosition={ghostPosition}
            isGhostValid={isGhostValid}
            onFloorPointerMove={handleFloorPointerMove}
            onFloorClick={handleFloorClick}
          />

          {/* HUD: MODO TRASLADO DE RACK ENTERO EN PISO 3D */}
          {isMoveRackModeActive && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border-2 border-cyan-400 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4 backdrop-blur-md animate-in fade-in slide-in-from-top-3 max-w-xl w-full mx-auto">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🏗️ Modo Traslado de Rack Activo</span>
                    <span className="font-mono bg-cyan-950 text-cyan-200 px-1.5 py-0.5 rounded border border-cyan-500/40">
                      Cuerpo {selectedRackInfo?.cuerpo || selectedCuerpo}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-0.5">
                    Mueve el cursor sobre el piso para previsualizar y haz <strong className="text-white">clic en el suelo</strong> para asentar el rack completo y sus cajas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMoveRackModeActive(false)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shrink-0 transition shadow-lg"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* HUD: MODO REUBICACIÓN INTERACTIVO 3D */}
          {isInteractiveRelocationActive && relocationSourceSlot && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-indigo-500 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex flex-col gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-3 max-w-xl w-full mx-auto">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="text-indigo-400 animate-pulse shrink-0" size={16} />
                  <div className="text-xs">
                    <span className="font-bold text-indigo-300 uppercase tracking-wide">Modo Reubicación 3D:</span>
                    <span className="text-slate-200 ml-1.5">
                      Reubicando <strong className="text-white font-mono">{relocationSourceSlot.slot_code}</strong>. Clic en visor 3D o elige una libre:
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsInteractiveRelocationActive(false);
                    setRelocationSourceSlot(null);
                  }}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 shrink-0"
                >
                  Cancelar
                </button>
              </div>

              {/* Sugerencias Rápidas de Coordenadas Libres en HUD */}
              {availableEmptySlots.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-thin scrollbar-thumb-slate-700">
                  <span className="text-[10px] text-emerald-400 font-semibold shrink-0 flex items-center gap-1">
                    <Compass size={11} /> Libres:
                  </span>
                  {availableEmptySlots.slice(0, 7).map((freeSlot) => (
                    <button
                      key={freeSlot.id}
                      onClick={() => handleExecuteRelocation(relocationSourceSlot, freeSlot)}
                      className="px-2 py-0.5 rounded-md bg-emerald-950/80 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/50 text-[10px] font-mono font-bold transition shrink-0"
                      title={`Reubicar a ${freeSlot.slot_code} (Cuerpo ${freeSlot.cuerpo}, Nivel ${freeSlot.nivel})`}
                    >
                      {freeSlot.slot_code}
                    </button>
                  ))}
                  {availableEmptySlots.length > 7 && (
                    <button
                      onClick={() => setIsFreeCoordsOpen(true)}
                      className="text-[10px] text-slate-400 hover:text-emerald-300 font-mono shrink-0 underline ml-1"
                    >
                      +{availableEmptySlots.length - 7} más en panel lateral
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

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
            {/* BLOQUE 5: DETALLE ESTRUCTURAL Y DE UBICACIÓN (2 PESTAÑAS) */}
            {/* ------------------------------------------------------ */}
            <div className="bg-slate-900/95 border-2 border-cyan-500/50 rounded-2xl p-4 shadow-2xl space-y-4">
              {/* Selector de Pestañas Superiores: RACK COMPLETO vs CASILLERO INDIVIDUAL */}
              <div className="flex border-b border-slate-800 bg-slate-950/80 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setActiveRightPanelTab('RACK')}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    activeRightPanelTab === 'RACK'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building2 size={14} className={activeRightPanelTab === 'RACK' ? 'text-cyan-400' : 'text-slate-500'} />
                  <span className="truncate">🏗️ RACK COMPLETO {selectedRackInfo ? `(${selectedRackInfo.cuerpo})` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightPanelTab('SLOT')}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    activeRightPanelTab === 'SLOT'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Boxes size={14} className={activeRightPanelTab === 'SLOT' ? 'text-sky-400' : 'text-slate-500'} />
                  <span className="truncate">📦 CASILLERO {inspectedSlot ? `(${inspectedSlot.slot_code})` : ''}</span>
                </button>
              </div>

              {/* PESTAÑA A: 🏗️ RACK / ESTANTERÍA COMPLETA */}
              {activeRightPanelTab === 'RACK' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      {selectedRackInfo && (
                        <button
                          type="button"
                          onClick={() => setSelectedRackInfo(null)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Deseleccionar rack"
                        >
                          <ArrowLeft size={14} />
                        </button>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-slate-400 uppercase font-bold">Rack Activo:</label>
                          <select
                            value={selectedRackInfo?.cuerpo || selectedCuerpo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedCuerpo(val);
                              const sample = slotsByCuerpo[val]?.[0];
                              if (sample) {
                                flyToSlot(sample);
                                const rw = sample.rack_width_m || 2.4;
                                const rh = sample.rack_height_m || 6.0;
                                const rd = sample.rack_depth_m || 1.2;
                                const lev = sample.levels_count || 4;
                                const maxWt = sample.max_rack_weight_kg || 3000.0;
                                const cuerpoSlots = slots.filter((s) => s.cuerpo === val);
                                const zone = sample.descripcion?.match(/\((.*?)\)/)?.[1] || 'GENERAL';
                                const cIdx = getCuerpoIndex(val);
                                const px = sample.pos_x_m ?? (sample as any).position_x ?? (-14 + cIdx * 7.0);
                                const pz = sample.pos_z_m ?? (sample as any).position_z ?? 0;
                                const rot = sample.rotation_y_deg ?? 0;

                                setSelectedRackInfo({
                                  rack_id: val,
                                  cuerpo: val,
                                  zone_code: zone,
                                  rack_width_m: rw,
                                  rack_height_m: rh,
                                  rack_depth_m: rd,
                                  levels_count: lev,
                                  max_weight_kg: maxWt,
                                  pos_x_m: px,
                                  pos_z_m: pz,
                                  rotation_y_deg: rot,
                                  position_x: px,
                                  position_y: 0,
                                  position_z: pz,
                                  total_slots: cuerpoSlots.length,
                                });

                                setSlotEditForm((prev) => ({
                                  ...prev,
                                  rack_width_m: rw,
                                  rack_height_m: rh,
                                  rack_depth_m: rd,
                                  levels_count: lev,
                                  max_rack_weight_kg: maxWt,
                                  pos_x_m: px,
                                  pos_z_m: pz,
                                  rotation_y_deg: rot,
                                  position_x: px,
                                  position_y: 0,
                                  position_z: pz,
                                }));
                              }
                            }}
                            className="bg-slate-950 border border-slate-700 text-cyan-300 font-bold rounded-lg px-2 py-1 text-xs focus:outline-hidden"
                          >
                            {uniqueCuerpos.map((c) => (
                              <option key={c} value={c}>
                                Cuerpo {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Zona: {selectedRackInfo?.zone_code || 'GENERAL'} · {slotsByCuerpo[selectedRackInfo?.cuerpo || selectedCuerpo]?.length || 0} Slots
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                      ESTRUCTURA 3D ACTIVA
                    </span>
                  </div>

                  {/* Control de Posición Espacial en Piso (X, Z y Rotación) */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
                    <label className="text-[11px] font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Compass size={14} className="text-cyan-400" />
                      <span>Coordenadas en el Piso (m) y Orientación</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Eje X (m) */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block font-semibold">Posición X (m)</span>
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const newX = (slotEditForm.pos_x_m ?? 0) - 1.0;
                              setSlotEditForm((prev) => ({ ...prev, pos_x_m: newX, position_x: newX }));
                            }}
                            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                            title="Desplazar -1 metro en X"
                          >
                            -1m
                          </button>
                          <input
                            type="number"
                            step="0.5"
                            value={slotEditForm.pos_x_m ?? 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSlotEditForm((prev) => ({ ...prev, pos_x_m: val, position_x: val }));
                            }}
                            className="w-full bg-transparent text-center font-mono font-bold text-xs text-white focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newX = (slotEditForm.pos_x_m ?? 0) + 1.0;
                              setSlotEditForm((prev) => ({ ...prev, pos_x_m: newX, position_x: newX }));
                            }}
                            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                            title="Desplazar +1 metro en X"
                          >
                            +1m
                          </button>
                        </div>
                      </div>

                      {/* Eje Z (m) */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block font-semibold">Posición Z (m)</span>
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const newZ = (slotEditForm.pos_z_m ?? 0) - 1.0;
                              setSlotEditForm((prev) => ({ ...prev, pos_z_m: newZ, position_z: newZ }));
                            }}
                            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                            title="Desplazar -1 metro en Z"
                          >
                            -1m
                          </button>
                          <input
                            type="number"
                            step="0.5"
                            value={slotEditForm.pos_z_m ?? 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSlotEditForm((prev) => ({ ...prev, pos_z_m: val, position_z: val }));
                            }}
                            className="w-full bg-transparent text-center font-mono font-bold text-xs text-white focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newZ = (slotEditForm.pos_z_m ?? 0) + 1.0;
                              setSlotEditForm((prev) => ({ ...prev, pos_z_m: newZ, position_z: newZ }));
                            }}
                            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                            title="Desplazar +1 metro en Z"
                          >
                            +1m
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Orientación / Rotación */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400 block font-semibold">Giro / Orientación Angular</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSlotEditForm((prev) => ({ ...prev, rotation_y_deg: 0 }))}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                            (slotEditForm.rotation_y_deg ?? 0) === 0
                              ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          <RotateCw size={12} />
                          <span>0° (Eje X)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlotEditForm((prev) => ({ ...prev, rotation_y_deg: 90 }))}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                            (slotEditForm.rotation_y_deg ?? 0) === 90
                              ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          <RotateCw size={12} />
                          <span>90° (Eje Z)</span>
                        </button>
                      </div>
                    </div>

                    {/* Botón Principal: Modo Mover RACK Entero haciendo Clic en el Piso 3D */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoveRackModeActive(!isMoveRackModeActive);
                        if (!isMoveRackModeActive) {
                          setSyncToast('Modo Traslado de Rack Activo: Haz clic en cualquier punto del piso 3D para asentar la estructura.');
                        } else {
                          setSyncToast(null);
                        }
                      }}
                      className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition shadow-lg ${
                        isMoveRackModeActive
                          ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-amber-900/40 animate-pulse'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-cyan-900/40'
                      }`}
                    >
                      <Compass size={15} />
                      <span>
                        {isMoveRackModeActive
                          ? '🎯 Moviendo... Haz Clic en el Piso 3D (o clic aquí para cancelar)'
                          : '🎯 Mover RACK Entero haciendo Clic en el Piso 3D'}
                      </span>
                    </button>
                  </div>

                  {/* Dimensiones Estructurales del Rack */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase">Dimensiones de Estantería (m)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Ancho (m)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          value={slotEditForm.rack_width_m}
                          onChange={(e) => setSlotEditForm({ ...slotEditForm, rack_width_m: parseFloat(e.target.value) || 2.4 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Alto (m)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="1.0"
                          value={slotEditForm.rack_height_m}
                          onChange={(e) => setSlotEditForm({ ...slotEditForm, rack_height_m: parseFloat(e.target.value) || 6.0 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Profundidad (m)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          value={slotEditForm.rack_depth_m}
                          onChange={(e) => setSlotEditForm({ ...slotEditForm, rack_depth_m: parseFloat(e.target.value) || 1.2 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Niveles y Carga Máxima */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Niveles (1-12)</span>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={slotEditForm.levels_count || 4}
                        onChange={(e) => setSlotEditForm({ ...slotEditForm, levels_count: parseInt(e.target.value) || 4 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Carga Máx (kg)</span>
                      <input
                        type="number"
                        step="100"
                        min="100"
                        value={slotEditForm.max_rack_weight_kg || 3000}
                        onChange={(e) => setSlotEditForm({ ...slotEditForm, max_rack_weight_kg: parseFloat(e.target.value) || 3000 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Resumen Calculado en Vivo */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">Volumen Rack: </span>
                      <span className="font-semibold text-cyan-300">
                        {(slotEditForm.rack_width_m * slotEditForm.rack_height_m * slotEditForm.rack_depth_m * 2).toFixed(2)} m³
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Altura / Nivel: </span>
                      <span className="font-semibold text-white">
                        {(slotEditForm.rack_height_m / Math.max(1, slotEditForm.levels_count || 4)).toFixed(2)} m
                      </span>
                    </div>
                  </div>

                  {/* Sugerencias Rápidas de Zonas Libres en el Piso */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase block">
                      🗺️ Sugerencias de Zonas Libres en Nave
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { name: 'Norte Central', x: 0, z: -10 },
                        { name: 'Sur Central', x: 0, z: 10 },
                        { name: 'Pasillo Oeste', x: -14, z: 8 },
                        { name: 'Pasillo Este', x: 14, z: 8 },
                      ].map((zone) => {
                        const rot = slotEditForm.rotation_y_deg ?? 0;
                        const activeCuerpo = selectedRackInfo?.cuerpo || selectedCuerpo;
                        const isAvail = checkClientCollisionAndBounds(zone.x, zone.z, rot, activeCuerpo);
                        return (
                          <button
                            key={zone.name}
                            type="button"
                            disabled={!isAvail}
                            onClick={() => {
                              setSlotEditForm((prev) => ({
                                ...prev,
                                pos_x_m: zone.x,
                                pos_z_m: zone.z,
                                position_x: zone.x,
                                position_z: zone.z,
                              }));
                              handleExecuteTransformRack(activeCuerpo, zone.x, zone.z, rot);
                            }}
                            className={`p-1.5 rounded-lg text-left text-[11px] border flex justify-between items-center transition ${
                              isAvail
                                ? 'bg-slate-950 border-slate-800 hover:border-cyan-500/60 text-slate-200'
                                : 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            <div>
                              <div className="font-semibold truncate">{zone.name}</div>
                              <div className="text-[9px] text-slate-500 font-mono">({zone.x}m, {zone.z}m)</div>
                            </div>
                            <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                              isAvail ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-600'
                            }`}>
                              {isAvail ? 'Libre' : 'Ocupada'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Botón Guardar Cambios del Rack en PostgreSQL 16 */}
                  <button
                    onClick={handleSaveRackStructureOnly}
                    disabled={isSavingSlot}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-900/30 transition"
                  >
                    <Save size={14} />
                    <span>{isSavingSlot ? 'Guardando en PostgreSQL 16...' : 'Guardar Transformación y Posición en PostgreSQL 16'}</span>
                  </button>
                </div>
              )}

              {/* PESTAÑA B: 📦 CAJA / CASILLERO INDIVIDUAL */}
              {activeRightPanelTab === 'SLOT' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  {inspectedSlot ? (
                    <>
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
                              <span className="text-xs text-sky-400 font-mono font-normal">
                                ({inspectedSlot.cuerpo}-R{inspectedSlot.rack}-N{inspectedSlot.nivel})
                              </span>
                            </h3>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            slotEditForm.estado === 'OCUPADA'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : slotEditForm.estado === 'VACIA'
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
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

                      {/* Botones de Acción Directa de Casillero */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={handleSaveSlot}
                          disabled={isSavingSlot}
                          className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                        >
                          <Save size={14} />
                          <span>{isSavingSlot ? 'Guardando...' : 'Guardar Casillero'}</span>
                        </button>

                        <button
                          onClick={() => {
                            if (!inspectedSlot) return;
                            if (isInteractiveRelocationActive) {
                              setIsInteractiveRelocationActive(false);
                              setRelocationSourceSlot(null);
                              setSyncToast(null);
                            } else {
                              setIsInteractiveRelocationActive(true);
                              setRelocationSourceSlot(inspectedSlot);
                              setIsFreeCoordsOpen(true);
                              setSyncToast(`Modo Reubicación 3D Activo: Haz clic en la posición destino en el visor 3D o elige una coordenada libre.`);
                            }
                          }}
                          className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border transition ${
                            isInteractiveRelocationActive && relocationSourceSlot?.id === inspectedSlot?.id
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg animate-pulse'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                          title="Habilitar modo interactivo de reubicación de slots en el visor 3D"
                        >
                          <ArrowRightLeft size={14} />
                          <span>{isInteractiveRelocationActive && relocationSourceSlot?.id === inspectedSlot?.id ? 'Reubicando...' : 'Transferir Stock'}</span>
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
                    </>
                  ) : (
                    <div className="p-4 text-center space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                      <Boxes size={28} className="text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">
                        Ningún casillero individual seleccionado. Haz clic sobre cualquier caja o posición vacía en el visor 3D para editarla o transferir mercancía.
                      </p>
                      {slotsByCuerpo[selectedRackInfo?.cuerpo || selectedCuerpo]?.length > 0 && (
                        <div className="space-y-1 text-left pt-2">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">
                            Casilleros en Cuerpo {selectedRackInfo?.cuerpo || selectedCuerpo}:
                          </span>
                          <div className="grid grid-cols-3 gap-1">
                            {slotsByCuerpo[selectedRackInfo?.cuerpo || selectedCuerpo].slice(0, 6).map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  flyToSlot(s);
                                  setActiveRightPanelTab('SLOT');
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-sky-400 truncate text-center"
                              >
                                {s.slot_code}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ------------------------------------------------------ */}
            {/* BLOQUE 5C: MATRIZ DE COORDENADAS LIBRES Y GUÍA 3D     */}
            {/* ------------------------------------------------------ */}
            <div className="bg-slate-900/95 border border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsFreeCoordsOpen(!isFreeCoordsOpen)}
              >
                <div className="flex items-center gap-2">
                  <Compass className="text-emerald-400" size={16} />
                  <div>
                    <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                      <span>🗺️ Matriz de Coordenadas Libres</span>
                      <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-mono border border-emerald-500/30">
                        {availableEmptySlots.length} libres
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400">Slots disponibles en {selectedWarehouse?.nombre || 'Almacén Activo'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={isFreeCoordsOpen ? "Plegar matriz de coordenadas" : "Desplegar matriz de coordenadas"}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  {isFreeCoordsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {isFreeCoordsOpen && (
                <div className="space-y-3 pt-2 border-t border-slate-800 animate-in fade-in">
                  {/* Buscador de Coordenadas Libres */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 text-slate-500" size={13} />
                    <input
                      type="text"
                      value={freeCoordFilter}
                      onChange={(e) => setFreeCoordFilter(e.target.value)}
                      placeholder="Filtrar coordenada (ej. A-01, N2)..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                    />
                    {freeCoordFilter && (
                      <button
                        onClick={() => setFreeCoordFilter('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Filtros por Cuerpo */}
                  {uniqueCuerposWithEmpty.length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                      <button
                        onClick={() => setFreeCoordCuerpo('ALL')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition shrink-0 ${
                          freeCoordCuerpo === 'ALL'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        Todos ({availableEmptySlots.length})
                      </button>
                      {uniqueCuerposWithEmpty.map((c) => {
                        const countInCuerpo = availableEmptySlots.filter((s) => s.cuerpo === c).length;
                        return (
                          <button
                            key={c}
                            onClick={() => setFreeCoordCuerpo(c)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition shrink-0 ${
                              freeCoordCuerpo === c
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            Cuerpo {c} ({countInCuerpo})
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Grilla de Coordenadas Libres */}
                  {filteredFreeSlots.length === 0 ? (
                    <div className="p-3 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                      No hay coordenadas vacías con los filtros aplicados.
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                      {filteredFreeSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-emerald-500/50 transition group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <div>
                              <span className="font-mono font-bold text-xs text-white group-hover:text-emerald-300 transition">
                                {slot.slot_code}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                Cuerpo {slot.cuerpo} · Rack {slot.rack} · Nivel {slot.nivel}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Botón Enfocar en 3D */}
                            <button
                              onClick={() => {
                                setInspectedSlot(slot);
                                setSlotEditForm({
                                  ...slotEditForm,
                                  rack_width_m: slot.rack_width_m || 2.4,
                                  rack_height_m: slot.rack_height_m || 6.0,
                                  rack_depth_m: slot.rack_depth_m || 1.2,
                                  levels_count: slot.levels_count || 4,
                                  max_rack_weight_kg: slot.max_rack_weight_kg || 3000,
                                  position_x: (slot as any).position_x,
                                  position_y: (slot as any).position_y,
                                  position_z: (slot as any).position_z,
                                  estado: 'VACIA',
                                  sku: '',
                                  descripcion: '',
                                  cajas_count: 0,
                                  unit_weight_kg: 5.0,
                                  box_width_m: 0.4,
                                  box_height_m: 0.3,
                                  box_length_m: 0.4,
                                });
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition"
                              title="Inspeccionar posición en visor"
                            >
                              Ver
                            </button>

                            {/* Si hay un slot origen seleccionado y ocupado */}
                            {inspectedSlot && inspectedSlot.estado === 'OCUPADA' && inspectedSlot.id !== slot.id && (
                              <button
                                onClick={() => handleExecuteRelocation(inspectedSlot, slot)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold flex items-center gap-1 shadow transition"
                                title={`Reubicar ${inspectedSlot.slot_code} hacia ${slot.slot_code}`}
                              >
                                <ArrowRightLeft size={10} />
                                <span>Mover aquí</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 text-center">
                    💡 Haz clic en <span className="text-emerald-400 font-semibold">Mover aquí</span> o en el visor 3D para reubicar stock.
                  </div>
                </div>
              )}
            </div>
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
                {/* Sugerencias de Coordenadas Libres (1 Clic) */}
                {availableEmptySlots.length > 0 && (
                  <div className="pt-1.5 space-y-1">
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Compass size={11} /> Coordenadas Libres Disponibles (1 Clic):
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                      {availableEmptySlots.slice(0, 12).map((free) => (
                        <button
                          key={free.id}
                          type="button"
                          onClick={() => setTransferTargetSlot(free.slot_code)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition border ${
                            transferTargetSlot === free.slot_code
                              ? 'bg-emerald-600 text-white border-emerald-400 font-bold shadow'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500 hover:text-white'
                          }`}
                        >
                          {free.slot_code}
                        </button>
                      ))}
                      {availableEmptySlots.length > 12 && (
                        <span className="text-[10px] text-slate-500 font-mono self-center px-1">
                          +{availableEmptySlots.length - 12} más
                        </span>
                      )}
                    </div>
                  </div>
                )}
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
      {/* ========================================================= */}
      {/* 9. MODAL: CREAR Y ALTA DE NUEVO RACK / CUERPO             */}
      {/* ========================================================= */}
      {isCreateRackModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Building2 className="text-sky-400" size={20} />
                <span>Alta de Nuevo Rack / Cuerpo Estructural</span>
              </h3>
              <button onClick={() => setIsCreateRackModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRack} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Depósito Asignado</label>
                  <select
                    value={createRackForm.warehouse_id}
                    onChange={(e) => setCreateRackForm({ ...createRackForm, warehouse_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.nombre} ({w.ubicacion})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Zona / Sector</label>
                  <input
                    type="text"
                    value={createRackForm.zone_code}
                    onChange={(e) => setCreateRackForm({ ...createRackForm, zone_code: e.target.value })}
                    placeholder="GENERAL, ALTA_ROTACION..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase">Código del Rack / Cuerpo</label>
                <input
                  type="text"
                  required
                  value={createRackForm.rack_code}
                  onChange={(e) => setCreateRackForm({ ...createRackForm, rack_code: e.target.value })}
                  placeholder="ej. Cuerpo I, Cuerpo J, RACK-06..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              {/* Dimensiones Físicas */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase">Dimensiones de Estantería (m)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Ancho (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      required
                      value={createRackForm.rack_width_m}
                      onChange={(e) => setCreateRackForm({ ...createRackForm, rack_width_m: parseFloat(e.target.value) || 2.4 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-center text-xs text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Alto (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      required
                      value={createRackForm.rack_height_m}
                      onChange={(e) => setCreateRackForm({ ...createRackForm, rack_height_m: parseFloat(e.target.value) || 6.0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-center text-xs text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Profundidad (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      required
                      value={createRackForm.rack_depth_m}
                      onChange={(e) => setCreateRackForm({ ...createRackForm, rack_depth_m: parseFloat(e.target.value) || 1.2 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-center text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Niveles y Bastidores */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Niveles (1-12)</span>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={createRackForm.levels_count}
                    onChange={(e) => setCreateRackForm({ ...createRackForm, levels_count: parseInt(e.target.value) || 4 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-center text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Carga Máx (kg)</span>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    required
                    value={createRackForm.max_weight_kg}
                    onChange={(e) => setCreateRackForm({ ...createRackForm, max_weight_kg: parseFloat(e.target.value) || 3000 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-center text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Bastidores (1-4)</span>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={createRackForm.racks_count}
                    onChange={(e) => setCreateRackForm({ ...createRackForm, racks_count: parseInt(e.target.value) || 2 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-center text-xs text-white"
                  />
                </div>
              </div>

              {/* Ficha de Capacidad Calculada en Vivo */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 text-xs space-y-1.5">
                <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Cálculo Paramétrico Transaccional</span>
                  <span className="text-slate-400 font-mono">
                    {(createRackForm.levels_count * (createRackForm.positions_per_level || 3) * (createRackForm.racks_count || 2))} Slots
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-slate-500">Volumen Total: </span>
                    <span className="font-semibold text-white">
                      {(createRackForm.rack_width_m * createRackForm.rack_height_m * createRackForm.rack_depth_m * (createRackForm.racks_count || 2)).toFixed(2)} m³
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Volumen / Slot: </span>
                    <span className="font-semibold text-white">
                      {((createRackForm.rack_width_m * createRackForm.rack_depth_m * (createRackForm.rack_height_m / Math.max(1, createRackForm.levels_count))) / (createRackForm.positions_per_level || 3)).toFixed(2)} m³
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Altura / Nivel: </span>
                    <span className="font-semibold text-white">
                      {(createRackForm.rack_height_m / Math.max(1, createRackForm.levels_count)).toFixed(2)} m
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Carga Máx / Slot: </span>
                    <span className="font-semibold text-white">
                      {((createRackForm.max_weight_kg / Math.max(1, createRackForm.levels_count)) / (createRackForm.positions_per_level || 3)).toFixed(0)} kg
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRackModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRack}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-md transition"
                >
                  {isCreatingRack ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>{isCreatingRack ? 'Creando e Instanciando...' : 'Crear e Instanciar en 3D'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
