import { apiClient } from './api';

export interface LogisticsBranchItem {
  id: number;
  client_id: number;
  nombre_sucursal: string;
  direccion: string;
  contacto_receptor?: string;
  telefono_receptor?: string;
  lat?: number | null;
  lng?: number | null;
  distancia_km_base: number;
  activo: boolean;
}

export interface LogisticsPricing {
  tarifa_almacenaje_pallet_dia: number;
  tarifa_handling_bulto: number;
  tarifa_etiquetado_unidad: number;
  tarifa_flete_base: number;
  tarifa_flete_km_adicional: number;
}

export interface LogisticsClientItem {
  id: number;
  rut: string;
  razon_social: string;
  nombre_comercial: string;
  tipo: 'SUPERMERCADO' | 'PYME' | 'DISTRIBUIDOR' | string;
  contacto_logistica?: string;
  telefono?: string;
  email?: string;
  direccion_central?: string;
  condiciones_pago: string;
  activo: boolean;
  total_bultos: number;
  total_skus: number;
  ordenes_activas: number;
  pricing?: LogisticsPricing;
  branches?: LogisticsBranchItem[];
}

export interface LogisticsDriverItem {
  id: number;
  nombre: string;
  documento: string;
  telefono: string;
  tipo_licencia: string;
  tipo_relacion: 'FLETERO_TERCERIZADO' | 'CADETE' | 'OPERARIO_DEPOSITO' | string;
  modalidad_pago?: 'VIAJE_KM' | 'POR_HORA' | 'POR_JORNAL' | string;
  tarifa_base_viaje: number;
  tarifa_km: number;
  tarifa_hora?: number;
  tarifa_jornal?: number;
  disponibilidad_semanal?: string | Record<string, any> | null;
  activo: boolean;
  viajes_hechos: number;
  viajes_activos: number;
  vehiculos: { id: number; matricula: string; tipo: string }[];
}

export interface LogisticsVehicleItem {
  id: number;
  driver_id?: number | null;
  driver_nombre?: string;
  driver_telefono?: string | null;
  matricula: string;
  tipo_vehiculo: 'UTILITARIO' | 'FURGON' | 'CAMION_PLATAFORMA' | 'SEMI_REMOLQUE' | string;
  capacidad_kg: number;
  volumen_m3: number;
  capacidad_pallets: number;
  activo: boolean;
  en_transito: boolean;
  orden_activa?: string | null;
}

export interface LogisticsInventoryItem {
  id: number;
  client_id: number;
  client_nombre: string;
  sku_cliente: string;
  descripcion: string;
  categoria: string;
  cantidad_bultos: number;
  unidades_por_bulto: number;
  total_unidades: number;
  volumen_unitario_m3: number;
  volumen_total_m3: number;
  peso_unitario_kg: number;
  peso_total_kg: number;
  ubicacion_rack: string;
  codigo_qr_lote: string;
  lote?: string;
  fecha_vencimiento?: string | null;
  fecha_ingreso?: string;
}

export interface CapacityStatus {
  peso_total_kg: number;
  volumen_total_m3: number;
  capacidad_vehiculo_kg: number;
  capacidad_vehiculo_m3: number;
  utilizacion_peso_pct: number;
  utilizacion_volumen_pct: number;
  is_overweight: boolean;
  is_overvolume: boolean;
  can_dispatch: boolean;
  estado_alerta: 'OPTIMO' | 'ADVERTENCIA' | 'SOBRECARGA_CRITICA';
  mensajes: string[];
  sugerencia_vehiculo?: string | null;
}

export interface LogisticsOrderItem {
  id: number;
  numero_orden: string;
  client_id: number;
  client_nombre: string;
  branch_id?: number | null;
  branch_nombre?: string | null;
  responsable_armado?: string | null;
  contacto_receptor_nombre?: string | null;
  contacto_receptor_telefono?: string | null;
  etapa_kanban: 'INGRESO' | 'ETIQUETADO_VAS' | 'LISTO_DESPACHO' | 'EN_DISTRIBUCION' | 'ENTREGADO';
  destino_direccion: string;
  destino_coordenadas?: string;
  ventana_horaria?: string;
  remito_numero?: string;
  codigo_qr?: string;
  kilometros_recorrido?: number;
  tipo_despacho?: string;
  total_bultos: number;
  total_kg: number;
  total_m3: number;
  tarifa_flete_cliente: number;
  costo_chofer_acordado: number;
  gastos_variables_ruta: number;
  margen_neto_estimado: number;
  firma_digital_receptor?: string | null;
  firma_fecha_hora?: string | null;
  firma_aclaracion?: string | null;
  fecha_entrega_real?: string | null;
  estado_pago: string;
  observaciones?: string;
  fecha_creacion?: string;
  vehicle?: {
    id: number;
    matricula: string;
    tipo: string;
    capacidad_kg: number;
    volumen_m3: number;
  } | null;
  driver?: {
    id: number;
    nombre: string;
    telefono: string;
    tipo_relacion: string;
  } | null;
  items: {
    sku: string;
    descripcion: string;
    bultos: number;
    kg: number;
    m3: number;
  }[];
  capacity_status?: CapacityStatus | null;
}

