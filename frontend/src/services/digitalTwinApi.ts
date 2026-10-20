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
  width_m?: number;
  length_m?: number;
  clear_height_m?: number;
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

  // Doble Candado SICE / Cotizador B2B
  reservation_type?: 'SOFT_RESERVED' | 'HARD_RESERVED' | null;
  reservation_order_id?: string | null;
  reserved_organism?: string | null;
  reserved_by_user?: string | null;
  reserved_until?: string | null;
  qr_signed_token?: string | null;

  // Propiedades paramétricas reales
  rack_width_m?: number;
  rack_height_m?: number;
  rack_depth_m?: number;
  levels_count?: number;
  max_rack_weight_kg?: number;
  pos_x_m?: number;
  pos_z_m?: number;
  rotation_y_deg?: number;
  bays_count?: number;
  position_x?: number;
  position_y?: number;
  position_z?: number;
  box_width_m?: number;
  box_height_m?: number;
  box_length_m?: number;
  unit_weight_kg?: number;
  units_count?: number;
  real_product_id?: number | null;
  // Indicadores de SKU Real en Vivo
  costo_fob?: number | null;
  costo_landed_calc?: number | null;
  precio_lista?: number | null;
  margen_bruto_pct?: number | null;
  doh_cobertura?: number | null;
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

export interface WarehouseDimensionsUpdatePayload {
  width_m: number;
  length_m: number;
  clear_height_m: number;
}

export interface DigitalTwinRack {
  rack_id: string;
  cuerpo: string;
  rack_code: string;
  warehouse_id: string;
  pos_x_m: number;
  pos_z_m: number;
  rotation_y_deg: number;
  rack_width_m: number;
  rack_height_m: number;
  rack_depth_m: number;
  levels_count: number;
  bays_count: number;
  max_weight_kg: number;
  total_slots: number;
  occupied_slots: number;
  free_slots: number;
  blocked_slots: number;
}

export interface CreateRackPayload {
  warehouse_id: string;
  zone_code?: string;
  rack_code: string;
  rack_width_m: number;
  rack_height_m: number;
  rack_depth_m: number;
  levels_count: number;
  max_weight_kg: number;
  racks_count?: number;
  bays_count?: number;
  positions_per_level?: number;
  pos_x_m?: number;
  pos_z_m?: number;
  rotation_y_deg?: number;
}

export interface RackUpdatePayload {
  warehouse_id?: string;
  rack_width_m?: number;
  rack_height_m?: number;
  rack_depth_m?: number;
  levels_count?: number;
  max_weight_kg?: number;
  bays_count?: number;
  pos_x_m?: number;
  pos_z_m?: number;
  rotation_y_deg?: number;
  position_x?: number;
  position_y?: number;
  position_z?: number;
}

export interface RackTransformPayload {
  warehouse_id?: string;
  pos_x_m?: number;
  pos_z_m?: number;
  rotation_y_deg?: number;
  rack_width_m?: number;
  rack_height_m?: number;
  rack_depth_m?: number;
  levels_count?: number;
  max_weight_kg?: number;
}

export interface RackDimensionsUpdatePayload {
  rack_width_m: number;
  rack_height_m: number;
  rack_depth_m: number;
  levels_count: number;
  max_rack_weight_kg: number;
}

export interface SlotItemSpecsUpdatePayload {
  box_width_m: number;
  box_height_m: number;
  box_length_m: number;
  unit_weight_kg: number;
  units_count: number;
  real_product_id?: number | null;
  lote?: string | null;
  descripcion?: string | null;
  estado?: 'VACIA' | 'OCUPADA' | 'BLOQUEADA' | 'CALIDAD' | 'RESERVADA' | string | null;
  rack_width_m?: number;
  rack_height_m?: number;
  rack_depth_m?: number;
}

export interface RealProductItem {
  id: number;
  sku: string;
  nombre: string;
  costo_base: number;
  precio_lista: number;
}

export interface SyncRealInventoryPayload {
  warehouse_id?: string;
  all_warehouses?: boolean;
  module_scope?: '3PL' | 'SUPPLY_CHAIN';
}

export interface SyncRealInventoryResponse {
  success: boolean;
  message: string;
  warehouses_synced: number;
  skus_count: number;
  lots_count: number;
  boxes_count: number;
  total_stock: number;
  valor_estimado_total: number;
}

// ==========================================
// 1. SIMULADOR 3D DE CUBICAJE & BOTÓN IA 98%
// ==========================================

