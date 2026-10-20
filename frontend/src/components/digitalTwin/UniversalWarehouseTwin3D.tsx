import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  Boxes,
  Ship,
  Search,
  ArrowRightLeft,
  Sparkles,
  AlertTriangle,
  FileText,
  Download,
  Plus,
  X,
  Cpu,
} from 'lucide-react';
import type {
  DigitalTwinWarehouse,
  DigitalTwinSlot,
  WarehouseIntelligenceSummary,
  TransferStockPayload,
  OptimizeSlottingResponse,
} from '../../services/digitalTwinApi';
import { digitalTwinApi } from '../../services/digitalTwinApi';

interface UniversalWarehouseTwin3DProps {
  moduleScope: '3PL' | 'SUPPLY_CHAIN';
  initialWarehouseId?: string;
  kanbanFilter?: 'ALL' | 'CRITICO_ROP' | 'ALERTA_DOH' | 'OPTIMO';
  onTransferSuccess?: () => void;
  className?: string;
}

// ==========================================
// 3D OBJECTS & MESHES (THREE.JS)
// ==========================================

// Terrestrial Pallet & Cargo Box Component
const TerrestrialSlotMesh: React.FC<{
  slot: DigitalTwinSlot;
  isSelected: boolean;
  isGhost: boolean;
  onSelect: (slot: DigitalTwinSlot) => void;
}> = ({ slot, isSelected, isGhost, onSelect }) => {
  const meshRef = useRef<THREE.Group>(null);

  const posX = (slot.cuerpo.charCodeAt(0) - 65) * 6 + (parseInt(slot.rack) || 1) * 2.2;
  const posY = (slot.nivel - 1) * 1.8 + 0.3;
  const posZ = (slot.posicion - 2) * 1.6;

  const isAlertROP = slot.rop_status === 'CRITICO_ROP';
  const isAlertDOH = slot.rop_status === 'ALERTA_DOH';
  const hasDeviation = Boolean(slot.desvios);

  if (isGhost) {
    return (
      <group position={[posX, posY, posZ]}>
        <mesh>
          <boxGeometry args={[1.2, 1.4, 1.2]} />
          <meshBasicMaterial color="#334155" wireframe transparent opacity={0.15} />
        </mesh>
      </group>
    );
  }

  if (slot.estado === 'VACIA') {
    return (
      <group
        position={[posX, posY, posZ]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(slot);
        }}
      >
        <mesh>
          <boxGeometry args={[1.2, 0.2, 1.2]} />
          <meshStandardMaterial color="#0284c7" transparent opacity={0.3} wireframe />
        </mesh>
      </group>
    );
  }

  if (slot.estado === 'BLOQUEADA') {
    return (
      <group
        position={[posX, posY, posZ]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(slot);
        }}
      >
        <mesh>
          <boxGeometry args={[1.2, 1.4, 1.2]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.65} wireframe />
        </mesh>
      </group>
    );
  }

  let boxColor = '#d97706';
  let emissiveColor = '#000000';
  let emissiveIntensity = 0;

  if (isAlertROP) {
    boxColor = '#dc2626';
    emissiveColor = '#ef4444';
    emissiveIntensity = 0.6;
  } else if (isAlertDOH) {
    boxColor = '#f59e0b';
    emissiveColor = '#fbbf24';
    emissiveIntensity = 0.4;
  } else if (hasDeviation) {
    boxColor = '#8b5cf6';
    emissiveColor = '#a855f7';
    emissiveIntensity = 0.3;
  } else if (slot.rop_status === 'OPTIMO') {
    boxColor = '#059669';
  }

  if (isSelected) {
    emissiveColor = '#38bdf8';
    emissiveIntensity = 0.8;
  }

  return (
    <group
      ref={meshRef}
      position={[posX, posY, posZ]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(slot);
      }}
    >
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.2, 0.15, 1.2]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.05, 1.2, 1.05]} />
        <meshStandardMaterial
          color={boxColor}
          roughness={0.6}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.07, 0.1, 1.07]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.4} />
      </mesh>
      {isSelected && (
        <Text
          position={[0, 1.6, 0]}
          fontSize={0.25}
          color="#38bdf8"
          anchorX="center"
          anchorY="middle"
        >
          {slot.slot_code}
        </Text>
      )}
    </group>
  );
};

