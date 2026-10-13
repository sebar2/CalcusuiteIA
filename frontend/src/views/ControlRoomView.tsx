import { useState, useEffect, useMemo } from 'react';
import { 
  Boxes, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  ShoppingCart,
  Edit2,
  X,
  Eye
} from 'lucide-react';
import type { InventoryAlertItem, SupplyActionPlanResponse, SupplierItem, WarehouseItem, UserRole } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable } from '../components/common/DataTable';
import type { Column } from '../components/common/DataTable';
import { InventoryQuickEditModal } from '../components/inventory/InventoryQuickEditModal';
import { ProductThumbnail } from '../components/common/ProductThumbnail';
import { apiService, getStoredUser } from '../services/api';
import { LocalPurchaseOrdersSection } from '../components/supply/LocalPurchaseOrdersSection';
import { ImplicitBudgetsSection } from '../components/supply/ImplicitBudgetsSection';
import { ReventaSuppliersSection } from '../components/supply/ReventaSuppliersSection';

interface ControlRoomViewProps {
  inventory: InventoryAlertItem[];
  isLoading?: boolean;
  selectedCategory: string;
  onlyAlerts: boolean;
  leadTimeFilter: boolean;
  searchQuery: string;
  currentRole?: UserRole;
  onItemUpdated?: (updated: InventoryAlertItem) => void;
}

