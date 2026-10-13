import React, { useState, useEffect } from 'react';
import {
  Anchor,
  Shield,
  FileText,
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  X,
} from 'lucide-react';
import { apiService, getStoredUser } from '../../services/api';
import type {
  ImplicitServiceItem,
  ImplicitBudgetOrder,
  TipoServicioLogistico,
  SupplierItem,
  UserRole,
} from '../../types';

interface ImplicitBudgetsSectionProps {
  suppliers: SupplierItem[];
  currentRole?: UserRole;
}

export const ImplicitBudgetsSection: React.FC<ImplicitBudgetsSectionProps> = ({
  suppliers,
  currentRole,
}) => {
  const effectiveRole = currentRole || (getStoredUser()?.role as UserRole) || 'controller_admin';
  const isAdmin = effectiveRole === 'controller_admin';

  const [catalog, setCatalog] = useState<ImplicitServiceItem[]>([]);
  const [budgets, setBudgets] = useState<ImplicitBudgetOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'presupuestos' | 'catalogo'>('presupuestos');

  // Modal: Nuevo Servicio al Catálogo
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catNombre, setCatNombre] = useState('');
  const [catTipo, setCatTipo] = useState<TipoServicioLogistico>('MARITIMO');
  const [catCosto, setCatCosto] = useState<number>(1500);
  const [catUnidad, setCatUnidad] = useState('Por Contenedor');
  const [catDesc, setCatDesc] = useState('');
  const [catProvId, setCatProvId] = useState<string>('');
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);

  // Modal: Nuevo Presupuesto Implícito
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [bgTitulo, setBgTitulo] = useState('');
  const [bgBuque, setBgBuque] = useState('');
  const [bgObs, setBgObs] = useState('');
  const [bgItems, setBgItems] = useState<{
    servicio_catalogo_id?: number;
    supplier_id?: number;
    tipo_servicio: string;
    concepto: string;
    cantidad: number;
    costo_unitario_usd: number;
    observaciones?: string;
  }[]>([
    {
      tipo_servicio: 'MARITIMO',
      concepto: 'Flete Marítimo Contenedor 40ft HQ Ningbo-MVD',
      cantidad: 1,
      costo_unitario_usd: 3200,
    },
    {
      tipo_servicio: 'SEGURO',
      concepto: 'Seguro Internacional de Carga Todo Riesgo',
      cantidad: 1,
      costo_unitario_usd: 450,
    },
    {
      tipo_servicio: 'ADUANA',
      concepto: 'Despacho Aduanero y Apertura DUA en Puerto',
      cantidad: 1,
      costo_unitario_usd: 600,
    },
    {
      tipo_servicio: 'FLETE_CAMION',
      concepto: 'Flete Camión Puerto MVD a Depósito Central',
      cantidad: 1,
      costo_unitario_usd: 350,
    },
  ]);
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Feedback Messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catData, bgData] = await Promise.all([
        apiService.getImplicitCatalog().catch(() => []),
        apiService.getImplicitBudgets().catch(() => []),
      ]);
      setCatalog(catData);
      setBudgets(bgData);
    } catch (err) {
      console.error('Error fetching implicit budgets data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNombre.trim() || catCosto <= 0) {
      setErrorMsg('Nombre y costo de referencia son requeridos.');
      return;
    }
    setIsSavingCatalog(true);
    setErrorMsg(null);
    try {
      await apiService.createImplicitCatalogItem({
        tipo_servicio: catTipo,
        nombre_servicio: catNombre.trim(),
        costo_referencia_usd: Number(catCosto),
        unidad_medida: catUnidad.trim() || 'Servicio',
        descripcion: catDesc.trim() || undefined,
        proveedor_sugerido_id: catProvId ? Number(catProvId) : undefined,
      });
      setIsCatalogModalOpen(false);
      setSuccessMsg('Servicio logístico agregado exitosamente al catálogo.');
      setTimeout(() => setSuccessMsg(null), 5000);
      setCatNombre('');
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error al guardar ítem de catálogo.');
    } finally {
      setIsSavingCatalog(false);
    }
  };

  const handleAddBudgetItem = () => {
    setBgItems([
      ...bgItems,
      {
        tipo_servicio: 'FLETE_CAMION',
        concepto: 'Servicio Logístico Adicional',
        cantidad: 1,
        costo_unitario_usd: 200,
      },
    ]);
  };

  const handleRemoveBudgetItem = (idx: number) => {
    setBgItems(bgItems.filter((_, i) => i !== idx));
  };

  const handleUpdateBudgetItem = (idx: number, field: string, val: any) => {
    const next = [...bgItems];
    (next[idx] as any)[field] = val;
    setBgItems(next);
  };

  const handleSelectFromCatalog = (idx: number, catalogId: number) => {
    const item = catalog.find((c) => c.id === catalogId);
    if (!item) return;
    const next = [...bgItems];
    next[idx] = {
      ...next[idx],
      servicio_catalogo_id: item.id,
      tipo_servicio: item.tipo_servicio,
      concepto: item.nombre_servicio,
      costo_unitario_usd: item.costo_referencia_usd,
      supplier_id: item.proveedor_sugerido_id || undefined,
    };
    setBgItems(next);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgTitulo.trim() || bgItems.length === 0) {
      setErrorMsg('El presupuesto requiere un título y al menos un ítem.');
      return;
    }
    setIsSavingBudget(true);
    setErrorMsg(null);
    try {
      const res = await apiService.createImplicitBudget({
        titulo: bgTitulo.trim(),
        buque_o_embarque: bgBuque.trim() || undefined,
        items: bgItems.map((it) => ({
          servicio_catalogo_id: it.servicio_catalogo_id,
          supplier_id: it.supplier_id,
          tipo_servicio: it.tipo_servicio,
          concepto: it.concepto,
          cantidad: Number(it.cantidad),
          costo_unitario_usd: Number(it.costo_unitario_usd),
          observaciones: it.observaciones,
        })),
        observaciones: bgObs.trim() || undefined,
      });

      setIsBudgetModalOpen(false);
      setSuccessMsg(res.message || 'Presupuesto implícito creado en estado pendiente de aprobación.');
      setTimeout(() => setSuccessMsg(null), 5000);
      setBgTitulo('');
      setBgBuque('');
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error al generar presupuesto implícito.');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleApproveBudget = async (id: number, accion: 'APROBADO' | 'RECHAZADO') => {
    try {
      const res = await apiService.approveImplicitBudget(id, { accion });
      setSuccessMsg(res.message || `Presupuesto ${accion.toLowerCase()} correctamente.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al actualizar el estado del presupuesto.');
    }
  };

  const getServiceIcon = (tipo: string) => {
    switch (tipo) {
      case 'MARITIMO':
        return <Anchor size={14} className="text-blue-500" />;
      case 'SEGURO':
        return <Shield size={14} className="text-emerald-500" />;
      case 'ADUANA':
        return <FileText size={14} className="text-amber-500" />;
      case 'FLETE_CAMION':
        return <Truck size={14} className="text-purple-500" />;
      default:
        return <DollarSign size={14} className="text-slate-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Anchor size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Presupuestos Implícitos (Landed Costs & Cadena Logística)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                {budgets.length} presupuestos
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Proveedores de Fletes Marítimos, Seguros de Carga, Despacho de Aduana y Camiones terrestres con aprobación de Directorio.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Tabs Selector */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex space-x-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('presupuestos')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'presupuestos'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Presupuestos ({budgets.length})
            </button>
            <button
              onClick={() => setActiveTab('catalogo')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'catalogo'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Catálogo de Servicios ({catalog.length})
            </button>
          </div>

          {activeTab === 'presupuestos' ? (
            <button
              onClick={() => setIsBudgetModalOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Plus size={14} />
              <span>+ Nuevo Presupuesto</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCatalogModalOpen(true)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Plus size={14} />
              <span>+ Nuevo Servicio</span>
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Vista Presupuestos */}
      {activeTab === 'presupuestos' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              Cargando presupuestos implícitos...
            </div>
          ) : budgets.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No hay órdenes de presupuesto implícito registradas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {budgets.map((bg) => {
                const isPending = bg.estado_aprobacion === 'PENDIENTE_APROBACION';
                const isApproved = bg.estado_aprobacion === 'APROBADO';

                return (
                  <div
                    key={bg.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 hover:border-blue-400 transition-colors shadow-2xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                            {bg.numero_presupuesto}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : isPending
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {bg.estado_aprobacion}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mt-1.5">
                          {bg.titulo}
                        </h4>
                        {bg.buque_o_embarque && (
                          <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                            <Anchor size={11} className="text-blue-500" />
                            <span>Buque: <strong>{bg.buque_o_embarque}</strong></span>
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Total Landed:</span>
                        <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                          ${(bg.total_usd || 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                        </span>
                      </div>
                    </div>

                    {/* Desglose de ítems */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Servicios y Proveedores Incluidos:
                      </span>
                      {bg.items && bg.items.length > 0 ? (
                        bg.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-700 dark:text-slate-300 py-0.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                            <span className="flex items-center space-x-1.5 truncate max-w-[240px]">
                              {getServiceIcon(it.tipo_servicio)}
                              <span className="truncate">{it.concepto}</span>
                            </span>
                            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                              {it.cantidad}x ${(it.costo_unitario_usd || 0).toFixed(2)} = ${(it.subtotal_usd || 0).toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">Sin ítems detallados</span>
                      )}
                    </div>

                    {/* Acciones de Aprobación por Directorio */}
                    {isPending && isAdmin && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                          <Clock size={12} />
                          <span>Requiere Aprobación de Directorio</span>
                        </span>
                        <div className="flex space-x-1.5">
                          <button
                            onClick={() => handleApproveBudget(bg.id, 'RECHAZADO')}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
                          >
                            Rechazar
                          </button>
                          <button
                            onClick={() => handleApproveBudget(bg.id, 'APROBADO')}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs transition-colors flex items-center space-x-1"
                          >
                            <CheckCircle2 size={12} />
                            <span>Aprobar Presupuesto</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Vista Catálogo de Servicios */}
      {activeTab === 'catalogo' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Servicio Logístico</th>
                <th className="py-2.5 px-3">Unidad de Medida</th>
                <th className="py-2.5 px-3 text-right">Costo Ref. (USD)</th>
                <th className="py-2.5 px-3">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {catalog.map((srv) => (
                <tr key={srv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3">
                    <span className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
                      {getServiceIcon(srv.tipo_servicio)}
                      <span>{srv.tipo_servicio}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                    {srv.nombre_servicio}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{srv.unidad_medida}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                    ${srv.costo_referencia_usd.toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[200px]">
                    {srv.descripcion || 'Estándar'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Nuevo Servicio al Catálogo */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Agregar Servicio Logístico al Catálogo
              </h3>
              <button onClick={() => setIsCatalogModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Servicio *
                </label>
                <select
                  value={catTipo}
                  onChange={(e) => setCatTipo(e.target.value as TipoServicioLogistico)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                >
                  <option value="MARITIMO">Flete Marítimo (Buques & Navieras)</option>
                  <option value="SEGURO">Seguro Internacional de Carga</option>
                  <option value="ADUANA">Liberación de Aduana / Despacho</option>
                  <option value="FLETE_CAMION">Camiones / Flete Terrestre</option>
                  <option value="OTRO">Otro Servicio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  value={catNombre}
                  onChange={(e) => setCatNombre(e.target.value)}
                  placeholder="ej: Contenedor 20ft Standard Ningbo a MVD"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Costo Ref. (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={catCosto}
                    onChange={(e) => setCatCosto(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unidad de Medida
                  </label>
                  <input
                    type="text"
                    value={catUnidad}
                    onChange={(e) => setCatUnidad(e.target.value)}
                    placeholder="ej: Por Contenedor / Por DUA"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Detalles sobre alcance del servicio"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Proveedor Sugerido
                </label>
                <select
                  value={catProvId}
                  onChange={(e) => setCatProvId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                >
                  <option value="">(Opcional) Sin proveedor asignado</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.nombre} ({s.tipo_proveedor || s.pais || 'Proveedor'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCatalog}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  {isSavingCatalog ? 'Guardando...' : 'Guardar en Catálogo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Presupuesto Implícito */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Generar Presupuesto Implícito Multi-Servicio
              </h3>
              <button onClick={() => setIsBudgetModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4 overflow-y-auto flex-1 p-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Título del Presupuesto *
                  </label>
                  <input
                    type="text"
                    value={bgTitulo}
                    onChange={(e) => setBgTitulo(e.target.value)}
                    placeholder="ej: Costos Logísticos Embarque Octubre 2026"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Buque / Identificador de Embarque
                  </label>
                  <input
                    type="text"
                    value={bgBuque}
                    onChange={(e) => setBgBuque(e.target.value)}
                    placeholder="ej: MSC LAURA V.204"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones Generales
                </label>
                <input
                  type="text"
                  value={bgObs}
                  onChange={(e) => setBgObs(e.target.value)}
                  placeholder="Detalles sobre términos comerciales o aprobación requerida"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Servicios Incluidos (Marítimo, Seguro, Aduana, Flete)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddBudgetItem}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                  >
                    <Plus size={12} />
                    <span>+ Agregar Servicio</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {bgItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Cargar de Catálogo</label>
                          <select
                            onChange={(e) => {
                              if (e.target.value) handleSelectFromCatalog(idx, Number(e.target.value));
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="">Seleccionar del catálogo...</option>
                            {catalog.map((c) => (
                              <option key={c.id} value={c.id}>
                                [{c.tipo_servicio}] {c.nombre_servicio} (${c.costo_referencia_usd})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Tipo de Servicio *</label>
                          <select
                            value={it.tipo_servicio}
                            onChange={(e) => handleUpdateBudgetItem(idx, 'tipo_servicio', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="MARITIMO">Flete Marítimo</option>
                            <option value="SEGURO">Seguro</option>
                            <option value="ADUANA">Liberación Aduana</option>
                            <option value="FLETE_CAMION">Camión / Flete</option>
                            <option value="OTRO">Otro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Concepto / Servicio *</label>
                          <input
                            type="text"
                            value={it.concepto}
                            onChange={(e) => handleUpdateBudgetItem(idx, 'concepto', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Cantidad *</label>
                          <input
                            type="number"
                            min="1"
                            value={it.cantidad}
                            onChange={(e) => handleUpdateBudgetItem(idx, 'cantidad', Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Costo Unit. (USD) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.costo_unitario_usd}
                            onChange={(e) => handleUpdateBudgetItem(idx, 'costo_unitario_usd', Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono"
                            required
                          />
                        </div>
                        <div className="flex justify-end items-center">
                          {bgItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBudgetItem(idx)}
                              className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="text-xs">
                  <span className="text-slate-500">Total Presupuestado: </span>
                  <strong className="font-mono text-base text-blue-700 dark:text-blue-300">
                    ${bgItems.reduce((acc, it) => acc + (it.cantidad * it.costo_unitario_usd || 0), 0).toFixed(2)} USD
                  </strong>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsBudgetModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBudget}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    {isSavingBudget ? 'Generando...' : 'Generar Presupuesto'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