// Maritime Shipping Container Component (Alta Mar)
const MaritimeContainerMesh: React.FC<{
  slot: DigitalTwinSlot;
  isSelected: boolean;
  onSelect: (slot: DigitalTwinSlot) => void;
}> = ({ slot, isSelected, onSelect }) => {
  const bayNum = parseInt(slot.cuerpo.replace('BAY-', '')) || 1;
  const rowNum = parseInt(slot.rack.replace('ROW-', '')) || 1;
  const tier = slot.nivel;
  const pos = slot.posicion;

  const is40HQ = slot.tipo_contenedor === '40HQ';
  const length = is40HQ ? 4.8 : 2.4;
  const height = is40HQ ? 1.3 : 1.1;
  const width = 1.1;

  const posX = (bayNum - 2) * 5.8 + (pos - 1.5) * 0.1;
  const posY = (tier - 1) * (height + 0.05) + 1.2;
  const posZ = (rowNum - 1.5) * 3.2;

  const containerColors = ['#0284c7', '#059669', '#dc2626', '#d97706', '#475569'];
  const baseColor = containerColors[(bayNum + rowNum + tier) % containerColors.length];

  return (
    <group
      position={[posX, posY, posZ]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(slot);
      }}
    >
      <mesh>
        <boxGeometry args={[length, height, width]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.4}
          metalness={0.5}
          transparent={isSelected}
          opacity={isSelected ? 0.35 : 1.0}
          wireframe={isSelected}
          emissive={isSelected ? '#38bdf8' : '#000000'}
          emissiveIntensity={isSelected ? 0.6 : 0}
        />
      </mesh>

      {isSelected && (
        <group>
          {[-length * 0.3, 0, length * 0.3].map((xOffset, i) => (
            <mesh key={i} position={[xOffset, 0, 0]}>
              <boxGeometry args={[0.7, height * 0.65, 0.7]} />
              <meshStandardMaterial color="#fbbf24" roughness={0.3} />
            </mesh>
          ))}
          <Text
            position={[0, height + 0.4, 0]}
            fontSize={0.28}
            color="#38bdf8"
            anchorX="center"
            anchorY="middle"
          >
            {`${slot.tipo_contenedor || '40HQ'} | ${slot.slot_code}`}
          </Text>
        </group>
      )}

      {!isSelected && (
        <mesh position={[0, 0, width / 2 + 0.01]}>
          <planeGeometry args={[length * 0.95, height * 0.9]} />
          <meshBasicMaterial color="#1e293b" wireframe />
        </mesh>
      )}
    </group>
  );
};

// Realistic Container Ship Hull Structure (Alta Mar)
const ContainerShipHull: React.FC = () => {
  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[120, 80, 32, 32]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.1}
          metalness={0.8}
          transparent
          opacity={0.85}
        />
      </mesh>

      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[22, 0.8, 7.5]} />
        <meshStandardMaterial color="#991b1b" roughness={0.6} />
      </mesh>

      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[22.5, 0.4, 7.8]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} />
      </mesh>

      <mesh position={[12.5, 0.7, 0]} rotation={[0, 0, -Math.PI / 12]}>
        <coneGeometry args={[4.2, 3.5, 4]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>

      <group position={[-9.5, 2.5, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.5, 3.2, 5]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[0.8, 1.2, 0]}>
          <boxGeometry args={[1.0, 0.4, 4.8]} />
          <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.8, 2.2, 0]}>
          <cylinderGeometry args={[0.4, 0.5, 1.5, 16]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
          <meshBasicMaterial color="#64748b" />
        </mesh>
      </group>
    </group>
  );
};

