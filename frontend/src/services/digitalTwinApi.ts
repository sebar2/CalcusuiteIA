import axios from 'axios';

const API_BASE = '/api/v1/digital-twin';

export interface DigitalTwinWarehouse {
  id: string;
  nombre: string;
  tipo: string; // 'CENTRAL', 'SUCURSAL', 'TRANSITO', 'FABRICA', 'INTERNACIONAL', 'URUGUAY'
  module_scope: '3PL' | 'SUPPLY_CHAIN';
  ubicacion: string;
  pais: string;
  capacidad_unidades: number;
  superficie_m2: number;
  volumen_max_m3: number;
  capacidad_peso_kg: number;
  altura_max_m: number;
  activo: boolean;
}

export interface DigitalTwinSlot {
  id: string;
  warehouse_id: string;
  module_scope: '3PL' | 'SUPPLY_CHAIN';
  slot_code: string;
  cuerpo: string;
  rack: string;
  nivel: number;
  posicion: number;
  estado: 'VACIA' | 'OCUPADA' | 'BLOQUEADA' | 'RESERVADA';
  sku: string | null;
  lote: string | null;
  descripcion: string | null;
  cantidad: number;
  peso_actual_kg: number;
  peso_max_kg: number;
  volumen_actual_m3: number;
  volumen_max_m3: number;
  altura_m: number;
  valor_estimado: number;
  pallets_count: number;
  cajas_count: number;
  tipo_contenedor: '40HQ' | '20ST' | 'LCL' | null;
  eta_arribo: string | null;
  costo_landed: number;
  desvios: string | null;
  material_retenido: boolean;
  material_calidad: boolean;
  fecha_vencimiento: string | null;
  rop_status: 'CRITICO_ROP' | 'ALERTA_DOH' | 'OPTIMO' | null;
}

export interface CuerpoSummaryItem {
  cuerpo: string;
  total: number;
  ocupadas: number;
  porcentaje_ocupacion: number;
  peso_total_kg: number;
  volumen_total_m3: number;
}

export interface WarehouseIntelligenceSummary {
  warehouse: {
    id: string;
    nombre: string;
    tipo: string;
    module_scope: string;
  };
  operativo: {
    lotes_activos: number;
    posiciones_ocupadas: number;
    posiciones_libres: number;
    posiciones_bloqueadas: number;
    total_posiciones: number;
    skus_distintos: number;
    stock_total: number;
    pallets_ocupados: number;
    cajas_ocupadas: number;
    valor_estimado_usd: number;
  };
  riesgos: {
    posiciones_afectadas: number;
    contenido_desvio: number;
    exceso_volumen: number;
    exceso_altura: number;
    exceso_peso: number;
    material_retenido: number;
    material_en_calidad: number;
    criticidad: 'ALTA' | 'MEDIA' | 'BAJA';
    compatibilidad_logistica_pct: number;
    vencimientos: number;
  };
  capacidad_real: {
    peso_actual_kg: number;
    peso_libre_kg: number;
    capacidad_peso_max_kg: number;
    superficie_ocupada_m2: number;
    superficie_total_m2: number;
    volumen_ocupado_m3: number;
    volumen_libre_m3: number;
    volumen_max_m3: number;
    porcentaje_volumen_usado: number;
    altura_promedio_m: number;
  };
  comparativa_cuerpos: CuerpoSummaryItem[];
}

export interface TransferStockPayload {
  source_warehouse_id: string;
  source_slot_code: string;
  target_warehouse_id: string;
  target_slot_code: string;
  cantidad_a_mover?: number;
  mover_lote_completo: boolean;
}

export interface CreateWarehousePayload {
  id: string;
  nombre: string;
  tipo: string;
  module_scope: '3PL' | 'SUPPLY_CHAIN';
  ubicacion: string;
  pais?: string;
  capacidad_unidades?: number;
  superficie_m2?: number;
  volumen_max_m3?: number;
  capacidad_peso_kg?: number;
  altura_max_m?: number;
}

export interface OptimizeSlottingResponse {
  warehouse_id: string;
  engine: string;
  eficiencia_actual_pct: number;
  eficiencia_proyectada_pct: number;
  posiciones_reubicables: number;
  reduccion_recorrido_picking_pct: number;
  recomendaciones: string[];
}

export const digitalTwinApi = {
  getWarehouses: async (scope?: '3PL' | 'SUPPLY_CHAIN'): Promise<DigitalTwinWarehouse[]> => {
    const params = scope ? { module_scope: scope } : {};
    const res = await axios.get<DigitalTwinWarehouse[]>(`${API_BASE}/warehouses`, { params });
    return res.data;
  },

  createWarehouse: async (payload: CreateWarehousePayload): Promise<any> => {
    const res = await axios.post(`${API_BASE}/warehouses`, payload);
    return res.data;
  },

  getSlots: async (params: {
    warehouse_id: string;
    cuerpo?: string;
    estado?: string;
    rop_status?: string;
    search?: string;
  }): Promise<DigitalTwinSlot[]> => {
    const res = await axios.get<DigitalTwinSlot[]>(`${API_BASE}/slots`, { params });
    return res.data;
  },

  getIntelligenceSummary: async (warehouse_id: string): Promise<WarehouseIntelligenceSummary> => {
    const res = await axios.get<WarehouseIntelligenceSummary>(`${API_BASE}/intelligence-summary`, {
      params: { warehouse_id },
    });
    return res.data;
  },

  transferStock: async (payload: TransferStockPayload): Promise<any> => {
    const res = await axios.post(`${API_BASE}/transfer`, payload);
    return res.data;
  },

  optimizeSlotting: async (warehouse_id: string): Promise<OptimizeSlottingResponse> => {
    const res = await axios.post<OptimizeSlottingResponse>(`${API_BASE}/optimize-slotting`, {
      warehouse_id,
    });
    return res.data;
  },
};
