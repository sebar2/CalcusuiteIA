import React, { useMemo, useRef, useLayoutEffect, useEffect, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CanvasLabelSprite } from './CanvasLabelSprite';
import type { DigitalTwinWarehouse, DigitalTwinSlot } from '../../services/digitalTwinApi';

// ==========================================
// 3D OBJECTS & MESHES (THREE.JS) - HIGH FIDELITY PBR
// ==========================================

// Atmósfera de galpón industrial realista PBR con iluminación balanceada
const SceneAtmosphere: React.FC<{ isMaritime: boolean }> = React.memo(({ isMaritime }) => {
  const { scene } = useThree();

  useEffect(() => {
    if (isMaritime) {
      scene.fog = new THREE.FogExp2('#0f172a', 0.010);
      scene.background = new THREE.Color('#0b1120');
    } else {
      // Fondo industrial slate profesional, eliminando el negro vacío
      scene.fog = new THREE.FogExp2('#1e293b', 0.007);
      scene.background = new THREE.Color('#1e293b');
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

// Camión de Carga Pesada en Dársena (Patio de Maniobras)
const IndustrialTruck: React.FC<{
  position: [number, number, number];
  rotation?: [x: number, y: number, z: number];
}> = React.memo(({ position, rotation }) => {
  return (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      {/* Caja cerrada de furgón semi-remolque térmico */}
      <mesh position={[0, 2.3, -4.2]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 3.4, 8.2]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.2} />
      </mesh>

      {/* Marco perimetral de acero del semi-remolque */}
      <mesh position={[0, 0.7, -4.2]}>
        <boxGeometry args={[2.55, 0.2, 8.3]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Cabina tractor frontal */}
      <mesh position={[0, 1.8, 1.8]} castShadow receiveShadow>
        <boxGeometry args={[2.45, 2.7, 3.2]} />
        <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Deflector de techo aerodinámico */}
      <mesh position={[0, 3.25, 1.6]} castShadow>
        <boxGeometry args={[2.3, 0.7, 2.6]} />
        <meshStandardMaterial color="#0369a1" roughness={0.4} />
      </mesh>

      {/* Parabrisas tintado oscuro */}
      <mesh position={[0, 2.35, 3.3]}>
        <boxGeometry args={[2.2, 1.05, 0.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Paragolpes frontal con luces */}
      <mesh position={[0, 0.5, 3.4]}>
        <boxGeometry args={[2.5, 0.4, 0.3]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Ruedas industriales del camión */}
      {[-2.2, -6.4].map((zPos, idx) => (
        <group key={idx}>
          <mesh position={[-1.25, 0.5, zPos]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.32, 16]} />
            <meshStandardMaterial color="#090d16" roughness={0.9} />
          </mesh>
          <mesh position={[1.25, 0.5, zPos]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.32, 16]} />
            <meshStandardMaterial color="#090d16" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

// Suelo de Concreto Pulido Industrial Gris Claro, Techo con Vigas, Paredes y Dársenas
const WarehouseNaveMesh: React.FC<{
  width: number;
  length: number;
  clearHeight: number;
}> = React.memo(({ width, length, clearHeight }) => {
  // Generar marcas viales (franjas amarillas de circulación en pasillos y perímetros)
  const aisleStripes = useMemo(() => {
    const stripes: Array<{ x: number; z: number; w: number; l: number; color: string }> = [];

    // Franja perimetral de seguridad continua (Amarillo Tráfico #eab308)
    stripes.push({ x: 0, z: -length / 2 + 1.2, w: width - 4, l: 0.18, color: '#eab308' });
    stripes.push({ x: 0, z: length / 2 - 1.2, w: width - 4, l: 0.18, color: '#eab308' });
    stripes.push({ x: -width / 2 + 1.8, z: 0, w: 0.18, l: length - 4, color: '#eab308' });
    stripes.push({ x: width / 2 - 1.8, z: 0, w: 0.18, l: length - 4, color: '#eab308' });

    // Franjas de circulación central para autoelevador (Forklift Highway)
    stripes.push({ x: -2.2, z: 0, w: 0.15, l: length * 0.85, color: '#facc15' });
    stripes.push({ x: 2.2, z: 0, w: 0.15, l: length * 0.85, color: '#facc15' });

    // Pasos cebra / Zona de precaución peatonal frente a dársenas
    for (let zi = -14; zi <= 14; zi += 2.0) {
      stripes.push({ x: -width / 2 + 4.5, z: zi, w: 2.2, l: 0.45, color: '#facc15' });
    }

    return stripes;
  }, [width, length]);

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Piso de concreto pulido industrial GRIS CLARO PBR (sin fondo negro vacío) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width * 1.05, length * 1.05]} />
        <meshStandardMaterial
          color="#cbd5e1"
          roughness={0.45}
          metalness={0.08}
        />
      </mesh>

      {/* Grid Helper sutil para alineación y escala técnica */}
      <gridHelper args={[Math.max(width, length), 28, '#0284c7', '#94a3b8']} position={[0, 0.005, 0]} />

      {/* Franjas viales industriales reflectivas en el suelo */}
      {aisleStripes.map((s, idx) => (
        <mesh key={idx} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.015, s.z]} receiveShadow>
          <planeGeometry args={[s.w, s.l]} />
          <meshStandardMaterial
            color={s.color}
            roughness={0.4}
            metalness={0.1}
            emissive={s.color}
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}

      {/* 2. Paredes Perimetrales de Nave Industrial (Chapa corrugada & zócalo de hormigón) */}
      {/* Pared trasera */}
      <mesh position={[0, clearHeight / 2, -length / 2]} receiveShadow>
        <boxGeometry args={[width, clearHeight, 0.4]} />
        <meshStandardMaterial color="#334155" roughness={0.65} metalness={0.3} />
      </mesh>
      {/* Pared lateral derecha */}
      <mesh position={[width / 2, clearHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.4, clearHeight, length]} />
        <meshStandardMaterial color="#334155" roughness={0.65} metalness={0.3} />
      </mesh>
      {/* Pared lateral izquierda (zona muelles) */}
      <mesh position={[-width / 2, clearHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.4, clearHeight, length]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* 3. Techo Industrial con Cerchas / Vigas Metálicas Reticuladas */}
      {[-length * 0.35, 0, length * 0.35].map((zPos, idx) => (
        <group key={idx} position={[0, clearHeight - 0.2, zPos]}>
          {/* Viga maestra transversal */}
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[width - 1, 0.4, 0.25]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* Luminaria industrial tipo campana LED suspendida */}
          {[-width * 0.25, 0, width * 0.25].map((xPos, lIdx) => (
            <group key={lIdx} position={[xPos, -0.4, 0]}>
              <mesh>
                <cylinderGeometry args={[0.35, 0.6, 0.3, 16]} />
                <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.7} />
              </mesh>
              <mesh position={[0, -0.15, 0]}>
                <circleGeometry args={[0.55, 16]} />
                <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={1.8} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* 4. Columnas estructurales perimetrales con refuerzo base amarillo antichoque */}
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

      {/* 5. Área de Dársenas de Carga y Descarga (Loading Docks) */}
      <group position={[-width / 2 - 2.8, 0, 0]}>
        {/* Plataforma de hormigón exterior */}
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[5.6, 0.16, length * 0.85]} />
          <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.2} />
        </mesh>

        {/* Portones seccionales de muelle y abrigos */}
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
              <meshStandardMaterial color={idx === 1 ? '#ef4444' : '#10b981'} emissive={idx === 1 ? '#ef4444' : '#10b981'} emissiveIntensity={1.8} />
            </mesh>
          </group>
        ))}

        {/* Camión atracado en dársena central operando */}
        <IndustrialTruck position={[-1.2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      </group>

      {/* 6. Autoelevadores en cabecera de pasillo y zona de maniobras */}
      <IndustrialForklift position={[-width / 2 + 5.5, 0, 4.5]} rotation={[0, Math.PI / 6, 0]} />
      <IndustrialForklift position={[4.0, 0, -length * 0.38]} rotation={[0, Math.PI, 0]} />
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
      isMuted: boolean;
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
      const isMuted = selectedCuerpo !== 'ALL' && selectedCuerpo !== cuerpo;

      rackNums.forEach((rackNum) => {
        const posX = cuerpoIdx * (rd * 2 + 4.8) + (rackNum - 1) * (rd + 1.6) - 12;
        list.push({ cuerpo, rackNum, sample, posX, rw, rh, rd, lev, levelH, isSelected, isMuted });
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
      const { posX, rw, rh, rd, lev, levelH, isSelected, isMuted } = rack;

      // 4 Montantes verticales metálicos perforados (Azul Industrial #0284c7)
      [-rd / 2, rd / 2].forEach((xOff) => {
        [-rw / 2, rw / 2].forEach((zOff) => {
          dummy.position.set(posX + xOff, rh / 2, zOff);
          dummy.scale.set(0.08, rh, 0.08);
          dummy.updateMatrix();
          postsMesh.setMatrixAt(pIdx, dummy.matrix);
          if (isSelected) {
            postColor.set('#38bdf8'); // Cyan brillante para cuerpo seleccionado
          } else if (isMuted) {
            postColor.set('#475569'); // Translúcido/atenuado para otros cuerpos
          } else {
            postColor.set('#0284c7'); // Azul industrial estándar
          }
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
        if (isSelected) {
          beamColor.set('#fbbf24');
        } else if (isMuted) {
          beamColor.set('#64748b');
        } else {
          beamColor.set('#ea580c');
        }
        beamsMesh.setColorAt(bIdx, beamColor);
        bIdx++;

        // Travesaño trasero
        dummy.position.set(posX - rd / 2, k * levelH + 0.04, 0);
        dummy.scale.set(0.06, 0.09, rw);
        dummy.updateMatrix();
        beamsMesh.setMatrixAt(bIdx, dummy.matrix);
        if (isSelected) {
          beamColor.set('#fbbf24');
        } else if (isMuted) {
          beamColor.set('#64748b');
        } else {
          beamColor.set('#ea580c');
        }
        beamsMesh.setColorAt(bIdx, beamColor);
        bIdx++;
      }

      // Malla de seguridad posterior anticaída de palets
      dummy.position.set(posX - rd / 2 - 0.02, rh / 2, 0);
      dummy.scale.set(0.01, rh * 0.98, rw * 0.98);
      dummy.updateMatrix();
      backsMesh.setMatrixAt(mIdx, dummy.matrix);
      meshColor.set(isMuted ? '#334155' : '#475569');
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
      {/* Montantes verticales InstancedMesh */}
      <instancedMesh
        ref={postsMeshRef}
        args={[undefined, undefined, totalPosts]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.3} metalness={0.7} />
      </instancedMesh>

      {/* Travesaños horizontales InstancedMesh */}
      <instancedMesh
        ref={beamsMeshRef}
        args={[undefined, undefined, totalBeams]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.35} metalness={0.6} />
      </instancedMesh>

      {/* Mallas traseras anticaída InstancedMesh */}
      <instancedMesh
        ref={backMeshRef}
        args={[undefined, undefined, totalBacks]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.8} metalness={0.2} transparent opacity={0.3} />
      </instancedMesh>

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

// Pallets de Madera Europeos y Cajas Corrugadas Kraft PBR en InstancedMesh
const InstancedTerrestrialCargo: React.FC<{
  slots: DigitalTwinSlot[];
  selectedSlotId: string | null;
  highlightedSlotIds?: string[];
  selectedCuerpo: string;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
}> = React.memo(({ slots, selectedSlotId, highlightedSlotIds = [], selectedCuerpo, onSelectSlot }) => {
  const boxesMeshRef = useRef<THREE.InstancedMesh>(null);
  const palletsMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const boxColor = useMemo(() => new THREE.Color(), []);
  const palletColor = useMemo(() => new THREE.Color('#854d0e'), []); // Madera marrón pino/nogal

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

      // 2. Bloque de Cajas de Cartón Kraft Corrugado sobre el pallet
      dummy.position.set(posX, (slot.nivel - 1) * levelH + 0.12 + bh / 2, posZ);
      dummy.scale.set(bw, bh, bl);
      dummy.updateMatrix();
      boxesMesh.setMatrixAt(i, dummy.matrix);

      // Clasificación de color PBR: Cartón kraft natural, eliminando cajas fucsias sobre negro
      let hexColor = '#b45309'; // Kraft marrón corrugado natural por defecto

      const isHighlightedRisk = highlightedSlotIds.includes(slot.id);
      const isMutedCuerpo = selectedCuerpo !== 'ALL' && slot.cuerpo !== selectedCuerpo;

      if (slot.id === selectedSlotId) {
        hexColor = '#38bdf8'; // Cyan brillante posición seleccionada
      } else if (isHighlightedRisk) {
        hexColor = '#ef4444'; // Rojo brillante de alerta (activado por el ojo en Riesgos)
      } else if (slot.reservation_type === 'HARD_RESERVED') {
        hexColor = '#2563eb'; // Azul eléctrico Licitaciones / SICE
      } else if (slot.reservation_type === 'SOFT_RESERVED') {
        hexColor = '#f59e0b'; // Ámbar Cotizaciones B2B
      } else if (slot.rop_status === 'CRITICO_ROP') {
        hexColor = '#dc2626'; // Rojo crítico ROP
      } else if (slot.rop_status === 'ALERTA_DOH') {
        hexColor = '#d97706'; // Naranja alerta DOH
      } else if (isMutedCuerpo) {
        hexColor = '#64748b'; // Atenuado si otro cuerpo está enfocado
      }

      boxColor.set(hexColor);
      boxesMesh.setColorAt(i, boxColor);
    });

    boxesMesh.instanceMatrix.needsUpdate = true;
    if (boxesMesh.instanceColor) boxesMesh.instanceColor.needsUpdate = true;

    palletsMesh.instanceMatrix.needsUpdate = true;
    if (palletsMesh.instanceColor) palletsMesh.instanceColor.needsUpdate = true;
  }, [occupiedSlots, selectedSlotId, highlightedSlotIds, selectedCuerpo, dummy, boxColor, palletColor]);

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

      {/* Cajas de mercancía apiladas en kraft */}
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

// Modo Holográfico / Wireframe Celeste para Posiciones Vacías y Bloqueadas
const EmptyAndBlockedSlotsMesh: React.FC<{
  slots: DigitalTwinSlot[];
  showEmptySlots: boolean;
  selectedSlotId: string | null;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
}> = React.memo(({ slots, showEmptySlots, selectedSlotId, onSelectSlot }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const visibleSlots = useMemo(() => {
    return slots.filter((s) => {
      if (s.estado === 'BLOQUEADA') return true;
      if (s.estado === 'VACIA' && showEmptySlots) return true;
      return false;
    });
  }, [slots, showEmptySlots]);

  useLayoutEffect(() => {
    if (!meshRef.current || visibleSlots.length === 0) return;
    const mesh = meshRef.current;

    visibleSlots.forEach((slot, i) => {
      const cuerpoIdx = Math.max(0, slot.cuerpo.charCodeAt(0) - 65);
      const rackNum = parseInt(slot.rack.replace(/\D/g, '')) || 1;
      const rw = slot.rack_width_m || 2.4;
      const rh = slot.rack_height_m || 6.0;
      const rd = slot.rack_depth_m || 1.2;
      const lev = Math.max(1, slot.levels_count || 4);
      const levelH = rh / lev;

      const posX = cuerpoIdx * (rd * 2 + 4.8) + (rackNum - 1) * (rd + 1.6) - 12;
      const posZ = (slot.posicion - 2) * (rw / 3.0);
      const posY = (slot.nivel - 1) * levelH + levelH / 2;

      dummy.position.set(posX, posY, posZ);
      dummy.scale.set(rd * 0.9, levelH * 0.85, rw / 3.1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (slot.id === selectedSlotId) {
        color.set('#38bdf8');
      } else if (slot.estado === 'BLOQUEADA') {
        color.set('#f43f5e'); // Rojo tenue para bloqueadas
      } else {
        color.set('#0284c7'); // Celeste holográfico para vacías
      }
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [visibleSlots, selectedSlotId, dummy, color]);

  if (visibleSlots.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, visibleSlots.length]}
      onClick={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && visibleSlots[instanceId]) {
          onSelectSlot(visibleSlots[instanceId]);
        }
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial wireframe transparent opacity={0.28} />
    </instancedMesh>
  );
});

// Casco Buque Portacontenedores para Tránsito Marítimo
const ContainerShipHull: React.FC = React.memo(() => {
  return (
    <group position={[0, -0.5, 0]}>
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[26, 0.9, 8.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[26.5, 0.5, 8.8]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.6} />
      </mesh>
      <mesh position={[-11.5, 2.8, 0]} castShadow>
        <boxGeometry args={[3.0, 3.6, 6.0]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
    </group>
  );
});

// Contenedores Marítimos en InstancedMesh
const InstancedMaritimeCargo: React.FC<{
  slots: DigitalTwinSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: DigitalTwinSlot) => void;
}> = React.memo(({ slots, selectedSlotId, onSelectSlot }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const maritimeSlots = useMemo(() => {
    return slots.filter((s) => s.estado === 'OCUPADA' || s.estado === 'RESERVADA');
  }, [slots]);

  useLayoutEffect(() => {
    if (!meshRef.current || maritimeSlots.length === 0) return;
    const mesh = meshRef.current;

    maritimeSlots.forEach((slot, i) => {
      const rowNum = parseInt(slot.rack.replace('ROW-', '')) || 1;
      const posX = (slot.nivel - 1) * 3.2 - 9;
      const posY = (slot.posicion - 1) * 1.5 + 0.8;
      const posZ = (rowNum - 2) * 2.6;

      dummy.position.set(posX, posY, posZ);
      const is40HQ = slot.tipo_contenedor === '40HQ';
      dummy.scale.set(is40HQ ? 3.0 : 1.5, 1.4, 2.4);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      let hexColor = is40HQ ? '#0284c7' : '#ea580c';
      if (slot.id === selectedSlotId) hexColor = '#38bdf8';
      color.set(hexColor);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [maritimeSlots, selectedSlotId, dummy, color]);

  if (maritimeSlots.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, maritimeSlots.length]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && maritimeSlots[instanceId]) {
          onSelectSlot(maritimeSlots[instanceId]);
        }
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.4} metalness={0.6} />
    </instancedMesh>
  );
});

// Controlador de Cámara 3D (Animaciones Lerp, Vistas Predefinidas y Giro 360°)
const WarehouseCameraController: React.FC<{
  rotationMode?: 'AUTO_360' | 'PAUSED' | 'MANUAL';
  cameraViewPreset?: 'ISOMETRIC' | 'TOP' | 'FRONT' | 'AISLE' | 'DOCK' | null;
  focusTargetPosition?: [number, number, number] | null;
  orbitControlsRef: React.RefObject<any>;
}> = ({ rotationMode, cameraViewPreset, focusTargetPosition, orbitControlsRef }) => {
  const { camera } = useThree();
  const targetCamPos = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!cameraViewPreset) return;
    if (cameraViewPreset === 'ISOMETRIC') {
      targetCamPos.current = new THREE.Vector3(22, 18, 28);
      targetLookAt.current = new THREE.Vector3(0, 3, 0);
    } else if (cameraViewPreset === 'TOP') {
      targetCamPos.current = new THREE.Vector3(0, 48, 0.05);
      targetLookAt.current = new THREE.Vector3(0, 0, 0);
    } else if (cameraViewPreset === 'FRONT') {
      targetCamPos.current = new THREE.Vector3(0, 12, 36);
      targetLookAt.current = new THREE.Vector3(0, 4, 0);
    } else if (cameraViewPreset === 'AISLE') {
      targetCamPos.current = new THREE.Vector3(-4, 2.6, 10);
      targetLookAt.current = new THREE.Vector3(0, 2, 0);
    } else if (cameraViewPreset === 'DOCK') {
      targetCamPos.current = new THREE.Vector3(-28, 7, 0);
      targetLookAt.current = new THREE.Vector3(-12, 2, 0);
    }
  }, [cameraViewPreset]);

  useEffect(() => {
    if (focusTargetPosition) {
      targetCamPos.current = new THREE.Vector3(
        focusTargetPosition[0] + 3.8,
        focusTargetPosition[1] + 2.4,
        focusTargetPosition[2] + 4.0
      );
      targetLookAt.current = new THREE.Vector3(
        focusTargetPosition[0],
        focusTargetPosition[1],
        focusTargetPosition[2]
      );
    }
  }, [focusTargetPosition]);

  useFrame((_, delta) => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.autoRotate = rotationMode === 'AUTO_360';
      orbitControlsRef.current.autoRotateSpeed = 1.3;
    }

    if (targetCamPos.current && targetLookAt.current) {
      const step = Math.min(delta * 4, 0.15);
      camera.position.lerp(targetCamPos.current, step);
      if (orbitControlsRef.current) {
        orbitControlsRef.current.target.lerp(targetLookAt.current, step);
        orbitControlsRef.current.update();
      }
      if (camera.position.distanceTo(targetCamPos.current) < 0.08) {
        targetCamPos.current = null;
        targetLookAt.current = null;
      }
    }
  });

  return null;
};

// Canvas Scene Memoizado con Iluminación Industrial PBR Profesional
export interface WarehouseCanvasSceneProps {
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
  rotationMode?: 'AUTO_360' | 'PAUSED' | 'MANUAL';
  cameraViewPreset?: 'ISOMETRIC' | 'TOP' | 'FRONT' | 'AISLE' | 'DOCK' | null;
  highlightedSlotIds?: string[];
  focusTargetPosition?: [number, number, number] | null;
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
  rotationMode = 'MANUAL',
  cameraViewPreset = null,
  highlightedSlotIds = [],
  focusTargetPosition = null,
}) => {
  const orbitControlsRef = useRef<any>(null);

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
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
      <ambientLight color="#f8fafc" intensity={0.75} />

      {/* Luces Cenitales LED de Techo (Directional Lights con sombras suaves PCF) */}
      <directionalLight
        position={[20, 38, 20]}
        intensity={1.5}
        color="#ffffff"
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
        intensity={0.65}
        color="#bfdbfe"
      />

      {/* Luces Puntuales de Acento: Dársenas (Cálido) y Racks (Cian) */}
      <pointLight position={[-25, 6, 0]} intensity={1.2} distance={35} color="#fbbf24" />
      <pointLight position={[0, 12, 0]} intensity={0.8} distance={40} color="#38bdf8" />
      <pointLight position={[20, 8, -15]} intensity={0.6} distance={30} color="#a7f3d0" />

      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={3}
        maxDistance={110}
      />

      <WarehouseCameraController
        rotationMode={rotationMode}
        cameraViewPreset={cameraViewPreset}
        focusTargetPosition={focusTargetPosition}
        orbitControlsRef={orbitControlsRef}
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
              highlightedSlotIds={highlightedSlotIds}
              selectedCuerpo={selectedCuerpo}
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