export const ControlRoomView = ({
  inventory,
  selectedCategory,
  onlyAlerts,
  leadTimeFilter,
  searchQuery,
  currentRole,
  onItemUpdated,
}: ControlRoomViewProps) => {
  const effectiveRole = currentRole || (getStoredUser()?.role as UserRole) || 'controller_admin';
  const [localInventory, setLocalInventory] = useState<InventoryAlertItem[]>(inventory);
  const [editingItem, setEditingItem] = useState<InventoryAlertItem | null>(null);
  const [inspectingItem, setInspectingItem] = useState<InventoryAlertItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [copilotPlan, setCopilotPlan] = useState<SupplyActionPlanResponse | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  // Proveedores y Almacenes para Órdenes Uy, Presupuestos Implícitos y Reventa
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);

  const loadSuppliersAndWarehouses = async () => {
    try {
      const [sData, wData] = await Promise.all([
        apiService.getSuppliers().catch(() => []),
        apiService.getWarehouses().catch(() => []),
      ]);
      setSuppliers(sData);
      setWarehouses(wData);
    } catch (e) {
      console.error('Error cargando proveedores en ControlRoomView', e);
    }
  };

  useEffect(() => {
    loadSuppliersAndWarehouses();
  }, []);

  const uySuppliers = useMemo(() => {
    return suppliers.filter(
      (s) =>
        s.tipo_proveedor === 'PROVEEDOR_UY' ||
        s.tipo_proveedor === 'PROVEEDOR_REVENTA' ||
        s.tipo_proveedor === 'LOCAL' ||
        s.pais?.toLowerCase() === 'uruguay'
    );
  }, [suppliers]);

  const uyWarehouses = useMemo(() => {
    return warehouses.filter(
      (w) =>
        w.tipo !== 'INTERNACIONAL' &&
        (!w.pais || w.pais.toLowerCase() === 'uruguay')
    );
  }, [warehouses]);

  // Sincronizar estado local cuando el padre actualice el inventario
  useEffect(() => {
    setLocalInventory(inventory);
  }, [inventory]);

  const handleItemSuccess = (updated: InventoryAlertItem) => {
    setLocalInventory((prev) => prev.map((it) => (it.sku === updated.sku ? updated : it)));
    setSuccessToast(`Parámetros y existencias de '${updated.sku}' actualizados exitosamente.`);
    setTimeout(() => setSuccessToast(null), 4000);
    if (onItemUpdated) {
      onItemUpdated(updated);
    }
  };

  // Filtrado reactivo en cascada sobre inventario local
  const filteredInventory = localInventory.filter((item) => {
    if (selectedCategory !== 'Todas' && item.categoria.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    if (onlyAlerts && !item.is_alert) {
      return false;
    }
    if (leadTimeFilter && item.lead_time_dias <= 30) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSku = item.sku.toLowerCase().includes(q);
      const matchName = item.nombre.toLowerCase().includes(q);
      const matchCat = item.categoria.toLowerCase().includes(q);
      if (!matchSku && !matchName && !matchCat) return false;
    }
    return true;
  });

  // Métricas de alto impacto
  const totalSkus = localInventory.length;
  const breakSkus = localInventory.filter((i) => i.is_alert).length;
  const totalStock = localInventory.reduce((acc, i) => acc + i.stock_actual, 0);
  const avgDoh = totalSkus > 0
    ? (localInventory.reduce((acc, i) => acc + Number(i.doh), 0) / totalSkus).toFixed(1)
    : '0';

  // Ejecución de Copiloto Asesor IA
  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    setCopilotError(null);
    try {
      // Mandar los SKUs críticos en alerta para la orden de compra sugerida
      const criticalSkus = inventory.filter((i) => i.is_alert).map((i) => ({
        sku: i.sku,
        nombre: i.nombre,
        categoria: i.categoria,
        stock_actual: i.stock_actual,
        rop: i.rop,
        doh: i.doh,
        lead_time_dias: i.lead_time_dias,
        costo_unitario: 100, // Costo base referencial para cálculo de PO
      }));

      const plan = await apiService.getSupplyActionPlan({
        items: criticalSkus,
        target_doh: 45.0,
      });
      setCopilotPlan(plan);
    } catch (err: any) {
      setCopilotError(err.response?.data?.detail || 'Error al conectar con el Copiloto Asesor IA');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Definición de columnas para la tabla de inventario
  const columns: Column<InventoryAlertItem>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '120px',
      render: (row) => (
        <span className="font-mono font-bold text-[#00a2e8]">{row.sku}</span>
      ),
    },
    {
      key: 'nombre',
      header: 'Producto',
      render: (row) => (
        <div className="flex items-center space-x-3">
          <ProductThumbnail
            src={row.image_url}
            alt={row.nombre}
            sku={row.sku}
            size="sm"
            className="border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-[#333333] dark:text-slate-100 truncate">{row.nombre}</span>
            <span className="text-[10px] text-slate-400">{row.categoria}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'stock_actual',
      header: 'Stock & Pipeline',
      width: '140px',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {row.stock_actual.toLocaleString()} u.
          </span>
          {row.stock_comprometido_pipeline && row.stock_comprometido_pipeline > 0 ? (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              🔥 {row.stock_comprometido_pipeline} u. en tratos ({row.stock_disponible_neto ?? row.stock_actual} disp. neto)
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'rop',
      header: 'Punto Reorden (ROP)',
      width: '140px',
      render: (row) => (
        <span className="text-slate-600 dark:text-slate-400 font-mono font-medium">{Number(row.rop).toFixed(1)} u.</span>
      ),
    },
    {
      key: 'doh',
      header: 'DOH (Días)',
      width: '110px',
      render: (row) => {
        const dohNum = Number(row.doh);
        const isLow = dohNum < 15;
        return (
          <span
            className={`font-semibold ${
              isLow ? 'text-rose-600 dark:text-rose-400' : dohNum > 60 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {dohNum.toFixed(1)} d
          </span>
        );
      },
    },
    {
      key: 'lead_time_dias',
      header: 'Lead Time',
      width: '100px',
      render: (row) => (
        <span className="text-slate-600 dark:text-slate-400 font-medium">{Number(row.lead_time_dias).toFixed(0)} días</span>
      ),
    },
    {
      key: 'is_alert',
      header: 'Estado Abastecimiento',
      width: '160px',
      render: (row) => {
        if (row.is_alert) {
          return (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-[#e74c3c] dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              <ShieldAlert size={12} />
              <span>Quiebre / Reorden</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-[#2ecc71] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={12} />
            <span>Stock Óptimo</span>
          </span>
        );
      },
    },
    {
      key: 'sku',
      header: 'Acciones',
      width: '130px',
      render: (row) => (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInspectingItem(row);
            }}
            className="p-1 text-slate-500 hover:text-[#00a2e8] dark:text-slate-400 dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Ver ficha técnica y desglose logístico"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingItem(row);
              setIsEditModalOpen(true);
            }}
            className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold text-[#00a2e8] hover:text-white bg-sky-50 dark:bg-sky-950/40 hover:bg-[#00a2e8] dark:hover:bg-[#00a2e8] border border-sky-200 dark:border-sky-800 rounded-lg transition-all shadow-2xs cursor-pointer"
            title="Ajuste rápido de existencias y parámetros"
          >
            <Edit2 size={11} />
            <span>Ajustar</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Top Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total SKUs Gestionados"
          value={totalSkus.toLocaleString()}
          subtitle="Catálogo activo multidepósito"
          icon={Boxes}
          iconColor="text-[#00a2e8]"
          iconBg="bg-sky-50"
        />

        <MetricCard
          title="SKUs en Quiebre / ROP"
          value={breakSkus}
          subtitle={breakSkus > 0 ? 'Requieren compra urgente' : 'Abastecimiento en regla'}
          icon={AlertTriangle}
          iconColor="text-[#e74c3c]"
          iconBg="bg-rose-50"
          badge={{
            text: breakSkus > 0 ? 'Crítico' : 'Normal',
            variant: breakSkus > 0 ? 'danger' : 'success',
          }}
          trend={{
            value: `${((breakSkus / (totalSkus || 1)) * 100).toFixed(0)}% del catálogo`,
            positive: breakSkus === 0,
          }}
        />

        <MetricCard
          title="DOH Promedio (Días)"
          value={`${avgDoh} d`}
          subtitle="Rotación ponderada anual"
          icon={Clock}
          iconColor="text-[#f39c12]"
          iconBg="bg-amber-50"
          trend={{
            value: 'Target: 45 d',
            positive: Number(avgDoh) >= 30 && Number(avgDoh) <= 60,
          }}
        />

        <MetricCard
          title="Stock Físico Total"
          value={`${totalStock.toLocaleString()} u.`}
          subtitle="Depósito + Aduana + Tránsito"
          icon={Layers}
          iconColor="text-[#2ecc71]"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Panel Asesor Copiloto IA */}
      <div className="bg-gradient-to-r from-sky-50/70 via-white to-sky-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 rounded-2xl border border-sky-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-[#00a2e8] text-white shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-[#333333] dark:text-slate-100">Copiloto Asesor IA de Cadena de Suministro</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 text-[#00a2e8] border border-sky-200 dark:border-sky-800 rounded-full shadow-2xs">
                  qwen2.5:7b Local
                </span>
                {copilotPlan && (
                  <span className="px-2 py-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-full">
                    ⚡ {copilotPlan.latency_ms.toFixed(0)} ms
                  </span>
                )}
              </div>
              <p className="text-xs text-[#535c69] dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Diagnostica desfasajes entre Demanda Diaria, Lead Time de proveedores y cobertura de DOH para emitir órdenes de compra óptimas minimizando capital inmovilizado.
              </p>
            </div>
          </div>

          <button
            onClick={handleGeneratePlan}
            disabled={isGeneratingPlan}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#00a2e8] to-[#008ecb] hover:from-[#008ecb] hover:to-[#007ba8] rounded-xl shadow-sm hover:shadow-bitrix-glow transition-all shrink-0 disabled:opacity-50"
          >
            <Sparkles size={15} className={isGeneratingPlan ? 'animate-spin' : ''} />
            <span>{isGeneratingPlan ? 'Analizando con LLM...' : '💡 Sugerir Plan de Reabastecimiento'}</span>
          </button>
        </div>

        {copilotError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-[#e74c3c] dark:text-rose-400">
            {copilotError}
          </div>
        )}

        {/* Resultados del Plan Sugerido */}
        {copilotPlan && (
          <div className="mt-5 pt-5 border-t border-sky-100 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-[#535c69] dark:text-slate-400 block">SKUs en Riesgo Crítico</span>
                <span className="text-lg font-bold text-[#e74c3c] dark:text-rose-400">{copilotPlan.critical_skus_count} productos</span>
              </div>
              <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-[#535c69] dark:text-slate-400 block">Capital de Trabajo Requerido</span>
                <span className="text-lg font-bold text-[#00a2e8] dark:text-sky-400">
                  ${Number(copilotPlan.total_working_capital_required).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-[#535c69] dark:text-slate-400 block">Motor de Inferencia</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{copilotPlan.provider}</span>
              </div>
            </div>

            {/* Plan de Acción en 3 Pasos */}
            {copilotPlan.action_plan_3_steps?.length > 0 && (
              <div className="bg-white dark:bg-slate-800/90 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <h4 className="font-bold text-xs text-[#333333] dark:text-slate-100 mb-2 flex items-center space-x-1.5">
                  <CheckCircle2 size={14} className="text-[#2ecc71] dark:text-emerald-400" />
                  <span>Plan de Acción Inmediato (3 Pasos)</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#535c69] dark:text-slate-400">
                  {copilotPlan.action_plan_3_steps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <span className="font-medium text-[#333333] dark:text-slate-200">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* PO Sugeridas */}
            {copilotPlan.suggested_purchase_orders?.length > 0 && (
              <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700 p-3 overflow-x-auto">
                <h4 className="font-bold text-xs text-[#333333] dark:text-slate-100 mb-2 flex items-center space-x-1.5">
                  <ShoppingCart size={14} className="text-[#00a2e8] dark:text-sky-400" />
                  <span>Órdenes de Compra Sugeridas (PO Priorizada)</span>
                </h4>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-[#535c69] dark:text-slate-400">
                      <th className="py-2 px-2">SKU</th>
                      <th className="py-2 px-2">Cantidad Sugerida</th>
                      <th className="py-2 px-2">Capital Estimado</th>
                      <th className="py-2 px-2">Prioridad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {copilotPlan.suggested_purchase_orders.slice(0, 5).map((po, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <td className="py-1.5 px-2 font-mono font-bold text-[#00a2e8] dark:text-sky-400">{po.sku}</td>
                        <td className="py-1.5 px-2 font-semibold text-slate-800 dark:text-slate-200">{po.suggested_quantity} u.</td>
                        <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300">${Number(po.working_capital_required).toFixed(2)}</td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.priority === 'CRÍTICA' || po.priority === 'ALTA'
                                ? 'bg-red-50 dark:bg-red-950/40 text-[#e74c3c] dark:text-rose-400'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-[#f39c12] dark:text-amber-400'
                            }`}
                          >
                            {po.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla Dinámica de Inventario */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#333333] dark:text-slate-100">
            Monitoreo Físico de Existencias &amp; Alertas de Reposición
          </h3>
          <span className="text-xs text-[#535c69] dark:text-slate-400">
            Mostrando {filteredInventory.length} de {inventory.length} SKUs
          </span>
        </div>

        <DataTable
          data={filteredInventory}
          columns={columns}
          keyExtractor={(row) => row.sku}
          pageSizeDefault={10}
          searchPlaceholder="Filtrar por SKU o nombre de producto..."
          onRowClick={(row) => setInspectingItem(row)}
        />
      </div>

      {/* =====================================================================
          MÓDULO 1: ÓRDENES DE COMPRA PARA PROVEEDORES DE URUGUAY (PLAZA / REVENTA)
      ===================================================================== */}
      <LocalPurchaseOrdersSection
        uySuppliers={uySuppliers}
        uyWarehouses={uyWarehouses}
        canManageOrders={effectiveRole === 'controller_admin' || effectiveRole === 'analista_comercial'}
      />

      {/* =====================================================================
          MÓDULO 2: PRESUPUESTOS IMPLÍCITOS & LOGÍSTICA (MARÍTIMO, SEGUROS, ADUANA, CAMIONES)
      ===================================================================== */}
      <ImplicitBudgetsSection
        suppliers={suppliers}
        currentRole={effectiveRole}
      />

      {/* =====================================================================
          MÓDULO 3: PROVEEDORES REVENTA & CARGA MASIVA EXCEL / PLANTILLA MODELO
      ===================================================================== */}
      <ReventaSuppliersSection
        uySuppliers={uySuppliers}
        onDataChanged={loadSuppliersAndWarehouses}
        currentRole={effectiveRole}
      />

      {/* Slide-Over Drawer para Inspección Profunda de SKU (Progressive Disclosure) */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-150">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setInspectingItem(null)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between overflow-y-auto z-10 animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 bg-sky-50 dark:bg-sky-950/50 text-[#00a2e8] rounded-lg">
                    <Boxes size={18} />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Ficha Operativa de SKU
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#00a2e8]">
                      {inspectingItem.sku}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setInspectingItem(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Cerrar panel"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Product Info & Image */}
              <div className="flex items-start space-x-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <ProductThumbnail
                  src={inspectingItem.image_url}
                  alt={inspectingItem.nombre}
                  sku={inspectingItem.sku}
                  size="lg"
                  className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                    {inspectingItem.nombre}
                  </h4>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/50 text-[#00a2e8] border border-sky-200 dark:border-sky-800 mt-1">
                    {inspectingItem.categoria}
                  </span>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Lead Time de Proveedor: <strong className="text-slate-800 dark:text-slate-200">{Number(inspectingItem.lead_time_dias).toFixed(0)} días</strong>
                  </div>
                </div>
              </div>

              {/* Estado y Diagnóstico */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-semibold ${
                inspectingItem.is_alert
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              }`}>
                <div className="flex items-center space-x-2">
                  {inspectingItem.is_alert ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
                  <span>{inspectingItem.is_alert ? 'Alerta Crítica: Stock <= ROP' : 'Stock en Rango Óptimo'}</span>
                </div>
                <span className="font-mono text-xs font-bold">
                  DOH: {Number(inspectingItem.doh).toFixed(1)} d
                </span>
              </div>

              {/* Desglose Físico de Existencias */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Distribución Multidepósito &amp; Tránsito:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Dep. Central</span>
                    <strong className="text-sm font-mono text-slate-900 dark:text-slate-100">
                      {inspectingItem.deposito_central ?? 0} u.
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Tránsito Buque</span>
                    <strong className="text-sm font-mono text-slate-900 dark:text-slate-100">
                      {inspectingItem.transito_maritimo ?? 0} u.
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Aduana / Puerto</span>
                    <strong className="text-sm font-mono text-slate-900 dark:text-slate-100">
                      {inspectingItem.aduana ?? 0} u.
                    </strong>
                  </div>
                </div>
              </div>

              {/* ROP, Pipeline & Parámetros */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Stock Total Físico:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{inspectingItem.stock_actual} u.</span>
                </div>
                {inspectingItem.stock_comprometido_pipeline ? (
                  <div className="flex justify-between items-center text-amber-600 dark:text-amber-400 font-semibold">
                    <span>Comprometido en Deals CRM:</span>
                    <span className="font-mono">{inspectingItem.stock_comprometido_pipeline} u.</span>
                  </div>
                ) : null}
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Punto de Reorden (ROP):</span>
                  <span className="font-mono font-bold text-[#00a2e8]">{Number(inspectingItem.rop).toFixed(1)} u.</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Demanda Diaria Promedio:</span>
                  <span className="font-mono">{Number(inspectingItem.demanda_diaria_promedio).toFixed(2)} u/día</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Stock de Seguridad Mínimo:</span>
                  <span className="font-mono">{Number(inspectingItem.stock_seguridad).toFixed(0)} u.</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2">
              <button
                onClick={() => {
                  setEditingItem(inspectingItem);
                  setIsEditModalOpen(true);
                }}
                className="flex-1 py-2.5 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Edit2 size={13} />
                <span>Ajustar Parámetros ROP</span>
              </button>
              <button
                onClick={() => setInspectingItem(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Express de Ajuste Rápido de Inventario */}
      <InventoryQuickEditModal
        isOpen={isEditModalOpen}
        item={editingItem}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleItemSuccess}
      />

      {/* Toast Flotante de Confirmación */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900/90 text-white border border-slate-700/80 rounded-2xl shadow-xl flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-3 duration-200">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
            <CheckCircle2 size={16} />
          </div>
          <span className="font-medium">{successToast}</span>
        </div>
      )}
    </div>
  );
};
