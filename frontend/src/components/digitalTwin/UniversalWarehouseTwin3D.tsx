import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
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
  Ruler,
  Layers,
  Settings2,
  PackageCheck,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Link2,
  Lock,
  Unlock,
  QrCode,
  Truck,
} from 'lucide-react';
import type {
  DigitalTwinWarehouse,
  DigitalTwinSlot,
  WarehouseIntelligenceSummary,
  TransferStockPayload,
  OptimizeSlottingResponse,
  RealProductItem,
  WarehouseDimensionsUpdatePayload,
  RackDimensionsUpdatePayload,
  SlotItemSpecsUpdatePayload,
  PlacedBox3D,
  ContainerLoadPlanResponse,
  FillAIResponse,
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

// Parametric Terrestrial Concrete Floor & Walls
const WarehouseNaveMesh: React.FC<{
  width: number;
  length: number;
  clearHeight: number;
}> = ({ width, length, clearHeight }) => {
  return (
    <group position={[0, 0, 0]}>
      {/* Ground concrete floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Safety perimeter line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[Math.min(width, length) * 0.45, Math.min(width, length) * 0.45 + 0.2, 64]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>

      {/* Grid line indicator */}
      <gridHelper args={[Math.max(width, length), 20, '#38bdf8', '#1e293b']} position={[0, 0.01, 0]} />

      {/* Structural Corner Columns indicating Clear Height */}
      {[
        [-width / 2 + 1, -length / 2 + 1],
        [width / 2 - 1, -length / 2 + 1],
        [-width / 2 + 1, length / 2 - 1],
        [width / 2 - 1, length / 2 - 1],
      ].map(([cx, cz], i) => (
        <group key={i} position={[cx, clearHeight / 2, cz]}>
          <mesh>
            <boxGeometry args={[0.6, clearHeight, 0.6]} />
            <meshStandardMaterial color="#334155" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Perimeter Dock Area */}
      <group position={[-width / 2 - 3, 0, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[6, 0.2, length * 0.8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {[-8, 0, 8].map((zPos, idx) => (
          <group key={idx} position={[1.5, 1.2, zPos]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[4.2, 2.2, 2.2]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.5} />
            </mesh>
            <mesh position={[-2.8, -0.2, 0]}>
              <boxGeometry args={[1.6, 1.8, 2.0]} />
              <meshStandardMaterial color="#0284c7" roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// Structural Racks per Cuerpo
const RackStructures: React.FC<{
  cuerpos: string[];
  slotsByCuerpo: Record<string, DigitalTwinSlot[]>;
  selectedCuerpo: string;
  onSelectRackCuerpo: (cuerpo: string, sampleSlot: DigitalTwinSlot) => void;
}> = ({ cuerpos, slotsByCuerpo, selectedCuerpo, onSelectRackCuerpo }) => {
  return (
    <group>
      {cuerpos.map((cuerpo) => {
        const cuerpoSlots = slotsByCuerpo[cuerpo] || [];
        if (cuerpoSlots.length === 0) return null;
        const sample = cuerpoSlots[0];

        const cuerpoIdx = Math.max(0, cuerpo.charCodeAt(0) - 65);
        const rw = sample.rack_width_m || 2.4;
        const rh = sample.rack_height_m || 6.0;
        const rd = sample.rack_depth_m || 1.2;
        const lev = sample.levels_count || 4;
        const levelH = rh / Math.max(1, lev);

        const rackNums = Array.from(new Set(cuerpoSlots.map((s) => parseInt(s.rack.replace(/\D/g, '')) || 1)));
        const isSelected = selectedCuerpo === cuerpo;

        return (
          <group key={cuerpo}>
            {rackNums.map((rackNum) => {
              const posX = cuerpoIdx * (rd * 2 + 4.8) + (rackNum - 1) * (rd + 1.6) - 12;
              return (
                <group
                  key={rackNum}
                  position={[posX, 0, 0]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRackCuerpo(cuerpo, sample);
                  }}
                >
                  {/* Upright posts (4 corner columns) */}
                  {[-rd / 2, rd / 2].map((xOff, xi) =>
                    [-rw / 2, rw / 2].map((zOff, zi) => (
                      <mesh key={`${xi}-${zi}`} position={[xOff, rh / 2, zOff]}>
                        <boxGeometry args={[0.07, rh, 0.07]} />
                        <meshStandardMaterial
                          color={isSelected ? '#38bdf8' : '#475569'}
                          metalness={0.7}
                          roughness={0.3}
                        />
                      </mesh>
                    ))
                  )}

                  {/* Horizontal crossbeams per level */}
                  {Array.from({ length: lev + 1 }).map((_, k) => (
                    <mesh key={k} position={[0, k * levelH + 0.04, 0]}>
                      <boxGeometry args={[rd, 0.05, rw]} />
                      <meshStandardMaterial
                        color={isSelected ? '#0284c7' : '#334155'}
                        metalness={0.6}
                        roughness={0.4}
                      />
                    </mesh>
                  ))}

                  {/* Header Label */}
                  <Text
                    position={[0, rh + 0.4, 0]}
                    fontSize={0.35}
                    color={isSelected ? '#38bdf8' : '#94a3b8'}
                    anchorX="center"
                    anchorY="middle"
                  >
                    {`Cuerpo ${cuerpo} - R${rackNum}`}
                  </Text>
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

// Ultra-Optimized InstancedMesh Cargo Engine for Real Inventory
const InstancedTerrestrialCargo: React.FC<{
  slots: DigitalTwinSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
}> = ({ slots, selectedSlotId, onSelectSlot }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const occupiedSlots = useMemo(() => {
    return slots.filter((s) => s.estado === 'OCUPADA' || s.estado === 'RESERVADA');
  }, [slots]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    occupiedSlots.forEach((slot, i) => {
      const cuerpoIdx = Math.max(0, slot.cuerpo.charCodeAt(0) - 65);
      const rackNum = parseInt(slot.rack.replace(/\D/g, '')) || 1;
      const rw = slot.rack_width_m || 2.4;
      const rh = slot.rack_height_m || 6.0;
      const rd = slot.rack_depth_m || 1.2;
      const lev = Math.max(1, slot.levels_count || 4);
      const levelH = rh / lev;

      const bw = Math.min(rw / 3.1, Math.max(0.2, slot.box_width_m || 0.4));
      const bh = Math.max(0.2, slot.box_height_m || 0.3);
      const bl = Math.min(rd * 0.9, Math.max(0.2, slot.box_length_m || 0.4));

      const posX = cuerpoIdx * (rd * 2 + 4.8) + (rackNum - 1) * (rd + 1.6) - 12;
      const posY = (slot.nivel - 1) * levelH + bh / 2 + 0.08;
      const posZ = (slot.posicion - 2) * (rw / 3.0);

      dummy.position.set(posX, posY, posZ);
      dummy.scale.set(bw, bh, bl);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color coding reactive to ROP / DOH / Reservas / Physical Deviations
      let hexColor = '#0284c7'; // default blue
      if (slot.id === selectedSlotId) {
        hexColor = '#38bdf8'; // glowing cyan
      } else if (slot.reservation_type === 'HARD_RESERVED') {
        hexColor = '#2563eb'; // electric solid blue for HARD RESERVED (Licitaciones / SICE)
      } else if (slot.reservation_type === 'SOFT_RESERVED') {
        hexColor = '#f59e0b'; // amber for SOFT RESERVED (Cotizaciones B2B)
      } else if (slot.desvios) {
        hexColor = '#ec4899'; // pink/magenta deviation
      } else if (slot.rop_status === 'CRITICO_ROP') {
        hexColor = '#ef4444'; // critical red
      } else if (slot.rop_status === 'ALERTA_DOH') {
        hexColor = '#f59e0b'; // amber
      } else if (slot.rop_status === 'OPTIMO') {
        hexColor = '#10b981'; // emerald
      }

      color.set(hexColor);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [occupiedSlots, selectedSlotId, dummy, color]);

  if (occupiedSlots.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, occupiedSlots.length]}
      onClick={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && occupiedSlots[instanceId]) {
          onSelectSlot(occupiedSlots[instanceId]);
        }
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.35} metalness={0.2} />
    </instancedMesh>
  );
};

// Wireframe Mesh for Empty and Blocked Slots
const EmptyAndBlockedSlotsMesh: React.FC<{
  slots: DigitalTwinSlot[];
  showEmptySlots: boolean;
  selectedSlotId: string | null;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
}> = ({ slots, showEmptySlots, selectedSlotId, onSelectSlot }) => {
  const targetSlots = useMemo(() => {
    return slots.filter((s) => {
      if (s.estado === 'OCUPADA') return false;
      if (s.estado === 'VACIA' && !showEmptySlots) return false;
      return true;
    });
  }, [slots, showEmptySlots]);

  return (
    <group>
      {targetSlots.map((slot) => {
        const cuerpoIdx = Math.max(0, slot.cuerpo.charCodeAt(0) - 65);
        const rackNum = parseInt(slot.rack.replace(/\D/g, '')) || 1;
        const rw = slot.rack_width_m || 2.4;
        const rh = slot.rack_height_m || 6.0;
        const rd = slot.rack_depth_m || 1.2;
        const lev = Math.max(1, slot.levels_count || 4);
        const levelH = rh / lev;

        const posX = cuerpoIdx * (rd * 2 + 4.8) + (rackNum - 1) * (rd + 1.6) - 12;
        const posY = (slot.nivel - 1) * levelH + 0.1;
        const posZ = (slot.posicion - 2) * (rw / 3.0);

        const isBlocked = slot.estado === 'BLOQUEADA';
        const isSelected = slot.id === selectedSlotId;

        return (
          <group
            key={slot.id}
            position={[posX, posY, posZ]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSlot(slot);
            }}
          >
            <mesh>
              <boxGeometry args={[rw / 3.2, 0.08, rd * 0.9]} />
              <meshStandardMaterial
                color={isSelected ? '#38bdf8' : isBlocked ? '#ef4444' : '#0284c7'}
                transparent
                opacity={isSelected ? 0.7 : isBlocked ? 0.6 : 0.25}
                wireframe={!isSelected}
              />
            </mesh>
          </group>
        );
      })}
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
  const [realProducts, setRealProducts] = useState<RealProductItem[]>([]);

  const [selectedCuerpo, setSelectedCuerpo] = useState<string>('ALL');
  const [kanbanFilter, setKanbanFilter] = useState<string>(propKanbanFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showEmptySlots, setShowEmptySlots] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'OPERATIVO' | 'RIESGOS' | 'CAPACIDAD'>('OPERATIVO');

  const [inspectedSlot, setInspectedSlot] = useState<DigitalTwinSlot | null>(null);

  // Modals state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferTargetWh, setTransferTargetWh] = useState<string>('');
  const [transferTargetSlot, setTransferTargetSlot] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(0);
  const [transferMoveAll, setTransferMoveAll] = useState<boolean>(true);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);

  // WebSocket Live Hub State
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [liveArrivalAlert, setLiveArrivalAlert] = useState<{
    message: string;
    slot_code: string;
    sku: string;
    units: number;
  } | null>(null);

  // 1. Simulador 3D de Cubicaje & AI Filler
  const [isLoadPlannerModalOpen, setIsLoadPlannerModalOpen] = useState<boolean>(false);
  const [loadPlanContainerType, setLoadPlanContainerType] = useState<'40HQ' | '20ST' | 'TRUCK_3PL'>('40HQ');
  const [enforceLifoRoute, setEnforceLifoRoute] = useState<boolean>(true);
  const [loadPlanData, setLoadPlanData] = useState<ContainerLoadPlanResponse | null>(null);
  const [aiFillerData, setAiFillerData] = useState<FillAIResponse | null>(null);
  const [isCalculatingPlan, setIsCalculatingPlan] = useState<boolean>(false);
  const [isFillingAI, setIsFillingAI] = useState<boolean>(false);

  // 2. Reserva Física 3D (Doble Candado)
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

  // 4. Recepción Inteligente QR
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [qrTokenGenerated, setQrTokenGenerated] = useState<string>('');
  const [qrScanInput, setQrScanInput] = useState<string>('');
  const [isScanningQR, setIsScanningQR] = useState<boolean>(false);

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

  // Parametric Dimensions Modals
  const [isWhDimModalOpen, setIsWhDimModalOpen] = useState<boolean>(false);
  const [whDimForm, setWhDimForm] = useState<WarehouseDimensionsUpdatePayload>({
    width_m: 50.0,
    length_m: 70.0,
    clear_height_m: 10.5,
  });
  const [isSavingWhDim, setIsSavingWhDim] = useState<boolean>(false);

  const [isRackEngModalOpen, setIsRackEngModalOpen] = useState<boolean>(false);
  const [selectedRackCuerpo, setSelectedRackCuerpo] = useState<string>('A');
  const [rackEngForm, setRackEngForm] = useState<RackDimensionsUpdatePayload>({
    rack_width_m: 2.4,
    rack_height_m: 6.0,
    rack_depth_m: 1.2,
    levels_count: 4,
    max_rack_weight_kg: 3000.0,
  });
  const [isSavingRackEng, setIsSavingRackEng] = useState<boolean>(false);

  const [isSlotItemModalOpen, setIsSlotItemModalOpen] = useState<boolean>(false);
  const [slotItemForm, setSlotItemForm] = useState<SlotItemSpecsUpdatePayload>({
    box_width_m: 0.4,
    box_height_m: 0.3,
    box_length_m: 0.4,
    unit_weight_kg: 10.0,
    units_count: 1,
    real_product_id: null,
    lote: '',
    descripcion: '',
  });
  const [isSavingSlotItem, setIsSavingSlotItem] = useState<boolean>(false);
  const [isSyncingInventory, setIsSyncingInventory] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

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

  const loadRealProducts = async () => {
    try {
      const prods = await digitalTwinApi.getRealProducts();
      setRealProducts(prods);
    } catch (err) {
      console.error('Error loading real products catalog:', err);
    }
  };

  useEffect(() => {
    loadWarehouses();
    loadRealProducts();
  }, [moduleScope]);

  // WebSocket Live Hub para Gemelo Digital 3D
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/digital-twin`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          setWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'BOX_RECEIVED_LIVE') {
              setLiveArrivalAlert({
                message: `¡Ingreso QR Confirmado en Vivo! SKU ${data.sku}`,
                slot_code: data.slot_code,
                sku: data.sku,
                units: data.units_count,
              });
              loadWarehouseData(selectedWarehouseId);
              setTimeout(() => setLiveArrivalAlert(null), 6000);
            } else if (data.event === 'SLOT_RESERVED' || data.event === 'SLOT_RELEASED') {
              loadWarehouseData(selectedWarehouseId);
            }
          } catch {
            // ignore
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 5000);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWs();
    return () => {
      if (socket) socket.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (selectedWarehouseId) {
      loadWarehouseData(selectedWarehouseId);
    }
  }, [selectedWarehouseId, selectedCuerpo, kanbanFilter, searchQuery]);

  useEffect(() => {
    if (selectedWarehouse) {
      setWhDimForm({
        width_m: selectedWarehouse.width_m || 50.0,
        length_m: selectedWarehouse.length_m || 70.0,
        clear_height_m: selectedWarehouse.clear_height_m || selectedWarehouse.altura_max_m || 10.5,
      });
    }
  }, [selectedWarehouse]);

  // Rack clicked in 3D
  const handleSelectRackCuerpo = (cuerpo: string, sampleSlot: DigitalTwinSlot) => {
    setSelectedRackCuerpo(cuerpo);
    setRackEngForm({
      rack_width_m: sampleSlot.rack_width_m || 2.4,
      rack_height_m: sampleSlot.rack_height_m || 6.0,
      rack_depth_m: sampleSlot.rack_depth_m || 1.2,
      levels_count: sampleSlot.levels_count || 4,
      max_rack_weight_kg: sampleSlot.max_rack_weight_kg || 3000.0,
    });
    setIsRackEngModalOpen(true);
  };

  // Box / Slot clicked in 3D
  const handleSelectSlot = (slot: DigitalTwinSlot) => {
    setInspectedSlot(slot);
    setSlotItemForm({
      box_width_m: slot.box_width_m || 0.4,
      box_height_m: slot.box_height_m || 0.3,
      box_length_m: slot.box_length_m || 0.4,
      unit_weight_kg: slot.unit_weight_kg || (slot.peso_actual_kg / Math.max(1, slot.cajas_count || 1)) || 10.0,
      units_count: slot.units_count ?? slot.cajas_count ?? (slot.estado === 'OCUPADA' ? 1 : 0),
      real_product_id: slot.real_product_id || null,
      lote: slot.lote || '',
      descripcion: slot.descripcion || '',
    });
  };

  // Save Warehouse Dimensions
  const handleSaveWarehouseDimensions = async () => {
    try {
      setIsSavingWhDim(true);
      await digitalTwinApi.updateWarehouseDimensions(selectedWarehouseId, whDimForm);
      await loadWarehouses();
      await loadWarehouseData(selectedWarehouseId);
      setIsWhDimModalOpen(false);
    } catch (err: any) {
      alert(`Error al actualizar dimensiones: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSavingWhDim(false);
    }
  };

  // Save Rack Engineering
  const handleSaveRackEngineering = async () => {
    try {
      setIsSavingRackEng(true);
      await digitalTwinApi.updateRackDimensions(selectedWarehouseId, selectedRackCuerpo, rackEngForm);
      await loadWarehouseData(selectedWarehouseId);
      setIsRackEngModalOpen(false);
    } catch (err: any) {
      alert(`Error al actualizar geometría de estantería: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSavingRackEng(false);
    }
  };

  // Save Slot Item Specs
  const handleSaveSlotItemSpecs = async () => {
    if (!inspectedSlot) return;
    try {
      setIsSavingSlotItem(true);
      await digitalTwinApi.updateSlotItemSpecs(inspectedSlot.id, slotItemForm);
      await loadWarehouseData(selectedWarehouseId);
      setIsSlotItemModalOpen(false);
      setInspectedSlot(null);
    } catch (err: any) {
      alert(`Error al actualizar especificaciones de caja: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSavingSlotItem(false);
    }
  };

  // Handlers para Cubicaje 3D y Relleno IA 98%
  const handleRunLoadPlanner = async (ctype = loadPlanContainerType) => {
    try {
      setIsCalculatingPlan(true);
      setAiFillerData(null);
      // Extraer ítems del almacén actual o lote muestra
      const sampleItems = slots
        .filter((s) => s.estado === 'OCUPADA' && s.cantidad > 0)
        .slice(0, 15)
        .map((s, idx) => ({
          sku: s.sku || `SKU-${idx + 1}`,
          description: s.descripcion || `Item ${idx + 1}`,
          box_width_m: s.box_width_m || 0.4,
          box_height_m: s.box_height_m || 0.3,
          box_length_m: s.box_length_m || 0.4,
          unit_weight_kg: s.unit_weight_kg || 8.0,
          units_count: Math.min(30, Math.max(5, s.cajas_count || 10)),
          stop_number: (idx % 3) + 1,
        }));

      const plan = await digitalTwinApi.planContainerLoad(
        ctype,
        sampleItems.length > 0 ? sampleItems : [
          { sku: 'VALV-IND-A1', description: 'Válvula 2"', box_width_m: 0.4, box_height_m: 0.3, box_length_m: 0.4, unit_weight_kg: 10, units_count: 40, stop_number: 1 },
          { sku: 'FILT-HYD-500', description: 'Filtro Hidráulico', box_width_m: 0.4, box_height_m: 0.3, box_length_m: 0.4, unit_weight_kg: 7, units_count: 35, stop_number: 2 },
        ],
        enforceLifoRoute
      );
      setLoadPlanData(plan);
      setIsLoadPlannerModalOpen(true);
    } catch (err: any) {
      alert(`Error al calcular cubicaje: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsCalculatingPlan(false);
    }
  };

  const handleRunAIFiller = async () => {
    if (!loadPlanData) return;
    try {
      setIsFillingAI(true);
      const fillRes = await digitalTwinApi.fillContainerAI(loadPlanContainerType, loadPlanData);
      setAiFillerData(fillRes);
      // Combinar cajas colocadas con las sugeridas por IA para visualización completa
      setLoadPlanData({
        ...loadPlanData,
        occupied_volume_pct: fillRes.projected_volume_pct,
        occupied_weight_pct: fillRes.projected_weight_pct,
        total_volume_m3: loadPlanData.total_volume_m3 + fillRes.filler_volume_m3,
        total_weight_kg: loadPlanData.total_weight_kg + fillRes.filler_weight_kg,
        placed_boxes: [...loadPlanData.placed_boxes, ...fillRes.filler_boxes],
      });
    } catch (err: any) {
      alert(`Error en recomendador IA: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsFillingAI(false);
    }
  };

  // Handlers para Doble Candado (SOFT / HARD)
  const handleReserveSlot = async () => {
    if (!inspectedSlot) return;
    try {
      setIsReserving(true);
      await digitalTwinApi.reserveSlot({
        warehouse_id: inspectedSlot.warehouse_id,
        slot_code: inspectedSlot.slot_code,
        reservation_type: reserveForm.reservation_type,
        order_id: reserveForm.order_id,
        organism: reserveForm.organism,
        duration_days: reserveForm.duration_days,
      });
      await loadWarehouseData(selectedWarehouseId);
      setIsReserveModalOpen(false);
      setSyncToast(`Posición ${inspectedSlot.slot_code} bloqueada bajo ${reserveForm.reservation_type}`);
    } catch (err: any) {
      alert(`Error al reservar slot: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsReserving(false);
    }
  };

  const handleReleaseSlot = async () => {
    if (!inspectedSlot) return;
    try {
      await digitalTwinApi.releaseSlot(inspectedSlot.warehouse_id, inspectedSlot.slot_code, true);
      await loadWarehouseData(selectedWarehouseId);
      setSyncToast(`Reserva liberada para ${inspectedSlot.slot_code}`);
    } catch (err: any) {
      alert(`Error al liberar slot: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Handlers para QR
  const handleOpenQRModal = async () => {
    if (!inspectedSlot) return;
    try {
      const qrRes = await digitalTwinApi.generateQRLabel({
        warehouse_id: inspectedSlot.warehouse_id,
        slot_code: inspectedSlot.slot_code,
        sku: inspectedSlot.sku || 'SKU-SAMPLE-2026',
        lote: inspectedSlot.lote || 'LOT-2026-AUTO',
        units_count: inspectedSlot.cajas_count || 24,
      });
      setQrTokenGenerated(qrRes.qr_token);
      setQrScanInput(qrRes.qr_token);
      setIsQRModalOpen(true);
    } catch (err: any) {
      alert(`Error al generar QR: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleExecuteScanQR = async () => {
    if (!qrScanInput) return;
    try {
      setIsScanningQR(true);
      const res = await digitalTwinApi.scanQRReceive(qrScanInput);
      await loadWarehouseData(selectedWarehouseId);
      setSyncToast(`¡Recepción exitosa! ${res.units_count} unidades en ${res.slot_code}`);
      setIsQRModalOpen(false);
    } catch (err: any) {
      alert(`Error al escanear QR: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsScanningQR(false);
    }
  };

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

  const handleSyncRealInventory = async () => {
    try {
      setIsSyncingInventory(true);
      const res = await digitalTwinApi.syncRealInventory({
        warehouse_id: selectedWarehouseId,
        module_scope: moduleScope,
      });
      setSyncToast(res.message);
      setTimeout(() => setSyncToast(null), 6500);
      await loadWarehouseData(selectedWarehouseId);
      await loadWarehouses();
    } catch (err: any) {
      alert(`Error al sincronizar inventario real: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSyncingInventory(false);
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

  // Real-time live deviation preview for slot item modal
  const liveSlotDeviations = useMemo(() => {
    if (!inspectedSlot) return [];
    const devs: string[] = [];
    const rackH = inspectedSlot.rack_height_m || 6.0;
    const levCnt = Math.max(1, inspectedSlot.levels_count || 4);
    const clearH = rackH / levCnt;
    const totVol = slotItemForm.box_width_m * slotItemForm.box_height_m * slotItemForm.box_length_m * slotItemForm.units_count;
    const totPeso = slotItemForm.unit_weight_kg * slotItemForm.units_count;

    if (slotItemForm.box_height_m > clearH) devs.push('EXCESO_ALTURA');
    if (totVol > inspectedSlot.volumen_max_m3) devs.push('EXCESO_VOLUMEN');
    if (totPeso > inspectedSlot.peso_max_kg) devs.push('EXCESO_PESO');
    return devs;
  }, [inspectedSlot, slotItemForm]);

  return (
    <div className={`relative flex flex-col h-[840px] w-full bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-2xl font-sans ${className}`}>
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

          {!isMaritimeScene && (
            <button
              onClick={() => setIsWhDimModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-900/30 hover:bg-sky-900/50 text-sky-300 text-xs font-medium rounded-lg border border-sky-700/50 transition"
              title="Configurar dimensiones de nave (ancho, largo, altura libre)"
            >
              <Ruler className="w-3.5 h-3.5 text-sky-400" />
              <span>Medidas de Nave</span>
            </button>
          )}

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
            onClick={handleSyncRealInventory}
            disabled={isSyncingInventory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg shadow-md transition disabled:opacity-50"
            title="Sincronizar catálogo e inventario real de Calcu en 1 clic"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingInventory ? 'animate-spin' : ''}`} />
            <span>{isSyncingInventory ? 'Sincronizando...' : 'Sincronizar Stock Real'}</span>
          </button>

          <button
            onClick={handleRunAiSlotting}
            disabled={isOptimizingAi}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
            <span>{isOptimizingAi ? 'Optimizando...' : 'Optimizar Slotting (IA)'}</span>
          </button>

          <button
            onClick={() => handleRunLoadPlanner()}
            disabled={isCalculatingPlan}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
            title="Simulador 3D de Cubicaje de Contenedores y Camiones con Relleno IA 98%"
          >
            <Truck className="w-3.5 h-3.5 text-purple-200" />
            <span>Cubicaje &amp; Relleno IA 98%</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/90 rounded-lg border border-slate-700 text-xs">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-[11px] font-semibold text-slate-300">
              {wsConnected ? 'Live WS' : 'Offline'}
            </span>
          </div>

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
            <ambientLight intensity={0.8} />
            <directionalLight
              position={[25, 35, 25]}
              intensity={1.3}
              castShadow
            />
            <pointLight position={[-10, 15, -10]} intensity={0.5} color="#38bdf8" />

            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              maxPolarAngle={Math.PI / 2.05}
              minDistance={3}
              maxDistance={90}
            />

            {isMaritimeScene ? (
              <group>
                <ContainerShipHull />
                {slots.map((slot) => (
                  <MaritimeContainerMesh
                    key={slot.id}
                    slot={slot}
                    isSelected={inspectedSlot?.id === slot.id}
                    onSelect={(s) => handleSelectSlot(s)}
                  />
                ))}
              </group>
            ) : (
              <group>
                <WarehouseNaveMesh
                  width={selectedWarehouse?.width_m || 50}
                  length={selectedWarehouse?.length_m || 70}
                  clearHeight={selectedWarehouse?.clear_height_m || 10.5}
                />
                <RackStructures
                  cuerpos={uniqueCuerpos}
                  slotsByCuerpo={slotsByCuerpo}
                  selectedCuerpo={selectedCuerpo}
                  onSelectRackCuerpo={handleSelectRackCuerpo}
                />
                <InstancedTerrestrialCargo
                  slots={slots}
                  selectedSlotId={inspectedSlot?.id || null}
                  onSelectSlot={handleSelectSlot}
                />
                <EmptyAndBlockedSlotsMesh
                  slots={slots}
                  showEmptySlots={showEmptySlots}
                  selectedSlotId={inspectedSlot?.id || null}
                  onSelectSlot={handleSelectSlot}
                />
              </group>
            )}
          </Canvas>

          {/* Toast / Notification Banner for Sync */}
          {syncToast && (
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2.5 bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncToast}</span>
              <button onClick={() => setSyncToast(null)} className="text-emerald-400 hover:text-white ml-2">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Banner de Recepción en Vivo vía WebSockets */}
          {liveArrivalAlert && (
            <div className="absolute top-16 right-4 z-40 bg-emerald-950/95 border-2 border-emerald-400 text-emerald-100 p-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
              <PackageCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-xs">{liveArrivalAlert.message}</div>
                <div className="text-[11px] text-emerald-300">Posición: {liveArrivalAlert.slot_code} | {liveArrivalAlert.units} unidades asignadas</div>
              </div>
            </div>
          )}

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
                  <span className="text-slate-400">SKU / Ítem:</span>
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
                  <span className="text-slate-400">Bultos / Unidades:</span>
                  <span className="font-bold text-emerald-400">{inspectedSlot.cajas_count || inspectedSlot.cantidad} u.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Medidas de Caja:</span>
                  <span>{inspectedSlot.box_width_m || 0.4}m × {inspectedSlot.box_height_m || 0.3}m × {inspectedSlot.box_length_m || 0.4}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Peso / Volumen:</span>
                  <span>{inspectedSlot.peso_actual_kg} kg | {inspectedSlot.volumen_actual_m3} m³</span>
                </div>

                {/* Insignia Verde: Vinculado a SKU Real de Calcu */}
                {inspectedSlot.real_product_id && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-xs space-y-1.5 mt-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>🔗 Vinculado a SKU Real: {inspectedSlot.sku}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-emerald-200">
                      <div>Costo FOB: <span className="font-semibold text-white">${inspectedSlot.costo_fob?.toFixed(2) ?? '0.00'}</span></div>
                      <div>Costo Landed: <span className="font-semibold text-white">${inspectedSlot.costo_landed_calc?.toFixed(2) ?? '0.00'}</span></div>
                      <div>Margen Bruto: <span className="font-semibold text-white">{inspectedSlot.margen_bruto_pct?.toFixed(1) ?? '0.0'}%</span></div>
                      <div>Cobertura (DOH): <span className="font-semibold text-white">{inspectedSlot.doh_cobertura ?? 45} días</span></div>
                    </div>
                  </div>
                )}

                {inspectedSlot.desvios && (
                  <div className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-300 font-semibold text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>Desvío: {inspectedSlot.desvios}</span>
                  </div>
                )}

                {/* Doble Candado: Estado de Reserva */}
                {inspectedSlot.reservation_type && (
                  <div className={`p-2.5 rounded-lg border text-xs space-y-1 mt-2 ${
                    inspectedSlot.reservation_type === 'HARD_RESERVED'
                      ? 'bg-blue-950/80 border-blue-500 text-blue-200'
                      : 'bg-amber-950/80 border-amber-500 text-amber-200'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{inspectedSlot.reservation_type === 'HARD_RESERVED' ? '🔒 RESERVA DURA INTOCABLE' : '🟡 PRE-RESERVA BLANDA'}</span>
                    </div>
                    <div className="text-[11px] space-y-0.5">
                      <div>Organismo: <span className="font-semibold text-white">{inspectedSlot.reserved_organism}</span></div>
                      <div>Orden/Licitación: <span className="font-mono text-white">{inspectedSlot.reservation_order_id}</span></div>
                      <div>Usuario: <span className="text-white">{inspectedSlot.reserved_by_user}</span></div>
                    </div>
                  </div>
                )}

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
                  onClick={() => setIsSlotItemModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs shadow-md transition"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>

                {inspectedSlot.reservation_type ? (
                  <button
                    onClick={handleReleaseSlot}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-xs shadow-md transition"
                    title="Liberar candado de reserva"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Liberar</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsReserveModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs shadow-md transition"
                    title="Bloquear posición bajo licitación SICE o cotización B2B"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Reservar</span>
                  </button>
                )}

                <button
                  onClick={handleOpenQRModal}
                  className="px-2 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-xs shadow-md transition"
                  title="Generar o Escanear Etiqueta QR Criptográfica HMAC"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    setTransferTargetWh(isMaritimeScene ? 'DEP-CENTRAL-MVD' : selectedWarehouseId);
                    setTransferTargetSlot('A-01-01-01');
                    setTransferQty(inspectedSlot.cantidad);
                    setIsTransferModalOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-xs shadow-md transition"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Mover</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom Left Filter and Search Controls */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar coord (ej. A-01-01)..."
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
                  <span className="text-slate-400">Vencimientos Próximos:</span>
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
      {/* MODAL: CONFIGURAR MEDIDAS DE NAVE / GALPÓN */}
      {/* ==================================================== */}
      {isWhDimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-sky-500/40 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm">Medidas Paramétricas de Nave</h3>
              </div>
              <button
                onClick={() => setIsWhDimModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400">
                Ajuste las dimensiones físicas reales del edificio en metros para redimensionar el piso 3D y la volumetría de almacenamiento.
              </p>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Ancho de Nave (m):</label>
                <input
                  type="number"
                  step="0.5"
                  value={whDimForm.width_m}
                  onChange={(e) => setWhDimForm({ ...whDimForm, width_m: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Largo de Nave (m):</label>
                <input
                  type="number"
                  step="0.5"
                  value={whDimForm.length_m}
                  onChange={(e) => setWhDimForm({ ...whDimForm, length_m: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Altura Libre de Techo (m):</label>
                <input
                  type="number"
                  step="0.5"
                  value={whDimForm.clear_height_m}
                  onChange={(e) => setWhDimForm({ ...whDimForm, clear_height_m: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>Superficie Teórica:</span>
                  <span className="font-bold text-sky-400">
                    {(whDimForm.width_m * whDimForm.length_m).toFixed(2)} m²
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Volumen Total Techo:</span>
                  <span className="font-bold text-emerald-400">
                    {(whDimForm.width_m * whDimForm.length_m * whDimForm.clear_height_m).toFixed(2)} m³
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsWhDimModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveWarehouseDimensions}
                disabled={isSavingWhDim}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition"
              >
                {isSavingWhDim ? 'Guardando...' : 'Aplicar a Nave 3D'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: INGENIERÍA DE ESTANTERÍA / CUERPO */}
      {/* ==================================================== */}
      {isRackEngModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-sky-500/40 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm">
                  Ingeniería Estructural: Cuerpo {selectedRackCuerpo}
                </h3>
              </div>
              <button
                onClick={() => setIsRackEngModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Ancho de Rack (m):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rackEngForm.rack_width_m}
                    onChange={(e) => setRackEngForm({ ...rackEngForm, rack_width_m: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Alto Total (m):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rackEngForm.rack_height_m}
                    onChange={(e) => setRackEngForm({ ...rackEngForm, rack_height_m: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Profundidad (m):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rackEngForm.rack_depth_m}
                    onChange={(e) => setRackEngForm({ ...rackEngForm, rack_depth_m: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Cantidad de Niveles:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={rackEngForm.levels_count}
                    onChange={(e) => setRackEngForm({ ...rackEngForm, levels_count: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Capacidad Estructural Máxima (kg):</label>
                <input
                  type="number"
                  step="100"
                  value={rackEngForm.max_rack_weight_kg}
                  onChange={(e) => setRackEngForm({ ...rackEngForm, max_rack_weight_kg: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>Altura Libre por Nivel:</span>
                  <span className="font-bold text-sky-400">
                    {(rackEngForm.rack_height_m / Math.max(1, rackEngForm.levels_count)).toFixed(2)} m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Carga Máxima por Nivel:</span>
                  <span className="font-bold text-emerald-400">
                    {(rackEngForm.max_rack_weight_kg / Math.max(1, rackEngForm.levels_count)).toFixed(1)} kg
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsRackEngModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRackEngineering}
                disabled={isSavingRackEng}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition"
              >
                {isSavingRackEng ? 'Guardando...' : 'Aplicar al Cuerpo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ESPECIFICACIONES DE CAJA & SKU REAL */}
      {/* ==================================================== */}
      {isSlotItemModalOpen && inspectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">
                  Inventario Real & Geometría de Caja ({inspectedSlot.slot_code})
                </h3>
              </div>
              <button
                onClick={() => setIsSlotItemModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Vincular con Producto del Catálogo Real:</label>
                <select
                  value={slotItemForm.real_product_id || ''}
                  onChange={(e) => {
                    const prodId = e.target.value ? Number(e.target.value) : null;
                    const prod = realProducts.find((p) => p.id === prodId);
                    setSlotItemForm({
                      ...slotItemForm,
                      real_product_id: prodId,
                      descripcion: prod ? prod.nombre : slotItemForm.descripcion,
                    });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                >
                  <option value="">-- Sin vincular / Ítem genérico --</option>
                  {realProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.nombre} (${p.precio_lista})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Ancho Caja (m):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={slotItemForm.box_width_m}
                    onChange={(e) => setSlotItemForm({ ...slotItemForm, box_width_m: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Alto Caja (m):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={slotItemForm.box_height_m}
                    onChange={(e) => setSlotItemForm({ ...slotItemForm, box_height_m: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Largo Caja (m):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={slotItemForm.box_length_m}
                    onChange={(e) => setSlotItemForm({ ...slotItemForm, box_length_m: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Peso Unitario (kg):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={slotItemForm.unit_weight_kg}
                    onChange={(e) => setSlotItemForm({ ...slotItemForm, unit_weight_kg: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Cantidad de Cajas / Bultos:</label>
                  <input
                    type="number"
                    min="0"
                    value={slotItemForm.units_count}
                    onChange={(e) => setSlotItemForm({ ...slotItemForm, units_count: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Lote:</label>
                  <input
                    type="text"
                    value={slotItemForm.lote || ''}
                    onChange={(e) => setSlotItemForm({ ...slotItemForm, lote: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Descripción:</label>
                  <input
                    type="text"
                    value={slotItemForm.descripcion || ''}
                    onChange={(e) => setSlotItemForm({ ...slotItemForm, descripcion: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              {/* Real-time Volumetric & Deviation Preview */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Volumen Total Calculado:</span>
                  <span className="font-bold text-sky-400">
                    {(slotItemForm.box_width_m * slotItemForm.box_height_m * slotItemForm.box_length_m * slotItemForm.units_count).toFixed(3)} m³
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Peso Total Calculado:</span>
                  <span className="font-bold text-emerald-400">
                    {(slotItemForm.unit_weight_kg * slotItemForm.units_count).toFixed(1)} kg
                  </span>
                </div>

                {liveSlotDeviations.length > 0 ? (
                  <div className="pt-1.5 border-t border-slate-800 flex flex-wrap gap-1.5">
                    {liveSlotDeviations.map((dev) => (
                      <span key={dev} className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold">
                        ⚠️ {dev}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="pt-1.5 border-t border-slate-800 text-[11px] text-emerald-400 font-medium">
                    ✓ Sin desvíos físicos (cumple límites de altura, volumen y carga).
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsSlotItemModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSlotItemSpecs}
                disabled={isSavingSlotItem}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition"
              >
                {isSavingSlotItem ? 'Guardando...' : 'Guardar y Recalcular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: SIMULADOR 3D DE CUBICAJE & RELLENO IA 98% */}
      {/* ==================================================== */}
      {isLoadPlannerModalOpen && loadPlanData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-violet-500/40 rounded-2xl max-w-4xl w-full p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-violet-400" />
                <h3 className="font-bold text-white text-sm">
                  Simulador 3D de Cubicaje ("Container & Truck Load Planner")
                </h3>
              </div>
              <button onClick={() => setIsLoadPlannerModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de Contenedor y Opciones */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Contenedor / Vehículo:</span>
                {(['40HQ', '20ST', 'TRUCK_3PL'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setLoadPlanContainerType(t);
                      handleRunLoadPlanner(t);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      loadPlanContainerType === t
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {t === '40HQ' ? 'Contenedor 40HQ' : t === '20ST' ? 'Contenedor 20ST' : 'Camión 3PL'}
                  </button>
                ))}
              </div>

              {loadPlanContainerType === 'TRUCK_3PL' && (
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enforceLifoRoute}
                    onChange={(e) => {
                      setEnforceLifoRoute(e.target.checked);
                      handleRunLoadPlanner();
                    }}
                    className="accent-violet-600"
                  />
                  <span>Orden LIFO por Ruta</span>
                </label>
              )}

              <button
                onClick={handleRunAIFiller}
                disabled={isFillingAI || loadPlanData.occupied_volume_pct >= 97.5}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-md transition disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                <span>{isFillingAI ? 'Optimizando IA...' : '💡 Rellenar Hueco Libre al 98% (IA)'}</span>
              </button>
            </div>

            {/* Métricas de Ocupación y Ejes */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Ocupación Volumétrica</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-mono font-bold text-violet-400">
                    {loadPlanData.occupied_volume_pct.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {loadPlanData.total_volume_m3.toFixed(1)} / {loadPlanData.specs.volume_m3} m³
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      loadPlanData.occupied_volume_pct >= 90 ? 'bg-emerald-500' : 'bg-violet-500'
                    }`}
                    style={{ width: `${Math.min(100, loadPlanData.occupied_volume_pct)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Carga en Peso</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-mono font-bold text-sky-400">
                    {loadPlanData.occupied_weight_pct.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {loadPlanData.total_weight_kg.toFixed(0)} / {loadPlanData.specs.max_weight_kg} kg
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-sky-500"
                    style={{ width: `${Math.min(100, loadPlanData.occupied_weight_pct)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Cajas Embaladas</span>
                <div className="text-xl font-mono font-bold text-emerald-400">
                  {loadPlanData.placed_boxes_count} u.
                </div>
                <p className="text-[10px] text-slate-400">
                  {loadPlanData.unfitted_boxes_count} no entraron por límite
                </p>
              </div>

              {loadPlanData.axle_distribution ? (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Distribución por Eje</span>
                  <div className="text-[11px] font-mono text-slate-300">
                    Eje Del: <span className="font-bold text-white">{loadPlanData.axle_distribution.front_axle_kg.toFixed(0)} kg</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-300">
                    Eje Tras: <span className="font-bold text-white">{loadPlanData.axle_distribution.rear_axle_kg.toFixed(0)} kg</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400">✓ Distribución Equilibrada</span>
                </div>
              ) : (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Margen Contribución IA</span>
                  <div className="text-xl font-mono font-bold text-emerald-400">
                    +${aiFillerData ? aiFillerData.estimated_margin_contribution_usd.toFixed(0) : '0'} USD
                  </div>
                  <p className="text-[10px] text-slate-400">Beneficio neto flete aprovechado</p>
                </div>
              )}
            </div>

            {/* Rationale de IA si se ejecutó el relleno */}
            {aiFillerData && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs space-y-1 text-emerald-200">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sugerencia del Optimizador IA (qwen2.5 / Heurística Logística):</span>
                </div>
                <p className="text-[11px] leading-relaxed">{aiFillerData.ai_rationale}</p>
              </div>
            )}

            {/* Listado de Cajas Colocadas */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Coordenadas de Estiba 3D ({loadPlanData.placed_boxes.length} cajas ubicadas)</span>
                <span className="text-[10px] text-slate-400">Verde: Sugerido por IA</span>
              </h4>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="py-1.5 px-3">Caja ID</th>
                      <th className="py-1.5 px-3">SKU</th>
                      <th className="py-1.5 px-3">Coord (X, Y, Z)</th>
                      <th className="py-1.5 px-3">Medidas (m)</th>
                      <th className="py-1.5 px-3">Peso</th>
                      <th className="py-1.5 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {loadPlanData.placed_boxes.slice(0, 100).map((b: PlacedBox3D) => (
                      <tr key={b.box_id} className={b.is_filler ? 'bg-emerald-950/30' : ''}>
                        <td className="py-1 px-3 font-mono text-slate-400">{b.box_id}</td>
                        <td className="py-1 px-3 font-semibold text-slate-200">{b.sku}</td>
                        <td className="py-1 px-3 font-mono text-slate-300">
                          {b.x_m.toFixed(2)}, {b.y_m.toFixed(2)}, {b.z_m.toFixed(2)}
                        </td>
                        <td className="py-1 px-3 text-slate-400">
                          {b.box_width_m} × {b.box_height_m} × {b.box_length_m}
                        </td>
                        <td className="py-1 px-3 font-mono text-slate-300">{b.unit_weight_kg} kg</td>
                        <td className="py-1 px-3">
                          {b.is_filler ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              IA-FILL 98%
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              Base
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsLoadPlannerModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: RESERVA FÍSICA 3D (DOBLE CANDADO) */}
      {/* ==================================================== */}
      {isReserveModalOpen && inspectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-blue-500/40 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm">Reserva Física 3D: Doble Candado</h3>
              </div>
              <button onClick={() => setIsReserveModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1.5 font-semibold">Tipo de Candado de Reserva:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReserveForm({ ...reserveForm, reservation_type: 'HARD_RESERVED' })}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      reserveForm.reservation_type === 'HARD_RESERVED'
                        ? 'bg-blue-950 border-blue-500 text-blue-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>🔵 Reserva Dura</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Licitación ganada SICE. Bloqueo 423 intocable.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReserveForm({ ...reserveForm, reservation_type: 'SOFT_RESERVED' })}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      reserveForm.reservation_type === 'SOFT_RESERVED'
                        ? 'bg-amber-950 border-amber-500 text-amber-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>🟡 Pre-Reserva</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Cotización B2B caliente. Advertencia visual.</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Organismo Público o Cliente B2B:</label>
                <input
                  type="text"
                  value={reserveForm.organism}
                  onChange={(e) => setReserveForm({ ...reserveForm, organism: e.target.value })}
                  placeholder="ej. Intendencia de Montevideo, UTE, Hospital Maciel"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">ID Licitación / Cotización:</label>
                <input
                  type="text"
                  value={reserveForm.order_id}
                  onChange={(e) => setReserveForm({ ...reserveForm, order_id: e.target.value })}
                  placeholder="ej. SICE-LIC-2026-088"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Plazo de Reserva (días):</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={reserveForm.duration_days}
                  onChange={(e) => setReserveForm({ ...reserveForm, duration_days: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsReserveModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleReserveSlot}
                disabled={isReserving}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition"
              >
                {isReserving ? 'Bloqueando...' : 'Confirmar Candado en 3D'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: RECEPCIÓN INTELIGENTE CON QR FIRMADO HMAC */}
      {/* ==================================================== */}
      {isQRModalOpen && inspectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-sm">Etiqueta QR Firmada HMAC-SHA256</h3>
              </div>
              <button onClick={() => setIsQRModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-purple-900/50 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-purple-300">Token Criptográfico Generado:</span>
                <p className="font-mono text-[11px] text-white break-all bg-slate-900 p-2 rounded border border-slate-800">
                  {qrTokenGenerated}
                </p>
                <p className="text-[10px] text-slate-400">
                  Firmado con clave maestra SHA256 contra adulteración física.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Escanear / Validar Token QR:</label>
                <textarea
                  rows={2}
                  value={qrScanInput}
                  onChange={(e) => setQrScanInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cerrar
              </button>
              <button
                onClick={handleExecuteScanQR}
                disabled={isScanningQR}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg transition"
              >
                {isScanningQR ? 'Validando...' : '📷 Confirmar Ingreso en Vivo'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                              handleSelectSlot(s);
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
