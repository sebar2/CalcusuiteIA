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
  ClipboardList,
  MapPin,
  Navigation,
  Sparkles,
} from 'lucide-react';
import { UniversalWarehouseTwin3D } from '../../components/digitalTwin/UniversalWarehouseTwin3D';
import { logisticsApi } from '../../services/logisticsApi';
import type {
  LogisticsInventoryItem,
  LogisticsClientItem,
  LogisticsBranchItem,
  LogisticsHubItem,
  LogisticsHubUpdatePayload,
} from '../../services/logisticsApi';

export const LogisticsInventoryView: React.FC = () => {
  const [inventory, setInventory] = useState<LogisticsInventoryItem[]>([]);
  const [clients, setClients] = useState<LogisticsClientItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [rackFilter, setRackFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'3D_TWIN' | 'TABLE'>('3D_TWIN');

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isGeneratingLabels, setIsGeneratingLabels] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Picking / Armar Pedido State
  const [isPickingModalOpen, setIsPickingModalOpen] = useState<boolean>(false);
  const [pickingClientId, setPickingClientId] = useState<string>('');
  const [pickingBranches, setPickingBranches] = useState<LogisticsBranchItem[]>([]);
  const [pickingBranchId, setPickingBranchId] = useState<string>('');
  const [pickingSupervisor, setPickingSupervisor] = useState<string>('');
  const [pickingDate, setPickingDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pickingWindow, setPickingWindow] = useState<string>('08:00 - 13:00');
  const [pickingCustomAddress, setPickingCustomAddress] = useState<string>('');
  const [pickingContactName, setPickingContactName] = useState<string>('');
  const [pickingContactPhone, setPickingContactPhone] = useState<string>('');
  const [pickingItemQuantities, setPickingItemQuantities] = useState<Record<number, number>>({});
  const [isSubmittingPicking, setIsSubmittingPicking] = useState<boolean>(false);

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

  // Hub / Centro de Distribución Base State
  const [hub, setHub] = useState<LogisticsHubItem | null>(null);
  const [isHubModalOpen, setIsHubModalOpen] = useState<boolean>(false);
  const [hubForm, setHubForm] = useState<LogisticsHubUpdatePayload>({});
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isSavingHub, setIsSavingHub] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, cliData, hubData] = await Promise.all([
        logisticsApi.getInventory({
          client_id: selectedClientId !== 'ALL' ? Number(selectedClientId) : undefined,
          search: search || undefined,
          rack: rackFilter || undefined,
        }),
        logisticsApi.getClients(),
        logisticsApi.getHub().catch(() => null),
      ]);
      setInventory(invData);
      setClients(cliData);
      if (hubData) {
        setHub(hubData);
      }
      if (cliData.length > 0 && !uploadClient) {
        setUploadClient(String(cliData[0].id));
      }
    } catch (err) {
      console.error('Error al cargar inventario 3PL:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHubModal = () => {
    if (hub) {
      setHubForm({
        nombre: hub.nombre,
        direccion: hub.direccion,
        ciudad: hub.ciudad,
        pais: hub.pais,
        lat: hub.lat,
        lng: hub.lng,
        superficie_m2: hub.superficie_m2,
        capacidad_pallets_max: hub.capacidad_pallets_max,
        responsable_deposito: hub.responsable_deposito,
        telefono_contacto: hub.telefono_contacto,
        costo_alquiler_mensual: hub.costo_alquiler_mensual,
        moneda_alquiler: hub.moneda_alquiler,
      });
    }
    setIsHubModalOpen(true);
  };

  const handleGeocodeHubAddress = async () => {
    if (!hubForm.direccion?.trim()) {
      alert('Ingrese una dirección primero en el campo correspondiente');
      return;
    }
    try {
      setIsGeocoding(true);
      const query = `${hubForm.direccion}, ${hubForm.ciudad || 'Canelones'}`;
      const res = await logisticsApi.geocodeAddress(query);
      setHubForm((prev) => ({
        ...prev,
        lat: res.lat,
        lng: res.lng,
      }));
      alert(`📍 Coordenadas GPS obtenidas:\nLatitud: ${res.lat}\nLongitud: ${res.lng}\n${res.found ? 'Ubicación geocodificada con OpenStreetMap.' : 'Ubicación estimada por cuadrante metropolitano.'}`);
    } catch (err: any) {
      alert('No se pudo geocodificar la dirección automáticamente. Puede ingresar las coordenadas manualmente.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSaveHub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingHub(true);
      const updated = await logisticsApi.updateHub(hubForm);
      setHub(updated);
      setIsHubModalOpen(false);
      alert('✅ ¡Centro de Distribución Base actualizado con éxito!\nLa dirección, coordenadas para el mapa de Tracking y el costo de alquiler se han sincronizado.');
    } catch (err: any) {
      alert(`Error al guardar configuración del Hub: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSavingHub(false);
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

  // Picking Handlers
  const handleOpenPickingModal = async () => {
    const defaultClient = selectedClientId !== 'ALL' ? selectedClientId : (clients[0]?.id ? String(clients[0].id) : '');
    setPickingClientId(defaultClient);
    setPickingSupervisor('Supervisor Depósito');
    setPickingDate(new Date().toISOString().slice(0, 10));
    setPickingWindow('08:00 - 14:00');
    setPickingItemQuantities({});
    if (defaultClient) {
      try {
        const branches = await logisticsApi.getClientBranches(Number(defaultClient));
        setPickingBranches(branches);
        if (branches.length > 0) {
          setPickingBranchId(String(branches[0].id));
          setPickingCustomAddress(branches[0].direccion);
          setPickingContactName(branches[0].contacto_receptor || '');
          setPickingContactPhone(branches[0].telefono_receptor || '');
        } else {
          setPickingBranchId('');
          const c = clients.find((x) => String(x.id) === defaultClient);
          setPickingCustomAddress(c?.direccion_central || '');
          setPickingContactName(c?.contacto_logistica || '');
          setPickingContactPhone(c?.telefono || '');
        }
      } catch {
        setPickingBranches([]);
      }
    }
    setIsPickingModalOpen(true);
  };

  const handlePickingClientChange = async (clientId: string) => {
    setPickingClientId(clientId);
    setPickingItemQuantities({});
    try {
      const branches = await logisticsApi.getClientBranches(Number(clientId));
      setPickingBranches(branches);
      if (branches.length > 0) {
        setPickingBranchId(String(branches[0].id));
        setPickingCustomAddress(branches[0].direccion);
        setPickingContactName(branches[0].contacto_receptor || '');
        setPickingContactPhone(branches[0].telefono_receptor || '');
      } else {
        setPickingBranchId('');
        const c = clients.find((x) => String(x.id) === clientId);
        setPickingCustomAddress(c?.direccion_central || '');
        setPickingContactName(c?.contacto_logistica || '');
        setPickingContactPhone(c?.telefono || '');
      }
    } catch {
      setPickingBranches([]);
    }
  };

  const handlePickingBranchChange = (branchId: string) => {
    setPickingBranchId(branchId);
    if (branchId === 'custom') {
      setPickingCustomAddress('');
      setPickingContactName('');
      setPickingContactPhone('');
    } else {
      const b = pickingBranches.find((x) => String(x.id) === branchId);
      if (b) {
        setPickingCustomAddress(b.direccion);
        setPickingContactName(b.contacto_receptor || '');
        setPickingContactPhone(b.telefono_receptor || '');
      }
    }
  };

  const handlePickingQtyChange = (inventoryId: number, qty: number, maxQty: number) => {
    const val = Math.max(0, Math.min(qty, maxQty));
    setPickingItemQuantities((prev) => ({
      ...prev,
      [inventoryId]: val,
    }));
  };

  const handleSubmitPickingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickingClientId) {
      alert('Seleccione un cliente');
      return;
    }
    if (!pickingCustomAddress) {
      alert('Debe especificar la dirección de entrega');
      return;
    }

    const itemsToSend = Object.entries(pickingItemQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({
        inventory_id: Number(id),
        cantidad: qty,
        bultos_solicitados: qty,
        es_unidades: false,
      }));

    if (itemsToSend.length === 0) {
      alert('Debe seleccionar al menos 1 bulto/pack de algún producto');
      return;
    }

    try {
      setIsSubmittingPicking(true);
      const res = await logisticsApi.createPickingOrder({
        client_id: Number(pickingClientId),
        branch_id: pickingBranchId && pickingBranchId !== 'custom' ? Number(pickingBranchId) : undefined,
        destino_direccion: pickingCustomAddress,
        contacto_receptor_nombre: pickingContactName.trim() || 'Recepción Cliente',
        contacto_receptor_telefono: pickingContactPhone.trim() || 'S/D',
        responsable_armado: pickingSupervisor.trim() || 'Supervisor Depósito',
        fecha_entrega_estimada: pickingDate,
        ventana_horaria: pickingWindow,
        items: itemsToSend,
      });

      alert(`✅ ¡Orden ${res.numero_orden} creada con éxito!\n• Descontados ${res.total_bultos} bultos del stock en depósito.\n• Sincronizada con Kanban: "Acondicionamiento / Etiquetado".\n• QR de Despacho: ${res.codigo_qr || res.numero_orden}`);
      setIsPickingModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Error al generar orden de picking: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSubmittingPicking(false);
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
                Custodia de mercadería de terceros, picking parcial con descuento de stock y codificación QR
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Conmutador 3D / Tabla WMS */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('3D_TWIN')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === '3D_TWIN'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes size={14} />
              <span>🧊 Gemelo Digital 3D</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ClipboardList size={14} />
              <span>📋 Inventario & Picking</span>
            </button>
          </div>

          <button
            onClick={handleOpenHubModal}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Configurar dirección de depósito y base para Tracking GPS"
          >
            <Building2 size={15} className="text-sky-500" />
            <span>Centro Distribución Base</span>
          </button>

          <button
            onClick={handleOpenPickingModal}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ClipboardList size={15} />
            <span>+ Armar Pedido (Picking)</span>
          </button>
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

      {viewMode === '3D_TWIN' ? (
        <div className="space-y-4">
          <UniversalWarehouseTwin3D
            moduleScope="3PL"
            onTransferSuccess={loadData}
          />
        </div>
      ) : (
        <div className="space-y-6">
{/* Hub Central Base Banner */}
      {hub && (
        <div className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-transparent p-4 rounded-2xl border border-sky-500/20 dark:border-sky-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-sky-600 text-white rounded-xl shadow-xs">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                  {hub.nombre}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  HUB Base Calcu 3PL
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="flex items-center space-x-1 text-slate-800 dark:text-slate-200 font-semibold">
                  <MapPin size={13} className="text-rose-500" />
                  <span>{hub.direccion}, {hub.ciudad}</span>
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  (GPS: {hub.lat.toFixed(4)}, {hub.lng.toFixed(4)})
                </span>
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  • Alquiler: $ {hub.costo_alquiler_mensual.toLocaleString('es-UY')} {hub.moneda_alquiler}/mes
                </span>
                <span className="text-slate-400">
                  • Sup: {hub.superficie_m2} m² ({hub.capacidad_pallets_max} pallets)
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenHubModal}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center space-x-1.5 self-start md:self-auto"
          >
            <Navigation size={13} />
            <span>Editar Dirección & Coordenadas</span>
          </button>
        </div>
      )}

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

              </div>
      )}

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

      {/* Modal Armar Pedido (Picking Parcial) */}
      {isPickingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-950/80 text-purple-600 rounded-lg">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Armar Pedido de Despacho (Picking Parcial)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Descuenta stock en custodia y genera orden en Kanban Acondicionamiento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPickingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPickingOrder} className="mt-4 space-y-4">
              {/* Selector Cliente y Sucursal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Empresa Cliente Propietaria *
                  </label>
                  <select
                    required
                    value={pickingClientId}
                    onChange={(e) => handlePickingClientChange(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
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
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Destino / Sucursal de Entrega
                  </label>
                  <select
                    value={pickingBranchId}
                    onChange={(e) => handlePickingBranchChange(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Dirección Central / Depósito Principal</option>
                    {pickingBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre_sucursal} ({b.distancia_km_base} km) - {b.direccion}
                      </option>
                    ))}
                    <option value="custom">Dirección Personalizada / Otra</option>
                  </select>
                </div>
              </div>

              {/* Dirección y Contacto Receptor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Dirección de Entrega *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Calle, número, esquina, ciudad"
                    value={pickingCustomAddress}
                    onChange={(e) => setPickingCustomAddress(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Responsable de Armado *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre del operario de picking"
                    value={pickingSupervisor}
                    onChange={(e) => setPickingSupervisor(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Contacto Receptor en Destino
                  </label>
                  <input
                    type="text"
                    placeholder="Persona que recibe y firma"
                    value={pickingContactName}
                    onChange={(e) => setPickingContactName(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Teléfono Receptor
                  </label>
                  <input
                    type="text"
                    placeholder="099 123 456"
                    value={pickingContactPhone}
                    onChange={(e) => setPickingContactPhone(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Fecha y Ventana Horaria
                  </label>
                  <div className="flex space-x-1.5 mt-1">
                    <input
                      type="date"
                      value={pickingDate}
                      onChange={(e) => setPickingDate(e.target.value)}
                      className="w-1/2 px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      placeholder="09:00 - 13:00"
                      value={pickingWindow}
                      onChange={(e) => setPickingWindow(e.target.value)}
                      className="w-1/2 px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Selección de Mercadería / Bultos a Descontar */}
              <div className="pt-2">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Seleccionar Mercadería del Cliente ({pickingClientId ? inventory.filter((i) => String(i.client_id) === pickingClientId).length : 0} SKUs)</span>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold lowercase">
                    Ingrese la cantidad de bultos a despachar
                  </span>
                </h3>

                {inventory.filter((i) => String(i.client_id) === pickingClientId).length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-xs text-slate-500 border border-slate-200 dark:border-slate-700">
                    No hay mercadería registrada en depósito para este cliente.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2 px-3">SKU / Descripción</th>
                          <th className="py-2 px-3">Rack</th>
                          <th className="py-2 px-3 text-center">Stock Custodia</th>
                          <th className="py-2 px-3 text-center w-36">Bultos a Despachar</th>
                          <th className="py-2 px-3 text-right">Stock Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {inventory
                          .filter((i) => String(i.client_id) === pickingClientId)
                          .map((item) => {
                            const requested = pickingItemQuantities[item.id] || 0;
                            const remaining = item.cantidad_bultos - requested;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3">
                                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 mr-1.5">
                                    {item.sku_cliente}
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-400">{item.descripcion}</span>
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-500">{item.ubicacion_rack}</td>
                                <td className="py-2 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                                  {item.cantidad_bultos} bultos ({item.cantidad_bultos * item.unidades_por_bulto} un)
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <div className="flex items-center justify-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => handlePickingQtyChange(item.id, requested - 1, item.cantidad_bultos)}
                                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 font-bold cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.cantidad_bultos}
                                      value={requested}
                                      onChange={(e) =>
                                        handlePickingQtyChange(
                                          item.id,
                                          parseInt(e.target.value, 10) || 0,
                                          item.cantidad_bultos
                                        )
                                      }
                                      className="w-16 px-1.5 py-0.5 text-center font-bold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handlePickingQtyChange(item.id, requested + 1, item.cantidad_bultos)}
                                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 font-bold cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-medium">
                                  <span className={remaining === 0 ? 'text-amber-600 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                                    {remaining} bultos
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Live Preview Resumen de Despacho */}
              <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-purple-900 dark:text-purple-300 block">
                    Resumen de Pedido Seleccionado:
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Bultos a despachar:{' '}
                    <b>
                      {Object.values(pickingItemQuantities).reduce((a, b) => a + b, 0)} bultos
                    </b>{' '}
                    | Estimado:{' '}
                    <b>
                      {Object.entries(pickingItemQuantities)
                        .reduce((acc, [id, qty]) => {
                          const it = inventory.find((x) => x.id === Number(id));
                          return acc + (it ? it.peso_unitario_kg * qty : 0);
                        }, 0)
                        .toFixed(1)}{' '}
                      kg
                    </b>{' '}
                    /{' '}
                    <b>
                      {Object.entries(pickingItemQuantities)
                        .reduce((acc, [id, qty]) => {
                          const it = inventory.find((x) => x.id === Number(id));
                          return acc + (it ? it.volumen_unitario_m3 * qty : 0);
                        }, 0)
                        .toFixed(2)}{' '}
                      m³
                    </b>
                  </span>
                </div>
                <div className="text-right text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                  Se generará QR de remito con lugar para firma en la app del conductor
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPickingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPicking || Object.values(pickingItemQuantities).every((q) => q === 0)}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-sm"
                >
                  {isSubmittingPicking ? 'Generando Orden...' : 'Confirmar Picking & Enviar a Kanban'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/*                  MODAL: CONFIGURAR CENTRO DE DISTRIBUCIÓN BASE HUB        */}
      {/* ========================================================================= */}
      {isHubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Centro de Distribución Base (HUB 3PL)
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dirección física, coordenadas para el mapa de Tracking GPS y costos de arrendamiento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHubModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveHub} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nombre del Centro / Nave Logística
                  </label>
                  <input
                    type="text"
                    required
                    value={hubForm.nombre || ''}
                    onChange={(e) => setHubForm({ ...hubForm, nombre: e.target.value })}
                    placeholder="Ej: Centro de Distribución Base Calcu 3PL"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Dirección Física del Depósito
                    </label>
                    <button
                      type="button"
                      disabled={isGeocoding}
                      onClick={handleGeocodeHubAddress}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center space-x-1 cursor-pointer"
                    >
                      <Sparkles size={12} />
                      <span>{isGeocoding ? 'Buscando GPS...' : 'Obtener Coordenadas GPS'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={hubForm.direccion || ''}
                    onChange={(e) => setHubForm({ ...hubForm, direccion: e.target.value })}
                    placeholder="Ej: Ruta 101 Km 24.200 o Camino Carrasco 5950"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Ciudad / Departamento
                  </label>
                  <input
                    type="text"
                    value={hubForm.ciudad || ''}
                    onChange={(e) => setHubForm({ ...hubForm, ciudad: e.target.value })}
                    placeholder="Ej: Canelones"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    País
                  </label>
                  <input
                    type="text"
                    value={hubForm.pais || ''}
                    onChange={(e) => setHubForm({ ...hubForm, pais: e.target.value })}
                    placeholder="Uruguay"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Coordenadas para Mapa */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Latitud GPS (Para el Mapa)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={hubForm.lat ?? -34.8350}
                    onChange={(e) => setHubForm({ ...hubForm, lat: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Longitud GPS (Para el Mapa)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={hubForm.lng ?? -56.0350}
                    onChange={(e) => setHubForm({ ...hubForm, lng: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Capacidad */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Superficie Almacén (m²)
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={hubForm.superficie_m2 ?? 1500}
                    onChange={(e) => setHubForm({ ...hubForm, superficie_m2: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Capacidad Pallets Máxima
                  </label>
                  <input
                    type="number"
                    value={hubForm.capacidad_pallets_max ?? 600}
                    onChange={(e) => setHubForm({ ...hubForm, capacidad_pallets_max: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Contacto & Responsable */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Supervisor / Responsable Depósito
                  </label>
                  <input
                    type="text"
                    value={hubForm.responsable_deposito || ''}
                    onChange={(e) => setHubForm({ ...hubForm, responsable_deposito: e.target.value })}
                    placeholder="Ej: Marcelo García"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Teléfono Central de Operaciones
                  </label>
                  <input
                    type="text"
                    value={hubForm.telefono_contacto || ''}
                    onChange={(e) => setHubForm({ ...hubForm, telefono_contacto: e.target.value })}
                    placeholder="Ej: +598 99 123 456"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Alquiler Sincronizado */}
                <div className="sm:col-span-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                      Costo Fijo de Alquiler Mensual (Sincronizado)
                    </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                      Impacta directo en EBITDA y Costos Fijos
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="100"
                        required
                        value={hubForm.costo_alquiler_mensual ?? 145000}
                        onChange={(e) => setHubForm({ ...hubForm, costo_alquiler_mensual: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <select
                        value={hubForm.moneda_alquiler || 'UYU'}
                        onChange={(e) => setHubForm({ ...hubForm, moneda_alquiler: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        <option value="UYU">UYU ($)</option>
                        <option value="USD">USD (U$S)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsHubModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingHub}
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-sm flex items-center space-x-1.5"
                >
                  <Building2 size={14} />
                  <span>{isSavingHub ? 'Guardando...' : 'Guardar y Sincronizar HUB'}</span>
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
