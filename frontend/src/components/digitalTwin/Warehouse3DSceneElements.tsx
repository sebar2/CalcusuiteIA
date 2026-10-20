import React, { useMemo, useRef, useLayoutEffect, useEffect, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CanvasLabelSprite } from './CanvasLabelSprite';
import type { DigitalTwinWarehouse, DigitalTwinSlot } from '../../services/digitalTwinApi';

// ==========================================
// 3D OBJECTS & MESHES (THREE.JS) - HIGH FIDELITY PBR
// ==========================================

// Atmósfera de galpón industrial PBR con niebla suave y balance de luces
const SceneAtmosphere: React.FC<{ isMaritime: boolean }> = React.memo(({ isMaritime }) => {
  const { scene } = useThree();

  useEffect(() => {
    if (isMaritime) {
      scene.fog = new THREE.FogExp2('#090d16', 0.012);
      scene.background = new THREE.Color('#060911');
    } else {
      scene.fog = new THREE.FogExp2('#0b101b', 0.014);
      scene.background = new THREE.Color('#080d1a');
    }
    return () => {
      scene.fog = null;
    };
  }, [scene, isMaritime]);

  return null;
});

// Autoelevador / Forklift Industrial Detallado para pasillos de almacén
const IndustrialForklift: React.FC<{
  position: [number, number, number];
  rotation?: [x: number, y: number, z: number];
}> = React.memo(({ position, rotation }) => {
  return (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      {/* Chasis principal (Amarillo Industrial de Seguridad) */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.5, 1.7]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.35} metalness={0.4} />
      </mesh>

      {/* Contrapeso trasero pesado (Gris oscuro / fundición) */}
      <mesh position={[0, 0.55, -0.65]} castShadow>
        <boxGeometry args={[1.05, 0.6, 0.45]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.6} />
      </mesh>

      {/* Cabina de seguridad antivuelco (Roll cage jaula de acero) */}
      {[
        [-0.45, 0.25],
        [0.45, 0.25],
        [-0.45, -0.35],
        [0.45, -0.35],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.15, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 1.6, -0.05]} castShadow>
        <boxGeometry args={[0.95, 0.04, 0.7]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* Asiento del operador */}
      <mesh position={[0, 0.85, -0.05]}>
        <boxGeometry args={[0.45, 0.35, 0.4]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>
      {/* Volante de dirección */}
      <mesh position={[0, 1.05, 0.2]} rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[0.12, 0.02, 8, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} />
      </mesh>

      {/* Mástil frontal vertical de elevación */}
      <mesh position={[-0.32, 1.25, 0.9]} castShadow>
        <boxGeometry args={[0.06, 1.9, 0.08]} />
        <meshStandardMaterial color="#0284c7" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0.32, 1.25, 0.9]} castShadow>
        <boxGeometry args={[0.06, 1.9, 0.08]} />
        <meshStandardMaterial color="#0284c7" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Uñas / Horquillas (Forks) de acero forjado */}
      <mesh position={[-0.22, 0.05, 1.4]} castShadow>
        <boxGeometry args={[0.08, 0.03, 0.95]} />
        <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[0.22, 0.05, 1.4]} castShadow>
        <boxGeometry args={[0.08, 0.03, 0.95]} />
        <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* 4 Ruedas industriales de caucho macizo */}
      {[
        [-0.55, 0.22, 0.55],
        [0.55, 0.22, 0.55],
        [-0.5, 0.18, -0.55],
        [0.5, 0.18, -0.55],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[y, y, 0.18, 16]} />
          <meshStandardMaterial color="#020617" roughness={0.9} />
        </mesh>
      ))}

      {/* Faro centellante / Baliza de seguridad estroboscópica */}
      <mesh position={[0, 1.66, -0.3]}>
        <cylinderGeometry args={[0.04, 0.05, 0.08, 8]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
});