export interface LiveFleetMarker {
  order_id: number;
  numero_orden: string;
  client_nombre: string;
  branch_nombre?: string | null;
  driver_nombre: string;
  driver_telefono: string;
  vehicle_matricula: string;
  vehicle_tipo: string;
  contacto_receptor_nombre?: string | null;
  contacto_receptor_telefono?: string | null;
  destino_direccion: string;
  destino_coordenadas?: string | null;
  google_maps_url?: string;
  ventana_horaria: string;
  total_bultos: number;
  total_kg?: number;
  kilometros_recorrido?: number;
  tipo_despacho?: string;
  lat: number;
  lng: number;
  velocidad_kmh: number;
  bateria_pct: number;
  eta_minutos: number;
  last_update: string;
}

export interface DriverDeliverySheetResponse {
  order_id: number;
  numero_orden: string;
  remito_numero?: string;
  codigo_qr?: string;
  client_nombre: string;
  branch_nombre?: string | null;
  contacto_receptor_nombre?: string | null;
  contacto_receptor_telefono?: string | null;
  destino_direccion: string;
  direccion_completa?: string;
  destino_coordenadas?: string | null;
  google_maps_url: string;
  ventana_horaria?: string;
  total_bultos: number;
  total_kg: number;
  total_m3: number;
  kilometros_recorrido: number;
  etapa_kanban: string;
  responsable_armado?: string;
  observaciones?: string;
  items: { sku: string; descripcion: string; bultos: number; kg: number; m3: number }[];
  firma_digital_receptor?: string | null;
  firma_fecha_hora?: string | null;
  firma_aclaracion?: string | null;
}

export interface LogisticsCostItem {
  id: number;
  tipo: 'FIJO' | 'VARIABLE';
  categoria: string;
  nombre: string;
  monto_mensual: number;
  moneda: string;
  descripcion?: string;
  activo: boolean;
  created_at?: string;
}

export interface EbitdaAnalysisResponse {
  ingresos_servicios_totales: number;
  costos_directos_choferes: number;
  costos_variables_operativos: number;
  margen_contribucion: number;
  margen_contribucion_pct: number;
  costos_fijos_totales: number;
  ebitda_neto: number;
  ebitda_pct: number;
  punto_equilibrio_ingresos: number;
  cobertura_costos_fijos_pct: number;
  total_viajes: number;
  total_km_recorridos: number;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
  diagnostico: string;
  costos_fijos_desglose: { nombre: string; categoria: string; monto: number }[];
  costos_variables_desglose: { nombre: string; categoria: string; monto: number }[];
}

export interface SettlementLineItem {
  concepto: string;
  cantidad: number;
  unidad_medida: string;
  tarifa_unitaria: number;
  subtotal: number;
}

export interface ServiceSettlementResponse {
  client_id: number;
  dias_almacenaje: number;
  pallets: number;
  total_bultos: number;
  total_unidades: number;
  distancia_km: number;
  items: SettlementLineItem[];
  subtotal_almacenaje: number;
  subtotal_handling: number;
  subtotal_vas: number;
  subtotal_flete: number;
  total_sin_impuestos: number;
  iva_monto: number;
  total_facturar: number;
}

export interface FinanceSummaryResponse {
  facturacion_fletes_total: number;
  costo_choferes_total: number;
  gastos_variables_total: number;
  margen_bruto_total: number;
  margen_pct: number;
  total_ordenes: number;
  rutas_detalle: {
    orden_id?: number;
    numero_orden: string;
    tarifa_flete_cliente: number;
    pago_conductor: number;
    peajes_combustible_variables: number;
    costo_total_operativo: number;
    margen_bruto: number;
    margen_pct: number;
    semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
    diagnostico: string;
  }[];
}

