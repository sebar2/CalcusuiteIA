import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Truck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Building2,
  X,
  QrCode,
  FileSignature,
  Eye,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type {
  LogisticsOrderItem,
  LogisticsClientItem,
  LogisticsVehicleItem,
  LogisticsDriverItem,
} from '../../services/logisticsApi';

const KANBAN_STAGES = [
  { id: 'INGRESO', label: '1. Ingreso & Descarga', color: 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20' },
  { id: 'ETIQUETADO_VAS', label: '2. Acondicionamiento / VAS', color: 'border-violet-400 bg-violet-50/40 dark:bg-violet-950/20' },
  { id: 'LISTO_DESPACHO', label: '3. Listo para Despacho', color: 'border-sky-400 bg-sky-50/40 dark:bg-sky-950/20' },
  { id: 'EN_DISTRIBUCION', label: '4. En Distribución', color: 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20' },
  { id: 'ENTREGADO', label: '5. Entregado con Conformidad', color: 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20' },
];

export const LogisticsKanbanView: React.FC = () => {
  const [orders, setOrders] = useState<LogisticsOrderItem[]>([]);
  const [clients, setClients] = useState<LogisticsClientItem[]>([]);
  const [vehicles, setVehicles] = useState<LogisticsVehicleItem[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriverItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState<LogisticsOrderItem | null>(null);
  const [assignVehicleId, setAssignVehicleId] = useState<string>('');
  const [assignDriverId, setAssignDriverId] = useState<string>('');
  const [assignDriverCost, setAssignDriverCost] = useState<number>(38.0);
  const [assignValidationPreview, setAssignValidationPreview] = useState<any>(null);

  // Signature Modal
  const [selectedSignatureOrder, setSelectedSignatureOrder] = useState<LogisticsOrderItem | null>(null);

  // Quick Order Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [orderForm, setOrderForm] = useState({
    client_id: '',
    destino_direccion: '',
    ventana_horaria: '09:00 - 13:00',
    remito_numero: '',
    sku_cliente: '',
    descripcion: '',
    bultos: 30,
    peso_total_kg: 350,
    volumen_total_m3: 1.8,
    tarifa_flete_cliente: 65.0,
    costo_chofer_estimado: 38.0,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordData, cliData, vehData, driData] = await Promise.all([
        logisticsApi.getOrders({
          client_id: selectedClientId !== 'ALL' ? Number(selectedClientId) : undefined,
        }),
        logisticsApi.getClients(),
        logisticsApi.getVehicles(),
        logisticsApi.getDrivers(),
      ]);
      setOrders(ordData);
      setClients(cliData);
      setVehicles(vehData);
      setDrivers(driData);
    } catch (err) {
      console.error('Error al cargar órdenes del Kanban 3PL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClientId]);

  // Stage transition
  const handleMoveStage = async (orderId: number, currentStage: string, direction: 'forward' | 'backward') => {
    const stageIds = KANBAN_STAGES.map((s) => s.id);
    const currentIndex = stageIds.indexOf(currentStage);
    const targetIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;

    if (targetIndex < 0 || targetIndex >= stageIds.length) return;
    const targetStage = stageIds[targetIndex];

    try {
      await logisticsApi.updateOrderStage(orderId, targetStage);
      loadData();
    } catch (err: any) {
      alert(`Error al mover etapa: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleOpenAssign = (order: LogisticsOrderItem) => {
    setSelectedOrderForAssign(order);
    const initialVehicle = order.vehicle?.id ? String(order.vehicle.id) : (vehicles[0] ? String(vehicles[0].id) : '');
    const initialDriver = order.driver?.id ? String(order.driver.id) : (drivers[0] ? String(drivers[0].id) : '');
    setAssignVehicleId(initialVehicle);
    setAssignDriverId(initialDriver);
    setAssignDriverCost(order.costo_chofer_acordado || 38.0);
    setIsAssignModalOpen(true);
  };

  // Live capacity calculation inside modal
  useEffect(() => {
    if (!selectedOrderForAssign || !assignVehicleId) {
      setAssignValidationPreview(null);
      return;
    }
    const veh = vehicles.find((v) => String(v.id) === String(assignVehicleId));
    if (!veh) return;

    const pesoUtil = (selectedOrderForAssign.total_kg / veh.capacidad_kg) * 100;
    const volUtil = (selectedOrderForAssign.total_m3 / veh.volumen_m3) * 100;
    const isOverweight = selectedOrderForAssign.total_kg > veh.capacidad_kg;
    const isOvervolume = selectedOrderForAssign.total_m3 > veh.volumen_m3;

    setAssignValidationPreview({
      vehiculo: veh.matricula,
      tipo: veh.tipo_vehiculo,
      cap_kg: veh.capacidad_kg,
      cap_m3: veh.volumen_m3,
      pesoUtil: pesoUtil.toFixed(1),
      volUtil: volUtil.toFixed(1),
      isOverweight,
      isOvervolume,
      canDispatch: !isOverweight && !isOvervolume,
    });
  }, [assignVehicleId, selectedOrderForAssign]);

  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForAssign || !assignVehicleId) return;

    try {
      await logisticsApi.assignOrderFleet(selectedOrderForAssign.id, {
        vehicle_id: Number(assignVehicleId),
        driver_id: assignDriverId ? Number(assignDriverId) : undefined,
        costo_chofer_acordado: Number(assignDriverCost),
      });
      setIsAssignModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Error al asignar flota: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.client_id) {
      alert('Seleccione un cliente 3PL');
      return;
    }
    try {
      await logisticsApi.createOrder({
        client_id: Number(orderForm.client_id),
        destino_direccion: orderForm.destino_direccion,
        ventana_horaria: orderForm.ventana_horaria,
        remito_numero: orderForm.remito_numero || undefined,
        tarifa_flete_cliente: Number(orderForm.tarifa_flete_cliente),
        costo_chofer_acordado: Number(orderForm.costo_chofer_estimado),
        items: [
          {
            sku_cliente: orderForm.sku_cliente || 'SKU-GENERAL',
            descripcion: orderForm.descripcion || 'Bultos surtidos cliente',
            bultos_despacho: Number(orderForm.bultos),
            kg_subtotal: Number(orderForm.peso_total_kg),
            m3_subtotal: Number(orderForm.volumen_total_m3),
          },
        ],
      });
      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Error al crear orden: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400">
              <ClipboardList size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Kanban Operativo 3PL (Etapas de Despacho)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control de flujo físico desde descarga y acondicionamiento hasta despacho y conformidad
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Building2 size={15} />
            <span className="font-semibold">Cliente:</span>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Todos los Clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_comercial}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Nueva Orden de Despacho</span>
          </button>
        </div>
      </div>

      {/* Kanban Board 5 Columns */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Cargando tablero Kanban...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {KANBAN_STAGES.map((stage) => {
            const stageOrders = orders.filter((o) => o.etapa_kanban === stage.id);
            const stageBultos = stageOrders.reduce((acc, o) => acc + o.total_bultos, 0);

            return (
              <div
                key={stage.id}
                className={`rounded-2xl border-t-4 ${stage.color} border border-slate-200/80 dark:border-slate-800 p-3 min-h-[500px] flex flex-col justify-between shadow-xs`}
              >
                <div>
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                      {stage.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {stageOrders.length}
                    </span>
                  </div>
                  <div className="py-1 text-[10px] text-slate-400">
                    {stageBultos} bultos en etapa
                  </div>

                  {/* Cards List */}
                  <div className="space-y-3 mt-2">
                    {stageOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Top: Order number & Client */}
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-mono text-xs font-bold text-[#00a2e8] dark:text-sky-400 block">
                                {order.numero_orden}
                              </span>
                              {order.tipo_despacho === 'PICKING_PARCIAL' && (
                                <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                                  📦 Picking Parcial
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                              {order.client_nombre}
                            </span>
                          </div>

                          {/* Destination & Branch */}
                          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                            {order.branch_nombre && (
                              <div className="flex items-center space-x-1 font-bold text-purple-700 dark:text-purple-400 text-[11px]">
                                <Building2 size={12} className="shrink-0" />
                                <span>{order.branch_nombre}</span>
                              </div>
                            )}
                            <div className="flex items-start space-x-1.5">
                              <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2 leading-tight font-medium">
                                {order.destino_direccion}
                              </span>
                            </div>
                            {order.kilometros_recorrido ? (
                              <div className="text-[10px] text-slate-400 pl-4 font-medium">
                                Distancia estimada: <b>{order.kilometros_recorrido} km</b>
                              </div>
                            ) : null}
                          </div>

                          {/* Supervisor & Recipient Contact */}
                          {(order.responsable_armado || order.contacto_receptor_nombre) && (
                            <div className="mt-2 p-1.5 bg-slate-50/80 dark:bg-slate-800/30 rounded-lg text-[10px] space-y-0.5 border border-slate-100 dark:border-slate-800">
                              {order.responsable_armado && (
                                <p className="text-slate-600 dark:text-slate-400">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Armado:</span> {order.responsable_armado}
                                </p>
                              )}
                              {order.contacto_receptor_nombre && (
                                <p className="text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Receptor:</span>
                                  <span>{order.contacto_receptor_nombre}</span>
                                  {order.contacto_receptor_telefono && (
                                    <span className="text-slate-400">({order.contacto_receptor_telefono})</span>
                                  )}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Metrics: bultos, kg, m3 */}
                          <div className="grid grid-cols-3 gap-1 mt-2.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-center text-[10px]">
                            <div>
                              <span className="text-slate-400 block">Bultos</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{order.total_bultos}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Tara kg</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{order.total_kg.toFixed(0)} kg</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Cubicaje</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{order.total_m3.toFixed(2)} m³</span>
                            </div>
                          </div>

                          {/* QR Code Remito Badge */}
                          {order.codigo_qr && (
                            <div className="mt-1.5 flex items-center space-x-1 text-[10px] font-mono text-slate-500">
                              <QrCode size={11} className="text-slate-400" />
                              <span className="truncate">{order.codigo_qr}</span>
                            </div>
                          )}

                          {/* Digital Signature Confirmation Badge */}
                          {order.firma_digital_receptor && (
                            <div className="mt-2 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold flex items-center justify-between border border-emerald-200/50 dark:border-emerald-800/50">
                              <span className="flex items-center space-x-1">
                                <FileSignature size={12} className="text-emerald-600" />
                                <span>Firma: {order.firma_aclaracion || 'Receptor'}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedSignatureOrder(order)}
                                className="text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-0.5 cursor-pointer font-bold"
                              >
                                <Eye size={11} />
                                <span>Ver</span>
                              </button>
                            </div>
                          )}

                          {/* Overweight / Overvolume Alert Badge */}
                          {order.capacity_status && (
                            <div
                              className={`mt-2 p-1.5 rounded-lg text-[10px] font-semibold flex items-center space-x-1 ${
                                order.capacity_status.can_dispatch
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {!order.capacity_status.can_dispatch && (
                                <AlertTriangle size={12} className="shrink-0 text-rose-600" />
                              )}
                              <span>
                                Carga: {order.capacity_status.utilizacion_peso_pct}% tara | {order.capacity_status.utilizacion_volumen_pct}% m³
                              </span>
                            </div>
                          )}

                          {/* Vehicle & Driver Assigned */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                            {order.vehicle ? (
                              <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                <Truck size={13} className="text-amber-500" />
                                <span className="font-mono font-bold">{order.vehicle.matricula}</span>
                                <span className="text-[10px] text-slate-400">({order.driver?.nombre?.split(' ')[0]})</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenAssign(order)}
                                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center space-x-1"
                              >
                                <Plus size={12} />
                                <span>Asignar Fletero</span>
                              </button>
                            )}

                            {order.vehicle && (
                              <button
                                onClick={() => handleOpenAssign(order)}
                                className="text-[10px] text-slate-400 hover:text-sky-600 cursor-pointer"
                                title="Reasignar vehículo / chofer"
                              >
                                Cambiar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Navigation buttons */}
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <button
                            disabled={stage.id === 'INGRESO'}
                            onClick={() => handleMoveStage(order.id, order.etapa_kanban, 'backward')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            title="Retroceder etapa"
                          >
                            <ArrowLeft size={14} />
                          </button>

                          <button
                            disabled={stage.id === 'ENTREGADO'}
                            onClick={() => handleMoveStage(order.id, order.etapa_kanban, 'forward')}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-[#00a2e8] dark:text-sky-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            <span>Avanzar</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Asignar Vehículo y Chofer con Validación de Cubitaje */}
      {isAssignModalOpen && selectedOrderForAssign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Truck className="text-sky-500" size={18} />
                <span>Asignación Inteligente de Flota</span>
              </h2>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Orden:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOrderForAssign.numero_orden}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destino:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[280px]">
                  {selectedOrderForAssign.destino_direccion}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-semibold">
                <span>Carga requerida:</span>
                <span className="text-sky-600 dark:text-sky-400">
                  {selectedOrderForAssign.total_bultos} bultos | {selectedOrderForAssign.total_kg.toFixed(0)} kg | {selectedOrderForAssign.total_m3.toFixed(2)} m³
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveAssign} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Seleccionar Vehículo</label>
                <select
                  required
                  value={assignVehicleId}
                  onChange={(e) => setAssignVehicleId(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Seleccionar Unidad --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.matricula} ({v.tipo_vehiculo}) - Cap: {v.capacidad_kg}kg / {v.volumen_m3}m³
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Volumetric & Weight Check Badge */}
              {assignValidationPreview && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    assignValidationPreview.canDispatch
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold">
                    {assignValidationPreview.canDispatch ? (
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={15} className="text-rose-600" />
                    )}
                    <span>
                      {assignValidationPreview.canDispatch
                        ? 'Carga compatible con la capacidad del vehículo'
                        : '¡Advertencia de Sobrecarga! Supera tara o volumen'}
                    </span>
                  </div>
                  <div className="text-[11px] flex justify-between">
                    <span>Tara: {assignValidationPreview.pesoUtil}% de {assignValidationPreview.cap_kg} kg</span>
                    <span>Cubicaje: {assignValidationPreview.volUtil}% de {assignValidationPreview.cap_m3} m³</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600">Chofer Asignado</label>
                <select
                  required
                  value={assignDriverId}
                  onChange={(e) => setAssignDriverId(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({d.tipo_licencia}) - {d.tipo_relacion.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Pago Acordado al Fletero ($)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={assignDriverCost}
                  onChange={(e) => setAssignDriverCost(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-xl cursor-pointer shadow-xs"
                >
                  Confirmar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Orden Rápida */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Plus className="text-sky-500" size={18} />
                <span>Nueva Orden de Despacho 3PL</span>
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Cliente 3PL</label>
                <select
                  required
                  value={orderForm.client_id}
                  onChange={(e) => setOrderForm({ ...orderForm, client_id: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Seleccionar Cliente --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_comercial} ({c.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Dirección de Destino</label>
                <input
                  type="text"
                  required
                  placeholder="Sucursal, calle y número"
                  value={orderForm.destino_direccion}
                  onChange={(e) => setOrderForm({ ...orderForm, destino_direccion: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Ventana Horaria</label>
                  <input
                    type="text"
                    value={orderForm.ventana_horaria}
                    onChange={(e) => setOrderForm({ ...orderForm, ventana_horaria: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Nº de Remito Cliente</label>
                  <input
                    type="text"
                    placeholder="REM-12345"
                    value={orderForm.remito_numero}
                    onChange={(e) => setOrderForm({ ...orderForm, remito_numero: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Bultos y Cubicaje a Despachar
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Total Bultos</label>
                    <input
                      type="number"
                      required
                      value={orderForm.bultos}
                      onChange={(e) => setOrderForm({ ...orderForm, bultos: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Peso Total (kg)</label>
                    <input
                      type="number"
                      step="5"
                      required
                      value={orderForm.peso_total_kg}
                      onChange={(e) => setOrderForm({ ...orderForm, peso_total_kg: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Volumen (m³)</label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={orderForm.volumen_total_m3}
                      onChange={(e) => setOrderForm({ ...orderForm, volumen_total_m3: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Tarifa Flete Cliente ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={orderForm.tarifa_flete_cliente}
                    onChange={(e) => setOrderForm({ ...orderForm, tarifa_flete_cliente: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Costo Conductor Estimado ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={orderForm.costo_chofer_estimado}
                    onChange={(e) => setOrderForm({ ...orderForm, costo_chofer_estimado: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-xl cursor-pointer shadow-xs"
                >
                  Crear Despacho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizar Firma Digital de Entrega */}
      {selectedSignatureOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 rounded-lg">
                  <FileSignature size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Comprobante de Conformidad
                  </h2>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    {selectedSignatureOrder.numero_orden}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSignatureOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5 border border-slate-200 dark:border-slate-700">
                <p className="flex justify-between">
                  <span className="text-slate-400">Cliente:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedSignatureOrder.client_nombre}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">Destino:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-right truncate max-w-[200px]">
                    {selectedSignatureOrder.destino_direccion}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">Bultos Entregados:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedSignatureOrder.total_bultos} bultos ({selectedSignatureOrder.total_kg} kg)
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">Conductor:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedSignatureOrder.driver?.nombre || 'Fletero'} ({selectedSignatureOrder.vehicle?.matricula || '-'})
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400">Aclaración / Receptor:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedSignatureOrder.firma_aclaracion || 'Receptor'}
                  </span>
                </p>
                {selectedSignatureOrder.firma_fecha_hora && (
                  <p className="flex justify-between">
                    <span className="text-slate-400">Fecha y Hora:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {new Date(selectedSignatureOrder.firma_fecha_hora).toLocaleString()}
                    </span>
                  </p>
                )}
              </div>

              {/* Firma en Pantalla Táctil */}
              <div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                  Firma Digital Capturada
                </span>
                <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-950 flex items-center justify-center min-h-[140px]">
                  {selectedSignatureOrder.firma_digital_receptor ? (
                    <img
                      src={selectedSignatureOrder.firma_digital_receptor}
                      alt="Firma del receptor"
                      className="max-h-32 object-contain"
                    />
                  ) : (
                    <span className="text-slate-400 italic">Sin firma digital registrada</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSignatureOrder(null)}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl cursor-pointer"
                >
                  Cerrar Comprobante
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default LogisticsKanbanView;