// Suelo de Concreto Pulido Industrial con Señalética Vial PBR y Dársenas
const WarehouseNaveMesh: React.FC<{
  width: number;
  length: number;
  clearHeight: number;
}> = React.memo(({ width, length, clearHeight }) => {
  // Generar marcas viales (franjas amarillas de circulación en pasillos y perímetros)
  const aisleStripes = useMemo(() => {
    const stripes: Array<{ x: number; z: number; w: number; l: number; color: string }> = [];

    // Franja perimetral de seguridad continua (Amarillo Tráfico #eab308)
    stripes.push({ x: 0, z: -length / 2 + 1.2, w: width - 4, l: 0.15, color: '#eab308' });
    stripes.push({ x: 0, z: length / 2 - 1.2, w: width - 4, l: 0.15, color: '#eab308' });
    stripes.push({ x: -width / 2 + 1.8, z: 0, w: 0.15, l: length - 4, color: '#eab308' });
    stripes.push({ x: width / 2 - 1.8, z: 0, w: 0.15, l: length - 4, color: '#eab308' });

    // Franjas de circulación central para autoelevador (Forklift Highway)
    stripes.push({ x: -2, z: 0, w: 0.12, l: length * 0.75, color: '#fbbf24' });
    stripes.push({ x: 2, z: 0, w: 0.12, l: length * 0.75, color: '#fbbf24' });

    // Pasos cebra / Zona de precaución peatonal frente a dársenas
    for (let zi = -12; zi <= 12; zi += 1.8) {
      stripes.push({ x: -width / 2 + 4.5, z: zi, w: 2.2, l: 0.45, color: '#facc15' });
    }

    return stripes;
  }, [width, length]);

  return (
    <group position={[0, 0, 0]}>
      {/* Piso de concreto pulido PBR con baja rugosidad y ligera reflectividad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial
          color="#0a0f1d"
          roughness={0.38}
          metalness={0.12}
        />
      </mesh>

      {/* Grid Helper sutil para orientación técnica */}
      <gridHelper args={[Math.max(width, length), 24, '#0284c7', '#1e293b']} position={[0, 0.005, 0]} />

      {/* Franjas viales industriales reflectivas en el suelo */}
      {aisleStripes.map((s, idx) => (
        <mesh key={idx} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.015, s.z]} receiveShadow>
          <planeGeometry args={[s.w, s.l]} />
          <meshStandardMaterial
            color={s.color}
            roughness={0.5}
            metalness={0.1}
            emissive={s.color}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}

      {/* Columnas estructurales perimetrales con refuerzo base amarillo */}
      {[
        [-width / 2 + 1.2, -length / 2 + 1.2],
        [width / 2 - 1.2, -length / 2 + 1.2],
        [-width / 2 + 1.2, length / 2 - 1.2],
        [width / 2 - 1.2, length / 2 - 1.2],
        [-width / 2 + 1.2, 0],
        [width / 2 - 1.2, 0],
      ].map(([cx, cz], i) => (
        <group key={i} position={[cx, 0, cz]}>
          {/* Protección antichoque de base (Guard post amarillo vial) */}
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.7, 16]} />
            <meshStandardMaterial color="#eab308" roughness={0.4} metalness={0.3} />
          </mesh>
          {/* Columna en H de acero estructural */}
          <mesh position={[0, clearHeight / 2, 0]} castShadow>
            <boxGeometry args={[0.5, clearHeight, 0.5]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Área de Dársenas de Carga y Descarga (Loading Docks) */}
      <group position={[-width / 2 - 2.8, 0, 0]}>
        {/* Plataforma de hormigón exterior */}
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[5.6, 0.16, length * 0.85]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.2} />
        </mesh>

        {/* Portones seccionales de muelle y camiones atracados */}
        {[-9, 0, 9].map((zPos, idx) => (
          <group key={idx} position={[1.4, 0, zPos]}>
            {/* Marco de portón seccional */}
            <mesh position={[0, 2.2, 0]} castShadow>
              <boxGeometry args={[0.2, 4.4, 3.8]} />
              <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Abrigo de muelle de goma negra selladora */}
            <mesh position={[-0.2, 2.2, 0]}>
              <boxGeometry args={[0.3, 4.2, 3.6]} />
              <meshStandardMaterial color="#090d16" roughness={0.9} />
            </mesh>
            {/* Semáforo indicador de muelle (Verde disponible / Rojo operando) */}
            <mesh position={[0.2, 3.5, 2.1]}>
              <boxGeometry args={[0.15, 0.45, 0.2]} />
              <meshStandardMaterial color="#020617" />
            </mesh>
            <mesh position={[0.28, 3.6, 2.1]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.5} />
            </mesh>
            <mesh position={[0.28, 3.4, 2.1]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Autoelevador operativo en la zona de maniobras */}
      <IndustrialForklift position={[-width / 2 + 5.5, 0, 4.5]} rotation={[0, Math.PI / 6, 0]} />
    </group>
  );
});

// Estructuras de Racks Industriales: Montantes azules, travesaños naranjas y malla trasera
const RackStructures: React.FC<{
  cuerpos: string[];
  slotsByCuerpo: Record<string, DigitalTwinSlot[]>;
  selectedCuerpo: string;
  onSelectRackCuerpo: (cuerpo: string, sampleSlot: DigitalTwinSlot) => void;
}> = React.memo(({ cuerpos, slotsByCuerpo, selectedCuerpo, onSelectRackCuerpo }) => {
  const postsMeshRef = useRef<THREE.InstancedMesh>(null);
  const beamsMeshRef = useRef<THREE.InstancedMesh>(null);
  const backMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const postColor = useMemo(() => new THREE.Color(), []);
  const beamColor = useMemo(() => new THREE.Color(), []);
  const meshColor = useMemo(() => new THREE.Color(), []);

  // Recolectar datos dimensionales de todos los racks
  const { allRacks, totalPosts, totalBeams, totalBacks } = useMemo(() => {
    const list: Array<{
      cuerpo: string;
      rackNum: number;
      sample: DigitalTwinSlot;
      posX: number;
      rw: number;
      rh: number;
      rd: number;
      lev: number;
      levelH: number;
      isSelected: boolean;
    }> = [];

    let postsCount = 0;
    let beamsCount = 0;
    let backsCount = 0;

    cuerpos.forEach((cuerpo) => {
      const cuerpoSlots = slotsByCuerpo[cuerpo] || [];
      if (cuerpoSlots.length === 0) return;
      const sample = cuerpoSlots[0];
      const cuerpoIdx = Math.max(0, cuerpo.charCodeAt(0) - 65);
      const rw = sample.rack_width_m || 2.4;
      const rh = sample.rack_height_m || 6.0;
      const rd = sample.rack_depth_m || 1.2;
      const lev = Math.max(1, sample.levels_count || 4);
      const levelH = rh / lev;
      const rackNums = Array.from(new Set(cuerpoSlots.map((s) => parseInt(s.rack.replace(/\D/g, '')) || 1)));
      const isSelected = selectedCuerpo === cuerpo;

      rackNums.forEach((rackNum) => {
        const posX = cuerpoIdx * (rd * 2 + 4.8) + (rackNum - 1) * (rd + 1.6) - 12;
        list.push({ cuerpo, rackNum, sample, posX, rw, rh, rd, lev, levelH, isSelected });
        postsCount += 4;
        beamsCount += (lev + 1) * 2; // Doble travesaño (frontal y trasero)
        backsCount += 1;
      });
    });

    return { allRacks: list, totalPosts: postsCount, totalBeams: beamsCount, totalBacks: backsCount };
  }, [cuerpos, slotsByCuerpo, selectedCuerpo]);

  useLayoutEffect(() => {
    if (!postsMeshRef.current || !beamsMeshRef.current || !backMeshRef.current) return;
    const postsMesh = postsMeshRef.current;
    const beamsMesh = beamsMeshRef.current;
    const backsMesh = backMeshRef.current;

    let pIdx = 0;
    let bIdx = 0;
    let mIdx = 0;

    allRacks.forEach((rack) => {
      const { posX, rw, rh, rd, lev, levelH, isSelected } = rack;

      // 4 Montantes verticales metálicos perforados (Azul Industrial #0284c7)
      [-rd / 2, rd / 2].forEach((xOff) => {
        [-rw / 2, rw / 2].forEach((zOff) => {
          dummy.position.set(posX + xOff, rh / 2, zOff);
          dummy.scale.set(0.08, rh, 0.08);
          dummy.updateMatrix();
          postsMesh.setMatrixAt(pIdx, dummy.matrix);
          postColor.set(isSelected ? '#38bdf8' : '#0369a1');
          postsMesh.setColorAt(pIdx, postColor);
          pIdx++;
        });
      });

      // Travesaños horizontales dobles de alta resistencia (Naranja Industrial #ea580c)
      for (let k = 0; k <= lev; k++) {
        // Travesaño frontal
        dummy.position.set(posX + rd / 2, k * levelH + 0.04, 0);
        dummy.scale.set(0.06, 0.09, rw);
        dummy.updateMatrix();
        beamsMesh.setMatrixAt(bIdx, dummy.matrix);
        beamColor.set(isSelected ? '#fbbf24' : '#ea580c');
        beamsMesh.setColorAt(bIdx, beamColor);
        bIdx++;

        // Travesaño trasero
        dummy.position.set(posX - rd / 2, k * levelH + 0.04, 0);
        dummy.scale.set(0.06, 0.09, rw);
        dummy.updateMatrix();
        beamsMesh.setMatrixAt(bIdx, dummy.matrix);
        beamColor.set(isSelected ? '#fbbf24' : '#ea580c');
        beamsMesh.setColorAt(bIdx, beamColor);
        bIdx++;
      }

      // Malla de seguridad anticaída trasera
      dummy.position.set(posX - rd / 2 - 0.02, rh / 2, 0);
      dummy.scale.set(0.01, rh * 0.95, rw * 0.98);
      dummy.updateMatrix();
      backsMesh.setMatrixAt(mIdx, dummy.matrix);
      meshColor.set(isSelected ? '#38bdf8' : '#334155');
      backsMesh.setColorAt(mIdx, meshColor);
      mIdx++;
    });

    postsMesh.instanceMatrix.needsUpdate = true;
    if (postsMesh.instanceColor) postsMesh.instanceColor.needsUpdate = true;

    beamsMesh.instanceMatrix.needsUpdate = true;
    if (beamsMesh.instanceColor) beamsMesh.instanceColor.needsUpdate = true;

    backsMesh.instanceMatrix.needsUpdate = true;
    if (backsMesh.instanceColor) backsMesh.instanceColor.needsUpdate = true;
  }, [allRacks, dummy, postColor, beamColor, meshColor]);

  return (
    <group>
      {/* Montantes verticales */}
      {totalPosts > 0 && (
        <instancedMesh
          ref={postsMeshRef}
          args={[undefined, undefined, totalPosts]}
          frustumCulled={false}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.3} metalness={0.7} />
        </instancedMesh>
      )}

      {/* Travesaños naranjas */}
      {totalBeams > 0 && (
        <instancedMesh
          ref={beamsMeshRef}
          args={[undefined, undefined, totalBeams]}
          frustumCulled={false}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.35} metalness={0.5} />
        </instancedMesh>
      )}

      {/* Malla metálica de seguridad trasera */}
      {totalBacks > 0 && (
        <instancedMesh
          ref={backMeshRef}
          args={[undefined, undefined, totalBacks]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial wireframe transparent opacity={0.25} />
        </instancedMesh>
      )}

      {/* Hitboxes livianas para selección y etiquetas 3D nativas */}
      {allRacks.map((rack) => (
        <group
          key={`${rack.cuerpo}-${rack.rackNum}`}
          position={[rack.posX, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectRackCuerpo(rack.cuerpo, rack.sample);
          }}
        >
          <mesh position={[0, rack.rh / 2, 0]}>
            <boxGeometry args={[rack.rd * 1.1, rack.rh, rack.rw * 1.1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {(rack.isSelected || rack.rackNum === 1) && (
            <CanvasLabelSprite
              text={`Cuerpo ${rack.cuerpo} - R${rack.rackNum}`}
              position={[0, rack.rh + 0.45, 0]}
              color={rack.isSelected ? '#7dd3fc' : '#cbd5e1'}
              background={rack.isSelected ? 'rgba(8, 47, 73, 0.92)' : 'rgba(15, 23, 42, 0.88)'}
              border={rack.isSelected ? '#38bdf8' : '#334155'}
            />
          )}
        </group>
      ))}
    </group>
  );
});

// Pallets de Madera Europeos y Cajas Corrugadas PBR en InstancedMesh
const InstancedTerrestrialCargo: React.FC<{
  slots: DigitalTwinSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
}> = React.memo(({ slots, selectedSlotId, onSelectSlot }) => {
  const boxesMeshRef = useRef<THREE.InstancedMesh>(null);
  const palletsMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const boxColor = useMemo(() => new THREE.Color(), []);
  const palletColor = useMemo(() => new THREE.Color('#78350f'), []); // Madera marrón nogal/pino

  const occupiedSlots = useMemo(() => {
    return slots.filter((s) => s.estado === 'OCUPADA' || s.estado === 'RESERVADA');
  }, [slots]);

  useLayoutEffect(() => {
    if (!boxesMeshRef.current || !palletsMeshRef.current) return;
    const boxesMesh = boxesMeshRef.current;
    const palletsMesh = palletsMeshRef.current;

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
      const posZ = (slot.posicion - 2) * (rw / 3.0);

      // 1. Pallet Europeo de base de madera (altura 0.08 m)
      dummy.position.set(posX, (slot.nivel - 1) * levelH + 0.06, posZ);
      dummy.scale.set(Math.min(rd * 0.95, bw * 1.08), 0.08, Math.min(rw / 3.05, bl * 1.08));
      dummy.updateMatrix();
      palletsMesh.setMatrixAt(i, dummy.matrix);
      palletsMesh.setColorAt(i, palletColor);

      // 2. Bloque de Cajas de Cartón Corrugado sobre el pallet
      dummy.position.set(posX, (slot.nivel - 1) * levelH + 0.12 + bh / 2, posZ);
      dummy.scale.set(bw, bh, bl);
      dummy.updateMatrix();
      boxesMesh.setMatrixAt(i, dummy.matrix);

      // Clasificación de color PBR según criticidad y estado operativo
      let hexColor = '#b45309'; // Cartón kraft marrón natural por defecto
      if (slot.id === selectedSlotId) {
        hexColor = '#38bdf8'; // Cyan brillante inspeccionado
      } else if (slot.reservation_type === 'HARD_RESERVED') {
        hexColor = '#2563eb'; // Azul eléctrico Licitaciones / SICE
      } else if (slot.reservation_type === 'SOFT_RESERVED') {
        hexColor = '#f59e0b'; // Ámbar Cotizaciones B2B
      } else if (slot.desvios) {
        hexColor = '#ec4899'; // Magenta desviación física
      } else if (slot.rop_status === 'CRITICO_ROP') {
        hexColor = '#ef4444'; // Rojo crítico ROP
      } else if (slot.rop_status === 'ALERTA_DOH') {
        hexColor = '#ea580c'; // Naranja alerta DOH
      } else if (slot.rop_status === 'OPTIMO') {
        hexColor = '#059669'; // Verde esmeralda óptimo
      }

      boxColor.set(hexColor);
      boxesMesh.setColorAt(i, boxColor);
    });

    boxesMesh.instanceMatrix.needsUpdate = true;
    if (boxesMesh.instanceColor) boxesMesh.instanceColor.needsUpdate = true;

    palletsMesh.instanceMatrix.needsUpdate = true;
    if (palletsMesh.instanceColor) palletsMesh.instanceColor.needsUpdate = true;
  }, [occupiedSlots, selectedSlotId, dummy, boxColor, palletColor]);

  if (occupiedSlots.length === 0) return null;

  return (
    <group>
      {/* Tarima / Pallet Europeo de madera */}
      <instancedMesh
        ref={palletsMeshRef}
        args={[undefined, undefined, occupiedSlots.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.8} metalness={0.05} />
      </instancedMesh>

      {/* Cajas de mercancía apiladas */}
      <instancedMesh
        ref={boxesMeshRef}
        args={[undefined, undefined, occupiedSlots.length]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          const instanceId = e.instanceId;
          if (instanceId !== undefined && occupiedSlots[instanceId]) {
            onSelectSlot(occupiedSlots[instanceId]);
          }
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.55} metalness={0.15} />
      </instancedMesh>
    </group>
  );
});

// Modo Holográfico / Wireframe Brillante para Posiciones Vacías y Bloqueadas
const EmptyAndBlockedSlotsMesh: React.FC<{
  slots: DigitalTwinSlot[];
  showEmptySlots: boolean;
  selectedSlotId: string | null;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
}> = React.memo(({ slots, showEmptySlots, selectedSlotId, onSelectSlot }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const targetSlots = useMemo(() => {
    return slots.filter((s) => {
      if (s.estado === 'OCUPADA') return false;
      if (s.estado === 'VACIA' && !showEmptySlots) return false;
      return true;
    });
  }, [slots, showEmptySlots]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    targetSlots.forEach((slot, i) => {
      const cuerpoIdx = Math.max(0, slot.cuerpo.charCodeAt(0) - 65);
      const rackNum = parseInt(slot.rack.replace(/\D/g, '')) || 1;
      const rw = slot.rack_width_m || 2.4;
      const rh = slot.rack_height_m || 6.0;
      const rd = slot.rack_depth_m || 1.2;
      const lev = Math.max(1, slot.levels_count || 4);
      const levelH = rh / lev;

      const posX = cuerpoIdx * (rd * 2 + 4.8) + (rackNum - 1) * (rd + 1.6) - 12;
      const posY = (slot.nivel - 1) * levelH + levelH * 0.45;
      const posZ = (slot.posicion - 2) * (rw / 3.0);

      dummy.position.set(posX, posY, posZ);
      dummy.scale.set(rd * 0.85, levelH * 0.75, rw / 3.2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const isBlocked = slot.estado === 'BLOQUEADA';
      const isSelected = slot.id === selectedSlotId;

      if (isSelected) {
        color.set('#38bdf8'); // Neón cian
      } else if (isBlocked) {
        color.set('#ef4444'); // Rojo advertencia
      } else {
        color.set('#10b981'); // Verde neón translúcido para posiciones vacías listas
      }
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [targetSlots, selectedSlotId, dummy, color]);

  if (targetSlots.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, targetSlots.length]}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && targetSlots[instanceId]) {
          onSelectSlot(targetSlots[instanceId]);
        }
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      {/* Efecto holográfico translúcido con wireframe de emisión */}
      <meshStandardMaterial
        roughness={0.1}
        metalness={0.9}
        wireframe
        transparent
        opacity={0.35}
        emissive="#059669"
        emissiveIntensity={0.4}
      />
    </instancedMesh>
  );
});

// Buque Portacontenedores de Alta Fidelidad en Alta Mar
const ContainerShipHull: React.FC = React.memo(() => {
  return (
    <group position={[0, 0, 0]}>
      {/* Océano profundo con ligera ondulación y transparencia */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[160, 100, 32, 32]} />
        <meshStandardMaterial
          color="#081b2e"
          roughness={0.15}
          metalness={0.7}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* Casco principal (Rojo antifouling náutico en obra viva) */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[26, 0.9, 8.5]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Banda negra superior de obra muerta */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[26.5, 0.5, 8.8]} />
        <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.6} />
      </mesh>

      {/* Proa bulbosa afilada para corte hidrodinámico */}
      <mesh position={[14.5, 0.75, 0]} rotation={[0, 0, -Math.PI / 10]} castShadow>
        <coneGeometry args={[4.6, 4.2, 4]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} />
      </mesh>

      {/* Puente de mando y torre de navegación (Superestructura blanca) */}
      <group position={[-11, 2.8, 0]} castShadow>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[3.0, 3.6, 6.0]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.25} />
        </mesh>
        {/* Ventanales panorámicos de navegación */}
        <mesh position={[1.1, 1.3, 0]}>
          <boxGeometry args={[1.1, 0.45, 5.8]} />
          <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.6} />
        </mesh>
        {/* Chimenea de escape con franja roja corporativa */}
        <mesh position={[-1.0, 2.5, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.55, 1.8, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
        {/* Mástil de radar y comunicaciones */}
        <mesh position={[0, 2.5, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
          <meshBasicMaterial color="#94a3b8" />
        </mesh>
      </group>
    </group>
  );
});

// Contenedores Marítimos 40HQ y 20ST con PBR corrugado y etiquetas de naviera
const InstancedMaritimeCargo: React.FC<{
  slots: DigitalTwinSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
}> = React.memo(({ slots, selectedSlotId, onSelectSlot }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const containerColors = ['#0284c7', '#059669', '#dc2626', '#d97706', '#475569'];

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    slots.forEach((slot, i) => {
      const bayNum = parseInt(slot.cuerpo.replace('BAY-', '')) || 1;
      const rowNum = parseInt(slot.rack.replace('ROW-', '')) || 1;
      const tier = slot.nivel;
      const pos = slot.posicion;

      const is40HQ = slot.tipo_contenedor === '40HQ';
      const length = is40HQ ? 4.8 : 2.4;
      const height = is40HQ ? 1.3 : 1.1;
      const width = 1.1;

      const posX = (bayNum - 2) * 5.8 + (pos - 1.5) * 0.1;
      const posY = (tier - 1) * (height + 0.05) + 1.25;
      const posZ = (rowNum - 1.5) * 3.2;

      dummy.position.set(posX, posY, posZ);
      dummy.scale.set(length, height, width);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const isSelected = slot.id === selectedSlotId;
      if (isSelected) {
        color.set('#38bdf8');
      } else {
        const baseColor = containerColors[(bayNum + rowNum + tier) % containerColors.length];
        color.set(baseColor);
      }
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [slots, selectedSlotId, dummy, color]);

  const selectedSlot = useMemo(() => {
    return slots.find((s) => s.id === selectedSlotId) || null;
  }, [slots, selectedSlotId]);

  if (slots.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, slots.length]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          const instanceId = e.instanceId;
          if (instanceId !== undefined && slots[instanceId]) {
            onSelectSlot(slots[instanceId]);
          }
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.35} metalness={0.65} />
      </instancedMesh>

      {/* Indicador holográfico y etiqueta al seleccionar contenedor */}
      {selectedSlot && (() => {
        const bayNum = parseInt(selectedSlot.cuerpo.replace('BAY-', '')) || 1;
        const rowNum = parseInt(selectedSlot.rack.replace('ROW-', '')) || 1;
        const tier = selectedSlot.nivel;
        const pos = selectedSlot.posicion;
        const is40HQ = selectedSlot.tipo_contenedor === '40HQ';
        const length = is40HQ ? 4.8 : 2.4;
        const height = is40HQ ? 1.3 : 1.1;
        const width = 1.1;
        const posX = (bayNum - 2) * 5.8 + (pos - 1.5) * 0.1;
        const posY = (tier - 1) * (height + 0.05) + 1.25;
        const posZ = (rowNum - 1.5) * 3.2;

        return (
          <group position={[posX, posY, posZ]}>
            <mesh>
              <boxGeometry args={[length * 1.02, height * 1.02, width * 1.02]} />
              <meshBasicMaterial color="#38bdf8" wireframe />
            </mesh>
            <CanvasLabelSprite
              text={`${selectedSlot.tipo_contenedor || '40HQ'} | ${selectedSlot.slot_code}`}
              position={[0, height + 0.45, 0]}
              height={0.5}
              color="#7dd3fc"
              background="rgba(8, 47, 73, 0.92)"
              border="#38bdf8"
            />
          </group>
        );
      })()}
    </group>
  );
});

// Canvas Scene Memoizado con Iluminación Industrial PBR Profesional
interface WarehouseCanvasSceneProps {
  active: boolean;
  isMaritimeScene: boolean;
  slots: DigitalTwinSlot[];
  inspectedSlotId: string | null;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
  selectedWarehouse: DigitalTwinWarehouse | null;
  uniqueCuerpos: string[];
  slotsByCuerpo: Record<string, DigitalTwinSlot[]>;
  selectedCuerpo: string;
  onSelectRackCuerpo: (cuerpo: string, sampleSlot: DigitalTwinSlot) => void;
  showEmptySlots: boolean;
}

export const WarehouseCanvasScene: React.FC<WarehouseCanvasSceneProps> = React.memo(({
  active,
  isMaritimeScene,
  slots,
  inspectedSlotId,
  onSelectSlot,
  selectedWarehouse,
  uniqueCuerpos,
  slotsByCuerpo,
  selectedCuerpo,
  onSelectRackCuerpo,
  showEmptySlots,
}) => {
  return (
    <Canvas
      frameloop={active ? 'demand' : 'never'}
      dpr={[1, 1.5]}
      gl={{
        powerPreference: 'high-performance',
        antialias: true,
      }}
      camera={{
        position: isMaritimeScene ? [18, 16, 26] : [20, 18, 28],
        fov: 42,
      }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
    >
      {/* Atmósfera industrial con niebla volumétrica y gradiente */}
      <SceneAtmosphere isMaritime={isMaritimeScene} />

      {/* Iluminación Global Neutra Suave */}
      <ambientLight color="#e2e8f0" intensity={0.65} />

      {/* Luces Cenitales LED de Techo (Directional Lights con sombras suaves PCF) */}
      <directionalLight
        position={[20, 38, 20]}
        intensity={1.4}
        color="#f8fafc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
      />

      {/* Luz cenital secundaria de relleno para evitar oclusiones oscuras */}
      <directionalLight
        position={[-20, 32, -20]}
        intensity={0.6}
        color="#93c5fd"
      />

      {/* Luces Puntuales de Acento: Dársenas (Cálido) y Racks (Cian) */}
      <pointLight position={[-25, 6, 0]} intensity={1.2} distance={35} color="#fbbf24" />
      <pointLight position={[0, 12, 0]} intensity={0.8} distance={40} color="#38bdf8" />
      <pointLight position={[20, 8, -15]} intensity={0.6} distance={30} color="#a7f3d0" />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={3}
        maxDistance={110}
      />

      <Suspense fallback={null}>
        {isMaritimeScene ? (
          <group>
            <ContainerShipHull />
            <InstancedMaritimeCargo
              slots={slots}
              selectedSlotId={inspectedSlotId}
              onSelectSlot={onSelectSlot}
            />
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
              onSelectRackCuerpo={onSelectRackCuerpo}
            />
            <InstancedTerrestrialCargo
              slots={slots}
              selectedSlotId={inspectedSlotId}
              onSelectSlot={onSelectSlot}
            />
            <EmptyAndBlockedSlotsMesh
              slots={slots}
              showEmptySlots={showEmptySlots}
              selectedSlotId={inspectedSlotId}
              onSelectSlot={onSelectSlot}
            />
          </group>
        )}
      </Suspense>
    </Canvas>
  );
});