// Terrestrial Warehouse Concrete Floor & Yard
const WarehouseFloor: React.FC = () => {
  return (
    <group position={[12, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[50, 30]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[14, 14.15, 64]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>

      <group position={[-20, 0, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[6, 0.2, 28]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {[-8, 0, 8].map((zPos, idx) => (
          <group key={idx} position={[2, 1.4, zPos]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[4.8, 2.2, 2.2]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.5} />
            </mesh>
            <mesh position={[-3.2, -0.2, 0]}>
              <boxGeometry args={[1.8, 1.8, 2.0]} />
              <meshStandardMaterial color="#0284c7" roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// ==========================================
// MAIN COMPONENT: UniversalWarehouseTwin3D
// ==========================================

export const UniversalWarehouseTwin3D: React.FC<UniversalWarehouseTwin3DProps> = ({
  moduleScope,
  initialWarehouseId,
  kanbanFilter: propKanbanFilter = 'ALL',
  onTransferSuccess,
  className = '',
}) => {
  const [warehouses, setWarehouses] = useState<DigitalTwinWarehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    initialWarehouseId || (moduleScope === '3PL' ? '3PL-WH-01' : 'DEP-CENTRAL-MVD')
  );
  const [slots, setSlots] = useState<DigitalTwinSlot[]>([]);
  const [summary, setSummary] = useState<WarehouseIntelligenceSummary | null>(null);

  const [selectedCuerpo, setSelectedCuerpo] = useState<string>('ALL');
  const [kanbanFilter, setKanbanFilter] = useState<string>(propKanbanFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showEmptySlots, setShowEmptySlots] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'OPERATIVO' | 'RIESGOS' | 'CAPACIDAD'>('OPERATIVO');

  const [inspectedSlot, setInspectedSlot] = useState<DigitalTwinSlot | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferTargetWh, setTransferTargetWh] = useState<string>('');
  const [transferTargetSlot, setTransferTargetSlot] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(0);
  const [transferMoveAll, setTransferMoveAll] = useState<boolean>(true);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);

  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);

  const [isAiSlottingModalOpen, setIsAiSlottingModalOpen] = useState<boolean>(false);
  const [aiSlottingData, setAiSlottingData] = useState<OptimizeSlottingResponse | null>(null);
  const [isOptimizingAi, setIsOptimizingAi] = useState<boolean>(false);

  const [isNewWhModalOpen, setIsNewWhModalOpen] = useState<boolean>(false);
  const [newWhId, setNewWhId] = useState<string>('');
  const [newWhName, setNewWhName] = useState<string>('');
  const [newWhType, setNewWhType] = useState<string>('SUCURSAL');
  const [newWhLocation, setNewWhLocation] = useState<string>('');
  const [isSavingWh, setIsSavingWh] = useState<boolean>(false);

  const isMaritimeScene = useMemo(() => {
    return (
      selectedWarehouseId === 'TRANSITO-MAR' ||
      selectedWarehouseId.includes('MAR') ||
      selectedWarehouseId.includes('VESSEL')
    );
  }, [selectedWarehouseId]);

  const loadWarehouses = async () => {
    try {
      const whList = await digitalTwinApi.getWarehouses(moduleScope);
      setWarehouses(whList);

      if (whList.length > 0 && !whList.some((w) => w.id === selectedWarehouseId)) {
        setSelectedWarehouseId(whList[0].id);
      }
    } catch (err) {
      console.error('Error fetching digital twin warehouses:', err);
    }
  };

  const loadWarehouseData = async (whId: string) => {
    try {
      const [slotData, summaryData] = await Promise.all([
        digitalTwinApi.getSlots({
          warehouse_id: whId,
          cuerpo: selectedCuerpo !== 'ALL' ? selectedCuerpo : undefined,
          rop_status: kanbanFilter !== 'ALL' ? kanbanFilter : undefined,
          search: searchQuery || undefined,
        }),
        digitalTwinApi.getIntelligenceSummary(whId),
      ]);
      setSlots(slotData);
      setSummary(summaryData);
    } catch (err) {
      console.error('Error loading warehouse 3D slots:', err);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, [moduleScope]);

  useEffect(() => {
    if (selectedWarehouseId) {
      loadWarehouseData(selectedWarehouseId);
    }
  }, [selectedWarehouseId, selectedCuerpo, kanbanFilter, searchQuery]);

  const handleExecuteTransfer = async () => {
    if (!inspectedSlot || !transferTargetWh || !transferTargetSlot) {
      alert('Por favor complete depósito y posición de destino');
      return;
    }
    try {
      setIsSubmittingTransfer(true);
      const payload: TransferStockPayload = {
        source_warehouse_id: inspectedSlot.warehouse_id,
        source_slot_code: inspectedSlot.slot_code,
        target_warehouse_id: transferTargetWh,
        target_slot_code: transferTargetSlot,
        cantidad_a_mover: transferMoveAll ? undefined : transferQty,
        mover_lote_completo: transferMoveAll,
      };
      await digitalTwinApi.transferStock(payload);
      alert(`Transferencia exitosa de ${inspectedSlot.slot_code} hacia ${transferTargetSlot}`);
      setIsTransferModalOpen(false);
      setInspectedSlot(null);
      await loadWarehouseData(selectedWarehouseId);
      if (onTransferSuccess) onTransferSuccess();
    } catch (err: any) {
      alert(`Error en transferencia: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleRunAiSlotting = async () => {
    try {
      setIsOptimizingAi(true);
      setIsAiSlottingModalOpen(true);
      const res = await digitalTwinApi.optimizeSlotting(selectedWarehouseId);
      setAiSlottingData(res);
    } catch (err: any) {
      console.error('Error running AI Slotting:', err);
    } finally {
      setIsOptimizingAi(false);
    }
  };

  const handleCreateWarehouse = async () => {
    if (!newWhId.trim() || !newWhName.trim()) {
      alert('Por favor ingrese código y nombre del depósito');
      return;
    }
    try {
      setIsSavingWh(true);
      await digitalTwinApi.createWarehouse({
        id: newWhId.trim().toUpperCase(),
        nombre: newWhName.trim(),
        tipo: newWhType,
        module_scope: moduleScope,
        ubicacion: newWhLocation.trim() || 'Montevideo, Uruguay',
      });
      alert(`Depósito '${newWhName}' creado exitosamente con su grilla 3D.`);
      setIsNewWhModalOpen(false);
      setNewWhId('');
      setNewWhName('');
      await loadWarehouses();
      setSelectedWarehouseId(newWhId.trim().toUpperCase());
    } catch (err: any) {
      alert(`Error al crear depósito: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSavingWh(false);
    }
  };

  const handleExportRiskTable = () => {
    if (!slots.length) return;
    const riskSlots = slots.filter((s) => s.desvios || s.material_retenido || s.material_calidad);
    const headers = 'Coordenada,SKU,Descripcion,Lote,Cantidad,Peso_KG,Volumen_M3,Desvios,Retenido,EnCalidad\n';
    const rows = riskSlots
      .map(
        (s) =>
          `"${s.slot_code}","${s.sku || ''}","${s.descripcion || ''}","${s.lote || ''}",${s.cantidad},${s.peso_actual_kg},${s.volumen_actual_m3},"${s.desvios || ''}",${s.material_retenido},${s.material_calidad}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Riesgos_${selectedWarehouseId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`relative flex flex-col h-[820px] w-full bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-2xl font-sans ${className}`}>
      {/* ==================================================== */}
      {/* TOP BAR: SELECTOR DINÁMICO DE DEPÓSITOS Y MODOS */}
      {/* ==================================================== */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 gap-3 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-sky-500/10 border border-sky-500/30 rounded-lg">
            {isMaritimeScene ? (
              <Ship className="w-5 h-5 text-sky-400 animate-pulse" />
            ) : (
              <Boxes className="w-5 h-5 text-sky-400" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
              {moduleScope === '3PL' ? '3PL Logistics & WMS' : 'Supply Chain Twin 3D'}
            </span>
          </div>

          <div className="relative">
            <select
              value={selectedWarehouseId}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                setSelectedCuerpo('ALL');
                setInspectedSlot(null);
              }}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.tipo === 'TRANSITO' ? '🚢 ' : '🏢 '}
                  {wh.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsNewWhModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
            title="Crear un nuevo depósito o nave industrial"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Nuevo Depósito</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700 text-xs">
            <button
              onClick={() => setKanbanFilter('ALL')}
              className={`px-2 py-1 rounded-md transition ${kanbanFilter === 'ALL' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setKanbanFilter('CRITICO_ROP')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${kanbanFilter === 'CRITICO_ROP' ? 'bg-red-600 text-white font-medium' : 'text-red-400 hover:text-white'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              Crítico ROP
            </button>
            <button
              onClick={() => setKanbanFilter('ALERTA_DOH')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${kanbanFilter === 'ALERTA_DOH' ? 'bg-amber-600 text-white font-medium' : 'text-amber-400 hover:text-white'}`}
            >
              Alerta DOH
            </button>
            <button
              onClick={() => setKanbanFilter('OPTIMO')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${kanbanFilter === 'OPTIMO' ? 'bg-emerald-600 text-white font-medium' : 'text-emerald-400 hover:text-white'}`}
            >
              Óptimo
            </button>
          </div>

          <button
            onClick={handleRunAiSlotting}
            disabled={isOptimizingAi}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
            <span>{isOptimizingAi ? 'Optimizando...' : 'Optimizar Slotting (IA)'}</span>
          </button>

          <button
            onClick={() => {
              if (inspectedSlot) {
                setTransferTargetWh(selectedWarehouseId === 'TRANSITO-MAR' ? 'DEP-CENTRAL-MVD' : selectedWarehouseId);
                setTransferTargetSlot('A-01-01-01');
                setTransferQty(inspectedSlot.cantidad);
              }
              setIsTransferModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Mover Stock</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3D CANVAS & RIGHT PANEL CONTAINER */}
      {/* ==================================================== */}
      <div className="relative flex-1 w-full h-full flex overflow-hidden">
        <div className="flex-1 relative w-full h-full bg-slate-950">
          <Canvas
            camera={{
              position: isMaritimeScene ? [16, 14, 22] : [18, 16, 24],
              fov: 45,
            }}
            shadows
          >
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[20, 30, 20]}
              intensity={1.2}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <pointLight position={[-10, 15, -10]} intensity={0.5} color="#38bdf8" />

            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              maxPolarAngle={Math.PI / 2.05}
              minDistance={4}
              maxDistance={70}
            />

            {isMaritimeScene ? (
              <group>
                <ContainerShipHull />
                {slots.map((slot) => (
                  <MaritimeContainerMesh
                    key={slot.id}
                    slot={slot}
                    isSelected={inspectedSlot?.id === slot.id}
                    onSelect={(s) => setInspectedSlot(s)}
                  />
                ))}
              </group>
            ) : (
              <group>
                <WarehouseFloor />
                {slots.map((slot) => {
                  const isGhost = selectedCuerpo !== 'ALL' && slot.cuerpo !== selectedCuerpo;
                  if (!showEmptySlots && slot.estado === 'VACIA') return null;

                  return (
                    <TerrestrialSlotMesh
                      key={slot.id}
                      slot={slot}
                      isSelected={inspectedSlot?.id === slot.id}
                      isGhost={isGhost}
                      onSelect={(s) => setInspectedSlot(s)}
                    />
                  );
                })}
              </group>
            )}
          </Canvas>

          {/* Floating HUD Pill for Selected 3D Slot */}
          {inspectedSlot && (
            <div className="absolute top-4 left-4 max-w-sm bg-slate-900/95 backdrop-blur-md border border-sky-500/50 rounded-xl p-3.5 shadow-2xl z-20 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                  <span className="font-mono text-sm font-bold text-white tracking-wide">
                    {inspectedSlot.slot_code}
                  </span>
                </div>
                <button
                  onClick={() => setInspectedSlot(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-2.5 space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">SKU:</span>
                  <span className="font-semibold text-sky-300">{inspectedSlot.sku || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Descripción:</span>
                  <span className="font-medium text-slate-200 truncate max-w-[180px]">{inspectedSlot.descripcion || 'Sin asignar'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lote:</span>
                  <span className="font-mono text-slate-200">{inspectedSlot.lote || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cantidad / Bultos:</span>
                  <span className="font-bold text-emerald-400">{inspectedSlot.cantidad} u.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Peso / Volumen:</span>
                  <span>{inspectedSlot.peso_actual_kg} kg | {inspectedSlot.volumen_actual_m3} m³</span>
                </div>

                {isMaritimeScene && (
                  <div className="pt-2 border-t border-slate-800 space-y-1 text-sky-200">
                    <div className="flex justify-between">
                      <span>Tipo Contenedor:</span>
                      <span className="font-bold">{inspectedSlot.tipo_contenedor || '40HQ'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ETA Puerto MVD:</span>
                      <span className="font-mono font-semibold">
                        {inspectedSlot.eta_arribo ? new Date(inspectedSlot.eta_arribo).toLocaleDateString() : 'En travesía'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Costo Landed CIF:</span>
                      <span className="font-bold text-emerald-300">${inspectedSlot.costo_landed.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => {
                    setTransferTargetWh(isMaritimeScene ? 'DEP-CENTRAL-MVD' : selectedWarehouseId);
                    setTransferTargetSlot('A-01-01-01');
                    setTransferQty(inspectedSlot.cantidad);
                    setIsTransferModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-xs shadow-md transition"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{isMaritimeScene ? 'Transferir a MVD al Arribar' : 'Mover a otra Posición'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex items-center gap-2 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar coord (ej. F-01-01)..."
                className="pl-8 pr-3 py-1.5 bg-slate-900/90 border border-slate-700 text-xs text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 w-52"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-900/90 border border-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={showEmptySlots}
                onChange={(e) => setShowEmptySlots(e.target.checked)}
                className="rounded border-slate-700 text-sky-600 focus:ring-0"
              />
              <span>Mostrar Vacías</span>
            </label>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT CONTROL PANEL: WAREHOUSE INTELLIGENCE */}
        {/* ==================================================== */}
        <div className="w-96 bg-slate-900/95 border-l border-slate-800 flex flex-col h-full z-10 overflow-y-auto">
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-sm tracking-wide text-white">WAREHOUSE INTELLIGENCE</h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-mono">
                Resumen Inteligente
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 mt-3 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('OPERATIVO')}
                className={`py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'OPERATIVO' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                [📦 Operativo]
              </button>
              <button
                onClick={() => setActiveTab('RIESGOS')}
                className={`py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'RIESGOS' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                [⚠️ Riesgos]
              </button>
              <button
                onClick={() => setActiveTab('CAPACIDAD')}
                className={`py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'CAPACIDAD' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                [📐 Capacidad]
              </button>
            </div>
          </div>

          {activeTab === 'OPERATIVO' && summary && (
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Lotes Activos</span>
                  <span className="text-base font-bold text-white">{summary.operativo.lotes_activos}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">SKUs Distintos</span>
                  <span className="text-base font-bold text-white">{summary.operativo.skus_distintos}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Posiciones Ocupadas</span>
                  <span className="text-base font-bold text-emerald-400">{summary.operativo.posiciones_ocupadas}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Posiciones Libres</span>
                  <span className="text-base font-bold text-sky-400">{summary.operativo.posiciones_libres}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Posiciones Bloqueadas</span>
                  <span className="text-base font-bold text-red-400">{summary.operativo.posiciones_bloqueadas}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Total Posiciones</span>
                  <span className="text-base font-bold text-white">{summary.operativo.total_posiciones}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>Stock Total:</span>
                  <span className="font-bold text-white">{summary.operativo.stock_total.toLocaleString()} u.</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Pallets Ocupados:</span>
                  <span className="font-bold text-white">{summary.operativo.pallets_ocupados}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Cajas Ocupadas:</span>
                  <span className="font-bold text-white">{summary.operativo.cajas_ocupadas.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                  <span className="font-medium text-emerald-400">Valor Estimado ($):</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    ${summary.operativo.valor_estimado_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'RIESGOS' && summary && (
            <div className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">
                <span className="font-semibold">Criticidad Global:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${summary.riesgos.criticidad === 'ALTA' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'}`}>
                  {summary.riesgos.criticidad}
                </span>
              </div>

              <div className="space-y-1.5 divide-y divide-slate-800/80">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Posiciones Afectadas:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{summary.riesgos.posiciones_afectadas}</span>
                    <button
                      onClick={() => setIsRiskModalOpen(true)}
                      className="p-1 hover:bg-slate-800 rounded text-sky-400"
                      title="Ver tabla modal y exportar a Excel"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Exceso de Volumen:</span>
                  <span className="font-semibold text-amber-400">{summary.riesgos.exceso_volumen}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Exceso de Altura:</span>
                  <span className="font-semibold text-amber-400">{summary.riesgos.exceso_altura}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Exceso de Peso:</span>
                  <span className="font-semibold text-red-400">{summary.riesgos.exceso_peso}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Material Retenido:</span>
                  <span className="font-semibold text-red-400">{summary.riesgos.material_retenido}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Material en Calidad:</span>
                  <span className="font-semibold text-sky-400">{summary.riesgos.material_en_calidad}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Compatibilidad Logística (%):</span>
                  <span className="font-bold text-emerald-400">{summary.riesgos.compatibilidad_logistica_pct}%</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Vencimientos Próximos (&lt;60d):</span>
                  <span className="font-bold text-amber-300">{summary.riesgos.vencimientos}</span>
                </div>
              </div>

              <button
                onClick={() => setIsRiskModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>Abrir Tabla de Desvíos & Riesgos</span>
              </button>
            </div>
          )}

          {activeTab === 'CAPACIDAD' && summary && (
            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>% Volumen Ocupado:</span>
                  <span className="font-bold text-sky-400">{summary.capacidad_real.porcentaje_volumen_usado}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, summary.capacidad_real.porcentaje_volumen_usado)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Peso Actual / Libre:</span>
                  <span className="font-medium text-white">
                    {summary.capacidad_real.peso_actual_kg.toLocaleString()} kg / {summary.capacidad_real.peso_libre_kg.toLocaleString()} kg
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Superficie Ocupada:</span>
                  <span className="font-medium text-white">
                    {summary.capacidad_real.superficie_ocupada_m2} m² / {summary.capacidad_real.superficie_total_m2} m²
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Volumen Ocupado / Libre:</span>
                  <span className="font-medium text-white">
                    {summary.capacidad_real.volumen_ocupado_m3.toLocaleString()} m³ / {summary.capacidad_real.volumen_libre_m3.toLocaleString()} m³
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Altura Promedio:</span>
                  <span className="font-medium text-white">{summary.capacidad_real.altura_promedio_m} m</span>
                </div>
              </div>
            </div>
          )}

          {summary && summary.comparativa_cuerpos.length > 0 && (
            <div className="p-4 border-t border-slate-800 space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Comparativa por Cuerpo {isMaritimeScene ? '(Bahías)' : '(Racks)'}
              </h4>
              <div className="space-y-2">
                {summary.comparativa_cuerpos.map((c) => (
                  <div key={c.cuerpo} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-200">
                        {isMaritimeScene ? `Bahía ${c.cuerpo}` : `Cuerpo ${c.cuerpo}`}
                      </span>
                      <span className="text-slate-400">
                        {c.ocupadas}/{c.total} pos ({c.porcentaje_ocupacion}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, c.porcentaje_ocupacion)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL 1: MOVER / TRANSFERIR STOCK */}
      {/* ==================================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm">Mover / Transferir Stock (Gemelo 3D)</h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Posición Origen</span>
                <span className="font-mono font-bold text-sky-300">
                  {selectedWarehouseId} ➔ {inspectedSlot?.slot_code || 'Seleccione un slot en 3D'}
                </span>
                {inspectedSlot && (
                  <p className="text-slate-400 mt-1">
                    SKU: {inspectedSlot.sku} | Cantidad disponible: {inspectedSlot.cantidad} u.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Depósito Destino:</label>
                <select
                  value={transferTargetWh}
                  onChange={(e) => setTransferTargetWh(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                >
                  <option value="">Seleccione depósito...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nombre} ({w.module_scope})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Posición / Slot Destino:</label>
                <input
                  type="text"
                  value={transferTargetSlot}
                  onChange={(e) => setTransferTargetSlot(e.target.value)}
                  placeholder="ej. A-02-01-04 o BAY-02-ROW-01-T01-P01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkMoveAll"
                  checked={transferMoveAll}
                  onChange={(e) => setTransferMoveAll(e.target.checked)}
                  className="rounded border-slate-700 text-sky-600 focus:ring-0"
                />
                <label htmlFor="chkMoveAll" className="text-slate-300 cursor-pointer">
                  Mover lote completo ({inspectedSlot?.cantidad || 0} unidades)
                </label>
              </div>

              {!transferMoveAll && (
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Cantidad Parcial a Mover:</label>
                  <input
                    type="number"
                    value={transferQty}
                    onChange={(e) => setTransferQty(Number(e.target.value))}
                    max={inspectedSlot?.cantidad || 0}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteTransfer}
                disabled={isSubmittingTransfer || !inspectedSlot}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50"
              >
                {isSubmittingTransfer ? 'Transfiriendo...' : 'Confirmar Transferencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: TABLA MODAL DE RIESGOS & EXPORTAR EXCEL */}
      {/* ==================================================== */}
      {isRiskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Auditoría de Desvíos y Riesgos Logísticos ({selectedWarehouseId})
                </h3>
              </div>
              <button
                onClick={() => setIsRiskModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-xs text-slate-400">
                Visualizando posiciones con desvíos de volumen, peso, altura o retención de calidad.
              </span>
              <button
                onClick={handleExportRiskTable}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar a Excel (.csv)</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2.5">Coordenada</th>
                    <th className="p-2.5">SKU / Lote</th>
                    <th className="p-2.5">Descripción</th>
                    <th className="p-2.5">Peso / Vol</th>
                    <th className="p-2.5">Desvío Detectado</th>
                    <th className="p-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {slots
                    .filter((s) => s.desvios || s.material_retenido || s.material_calidad)
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-mono font-semibold text-sky-400">{s.slot_code}</td>
                        <td className="p-2.5">
                          <span className="block font-medium text-white">{s.sku}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{s.lote}</span>
                        </td>
                        <td className="p-2.5 max-w-[200px] truncate">{s.descripcion}</td>
                        <td className="p-2.5">
                          {s.peso_actual_kg} kg | {s.volumen_actual_m3} m³
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">
                            {s.desvios || (s.material_retenido ? 'RETENIDO' : 'EN CALIDAD')}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => {
                              setInspectedSlot(s);
                              setIsRiskModalOpen(false);
                            }}
                            className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-medium"
                          >
                            Ver en 3D
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsRiskModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: OPTIMIZACIÓN DE SLOTTING CON IA LOCAL */}
      {/* ==================================================== */}
      {isAiSlottingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-white text-sm">
                  Optimización Inteligente de Slotting (IA qwen2.5:3b)
                </h3>
              </div>
              <button
                onClick={() => setIsAiSlottingModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {aiSlottingData ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Eficiencia Proyectada</span>
                    <span className="text-xl font-bold text-emerald-400">
                      {aiSlottingData.eficiencia_proyectada_pct}%
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      (+{(aiSlottingData.eficiencia_proyectada_pct - aiSlottingData.eficiencia_actual_pct).toFixed(1)}% vs actual)
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Reducción Recorrido Picking</span>
                    <span className="text-xl font-bold text-sky-400">
                      -{aiSlottingData.reduccion_recorrido_picking_pct}%
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {aiSlottingData.posiciones_reubicables} posiciones sugeridas
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-300">Recomendaciones del Motor IA:</h4>
                  <div className="space-y-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    {aiSlottingData.recomendaciones.map((rec, idx) => (
                      <p key={idx} className="text-slate-200 leading-relaxed">
                        {rec}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
                <p>Procesando heurística de slotting y velocidad de rotación...</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAiSlottingModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 4: CREAR NUEVO DEPÓSITO */}
      {/* ==================================================== */}
      {isNewWhModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm">Nuevo Depósito ({moduleScope})</h3>
              </div>
              <button
                onClick={() => setIsNewWhModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Código / ID Depósito:</label>
                <input
                  type="text"
                  value={newWhId}
                  onChange={(e) => setNewWhId(e.target.value)}
                  placeholder="ej. 3PL-NAVE-SUR o DEP-PUNTA"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nombre Descriptivo:</label>
                <input
                  type="text"
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  placeholder="ej. Almacén 03 - Cadena de Frío"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Tipo de Depósito:</label>
                <select
                  value={newWhType}
                  onChange={(e) => setNewWhType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                >
                  <option value="CENTRAL">CENTRAL (Distribución Principal)</option>
                  <option value="SUCURSAL">SUCURSAL (Regional / Showroom)</option>
                  <option value="FABRICA">FABRICA (Manufactura / Kitting)</option>
                  <option value="INTERNACIONAL">INTERNACIONAL (Hub Exterior)</option>
                  <option value="TRANSITO">TRANSITO (Marítimo / Aduanero)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Dirección / Ubicación:</label>
                <input
                  type="text"
                  value={newWhLocation}
                  onChange={(e) => setNewWhLocation(e.target.value)}
                  placeholder="ej. Ruta 101 Km 28, Canelones"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsNewWhModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateWarehouse}
                disabled={isSavingWh}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition"
              >
                {isSavingWh ? 'Creando...' : 'Crear con Grilla 3D'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
