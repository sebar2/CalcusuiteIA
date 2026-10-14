import React, { useState, useEffect, useRef } from 'react';
import {
  Boxes,
  Search,
  UploadCloud,
  Printer,
  Plus,
  Barcode,
  Layers,
  Building2,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type { LogisticsInventoryItem, LogisticsClientItem } from '../../services/logisticsApi';

export const LogisticsInventoryView: React.FC = () => {
  const [inventory, setInventory] = useState<LogisticsInventoryItem[]>([]);
  const [clients, setClients] = useState<LogisticsClientItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [rackFilter, setRackFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isGeneratingLabels, setIsGeneratingLabels] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadClient, setUploadClient] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Manual Form
  const [manualForm, setManualForm] = useState({
    client_id: '',
    sku_cliente: '',
    descripcion: '',
    categoria: 'GENERAL',
    cantidad_bultos: 10,
    unidades_por_bulto: 12,
    volumen_unitario_m3: 0.024,
    peso_unitario_kg: 5.5,
    ubicacion_rack: 'RACK-A-01-01',
    lote: '',
    fecha_vencimiento: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, cliData] = await Promise.all([
        logisticsApi.getInventory({
          client_id: selectedClientId !== 'ALL' ? Number(selectedClientId) : undefined,
          search: search || undefined,
          rack: rackFilter || undefined,
        }),
        logisticsApi.getClients(),
      ]);
      setInventory(invData);
      setClients(cliData);
      if (cliData.length > 0 && !uploadClient) {
        setUploadClient(String(cliData[0].id));
      }
    } catch (err) {
      console.error('Error al cargar inventario 3PL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClientId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDownloadLabels = async (inventoryId?: number) => {
    try {
      setIsGeneratingLabels(true);
      await logisticsApi.downloadInventoryLabels({
        inventory_id: inventoryId,
        client_id: selectedClientId !== 'ALL' ? Number(selectedClientId) : undefined,
      });
    } catch (err: any) {
      alert(`Error al generar rótulos PDF: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsGeneratingLabels(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.client_id) {
      alert('Debe seleccionar el cliente propietario del lote');
      return;
    }
    try {
      await logisticsApi.createInventoryItem({
        client_id: Number(manualForm.client_id),
        sku_cliente: manualForm.sku_cliente,
        descripcion: manualForm.descripcion,
        categoria: manualForm.categoria,
        cantidad_bultos: Number(manualForm.cantidad_bultos),
        unidades_por_bulto: Number(manualForm.unidades_por_bulto),
        volumen_unitario_m3: Number(manualForm.volumen_unitario_m3),
        peso_unitario_kg: Number(manualForm.peso_unitario_kg),
        ubicacion_rack: manualForm.ubicacion_rack,
        lote: manualForm.lote || undefined,
        fecha_vencimiento: manualForm.fecha_vencimiento || undefined,
      });
      setIsManualModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Error al guardar stock: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadClient) {
      alert('Seleccione un cliente y una planilla Excel / CSV');
      return;
    }
    try {
      setLoading(true);
      const res = await logisticsApi.uploadInventoryExcel(Number(uploadClient), selectedFile);
      setUploadResult(res);
      setSelectedFile(null);
      loadData();
    } catch (err: any) {
      alert(`Error al procesar archivo: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const totalBultos = inventory.reduce((acc, i) => acc + i.cantidad_bultos, 0);
  const totalKg = inventory.reduce((acc, i) => acc + i.peso_total_kg, 0);
  const totalM3 = inventory.reduce((acc, i) => acc + i.volumen_total_m3, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400">
              <Boxes size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Depósito & Stock 3PL (Multi-Cliente)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Custodia de mercadería de terceros, ubicaciones de rack, cubicaje y codificación QR/Code128
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleDownloadLabels()}
            disabled={isGeneratingLabels || inventory.length === 0}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Printer size={15} />
            <span>{isGeneratingLabels ? 'Generando PDF...' : 'Imprimir Rótulos QR / Barcode'}</span>
          </button>

          <button
            onClick={() => {
              setUploadResult(null);
              setIsUploadModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <UploadCloud size={15} />
            <span>Importar Planilla Excel</span>
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Ingreso Manual</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Lotes Registrados
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {inventory.length}
            </span>
            <span className="text-xs text-sky-600 font-medium">SKUs Terceros</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Bultos en Custodia
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalBultos.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">Cajas / Bultos</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Peso Total Almacenado
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {(totalKg / 1000).toFixed(1)} tn
            </span>
            <span className="text-xs text-slate-400">{totalKg.toLocaleString()} kg</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Cubicaje Ocupado (m³)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
              {totalM3.toFixed(2)} m³
            </span>
            <span className="text-xs text-slate-400">Volumen en Racks</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Building2 size={15} />
            <span className="font-semibold">Cliente:</span>
          </div>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">Todos los Clientes 3PL</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_comercial} ({c.tipo})
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400 ml-2">
            <Layers size={15} />
            <span className="font-semibold">Rack:</span>
          </div>
          <input
            type="text"
            placeholder="Ej: RACK-A"
            value={rackFilter}
            onChange={(e) => setRackFilter(e.target.value)}
            className="w-28 px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>

        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, descripción, QR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200"
          />
        </form>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Cliente Propietario</th>
                <th className="py-3 px-4">SKU Cliente</th>
                <th className="py-3 px-4">Descripción Mercadería</th>
                <th className="py-3 px-4">Ubicación Rack</th>
                <th className="py-3 px-4 text-center">Bultos</th>
                <th className="py-3 px-4 text-center">Unid/Bulto</th>
                <th className="py-3 px-4">Peso Total</th>
                <th className="py-3 px-4">Volumen Total</th>
                <th className="py-3 px-4">Código Rótulo QR</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    Cargando inventario 3PL...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    No hay inventario registrado con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.client_nombre}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sky-700 dark:text-sky-300">
                      {item.sku_cliente}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {item.descripcion}
                        </span>
                        {item.lote && (
                          <span className="text-[10px] text-slate-400">Lote: {item.lote}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {item.ubicacion_rack}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-slate-100">
                      {item.cantidad_bultos}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500">
                      {item.unidades_por_bulto} u
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {item.peso_total_kg.toFixed(1)} kg
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {item.volumen_total_m3.toFixed(3)} m³
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                      <div className="flex items-center space-x-1.5">
                        <Barcode size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate max-w-[140px]">{item.codigo_qr_lote}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDownloadLabels(item.id)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        title="Imprimir Rótulo de este Lote"
                      >
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ingreso Manual */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Boxes className="text-sky-500" size={18} />
                <span>Ingreso Manual de Stock 3PL</span>
              </h2>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Cliente Propietario</label>
                <select
                  required
                  value={manualForm.client_id}
                  onChange={(e) => setManualForm({ ...manualForm, client_id: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Seleccionar Cliente 3PL --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_comercial} ({c.razon_social})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">SKU Cliente</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: DISCO-ARR-01"
                    value={manualForm.sku_cliente}
                    onChange={(e) => setManualForm({ ...manualForm, sku_cliente: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Categoría</label>
                  <input
                    type="text"
                    value={manualForm.categoria}
                    onChange={(e) => setManualForm({ ...manualForm, categoria: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Descripción del Producto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Arroz Extra Largo 1kg x 20 unidades"
                  value={manualForm.descripcion}
                  onChange={(e) => setManualForm({ ...manualForm, descripcion: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Cantidad Bultos</label>
                  <input
                    type="number"
                    required
                    value={manualForm.cantidad_bultos}
                    onChange={(e) => setManualForm({ ...manualForm, cantidad_bultos: parseInt(e.target.value, 10) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Unidades por Bulto</label>
                  <input
                    type="number"
                    required
                    value={manualForm.unidades_por_bulto}
                    onChange={(e) => setManualForm({ ...manualForm, unidades_por_bulto: parseInt(e.target.value, 10) || 1 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Peso Unitario (kg/bulto)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={manualForm.peso_unitario_kg}
                    onChange={(e) => setManualForm({ ...manualForm, peso_unitario_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Volumen Unitario (m³/bulto)</label>
                  <input
                    type="number"
                    step="0.005"
                    required
                    value={manualForm.volumen_unitario_m3}
                    onChange={(e) => setManualForm({ ...manualForm, volumen_unitario_m3: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Ubicación Rack / Pasillo</label>
                  <input
                    type="text"
                    required
                    placeholder="RACK-A-01-01"
                    value={manualForm.ubicacion_rack}
                    onChange={(e) => setManualForm({ ...manualForm, ubicacion_rack: e.target.value.toUpperCase() })}
                    className="w-full mt-1 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Lote</label>
                  <input
                    type="text"
                    placeholder="LOTE-2026-X"
                    value={manualForm.lote}
                    onChange={(e) => setManualForm({ ...manualForm, lote: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-xl cursor-pointer"
                >
                  Ingresar a Almacén
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Importar Excel */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <FileSpreadsheet className="text-emerald-500" size={18} />
                <span>Importación Masiva de Stock de Cliente</span>
              </h2>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Cliente 3PL Destinatario</label>
                <select
                  required
                  value={uploadClient}
                  onChange={(e) => setUploadClient(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_comercial} ({c.razon_social})
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
                <UploadCloud className="mx-auto text-sky-500 mb-2" size={36} />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {selectedFile ? selectedFile.name : 'Haz clic para seleccionar o arrastra la planilla aquí'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Formatos soportados: Excel (.xlsx, .xls) o CSV
                </p>
                <p className="text-[10px] text-slate-500 mt-2">
                  Columnas sugeridas: SKU, Descripción, Bultos, Peso, Volumen, Rack, Lote
                </p>
              </div>

              {uploadResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <CheckCircle2 size={16} />
                    <span>{uploadResult.message}</span>
                  </div>
                  <div className="mt-1 text-[11px]">
                    Nuevos ingresados: <b>{uploadResult.nuevos_ingresados}</b> | Actualizados: <b>{uploadResult.actualizados}</b>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs"
                >
                  Procesar Ingesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default LogisticsInventoryView;