export interface PlacedBox3D {
  box_id: string;
  sku: string;
  description: string;
  x_m: number;
  y_m: number;
  z_m: number;
  box_width_m: number;
  box_height_m: number;
  box_length_m: number;
  unit_weight_kg: number;
  stop_number: number;
  is_filler: boolean;
  status?: string;
  color?: string;
}

export interface ContainerLoadPlanResponse {
  container_type: '20ST' | '40HQ' | 'TRUCK_3PL';
  specs: {
    length_m: number;
    width_m: number;
    height_m: number;
    max_weight_kg: number;
    volume_m3: number;
  };
  total_volume_m3: number;
  total_weight_kg: number;
  occupied_volume_pct: number;
  occupied_weight_pct: number;
  remaining_volume_m3: number;
  remaining_weight_kg: number;
  placed_boxes_count: number;
  unfitted_boxes_count: number;
  placed_boxes: PlacedBox3D[];
  unfitted_boxes: any[];
  axle_distribution?: {
    front_axle_kg: number;
    front_axle_limit_kg: number;
    rear_axle_kg: number;
    rear_axle_limit_kg: number;
    balanced: boolean;
    lifo_enforced: boolean;
  };
}

export interface FillAIResponse {
  success: boolean;
  container_type: string;
  target_occupancy_pct: number;
  initial_volume_pct: number;
  projected_volume_pct: number;
  projected_weight_pct: number;
  filler_boxes_count: number;
  filler_volume_m3: number;
  filler_weight_kg: number;
  estimated_additional_cost_usd: number;
  estimated_additional_revenue_usd: number;
  estimated_margin_contribution_usd: number;
  suggested_skus_breakdown: { sku: string; units_suggested: number }[];
  filler_boxes: PlacedBox3D[];
  ai_rationale: string;
}

// ==========================================
// 2. RESERVAS DOBLE CANDADO (SOFT / HARD)
// ==========================================

export interface ReserveSlotPayload {
  warehouse_id: string;
  slot_code: string;
  reservation_type: 'SOFT_RESERVED' | 'HARD_RESERVED';
  order_id: string;
  organism: string;
  user_name?: string;
  duration_days?: number;
}

// ==========================================
// 3. TIPO DE CAMBIO BROU & FACTURACIÓN 3PL
// ==========================================

export interface ExchangeRateConfig {
  provider: string;
  official_rate_uyu: number;
  manual_rate_uyu: number;
  use_manual: boolean;
  effective_rate_uyu: number;
  last_sync: string;
}

export interface BimonetaryBillingCalculation {
  client_id: number;
  client_rut?: string;
  client_razon_social?: string;
  moneda_contrato: 'USD' | 'UYU';
  exchange_rate_uyu: number;
  dias_almacenaje: number;
  pallets: number;
  m3: number;
  picking_movements: number;
  subtotal_almacenaje_usd: number;
  subtotal_almacenaje_uyu: number;
  subtotal_picking_usd: number;
  subtotal_picking_uyu: number;
  subtotal_flete_usd: number;
  subtotal_flete_uyu: number;
  subtotal_neto_usd: number;
  subtotal_neto_uyu: number;
  iva_22_usd: number;
  iva_22_uyu: number;
  total_facturar_usd: number;
  total_facturar_uyu: number;
  items: any[];
}

export interface IssueBimonetaryInvoicePayload {
  client_id: number;
  dias_almacenaje?: number;
  pallets?: number;
  m3?: number;
  picking_movements?: number;
  distancia_km?: number;
  moneda_facturacion?: 'USD' | 'UYU';
  forma_pago?: string;
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

  updateWarehouseDimensions: async (
    warehouse_id: string,
    payload: WarehouseDimensionsUpdatePayload
  ): Promise<any> => {
    const res = await axios.patch(`${API_BASE}/warehouses/${warehouse_id}/dimensions`, payload);
    return res.data;
  },

  getRacks: async (warehouse_id: string): Promise<DigitalTwinRack[]> => {
    const res = await axios.get<DigitalTwinRack[]>(`${API_BASE}/racks`, { params: { warehouse_id } });
    return res.data;
  },

  createRack: async (payload: CreateRackPayload): Promise<any> => {
    const res = await axios.post(`${API_BASE}/racks`, payload);
    return res.data;
  },

  transformRack: async (
    rack_identifier: string,
    payload: RackTransformPayload
  ): Promise<any> => {
    const res = await axios.patch(
      `${API_BASE}/racks/${encodeURIComponent(rack_identifier)}/transform`,
      payload
    );
    return res.data;
  },

  updateRackById: async (rack_id: string, payload: RackUpdatePayload): Promise<any> => {
    const res = await axios.patch(`${API_BASE}/racks/${encodeURIComponent(rack_id)}`, payload);
    return res.data;
  },

