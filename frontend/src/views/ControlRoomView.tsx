import { useState, useEffect } from 'react';
import { 
  Boxes, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  ShoppingCart,
  Edit2
} from 'lucide-react';
import type { InventoryAlertItem, SupplyActionPlanResponse } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable } from '../components/common/DataTable';
import type { Column } from '../components/common/DataTable';
import { InventoryQuickEditModal } from '../components/inventory/InventoryQuickEditModal';
import { ProductThumbnail } from '../components/common/ProductThumbnail';
import { apiService } from '../services/api';

interface ControlRoomViewProps {
  inventory: InventoryAlertItem[];
  isLoading?: boolean;
  selectedCategory: string;
  onlyAlerts: boolean;
  leadTimeFilter: boolean;
  searchQuery: string;
  onItemUpdated?: (updated: InventoryAlertItem) => void;
}

export const ControlRoomView = ({
  inventory,
  selectedCategory,
  onlyAlerts,
  leadTimeFilter,
  searchQuery,
  onItemUpdated,
}: ControlRoomViewProps) => {
  const [localInventory, setLocalInventory] = useState<InventoryAlertItem[]>(inventory);
  const [editingItem, setEditingItem] = useState<InventoryAlertItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [copilotPlan, setCopilotPlan] = useState<SupplyActionPlanResponse | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

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
        <span className="text-[#535c69] font-mono">{Number(row.rop).toFixed(1)} u.</span>
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
              isLow ? 'text-[#e74c3c]' : dohNum > 60 ? 'text-[#f39c12]' : 'text-[#2ecc71]'
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
        <span className="text-[#535c69]">{Number(row.lead_time_dias).toFixed(0)} días</span>
      ),
    },
    {
      key: 'is_alert',
      header: 'Estado Abastecimiento',
      width: '160px',
      render: (row) => {
        if (row.is_alert) {
          return (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-[#e74c3c] border border-rose-200">
              <ShieldAlert size={12} />
              <span>Quiebre / Reorden</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#2ecc71] border border-emerald-200">
            <CheckCircle2 size={12} />
            <span>Stock Óptimo</span>
          </span>
        );
      },
    },
    {
      key: 'sku',
      header: 'Acción',
      width: '100px',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingItem(row);
            setIsEditModalOpen(true);
          }}
          className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-[#00a2e8] hover:text-white bg-sky-50 dark:bg-sky-950/40 hover:bg-[#00a2e8] dark:hover:bg-[#00a2e8] border border-sky-200 dark:border-sky-800 rounded-lg transition-all shadow-2xs cursor-pointer"
          title="Ajuste rápido de existencias y parámetros"
        >
          <Edit2 size={12} />
          <span>Ajustar</span>
        </button>
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
      <div className="bg-gradient-to-r from-sky-50/70 via-white to-sky-50/30 rounded-2xl border border-sky-200/80 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-[#00a2e8] text-white shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-[#333333]">Copiloto Asesor IA de Cadena de Suministro</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-[#00a2e8] border border-sky-200 rounded-full shadow-2xs">
                  qwen2.5:7b Local
                </span>
                {copilotPlan && (
                  <span className="px-2 py-0.5 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                    ⚡ {copilotPlan.latency_ms.toFixed(0)} ms
                  </span>
                )}
              </div>
              <p className="text-xs text-[#535c69] mt-1 max-w-2xl leading-relaxed">
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
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#e74c3c]">
            {copilotError}
          </div>
        )}

        {/* Resultados del Plan Sugerido */}
        {copilotPlan && (
          <div className="mt-5 pt-5 border-t border-sky-100 space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-[#535c69] block">SKUs en Riesgo Crítico</span>
                <span className="text-lg font-bold text-[#e74c3c]">{copilotPlan.critical_skus_count} productos</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-[#535c69] block">Capital de Trabajo Requerido</span>
                <span className="text-lg font-bold text-[#00a2e8]">
                  ${Number(copilotPlan.total_working_capital_required).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-[#535c69] block">Motor de Inferencia</span>
                <span className="text-sm font-semibold text-slate-700">{copilotPlan.provider}</span>
              </div>
            </div>

            {/* Plan de Acción en 3 Pasos */}
            {copilotPlan.action_plan_3_steps?.length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-slate-200/80">
                <h4 className="font-bold text-xs text-[#333333] mb-2 flex items-center space-x-1.5">
                  <CheckCircle2 size={14} className="text-[#2ecc71]" />
                  <span>Plan de Acción Inmediato (3 Pasos)</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#535c69]">
                  {copilotPlan.action_plan_3_steps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <span className="font-medium text-[#333333]">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* PO Sugeridas */}
            {copilotPlan.suggested_purchase_orders?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200/80 p-3 overflow-x-auto">
                <h4 className="font-bold text-xs text-[#333333] mb-2 flex items-center space-x-1.5">
                  <ShoppingCart size={14} className="text-[#00a2e8]" />
                  <span>Órdenes de Compra Sugeridas (PO Priorizada)</span>
                </h4>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[#535c69]">
                      <th className="py-2 px-2">SKU</th>
                      <th className="py-2 px-2">Cantidad Sugerida</th>
                      <th className="py-2 px-2">Capital Estimado</th>
                      <th className="py-2 px-2">Prioridad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {copilotPlan.suggested_purchase_orders.slice(0, 5).map((po, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2 font-mono font-bold text-[#00a2e8]">{po.sku}</td>
                        <td className="py-1.5 px-2 font-semibold">{po.suggested_quantity} u.</td>
                        <td className="py-1.5 px-2">${Number(po.working_capital_required).toFixed(2)}</td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.priority === 'CRÍTICA' || po.priority === 'ALTA'
                                ? 'bg-red-50 text-[#e74c3c]'
                                : 'bg-amber-50 text-[#f39c12]'
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
          <h3 className="text-sm font-bold text-[#333333]">
            Monitoreo Físico de Existencias &amp; Alertas de Reposición
          </h3>
          <span className="text-xs text-[#535c69]">
            Mostrando {filteredInventory.length} de {inventory.length} SKUs
          </span>
        </div>

        <DataTable
          data={filteredInventory}
          columns={columns}
          keyExtractor={(row) => row.sku}
          pageSizeDefault={10}
          searchPlaceholder="Filtrar por SKU o nombre de producto..."
        />
      </div>

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