export const logisticsApi = {
  // CLIENTES
  async getClients(): Promise<LogisticsClientItem[]> {
    const res = await apiClient.get<LogisticsClientItem[]>('/api/v1/logistics/clients');
    return res.data;
  },

  async createClient(data: Partial<LogisticsClientItem> & { pricing?: LogisticsPricing }): Promise<{ message: string; id: number }> {
    const res = await apiClient.post('/api/v1/logistics/clients', data);
    return res.data;
  },

  async updateClientPricing(clientId: number, pricing: LogisticsPricing): Promise<{ message: string }> {
    const res = await apiClient.put(`/api/v1/logistics/clients/${clientId}/pricing`, pricing);
    return res.data;
  },

  async getClientBranches(clientId: number): Promise<LogisticsBranchItem[]> {
    const res = await apiClient.get<LogisticsBranchItem[]>(`/api/v1/logistics/clients/${clientId}/branches`);
    return res.data;
  },

  async createClientBranch(clientId: number, data: Partial<LogisticsBranchItem>): Promise<{ message: string; id: number }> {
    const res = await apiClient.post(`/api/v1/logistics/clients/${clientId}/branches`, data);
    return res.data;
  },

  async updateBranch(branchId: number, data: Partial<LogisticsBranchItem>): Promise<{ message: string; id: number }> {
    const res = await apiClient.put(`/api/v1/logistics/branches/${branchId}`, data);
    return res.data;
  },

  async deleteBranch(branchId: number): Promise<{ message: string }> {
    const res = await apiClient.delete(`/api/v1/logistics/branches/${branchId}`);
    return res.data;
  },

  // FLOTA & CHOFERES
  async getDrivers(): Promise<LogisticsDriverItem[]> {
    const res = await apiClient.get<LogisticsDriverItem[]>('/api/v1/logistics/fleet/drivers');
    return res.data;
  },

  async createDriver(data: Partial<LogisticsDriverItem>): Promise<{ message: string; id: number }> {
    const res = await apiClient.post('/api/v1/logistics/fleet/drivers', data);
    return res.data;
  },

  async updateDriver(driverId: number, data: Partial<LogisticsDriverItem>): Promise<{ message: string; id: number }> {
    const res = await apiClient.put(`/api/v1/logistics/fleet/drivers/${driverId}`, data);
    return res.data;
  },

  async getVehicles(): Promise<LogisticsVehicleItem[]> {
    const res = await apiClient.get<LogisticsVehicleItem[]>('/api/v1/logistics/fleet/vehicles');
    return res.data;
  },

  async createVehicle(data: Partial<LogisticsVehicleItem>): Promise<{ message: string; id: number }> {
    const res = await apiClient.post('/api/v1/logistics/fleet/vehicles', data);
    return res.data;
  },

  async updateVehicle(vehicleId: number, data: Partial<LogisticsVehicleItem>): Promise<{ message: string; id: number }> {
    const res = await apiClient.put(`/api/v1/logistics/fleet/vehicles/${vehicleId}`, data);
    return res.data;
  },

  // INVENTARIO & PICKING
  async getInventory(params?: { client_id?: number; search?: string; rack?: string }): Promise<LogisticsInventoryItem[]> {
    const res = await apiClient.get<LogisticsInventoryItem[]>('/api/v1/logistics/inventory', { params });
    return res.data;
  },

  async createInventoryItem(data: any): Promise<{ message: string; id: number; codigo_qr_lote: string }> {
    const res = await apiClient.post('/api/v1/logistics/inventory', data);
    return res.data;
  },

  async createPickingOrder(payload: {
    client_id: number;
    branch_id?: number | null;
    responsable_armado: string;
    contacto_receptor_nombre: string;
    contacto_receptor_telefono: string;
    destino_direccion?: string;
    destino_coordenadas?: string;
    ventana_horaria?: string;
    fecha_entrega_estimada?: string;
    kilometros_recorrido?: number;
    tipo_despacho?: string;
    observaciones?: string;
    items: { inventory_id: number; cantidad?: number; bultos_solicitados?: number; unidades_solicitadas?: number; es_unidades?: boolean }[];
  }): Promise<any> {
    const res = await apiClient.post('/api/v1/logistics/inventory/picking-order', payload);
    return res.data;
  },

  async uploadInventoryExcel(clientId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(`/api/v1/logistics/inventory/upload-excel?client_id=${clientId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async downloadInventoryLabels(params?: { inventory_id?: number; client_id?: number }): Promise<void> {
    const res = await apiClient.get('/api/v1/logistics/inventory/generate-labels', {
      params,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rotulos_3PL_Calcu_${new Date().toISOString().slice(0, 10)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // KANBAN & ORDENES
  async getOrders(params?: { client_id?: number; etapa?: string }): Promise<LogisticsOrderItem[]> {
    const res = await apiClient.get<LogisticsOrderItem[]>('/api/v1/logistics/orders', { params });
    return res.data;
  },

  async createOrder(data: any): Promise<{ message: string; id: number; numero_orden: string }> {
    const res = await apiClient.post('/api/v1/logistics/orders', data);
    return res.data;
  },

  async updateOrderStage(orderId: number, stage: string): Promise<{ message: string }> {
    const res = await apiClient.patch(`/api/v1/logistics/orders/${orderId}/stage`, { etapa_kanban: stage });
    return res.data;
  },

  async assignOrderFleet(orderId: number, data: { vehicle_id: number; driver_id?: number; costo_chofer_acordado?: number; gastos_variables_ruta?: number }): Promise<any> {
    const res = await apiClient.post(`/api/v1/logistics/orders/${orderId}/assign`, data);
    return res.data;
  },

  async signDelivery(orderId: number, payload: { firma_digital?: string; firma_digital_base64?: string; aclaracion?: string; documento?: string; lat?: number; lng?: number }): Promise<any> {
    const res = await apiClient.post(`/api/v1/logistics/orders/${orderId}/sign-delivery`, {
      firma_digital: payload.firma_digital || payload.firma_digital_base64,
      aclaracion: payload.aclaracion,
      documento: payload.documento,
      lat: payload.lat,
      lng: payload.lng,
    });
    return res.data;
  },

  async getDriverSheet(orderId: number): Promise<DriverDeliverySheetResponse> {
    const res = await apiClient.get<DriverDeliverySheetResponse>(`/api/v1/logistics/orders/${orderId}/driver-sheet`);
    return res.data;
  },

  async downloadOrderRemitoPdf(orderId: number, numeroOrden: string): Promise<void> {
    const res = await apiClient.get(`/api/v1/logistics/orders/${orderId}/remito-pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Remito_${numeroOrden || orderId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // TRACKING GPS
  async getLiveTracking(): Promise<LiveFleetMarker[]> {
    const res = await apiClient.get<LiveFleetMarker[]>('/api/v1/logistics/tracking/live');
    return res.data;
  },

  async sendTelemetryPing(orderId: number, ping: { lat: number; lng: number; velocidad_kmh?: number; bateria_pct?: number }): Promise<any> {
    const res = await apiClient.post(`/api/v1/logistics/tracking/${orderId}/ping`, ping);
    return res.data;
  },

  // LIQUIDACION & COSTOS / EBITDA
  async calculateQuote(payload: {
    client_id: number;
    dias_almacenaje: number;
    pallets: number;
    total_bultos: number;
    total_unidades: number;
    distancia_km: number;
    iva_pct?: number;
  }): Promise<ServiceSettlementResponse> {
    const res = await apiClient.post<ServiceSettlementResponse>('/api/v1/logistics/billing/quote', payload);
    return res.data;
  },

  async getFinanceSummary(): Promise<FinanceSummaryResponse> {
    const res = await apiClient.get<FinanceSummaryResponse>('/api/v1/logistics/finance/summary');
    return res.data;
  },

  async getCostItems(tipo?: string): Promise<LogisticsCostItem[]> {
    const res = await apiClient.get<LogisticsCostItem[]>('/api/v1/logistics/finance/costs', { params: tipo ? { tipo } : {} });
    return res.data;
  },

  async createCostItem(data: Partial<LogisticsCostItem>): Promise<{ message: string; id: number }> {
    const res = await apiClient.post('/api/v1/logistics/finance/costs', data);
    return res.data;
  },

  async updateCostItem(costId: number, data: Partial<LogisticsCostItem>): Promise<{ message: string; id: number }> {
    const res = await apiClient.put(`/api/v1/logistics/finance/costs/${costId}`, data);
    return res.data;
  },

  async deleteCostItem(costId: number): Promise<{ message: string }> {
    const res = await apiClient.delete(`/api/v1/logistics/finance/costs/${costId}`);
    return res.data;
  },

  async getEbitdaAnalysis(): Promise<EbitdaAnalysisResponse> {
    const res = await apiClient.get<EbitdaAnalysisResponse>('/api/v1/logistics/finance/ebitda');
    return res.data;
  },
};