  updateRackDimensions: async (
    warehouse_id: string,
    cuerpo: string,
    payload: RackDimensionsUpdatePayload
  ): Promise<any> => {
    const res = await axios.patch(`${API_BASE}/racks/${warehouse_id}/${cuerpo}/dimensions`, payload);
    return res.data;
  },

  updateSlotItemSpecs: async (
    slot_id: string,
    payload: SlotItemSpecsUpdatePayload
  ): Promise<any> => {
    const res = await axios.patch(`${API_BASE}/slots/${slot_id}/item-specs`, payload);
    return res.data;
  },

  getRealProducts: async (): Promise<RealProductItem[]> => {
    const res = await axios.get<RealProductItem[]>(`${API_BASE}/products`);
    return res.data;
  },

  syncRealInventory: async (
    payload: SyncRealInventoryPayload
  ): Promise<SyncRealInventoryResponse> => {
    const res = await axios.post<SyncRealInventoryResponse>(
      `${API_BASE}/sync-real-inventory`,
      payload
    );
    return res.data;
  },

  // 1. Simulador 3D de Cubicaje & AI Filler
  planContainerLoad: async (
    containerType: '20ST' | '40HQ' | 'TRUCK_3PL',
    items: any[],
    enforceLifo: boolean = false
  ): Promise<ContainerLoadPlanResponse> => {
    const res = await axios.post<ContainerLoadPlanResponse>(`${API_BASE}/container-load-planner`, {
      container_type: containerType,
      items,
      enforce_lifo: enforceLifo,
    });
    return res.data;
  },

  fillContainerAI: async (
    containerType: '20ST' | '40HQ' | 'TRUCK_3PL',
    currentPlan: ContainerLoadPlanResponse,
    candidateSkus?: any[],
    targetOccupancyPct: number = 98.0
  ): Promise<FillAIResponse> => {
    const res = await axios.post<FillAIResponse>(`${API_BASE}/container-load-planner/fill-ai`, {
      container_type: containerType,
      current_load_plan: currentPlan,
      candidate_skus: candidateSkus,
      target_occupancy_pct: targetOccupancyPct,
    });
    return res.data;
  },

  // 2. Reservas Doble Candado (SOFT / HARD)
  reserveSlot: async (payload: ReserveSlotPayload): Promise<any> => {
    const res = await axios.post(`${API_BASE}/reserve-slot`, payload);
    return res.data;
  },

  releaseSlot: async (warehouse_id: string, slot_code: string, is_controller_admin: boolean = true): Promise<any> => {
    const res = await axios.post(`${API_BASE}/release-slot`, {
      warehouse_id,
      slot_code,
      is_controller_admin,
    });
    return res.data;
  },

  // 3. Recepción QR Criptográfico HMAC-SHA256
  generateQRLabel: async (payload: {
    warehouse_id: string;
    slot_code: string;
    sku: string;
    lote: string;
    units_count: number;
  }): Promise<any> => {
    const res = await axios.post(`${API_BASE}/generate-qr-label`, payload);
    return res.data;
  },

  scanQRReceive: async (qrToken: string): Promise<any> => {
    const res = await axios.post(`${API_BASE}/scan-qr-receive`, { qr_token: qrToken });
    return res.data;
  },

  // 4. Tipo de Cambio BROU & Liquidación 3PL
  getExchangeRateConfig: async (): Promise<ExchangeRateConfig> => {
    const res = await axios.get<ExchangeRateConfig>('/api/v1/settings/exchange-rate');
    return res.data;
  },

  updateExchangeRateConfig: async (payload: {
    manual_rate_uyu?: number;
    official_rate_uyu?: number;
    use_manual?: boolean;
  }): Promise<ExchangeRateConfig> => {
    const res = await axios.post<ExchangeRateConfig>('/api/v1/settings/exchange-rate', payload);
    return res.data;
  },

  calculateBimonetaryBilling: async (payload: {
    client_id: number;
    dias_almacenaje?: number;
    pallets?: number;
    m3?: number;
    picking_movements?: number;
    distancia_km?: number;
    manual_exchange_rate?: number;
  }): Promise<BimonetaryBillingCalculation> => {
    const res = await axios.post<BimonetaryBillingCalculation>(
      '/api/v1/logistics/billing/calculate-bimonetary',
      payload
    );
    return res.data;
  },

  issueBimonetaryInvoice: async (payload: IssueBimonetaryInvoicePayload): Promise<any> => {
    const res = await axios.post('/api/v1/logistics/billing/issue-bimonetary-invoice', payload);
    return res.data;
  },
};
