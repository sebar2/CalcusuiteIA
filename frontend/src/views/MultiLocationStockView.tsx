import React, { useState, useEffect, useMemo } from 'react';
import {
  Ship,
  Factory,
  Warehouse,
  Globe,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  MapPin,
  Info,
  ShieldCheck,
  Search,
  Store,
  Clock,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react';
import { apiService, getStoredUser } from '../services/api';
import type {
  StockBatchItem,
  WarehouseTransferPayload,
  WarehouseAssignStockPayload,
  WarehouseItem,
  SupplierItem,
  WarehouseStockItem,
  UserRole,
} from '../types';
import { UniversalWarehouseTwin3D } from '../components/digitalTwin/UniversalWarehouseTwin3D';
import { Boxes } from 'lucide-react';
import { ProductThumbnail } from '../components/common/ProductThumbnail';
import { ColumnMultiSelect } from '../components/multilocation/ColumnMultiSelect';
import { ReventaBatchModal } from '../components/multilocation/ReventaBatchModal';

interface MultiLocationStockViewProps {
  currentRole?: UserRole;
}

export const MultiLocationStockView: React.FC<MultiLocationStockViewProps> = ({ currentRole: propRole }) => {
  // Rol de usuario activo para gobernanza RBAC
  const effectiveRole = propRole || (getStoredUser()?.role as UserRole) || 'controller_admin';
  const isAdmin = effectiveRole === 'controller_admin';
  const canManageCostAndApproval = effectiveRole === 'controller_admin' || effectiveRole === 'analista_comercial';

  // Datos principales
  const [unifiedBatches, setUnifiedBatches] = useState<StockBatchItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filtros globales
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedOrigenTipo, setSelectedOrigenTipo] = useState<string>('ALL');
  const [hideTestBatches, setHideTestBatches] = useState<boolean>(true); // Limpieza visual activa por defecto
  const [viewMode, setViewMode] = useState<'MATRIX' | '3D_TWIN'>('MATRIX');

  // Modal / Panel: Master de Almacenes Uruguay (Metros cúbicos, ocupación y valorización)
  const [isMasterAlmacenesOpen, setIsMasterAlmacenesOpen] = useState<boolean>(false);

  // Filtros individuales por columna maestra (Multi-Select: uno, varios o todos)
  const [selectedFactoryIds, setSelectedFactoryIds] = useState<string[]>(['ALL']);
  const [selectedIntWhIds, setSelectedIntWhIds] = useState<string[]>(['ALL']);
  const [selectedVesselIds, setSelectedVesselIds] = useState<string[]>(['ALL']);
  const [selectedUySupplierIds, setSelectedUySupplierIds] = useState<string[]>(['ALL']);
  const [selectedUyWhIds, setSelectedUyWhIds] = useState<string[]>(['ALL']);

  // Modal: Cargar Lote Reventa
  const [isReventaModalOpen, setIsReventaModalOpen] = useState<boolean>(false);

  // Modal: Ficha de Proveedor (Fábrica o Naviera/Buque)
  const [supplierDrawerItem, setSupplierDrawerItem] = useState<SupplierItem | null>(null);
  const [isLoadingSupplierDetail, setIsLoadingSupplierDetail] = useState<boolean>(false);

  // Modal: Ficha de Almacén (Internacional o Uruguay)
  const [warehouseModalDetail, setWarehouseModalDetail] = useState<WarehouseItem | null>(null);
  const [warehouseStockItems, setWarehouseStockItems] = useState<WarehouseStockItem[]>([]);
  const [isLoadingWarehouseStock, setIsLoadingWarehouseStock] = useState<boolean>(false);

  // Modal: Nueva Fábrica o Buque
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState<boolean>(false);
  const [supplierFormType, setSupplierFormType] = useState<'FABRICA' | 'NAVIERA_BUQUE' | 'PROVEEDOR_UY'>('FABRICA');
  const [supFormNombre, setSupFormNombre] = useState<string>('');
  const [supFormRazonSocial, setSupFormRazonSocial] = useState<string>('');
  const [supFormRut, setSupFormRut] = useState<string>('');
  const [supFormPais, setSupFormPais] = useState<string>('China');
  const [supFormContacto, setSupFormContacto] = useState<string>('');
  const [supFormCargo, setSupFormCargo] = useState<string>('');
  const [supFormEmail, setSupFormEmail] = useState<string>('');
  const [supFormPhone, setSupFormPhone] = useState<string>('');
  const [supFormAddress, setSupFormAddress] = useState<string>('');
  const [supFormDesc, setSupFormDesc] = useState<string>('');
  const [isSavingSupplier, setIsSavingSupplier] = useState<boolean>(false);

  // Modal: Nuevo Almacén (Internacional o Uruguay)
  const [isNewWarehouseModalOpen, setIsNewWarehouseModalOpen] = useState<boolean>(false);
  const [whFormTargetCol, setWhFormTargetCol] = useState<'INTERNACIONAL' | 'URUGUAY'>('URUGUAY');
  const [whFormId, setWhFormId] = useState<string>('');
  const [whFormNombre, setWhFormNombre] = useState<string>('');
  const [whFormTipo, setWhFormTipo] = useState<string>('SUCURSAL');
  const [whFormUbicacion, setWhFormUbicacion] = useState<string>('');
  const [whFormPais, setWhFormPais] = useState<string>('Uruguay');
  const [whFormCapacidad, setWhFormCapacidad] = useState<number>(10000);
  const [isSavingWarehouse, setIsSavingWarehouse] = useState<boolean>(false);

  // Modal: Transferencia de Lote entre Nodos
  const [transferModalBatch, setTransferModalBatch] = useState<StockBatchItem | null>(null);
  const [transferDestinoWh, setTransferDestinoWh] = useState<string>('DEP-CENTRAL-MVD');
  const [transferCantidad, setTransferCantidad] = useState<string>('');
  const [transferNotas, setTransferNotas] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Modal: Asignar Stock Directo
  const [isDirectStockModalOpen, setIsDirectStockModalOpen] = useState<boolean>(false);
  const [directLote, setDirectLote] = useState<string>('LOT-DIR-2026-');
  const [directSku, setDirectSku] = useState<string>('LUM-6060');
  const [directCantidad, setDirectCantidad] = useState<number>(100);
  const [directWhId, setDirectWhId] = useState<string>('DEP-CENTRAL-MVD');
  const [directTracking, setDirectTracking] = useState<string>('');
  const [directFechaEta, setDirectFechaEta] = useState<string>('');
  const [directNotas, setDirectNotas] = useState<string>('');
  const [isSavingDirect, setIsSavingDirect] = useState<boolean>(false);

  // Carga reactiva de datos maestros
  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [batchesData, whData, suppData] = await Promise.all([
        apiService.getUnifiedBatches(),
        apiService.getWarehouses().catch(() => []),
        apiService.getSuppliers().catch(() => []),
      ]);
      setUnifiedBatches(batchesData || []);
      setWarehouses(whData || []);
      setSuppliers(suppData || []);
    } catch (err: any) {
      console.error('Error al cargar datos de trazabilidad multidepósito:', err);
      setErrorMsg('No se pudieron obtener los lotes y almacenes unificados.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Separación de proveedores por rol (Fábricas vs Navieras/Buques vs Proveedores Uy/Reventa)
  const factories = useMemo(() => {
    return suppliers.filter(
      (s) => !s.tipo_proveedor || s.tipo_proveedor === 'FABRICA' || s.tipo_proveedor === 'GENERAL'
    );
  }, [suppliers]);

  const vessels = useMemo(() => {
    return suppliers.filter(
      (s) => s.tipo_proveedor === 'NAVIERA_BUQUE' || s.tipo_proveedor === 'LOGISTICA'
    );
  }, [suppliers]);

  const uySuppliers = useMemo(() => {
    return suppliers.filter(
      (s) =>
        s.tipo_proveedor === 'PROVEEDOR_UY' ||
        s.tipo_proveedor === 'PROVEEDOR_REVENTA' ||
        s.tipo_proveedor === 'LOCAL' ||
        (s.pais && s.pais.toLowerCase() === 'uruguay')
    );
  }, [suppliers]);

  // Separación de almacenes (Internacionales vs Uruguay)
  const intWarehouses = useMemo(() => {
    return warehouses.filter(
      (w) =>
        w.tipo === 'INTERNACIONAL' ||
        w.id.toLowerCase().includes('hub') ||
        (w.pais && w.pais.toLowerCase() !== 'uruguay')
    );
  }, [warehouses]);

  const uyWarehouses = useMemo(() => {
    return warehouses.filter(
      (w) =>
        w.tipo !== 'INTERNACIONAL' &&
        !w.id.toLowerCase().includes('hub') &&
        (!w.pais || w.pais.toLowerCase() === 'uruguay')
    );
  }, [warehouses]);

  // Opciones formateadas para Multi-Selects
  const factoryOptions = useMemo(
    () => factories.map((f) => ({ id: String(f.id), label: f.nombre, subLabel: f.pais || 'China' })),
    [factories]
  );
  const intWhOptions = useMemo(
    () => intWarehouses.map((w) => ({ id: w.id, label: w.nombre, subLabel: w.pais || 'China' })),
    [intWarehouses]
  );
  const vesselOptions = useMemo(
    () => vessels.map((v) => ({ id: String(v.id), label: v.nombre, subLabel: 'Naviera / Buque' })),
    [vessels]
  );
  const uySupplierOptions = useMemo(
    () =>
      uySuppliers.map((s) => ({
        id: String(s.id),
        label: s.nombre,
        subLabel: `RUT: ${s.rut || 'N/A'} - ${s.tipo_proveedor || 'Plaza'}`,
      })),
    [uySuppliers]
  );
  const uyWhOptions = useMemo(
    () => uyWarehouses.map((w) => ({ id: w.id, label: w.nombre, subLabel: w.tipo })),
    [uyWarehouses]
  );

  // Lotes filtrados con blindaje defensivo
  const filteredBatches = useMemo(() => {
    if (!Array.isArray(unifiedBatches)) return [];

    const term = String(searchFilter ?? '').trim().toLowerCase();

    return unifiedBatches.filter((b) => {
      if (!b) return false;

      const id = String(b.id ?? b.lote ?? '').toLowerCase();
      const lote = String(b.lote ?? '').toLowerCase();
      const sku = String(b.sku ?? '').toLowerCase();
      const skuFab = String(b.sku_fabrica ?? '').toLowerCase();
      const loteFab = String(b.lote_fabrica ?? '').toLowerCase();
      const nombre = String(b.producto_nombre ?? '').toLowerCase();
      const tracking = String(b.buque_o_tracking ?? '').toLowerCase();
      const whId = String(b.warehouse_id ?? '').toLowerCase();
      const prov = String(b.proveedor ?? b.supplier_nombre ?? '').toLowerCase();

      const matchSearch =
        !term ||
        id.includes(term) ||
        lote.includes(term) ||
        sku.includes(term) ||
        skuFab.includes(term) ||
        loteFab.includes(term) ||
        nombre.includes(term) ||
        tracking.includes(term) ||
        whId.includes(term) ||
        prov.includes(term);

      const rawOrigen = String(b.origen_tipo ?? 'ROP_REPOSICION').toUpperCase();
      const matchOrigen =
        selectedOrigenTipo === 'ALL' ||
        selectedOrigenTipo === 'todos' ||
        rawOrigen === selectedOrigenTipo ||
        (selectedOrigenTipo === 'LICITACION_B2B' && (rawOrigen.includes('LICIT') || rawOrigen.includes('B2B'))) ||
        (selectedOrigenTipo === 'ROP_REPOSICION' && (rawOrigen.includes('ROP') || rawOrigen.includes('REPO'))) ||
        (selectedOrigenTipo === 'STOCK_DIRECTO' && (rawOrigen.includes('DIRECT') || rawOrigen === 'STOCK_DIRECTO'));

      const isTestBatch = id.includes('test') || lote.includes('test');
      if (hideTestBatches && isTestBatch) {
        return false;
      }

      return matchSearch && matchOrigen;
    });
  }, [unifiedBatches, searchFilter, selectedOrigenTipo, hideTestBatches]);

  // Subconjuntos de lotes para cada una de las 5 Columnas Maestras
  const col1Batches = useMemo(() => {
    return filteredBatches.filter((b) => {
      const isCol = b.etapa_columna === 'fabrica' || b.estado === 'EN_PRODUCCION';
      if (!isCol) return false;
      if (selectedFactoryIds.length === 0 || selectedFactoryIds.includes('ALL')) return true;
      return (
        selectedFactoryIds.includes(String(b.supplier_id)) ||
        (b.supplier_nombre && selectedFactoryIds.some((id) => b.supplier_nombre?.toLowerCase().includes(id.toLowerCase()))) ||
        (b.proveedor && selectedFactoryIds.some((id) => b.proveedor?.toLowerCase().includes(id.toLowerCase())))
      );
    });
  }, [filteredBatches, selectedFactoryIds]);

  const col2Batches = useMemo(() => {
    return filteredBatches.filter((b) => {
      const isCol = b.etapa_columna === 'deposito_internacional';
      if (!isCol) return false;
      if (selectedIntWhIds.length === 0 || selectedIntWhIds.includes('ALL')) return true;
      return selectedIntWhIds.includes(b.warehouse_id);
    });
  }, [filteredBatches, selectedIntWhIds]);

  const col3Batches = useMemo(() => {
    return filteredBatches.filter((b) => {
      const isCol = b.etapa_columna === 'alta_mar' || b.estado === 'EN_TRANSITO';
      if (!isCol) return false;
      if (selectedVesselIds.length === 0 || selectedVesselIds.includes('ALL')) return true;
      return (
        selectedVesselIds.includes(String(b.supplier_id)) ||
        (b.buque_o_tracking && selectedVesselIds.some((id) => b.buque_o_tracking?.toLowerCase().includes(id.toLowerCase()))) ||
        (b.supplier_nombre && selectedVesselIds.some((id) => b.supplier_nombre?.toLowerCase().includes(id.toLowerCase())))
      );
    });
  }, [filteredBatches, selectedVesselIds]);

  const col4Batches = useMemo(() => {
    return filteredBatches.filter((b) => {
      const isCol = b.etapa_columna === 'proveedor_uy';
      if (!isCol) return false;
      if (selectedUySupplierIds.length === 0 || selectedUySupplierIds.includes('ALL')) return true;
      return (
        selectedUySupplierIds.includes(String(b.supplier_id)) ||
        (b.supplier_nombre && selectedUySupplierIds.some((id) => b.supplier_nombre?.toLowerCase().includes(id.toLowerCase()))) ||
        (b.proveedor && selectedUySupplierIds.some((id) => b.proveedor?.toLowerCase().includes(id.toLowerCase())))
      );
    });
  }, [filteredBatches, selectedUySupplierIds]);

  const col5Batches = useMemo(() => {
    return filteredBatches.filter((b) => {
      const isCol =
        b.etapa_columna === 'deposito_uruguay' ||
        (!b.etapa_columna && b.estado === 'DISPONIBLE');
      if (!isCol) return false;
      if (selectedUyWhIds.length === 0 || selectedUyWhIds.includes('ALL')) return true;
      return selectedUyWhIds.includes(b.warehouse_id);
    });
  }, [filteredBatches, selectedUyWhIds]);

  // Sumas cuantitativas de unidades
  const sumUnits = (items: StockBatchItem[]) => items.reduce((acc, b) => acc + (b.cantidad || 0), 0);

  // Manejador para abrir Ficha de Proveedor / Fábrica / Buque
  const handleOpenSupplierFicha = async (supplierIdOrName: string | number) => {
    setIsLoadingSupplierDetail(true);
    try {
      let supp: SupplierItem | undefined;
      if (typeof supplierIdOrName === 'number' || !isNaN(Number(supplierIdOrName))) {
        supp = suppliers.find((s) => s.id === Number(supplierIdOrName));
        if (supp) {
          const detail = await apiService.getSupplierById(supp.id).catch(() => supp);
          if (detail) supp = detail;
        }
      } else {
        supp = suppliers.find(
          (s) => s.nombre.toLowerCase().trim() === String(supplierIdOrName).toLowerCase().trim()
        );
        if (supp) {
          const detail = await apiService.getSupplierById(supp.id).catch(() => supp);
          if (detail) supp = detail;
        }
      }
      if (supp) {
        setSupplierDrawerItem(supp);
      } else {
        // Objeto provisional si no está persistido formalmente
        setSupplierDrawerItem({
          id: 0,
          nombre: String(supplierIdOrName),
          razon_social: String(supplierIdOrName),
          rut: 'N/A',
          tipo_proveedor: 'FABRICA',
          pais: 'China',
          total_skus: 0,
          productos: [],
          ordenes_compra_count: 0,
          ordenes_compra: [],
          descripcion: 'Proveedor de línea de producción registrado.',
        });
      }
    } catch (err) {
      console.error('Error al abrir ficha de proveedor:', err);
    } finally {
      setIsLoadingSupplierDetail(false);
    }
  };

  // Manejador para abrir Ficha de Almacén
  const handleOpenWarehouseFicha = async (whId: string) => {
    const wh = warehouses.find((w) => w.id === whId);
    if (!wh) return;
    setWarehouseModalDetail(wh);
    setIsLoadingWarehouseStock(true);
    try {
      const stock = await apiService.getWarehouseStock(wh.id).catch(() => []);
      setWarehouseStockItems(stock);
    } catch (err) {
      console.error('Error al cargar stock del almacén:', err);
      setWarehouseStockItems([]);
    } finally {
      setIsLoadingWarehouseStock(false);
    }
  };

  // Abrir Modal para crear nuevo proveedor
  const handleOpenNewSupplierModal = (type: 'FABRICA' | 'NAVIERA_BUQUE' | 'PROVEEDOR_UY') => {
    setSupplierFormType(type === 'PROVEEDOR_UY' ? 'PROVEEDOR_UY' : type);
    setSupFormNombre('');
    setSupFormRazonSocial('');
    setSupFormRut('');
    setSupFormPais(type === 'FABRICA' ? 'China' : type === 'NAVIERA_BUQUE' ? 'Dinamarca' : 'Uruguay');
    setSupFormContacto('');
    setSupFormCargo(
      type === 'FABRICA'
        ? 'Gerente de Planta'
        : type === 'NAVIERA_BUQUE'
        ? 'Agente Portuario'
        : 'Gerente Comercial / Ventas'
    );
    setSupFormEmail('');
    setSupFormPhone('');
    setSupFormAddress('');
    setSupFormDesc(
      type === 'FABRICA'
        ? 'Fabricante y ensamblador de luminarias y componentes LED.'
        : type === 'NAVIERA_BUQUE'
        ? 'Naviera y línea de transporte marítimo internacional de contenedores.'
        : 'Proveedor local en plaza uruguaya para reventa y proyectos B2B.'
    );
    setIsNewSupplierModalOpen(true);
  };

  // Guardar nuevo proveedor
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supFormNombre.trim()) {
      alert('El nombre es obligatorio.');
      return;
    }
    setIsSavingSupplier(true);
    try {
      await apiService.createSupplier({
        nombre: supFormNombre.trim(),
        razon_social: supFormRazonSocial.trim() || undefined,
        rut: supFormRut.trim() || undefined,
        tipo_proveedor: supplierFormType,
        pais: supFormPais.trim() || (supplierFormType === 'PROVEEDOR_UY' ? 'Uruguay' : 'China'),
        contacto_nombre: supFormContacto.trim() || undefined,
        contacto_cargo: supFormCargo.trim() || undefined,
        email: supFormEmail.trim() || undefined,
        phone: supFormPhone.trim() || undefined,
        address: supFormAddress.trim() || undefined,
        descripcion: supFormDesc.trim() || undefined,
      });
      setIsNewSupplierModalOpen(false);
      setSuccessBanner(
        `${
          supplierFormType === 'FABRICA'
            ? 'Fábrica'
            : supplierFormType === 'NAVIERA_BUQUE'
            ? 'Naviera / Buque'
            : 'Proveedor de Uruguay'
        } "${supFormNombre}" registrado con éxito.`
      );
      setTimeout(() => setSuccessBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      console.error('Error al guardar proveedor:', err);
      alert(err.response?.data?.detail || 'No se pudo registrar el proveedor.');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  // Aprobación de lote de reventa
  const handleApproveBatch = async (batchId: string) => {
    try {
      const res = await apiService.approveBatch(batchId, { accion: 'APROBADO' });
      setSuccessBanner(res.message || 'Lote de reventa aprobado para plaza.');
      setTimeout(() => setSuccessBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      console.error('Error al aprobar lote:', err);
      alert(err.response?.data?.detail || 'No se pudo aprobar el lote.');
    }
  };

  // Abrir Modal para crear nuevo almacén
  const handleOpenNewWarehouseModal = (target: 'INTERNACIONAL' | 'URUGUAY') => {
    setWhFormTargetCol(target);
    const prefix = target === 'INTERNACIONAL' ? 'wh-int-' : 'dep-uy-';
    setWhFormId(`${prefix}${Math.floor(10 + Math.random() * 90)}`);
    setWhFormNombre(
      target === 'INTERNACIONAL' ? 'Depósito Internacional Ningbo' : 'Depósito Salto Litoral'
    );
    setWhFormTipo(target === 'INTERNACIONAL' ? 'INTERNACIONAL' : 'SUCURSAL');
    setWhFormPais(target === 'INTERNACIONAL' ? 'China' : 'Uruguay');
    setWhFormUbicacion(
      target === 'INTERNACIONAL' ? 'Puerto de Ningbo, China' : 'Av. Blandengues, Salto, Uruguay'
    );
    setWhFormCapacidad(target === 'INTERNACIONAL' ? 50000 : 15000);
    setIsNewWarehouseModalOpen(true);
  };

  // Guardar nuevo almacén
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whFormNombre.trim()) {
      alert('El nombre del almacén es obligatorio.');
      return;
    }
    setIsSavingWarehouse(true);
    try {
      await apiService.createWarehouse({
        id: whFormId.trim() || undefined,
        nombre: whFormNombre.trim(),
        tipo: whFormTipo,
        ubicacion: whFormUbicacion.trim(),
        pais: whFormPais.trim() || (whFormTargetCol === 'INTERNACIONAL' ? 'China' : 'Uruguay'),
        capacidad_unidades: whFormCapacidad,
        activo: true,
      });
      setIsNewWarehouseModalOpen(false);
      setSuccessBanner(`Almacén "${whFormNombre}" registrado exitosamente.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      console.error('Error al guardar almacén:', err);
      alert(err.response?.data?.detail || 'No se pudo crear el almacén.');
    } finally {
      setIsSavingWarehouse(false);
    }
  };

  // Transferencia de lote
  const handleOpenTransferModal = (batch: StockBatchItem) => {
    if (batch.etapa_columna === 'proveedor_uy' && batch.estado_aprobacion === 'PENDIENTE_APROBACION') {
      alert('⚠️ Este lote se encuentra pendiente de aprobación comercial o administración. Debe ser aprobado antes de poder ser transferido a depósitos de Uruguay.');
      return;
    }
    setTransferModalBatch(batch);
    const defaultDest =
      batch.warehouse_id === 'DEP-CENTRAL-MVD' ? 'SHOWROOM-POCITOS' : 'DEP-CENTRAL-MVD';
    setTransferDestinoWh(defaultDest);
    setTransferCantidad(String(batch.cantidad));
    setTransferNotas('');
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalBatch) return;

    const cant = parseInt(transferCantidad, 10);
    if (isNaN(cant) || cant <= 0 || cant > transferModalBatch.cantidad) {
      alert(`La cantidad debe ser entre 1 y ${transferModalBatch.cantidad}.`);
      return;
    }

    if (transferModalBatch.warehouse_id === transferDestinoWh) {
      alert('El depósito de destino debe ser diferente al depósito de origen.');
      return;
    }

    setIsTransferring(true);
    try {
      const payload: WarehouseTransferPayload = {
        batch_id: transferModalBatch.id,
        origen_warehouse_id: transferModalBatch.warehouse_id,
        destino_warehouse_id: transferDestinoWh,
        cantidad: cant,
        observaciones: transferNotas.trim() || undefined,
      };

      const res = await apiService.transferWarehouseStock(payload);
      setTransferModalBatch(null);
      setSuccessBanner(res.message || 'Lote transferido exitosamente.');
      setTimeout(() => setSuccessBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      console.error('Error al transferir lote:', err);
      alert(err.response?.data?.detail || 'Error al ejecutar la transferencia.');
    } finally {
      setIsTransferring(false);
    }
  };

  // Arribo automático
  const handleAutoArrive = async () => {
    try {
      const res = await apiService.autoArriveStockBatches();
      setSuccessBanner(res.message);
      setTimeout(() => setSuccessBanner(null), 6000);
      await loadData();
    } catch (err: any) {
      console.error('Error al procesar arribos automáticos:', err);
      setErrorMsg('No se pudieron procesar los arribos automáticos.');
    }
  };

  // Asignación directa de stock
  const handleDirectStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directLote.trim() || !directSku.trim() || directCantidad <= 0) {
      alert('Lote, SKU y cantidad mayor a 0 son obligatorios.');
      return;
    }

    setIsSavingDirect(true);
    try {
      const payload: WarehouseAssignStockPayload = {
        lote: directLote.trim(),
        sku: directSku.trim(),
        cantidad: Number(directCantidad),
        warehouse_id: directWhId,
        buque_o_tracking: directTracking.trim() || undefined,
        fecha_eta: directFechaEta || undefined,
        observaciones: directNotas.trim() || undefined,
      };

      const res = await apiService.assignDirectStock(payload);
      setIsDirectStockModalOpen(false);
      setSuccessBanner(res.message || 'Stock asignado correctamente.');
      setTimeout(() => setSuccessBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      console.error('Error al asignar stock directo:', err);
      alert(err.response?.data?.detail || 'Error al asignar stock directo.');
    } finally {
      setIsSavingDirect(false);
    }
  };

  const renderBatchCard = (batch: StockBatchItem, stageType: string) => {
    const daysLeft = batch.dias_restantes_eta;
    const isROP = batch.origen_tipo === 'ROP' || batch.origen_tipo === 'ROP_REPOSICION';

    return (
      <div
        key={batch.id}
        className="bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all duration-150 shadow-xs hover:shadow-md space-y-2.5"
      >
        {/* Encabezado: Lote y Origen */}
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md truncate">
            {batch.lote}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              batch.etapa_columna === 'proveedor_uy'
                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                : isROP
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {batch.etapa_columna === 'proveedor_uy' ? 'REVENTA UY' : isROP ? 'ROP' : 'DIRECTO'}
          </span>
        </div>

        {/* SKU Dual & Thumbnail */}
        <div className="flex items-start gap-2.5">
          <ProductThumbnail src={batch.image_url || batch.imagen_url} alt={batch.sku} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                {batch.sku}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                {batch.cantidad.toLocaleString('es-UY')} u.
              </span>
            </div>

            {/* Ubicación Física Destacada para Depósitos Uruguay */}
            {stageType === 'deposito_uruguay' ? (
              <div className="mt-1 flex items-center space-x-1.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 font-semibold">
                <MapPin size={13} className="text-emerald-600 flex-shrink-0" />
                <span className="truncate">{batch.warehouse_nombre || batch.warehouse_id}</span>
              </div>
            ) : (
              /* SKU / Lote Fábrica para etapas internacionales */
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                <span className="font-mono bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded">
                  Fábrica: {batch.sku_fabrica || `MK-${batch.sku}-CN`}
                </span>
                {batch.lote_fabrica && (
                  <span className="font-mono bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded">
                    Lote: {batch.lote_fabrica}
                  </span>
                )}
              </div>
            )}

            {/* Descripción Producto */}
            {batch.producto_nombre && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-1 font-medium">
                {batch.producto_nombre}
              </p>
            )}
          </div>
        </div>

        {/* Acordeón secundario de trazabilidad de origen solo para Depósitos Uruguay */}
        {stageType === 'deposito_uruguay' && (batch.sku_fabrica || batch.lote_fabrica || batch.proveedor) && (
          <details className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/40 cursor-pointer">
            <summary className="font-medium hover:text-slate-600 dark:hover:text-slate-300 select-none">
              🏷️ Trazabilidad de Origen & Fábrica
            </summary>
            <div className="mt-1 space-y-0.5 pt-1 border-t border-slate-200/40 dark:border-slate-700/40 text-slate-500 dark:text-slate-400 font-mono">
              <div>Fábrica SKU: {batch.sku_fabrica || `MK-${batch.sku}-CN`}</div>
              {batch.lote_fabrica && <div>Lote Origen: {batch.lote_fabrica}</div>}
              <div>Proveedor: {batch.supplier_nombre || batch.proveedor || 'Importación'}</div>
            </div>
          </details>
        )}

        {/* PRECIO DE VENTA (ESTRICTAMENTE SIN COSTOS FOB/CIF CONFIDENCIALES) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[10px] uppercase font-semibold">Precio de Venta:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
            ${(batch.precio_venta || 0).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </span>
        </div>

        {/* HITOS ESPECÍFICOS SEGÚN FASE */}
        {stageType === 'fabrica' && (
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/70 dark:border-amber-900/40 text-[10px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-amber-800 dark:text-amber-300 font-medium">Fábrica:</span>
              <span className="font-bold text-amber-900 dark:text-amber-200 truncate max-w-[130px]">
                {batch.supplier_nombre || batch.proveedor || 'Foshan Lighting'}
              </span>
            </div>
            {batch.fecha_terminado && (
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                <span className="flex items-center space-x-1">
                  <Calendar size={11} />
                  <span>Terminado Estimado:</span>
                </span>
                <span className="font-bold">{String(batch.fecha_terminado)}</span>
              </div>
            )}
          </div>
        )}

        {stageType === 'deposito_internacional' && (
          <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-200/70 dark:border-indigo-900/40 text-[10px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-indigo-800 dark:text-indigo-300 font-medium">Hub Internacional:</span>
              <span className="font-bold text-indigo-900 dark:text-indigo-200 truncate max-w-[130px]">
                {batch.warehouse_nombre || batch.warehouse_id}
              </span>
            </div>
            <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300">
              <span>País Origen:</span>
              <span className="font-semibold">{batch.origen_pais || 'China'}</span>
            </div>
          </div>
        )}

        {stageType === 'alta_mar' && (
          <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg border border-blue-200/70 dark:border-blue-900/40 text-[10px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-blue-800 dark:text-blue-300 font-medium flex items-center space-x-1">
                <Ship size={11} />
                <span>Buque:</span>
              </span>
              <span className="font-bold text-blue-900 dark:text-blue-200 truncate max-w-[140px]">
                {batch.buque_o_tracking || 'MSC LAURA'}
              </span>
            </div>
            {batch.fecha_eta && (
              <div className="flex items-center justify-between pt-1 border-t border-blue-200/60 dark:border-blue-900/60">
                <span className="text-blue-700 dark:text-blue-300">ETA Montevideo:</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-bold ${
                    daysLeft !== null && daysLeft !== undefined && daysLeft <= 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200'
                  }`}
                >
                  {daysLeft !== null && daysLeft !== undefined && daysLeft <= 0 ? 'Arribado' : `${daysLeft || 0}d restantes`}
                </span>
              </div>
            )}
          </div>
        )}

        {stageType === 'proveedor_uy' && (
          <div className="bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-lg border border-purple-200/70 dark:border-purple-900/40 text-[10px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-purple-800 dark:text-purple-300 font-medium flex items-center space-x-1">
                <Store size={11} />
                <span>Proveedor Plaza:</span>
              </span>
              <span className="font-bold text-purple-900 dark:text-purple-200 truncate max-w-[130px]">
                {batch.supplier_nombre || batch.proveedor || 'Proveedor Uy'}
              </span>
            </div>

            {/* Costo Confidencial (Solo Comercial / Admin) */}
            {canManageCostAndApproval && batch.costo_compra ? (
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-semibold pt-1 border-t border-purple-200/50 dark:border-purple-900/50">
                <span className="flex items-center space-x-1">
                  <ShieldCheck size={11} />
                  <span>Costo Compra:</span>
                </span>
                <span className="font-mono font-bold">${Number(batch.costo_compra).toFixed(2)} USD</span>
              </div>
            ) : null}

            {/* Estado de Aprobación */}
            <div className="flex items-center justify-between pt-1 border-t border-purple-200/50 dark:border-purple-900/50">
              <span className="text-slate-600 dark:text-slate-400">Aprobación:</span>
              <span
                className={`px-1.5 py-0.5 rounded font-bold flex items-center space-x-1 ${
                  batch.estado_aprobacion === 'APROBADO'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {batch.estado_aprobacion === 'APROBADO' ? (
                  <>
                    <CheckCircle2 size={10} />
                    <span>Aprobado</span>
                  </>
                ) : (
                  <>
                    <Clock size={10} />
                    <span>Pendiente</span>
                  </>
                )}
              </span>
            </div>

            {/* Botón Aprobar Lote */}
            {batch.estado_aprobacion === 'PENDIENTE_APROBACION' && canManageCostAndApproval && (
              <button
                onClick={() => handleApproveBatch(batch.id)}
                className="w-full mt-1.5 py-1 px-2 text-[10px] font-bold rounded-md bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center space-x-1 transition-colors shadow-2xs"
              >
                <CheckCircle2 size={11} />
                <span>✓ Aprobar Lote para Plaza</span>
              </button>
            )}
          </div>
        )}

        {stageType === 'deposito_uruguay' && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200/70 dark:border-emerald-900/40 text-[10px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-emerald-800 dark:text-emerald-300 font-medium flex items-center space-x-1">
                <MapPin size={11} />
                <span>Ubicación:</span>
              </span>
              <span className="font-bold text-emerald-900 dark:text-emerald-200 truncate max-w-[130px]">
                {batch.warehouse_nombre || batch.warehouse_id}
              </span>
            </div>
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
              <span>Estado:</span>
              <span className="font-bold uppercase">{batch.estado || 'DISPONIBLE'}</span>
            </div>
          </div>
        )}

        {/* Botón de Acción de Transferencia */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono">
            {batch.warehouse_id}
          </span>
          <button
            onClick={() => handleOpenTransferModal(batch)}
            disabled={batch.etapa_columna === 'proveedor_uy' && batch.estado_aprobacion === 'PENDIENTE_APROBACION'}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center space-x-1 transition-colors ${
              batch.etapa_columna === 'proveedor_uy' && batch.estado_aprobacion === 'PENDIENTE_APROBACION'
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 dark:bg-slate-800 dark:text-slate-600'
                : 'bg-slate-100 hover:bg-cyan-50 dark:bg-slate-700 dark:hover:bg-cyan-950/60 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-600'
            }`}
            title={
              batch.etapa_columna === 'proveedor_uy' && batch.estado_aprobacion === 'PENDIENTE_APROBACION'
                ? 'Debe ser aprobado por Comercial o Admin antes de transferir a depósito Uruguay'
                : 'Transferir unidades entre depósitos o nodos'
            }
          >
            <ArrowRightLeft size={11} />
            <span>Transferir</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          HEADER PRINCIPAL EJECUTIVO (MODERN SAAS)
      ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Ship size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Monitor Multi-Depósito & Trazabilidad Global
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-200">
                5 Fases Logísticas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control físico y dual-SKU en Fábricas, Depósitos Internacionales, Buques en Alta Mar, Proveedores Uy y Almacenes Uruguay.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Conmutador Matriz / Gemelo Digital 3D */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('MATRIX')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'MATRIX'
                  ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Ship size={14} />
              <span>📊 Matriz Multi-Depósito</span>
            </button>
            <button
              onClick={() => setViewMode('3D_TWIN')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === '3D_TWIN'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes size={14} />
              <span>🧊 Gemelo Digital 3D</span>
            </button>
          </div>

          <button
            onClick={handleAutoArrive}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 border border-emerald-300 dark:border-emerald-800 transition-all shadow-xs"
            title="Ingresar a Depósito Central todos los lotes cuya fecha ETA ya se cumplió"
          >
            <PackageCheck size={15} />
            <span>⚡ Arribo Automático (ETA ≤ 0)</span>
          </button>

          <button
            onClick={() => {
              setDirectLote(`LOT-DIR-2026-${Math.floor(100 + Math.random() * 900)}`);
              setIsDirectStockModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-emerald-500/20 transition-all hover:scale-[1.01]"
            title="Asignar stock de ingreso directo en un almacén físico"
          >
            <Plus size={16} />
            <span>+ Asignar Stock Directo</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Refrescar Lotes"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {viewMode === '3D_TWIN' ? (
        <div className="space-y-4">
          <UniversalWarehouseTwin3D
            moduleScope="SUPPLY_CHAIN"
            onTransferSuccess={loadData}
          />
        </div>
      ) : (
        <div className="space-y-6">
{/* =====================================================================
          5 CARDS RESUMEN DE LAS FASES LOGÍSTICAS
      ===================================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span className="font-semibold text-amber-700 dark:text-amber-400">1. Fábricas (Producción)</span>
            <Factory size={18} className="text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {sumUnits(col1Batches).toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{col1Batches.length} lotes en curso</span>
            <span className="font-semibold text-amber-600">{factories.length} fábricas</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span className="font-semibold text-indigo-700 dark:text-indigo-400">2. Depósitos Int.</span>
            <Globe size={18} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {sumUnits(col2Batches).toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{col2Batches.length} lotes origen</span>
            <span className="font-semibold text-indigo-600">{intWarehouses.length} depósitos</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span className="font-semibold text-blue-700 dark:text-blue-400">3. En Alta Mar</span>
            <Ship size={18} className="text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {sumUnits(col3Batches).toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{col3Batches.length} lotes tracking</span>
            <span className="font-semibold text-blue-600">{vessels.length} buques</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/50 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span className="font-semibold text-purple-700 dark:text-purple-400">4. Proveedores Uy</span>
            <Store size={18} className="text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {sumUnits(col4Batches).toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{col4Batches.length} lotes reventa</span>
            <span className="font-semibold text-purple-600">{uySuppliers.length} proveedores</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">5. Depósitos Uruguay</span>
            <Warehouse size={18} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {sumUnits(col5Batches).toLocaleString('es-UY')}
            <span className="text-xs font-normal text-slate-500 ml-1">u.</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{col5Batches.length} lotes plaza</span>
            <span className="font-semibold text-emerald-600">{uyWarehouses.length} almacenes</span>
          </div>
        </div>
      </div>

      {/* Banners de Notificación */}
      {successBanner && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Barra de Búsqueda Global y Origen */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
          <Search size={15} className="text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por SKU Montevideo, SKU Fábrica, Lote, Buque o Almacén..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Origen:</span>
            <select
              value={selectedOrigenTipo}
              onChange={(e) => setSelectedOrigenTipo(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
            >
              <option value="ALL">Todos los orígenes</option>
              <option value="ROP_REPOSICION">ROP (Reposición / Kanban)</option>
              <option value="STOCK_DIRECTO">Stock Directo</option>
              <option value="LICITACION_B2B">Licitación B2B</option>
            </select>
          </div>

          {/* Toggle Limpieza de Lotes de Prueba */}
          <button
            type="button"
            onClick={() => setHideTestBatches(!hideTestBatches)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-all ${
              hideTestBatches
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            }`}
            title={hideTestBatches ? "Lotes de prueba ocultos (Vista operativa limpia)" : "Mostrando todos los lotes incluidos los de testing"}
          >
            {hideTestBatches ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{hideTestBatches ? "Ocultando Tests" : "Mostrando Tests"}</span>
          </button>

          {/* Botón Gestión Master de Almacenes Uruguay */}
          <button
            type="button"
            onClick={() => setIsMasterAlmacenesOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-bold shadow-xs transition-all hover:scale-[1.01]"
            title="Abrir panel maestro de almacenes, m³ ocupados y transferencias locales"
          >
            <Building2 size={13} />
            <span>Almacenes Uruguay</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          TABLERO DE LAS 4 COLUMNAS MAESTRAS
      ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start min-h-[600px]">
        {/* =================================================================
            COLUMNA 1: FÁBRICAS (PRODUCCIÓN)
        ================================================================= */}
        <div className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Header de Columna 1 */}
          <div className="p-3.5 border-t-4 border-amber-500 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Factory size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    1. Fábricas
                  </h2>
                  <p className="text-[10px] text-slate-400">Producción en planta</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200">
                {col1Batches.length} lotes ({sumUnits(col1Batches)} u.)
              </span>
            </div>

            {/* Selector Multi-Select de Fábrica (Sin botón agregar) */}
            <div className="flex items-center gap-1.5 pt-1">
              <ColumnMultiSelect
                label="Fábricas"
                allLabel={`Todas las Fábricas (${factories.length})`}
                options={factoryOptions}
                selectedIds={selectedFactoryIds}
                onChange={setSelectedFactoryIds}
                accentClass="text-amber-600"
              />

              {selectedFactoryIds.length === 1 && selectedFactoryIds[0] !== 'ALL' && (
                <button
                  onClick={() => handleOpenSupplierFicha(Number(selectedFactoryIds[0]))}
                  className="p-1 text-slate-500 hover:text-amber-600 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Ver ficha técnica de la fábrica"
                >
                  <Info size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Tarjetas de Columna 1 */}
          <div className="p-2 space-y-2.5 min-h-[400px] max-h-[750px] overflow-y-auto">
            {col1Batches.length === 0 ? (
              <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs italic space-y-1">
                <Factory size={22} className="opacity-40" />
                <span>No hay lotes en fabricación</span>
              </div>
            ) : (
              col1Batches.map((batch) => renderBatchCard(batch, 'fabrica'))
            )}
          </div>
        </div>

        {/* =================================================================
            COLUMNA 2: DEPÓSITOS INTERNACIONALES (CONSOLIDACIÓN)
        ================================================================= */}
        <div className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Header de Columna 2 */}
          <div className="p-3.5 border-t-4 border-indigo-500 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Globe size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    2. Depósitos Int.
                  </h2>
                  <p className="text-[10px] text-slate-400">Consolidación en origen</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200">
                {col2Batches.length} lotes ({sumUnits(col2Batches)} u.)
              </span>
            </div>

            {/* Selector Multi-Select de Depósito Int. (Sin botón agregar) */}
            <div className="flex items-center gap-1.5 pt-1">
              <ColumnMultiSelect
                label="Depósitos Int."
                allLabel={`Todos los Depósitos Int. (${intWarehouses.length})`}
                options={intWhOptions}
                selectedIds={selectedIntWhIds}
                onChange={setSelectedIntWhIds}
                accentClass="text-indigo-600"
              />

              {selectedIntWhIds.length === 1 && selectedIntWhIds[0] !== 'ALL' && (
                <button
                  onClick={() => handleOpenWarehouseFicha(selectedIntWhIds[0])}
                  className="p-1 text-slate-500 hover:text-indigo-600 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Ver ficha del almacén internacional"
                >
                  <Info size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Tarjetas de Columna 2 */}
          <div className="p-2 space-y-2.5 min-h-[400px] max-h-[750px] overflow-y-auto">
            {col2Batches.length === 0 ? (
              <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs italic space-y-1">
                <Globe size={22} className="opacity-40" />
                <span>Sin lotes en consolidación internacional</span>
              </div>
            ) : (
              col2Batches.map((batch) => renderBatchCard(batch, 'deposito_internacional'))
            )}
          </div>
        </div>

        {/* =================================================================
            COLUMNA 3: EN ALTA MAR (BUQUES & NAVIERAS)
        ================================================================= */}
        <div className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Header de Columna 3 */}
          <div className="p-3.5 border-t-4 border-blue-500 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Ship size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    3. En Alta Mar
                  </h2>
                  <p className="text-[10px] text-slate-400">Tránsito marítimo con ETA</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200">
                {col3Batches.length} lotes ({sumUnits(col3Batches)} u.)
              </span>
            </div>

            {/* Selector Multi-Select de Buque/Naviera (Sin botón agregar) */}
            <div className="flex items-center gap-1.5 pt-1">
              <ColumnMultiSelect
                label="Buques"
                allLabel={`Todos los Buques (${vessels.length})`}
                options={vesselOptions}
                selectedIds={selectedVesselIds}
                onChange={setSelectedVesselIds}
                accentClass="text-blue-600"
              />

              {selectedVesselIds.length === 1 && selectedVesselIds[0] !== 'ALL' && (
                <button
                  onClick={() => handleOpenSupplierFicha(Number(selectedVesselIds[0]))}
                  className="p-1 text-slate-500 hover:text-blue-600 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Ver ficha técnica del buque"
                >
                  <Info size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Tarjetas de Columna 3 */}
          <div className="p-2 space-y-2.5 min-h-[400px] max-h-[750px] overflow-y-auto">
            {col3Batches.length === 0 ? (
              <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs italic space-y-1">
                <Ship size={22} className="opacity-40" />
                <span>No hay lotes navegando en alta mar</span>
              </div>
            ) : (
              col3Batches.map((batch) => renderBatchCard(batch, 'alta_mar'))
            )}
          </div>
        </div>

        {/* =================================================================
            COLUMNA 4: PROVEEDORES UY (PLAZA LOCAL & REVENTA)
        ================================================================= */}
        <div className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Header de Columna 4 */}
          <div className="p-3.5 border-t-4 border-purple-500 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Store size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    4. Proveedores Uy
                  </h2>
                  <p className="text-[10px] text-slate-400">Plaza local & Reventa</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200">
                {col4Batches.length} lotes ({sumUnits(col4Batches)} u.)
              </span>
            </div>

            {/* Selector Multi-Select de Proveedor Uy + Botones Agregar Proveedor y Lote */}
            <div className="flex items-center gap-1.5 pt-1">
              <ColumnMultiSelect
                label="Proveedores Uy"
                allLabel={`Todos los Prov. Uy (${uySuppliers.length})`}
                options={uySupplierOptions}
                selectedIds={selectedUySupplierIds}
                onChange={setSelectedUySupplierIds}
                accentClass="text-purple-600"
              />

              <button
                onClick={() => handleOpenNewSupplierModal('PROVEEDOR_UY')}
                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-semibold flex items-center space-x-0.5 shadow-2xs"
                title="Registrar nuevo proveedor uruguayo o reventa"
              >
                <Plus size={12} />
                <span>Prov. Uy</span>
              </button>

              <button
                onClick={() => setIsReventaModalOpen(true)}
                className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950/80 dark:text-purple-200 rounded-lg text-[10px] font-semibold flex items-center space-x-0.5 shadow-2xs"
                title="Cargar lote manual de reventa con precio y costo"
              >
                <Plus size={12} />
                <span>Lote</span>
              </button>
            </div>
          </div>

          {/* Lista de Tarjetas de Columna 4 */}
          <div className="p-2 space-y-2.5 min-h-[400px] max-h-[750px] overflow-y-auto">
            {col4Batches.length === 0 ? (
              <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs italic space-y-1">
                <Store size={22} className="opacity-40" />
                <span>No hay lotes de proveedores locales en plaza</span>
              </div>
            ) : (
              col4Batches.map((batch) => renderBatchCard(batch, 'proveedor_uy'))
            )}
          </div>
        </div>

        {/* =================================================================
            COLUMNA 5: DEPÓSITOS URUGUAY (STOCK NACIONALIZADO)
        ================================================================= */}
        <div className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Header de Columna 5 */}
          <div className="p-3.5 border-t-4 border-emerald-500 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Warehouse size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    5. Depósitos Uruguay
                  </h2>
                  <p className="text-[10px] text-slate-400">Stock nacionalizado</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200">
                {col5Batches.length} lotes ({sumUnits(col5Batches)} u.)
              </span>
            </div>

            {/* Selector Multi-Select de Almacén UY + Acciones */}
            <div className="flex items-center gap-1.5 pt-1">
              <ColumnMultiSelect
                label="Almacenes UY"
                allLabel={`Todos los Almacenes UY (${uyWarehouses.length})`}
                options={uyWhOptions}
                selectedIds={selectedUyWhIds}
                onChange={setSelectedUyWhIds}
                accentClass="text-emerald-600"
              />

              <button
                onClick={() => handleOpenNewWarehouseModal('URUGUAY')}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-semibold flex items-center space-x-0.5 shadow-2xs"
                title="Registrar nuevo almacén en Uruguay"
              >
                <Plus size={12} />
                <span>Almacén</span>
              </button>

              {selectedUyWhIds.length === 1 && selectedUyWhIds[0] !== 'ALL' && (
                <button
                  onClick={() => handleOpenWarehouseFicha(selectedUyWhIds[0])}
                  className="p-1 text-slate-500 hover:text-emerald-600 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Ver ficha del almacén uruguayo"
                >
                  <Info size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Tarjetas de Columna 5 */}
          <div className="p-2 space-y-2.5 min-h-[400px] max-h-[750px] overflow-y-auto">
            {col5Batches.length === 0 ? (
              <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs italic space-y-1">
                <Warehouse size={22} className="opacity-40" />
                <span>No hay lotes en depósitos de Uruguay</span>
              </div>
            ) : (
              col5Batches.map((batch) => renderBatchCard(batch, 'deposito_uruguay'))
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL / DRAWER: FICHA DE PROVEEDOR (FÁBRICA O BUQUE)
      ===================================================================== */}
      {supplierDrawerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${
                    supplierDrawerItem.tipo_proveedor === 'NAVIERA_BUQUE'
                      ? 'bg-gradient-to-tr from-blue-600 to-cyan-600'
                      : 'bg-gradient-to-tr from-amber-600 to-orange-600'
                  }`}
                >
                  {supplierDrawerItem.tipo_proveedor === 'NAVIERA_BUQUE' ? (
                    <Ship size={24} />
                  ) : (
                    <Factory size={24} />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {supplierDrawerItem.nombre}
                  </h3>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {supplierDrawerItem.tipo_proveedor || 'FABRICA'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {supplierDrawerItem.pais || 'China'}
                    </span>
                    {isLoadingSupplierDetail && (
                      <RefreshCw size={12} className="animate-spin text-cyan-500" />
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSupplierDrawerItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Datos Técnicos y de Contacto */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
              <div>
                <span className="text-slate-400 block text-[10px]">Razón Social:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {supplierDrawerItem.razon_social || supplierDrawerItem.nombre}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">RUT / Registro Tributario:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {supplierDrawerItem.rut || 'No registrado'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Contacto Principal:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {supplierDrawerItem.contacto_nombre || 'No asignado'} ({supplierDrawerItem.contacto_cargo || 'Representante'})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Teléfono / Móvil:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {supplierDrawerItem.phone || 'No registrado'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px]">Correo Electrónico:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {supplierDrawerItem.email || 'No registrado'}
                </span>
              </div>
              {supplierDrawerItem.address && (
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px]">Dirección / Planta:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {supplierDrawerItem.address}
                  </span>
                </div>
              )}
            </div>

            {supplierDrawerItem.descripcion && (
              <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                "{supplierDrawerItem.descripcion}"
              </p>
            )}

            {/* SECCIÓN CONFIDENCIAL ADMIN: ÓRDENES DE COMPRA */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck size={16} className="text-cyan-600" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Historial de Órdenes de Compra (Admin)
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">
                  {supplierDrawerItem.ordenes_compra_count || supplierDrawerItem.ordenes_compra?.length || 0} órdenes registradas
                </span>
              </div>

              {isAdmin ? (
                supplierDrawerItem.ordenes_compra && supplierDrawerItem.ordenes_compra.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {supplierDrawerItem.ordenes_compra.map((po, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            #{po.id} - {po.sku_id}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-2">
                            ({po.cantidad} u.)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">
                            ${(po.monto_total || 0).toLocaleString('es-UY')} USD
                          </span>
                          <span className="text-[9px] uppercase font-bold text-emerald-600">
                            {po.etapa}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    No se registran órdenes de compra históricas para este proveedor.
                  </div>
                )
              ) : (
                <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  🔒 Historial de compras y acuerdos comerciales restringido al rol Controller / Admin.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSupplierDrawerItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: FICHA / DETALLE DE ALMACÉN
      ===================================================================== */}
      {warehouseModalDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Warehouse size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {warehouseModalDetail.nombre}
                  </h3>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="font-mono text-xs text-indigo-600 font-bold">
                      {warehouseModalDetail.id}
                    </span>
                    <span className="text-xs text-slate-500">
                      {warehouseModalDetail.pais || 'Uruguay'} ({warehouseModalDetail.tipo})
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setWarehouseModalDetail(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px]">Ubicación Física:</span>
                <span className="font-semibold">{warehouseModalDetail.ubicacion}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Capacidad Operativa:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {warehouseModalDetail.capacidad_unidades?.toLocaleString('es-UY')} u.
                </span>
              </div>
            </div>

            {/* Listado de SKUs en Almacén */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Inventario Consolidado en Almacén
              </h4>
              {isLoadingWarehouseStock ? (
                <div className="py-6 text-center text-xs text-slate-400">Consultando stock...</div>
              ) : warehouseStockItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  No hay stock asignado en este centro logístico.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {warehouseStockItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {item.sku}
                        </span>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{item.producto_nombre}</p>
                      </div>
                      <span className="font-bold text-emerald-600">
                        {item.stock_disponible} u.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setWarehouseModalDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: + NUEVA FÁBRICA / + NUEVO BUQUE
      ===================================================================== */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                  {supplierFormType === 'FABRICA' ? <Factory size={20} /> : <Ship size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {supplierFormType === 'FABRICA' ? 'Registrar Nueva Fábrica' : 'Registrar Nuevo Buque / Naviera'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {supplierFormType === 'FABRICA'
                      ? 'Proveedor de manufactura y ensamblaje internacional.'
                      : 'Línea de flete marítimo y despacho aduanero.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder={supplierFormType === 'FABRICA' ? 'ej. Ningbo Opto Components' : 'ej. MSC LAURA / Maersk Line'}
                  value={supFormNombre}
                  onChange={(e) => setSupFormNombre(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={supFormRazonSocial}
                    onChange={(e) => setSupFormRazonSocial(e.target.value)}
                    placeholder="ej. Ningbo Opto Co. Ltd"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    RUT / Identificador Fiscal
                  </label>
                  <input
                    type="text"
                    value={supFormRut}
                    onChange={(e) => setSupFormRut(e.target.value)}
                    placeholder="CN-9133020..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    País de Operación
                  </label>
                  <input
                    type="text"
                    value={supFormPais}
                    onChange={(e) => setSupFormPais(e.target.value)}
                    placeholder="ej. China, Suiza, Alemania"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contacto / Agente
                  </label>
                  <input
                    type="text"
                    value={supFormContacto}
                    onChange={(e) => setSupFormContacto(e.target.value)}
                    placeholder="ej. Zhang Wei / Marco Valente"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email de Enlace
                  </label>
                  <input
                    type="email"
                    value={supFormEmail}
                    onChange={(e) => setSupFormEmail(e.target.value)}
                    placeholder="orders@supplier.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={supFormPhone}
                    onChange={(e) => setSupFormPhone(e.target.value)}
                    placeholder="+86 574 8820 1100"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descripción Operativa
                </label>
                <textarea
                  rows={2}
                  value={supFormDesc}
                  onChange={(e) => setSupFormDesc(e.target.value)}
                  placeholder="Detalles sobre capacidades de planta, líneas de flete, rutas habituales..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isSavingSupplier ? 'Guardando...' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: + NUEVO ALMACÉN (INTERNACIONAL O URUGUAY)
      ===================================================================== */}
      {isNewWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                  <Warehouse size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {whFormTargetCol === 'INTERNACIONAL'
                      ? 'Registrar Depósito Internacional'
                      : 'Registrar Almacén en Uruguay'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Centro logístico físico para almacenamiento y control de stock.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewWarehouseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Almacén *
                </label>
                <input
                  type="text"
                  required
                  value={whFormNombre}
                  onChange={(e) => setWhFormNombre(e.target.value)}
                  placeholder="ej. Depósito Regional Salto o Ningbo Logistics Hub"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Código Identificador (ID)
                  </label>
                  <input
                    type="text"
                    value={whFormId}
                    onChange={(e) => setWhFormId(e.target.value)}
                    placeholder="ej. dep-salto-02"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    País
                  </label>
                  <input
                    type="text"
                    value={whFormPais}
                    onChange={(e) => setWhFormPais(e.target.value)}
                    placeholder="ej. Uruguay, China, Alemania"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Depósito
                  </label>
                  <select
                    value={whFormTipo}
                    onChange={(e) => setWhFormTipo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {whFormTargetCol === 'INTERNACIONAL' ? (
                      <option value="INTERNACIONAL">INTERNACIONAL (Consolidación)</option>
                    ) : (
                      <>
                        <option value="CENTRAL">CENTRAL (Montevideo)</option>
                        <option value="SUCURSAL">SUCURSAL (Regional / Interior)</option>
                        <option value="TRANSITO">TRANSITO (Zona Franca)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Capacidad (Unidades)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={whFormCapacidad}
                    onChange={(e) => setWhFormCapacidad(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ubicación Física / Dirección
                </label>
                <input
                  type="text"
                  required
                  value={whFormUbicacion}
                  onChange={(e) => setWhFormUbicacion(e.target.value)}
                  placeholder="ej. Av. Barbieri 820, Salto, Uruguay"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewWarehouseModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingWarehouse}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isSavingWarehouse ? 'Guardando...' : 'Guardar Almacén'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: TRANSFERENCIA DE STOCK ENTRE ALMACENES
      ===================================================================== */}
      {transferModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft size={20} className="text-cyan-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Transferir Stock entre Nodos
                </h3>
              </div>
              <button
                onClick={() => setTransferModalBatch(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between font-mono font-bold text-blue-600 dark:text-blue-400">
                  <span>{transferModalBatch.lote}</span>
                  <span>{transferModalBatch.sku}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Ubicación Origen:</span>
                  <span className="font-semibold">{transferModalBatch.warehouse_nombre || transferModalBatch.warehouse_id}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Stock Disponible:</span>
                  <span className="font-bold">{transferModalBatch.cantidad} unidades</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Depósito Destino *
                </label>
                <select
                  value={transferDestinoWh}
                  onChange={(e) => setTransferDestinoWh(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
                >
                  {warehouses
                    .filter((w) => w.id !== transferModalBatch.warehouse_id)
                    .map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nombre} ({wh.tipo})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cantidad a Transferir (Unidades) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={transferModalBatch.cantidad}
                  value={transferCantidad}
                  onChange={(e) => setTransferCantidad(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notas / Remito Interno
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. Transferencia interna de stock hacia depósito regional Salto."
                  value={transferNotas}
                  onChange={(e) => setTransferNotas(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferModalBatch(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isTransferring ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ASIGNAR STOCK DIRECTO
      ===================================================================== */}
      {isDirectStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Warehouse size={20} className="text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Asignar Stock de Ingreso Directo
                </h3>
              </div>
              <button
                onClick={() => setIsDirectStockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleDirectStockSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Código de Lote *
                  </label>
                  <input
                    type="text"
                    required
                    value={directLote}
                    onChange={(e) => setDirectLote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    SKU del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={directSku}
                    onChange={(e) => setDirectSku(e.target.value)}
                    placeholder="LUM-6060"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cantidad a Ingresar *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={directCantidad}
                    onChange={(e) => setDirectCantidad(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Almacén de Entrada *
                  </label>
                  <select
                    value={directWhId}
                    onChange={(e) => setDirectWhId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.nombre} ({wh.tipo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Buque / Tracking (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Maersk / Guía 99201"
                    value={directTracking}
                    onChange={(e) => setDirectTracking(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fecha ETA (opcional)
                  </label>
                  <input
                    type="date"
                    value={directFechaEta}
                    onChange={(e) => setDirectFechaEta(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones de Recepción
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre remito de fábrica o importación..."
                  value={directNotas}
                  onChange={(e) => setDirectNotas(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDirectStockModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDirect}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isSavingDirect ? 'Guardando...' : 'Asignar Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cargar Lote Reventa / Plaza */}
              </div>
      )}

      <ReventaBatchModal
        isOpen={isReventaModalOpen}
        onClose={() => setIsReventaModalOpen(false)}
        onSuccess={() => {
          setSuccessBanner('Lote de reventa registrado exitosamente en estado pendiente de aprobación.');
          setTimeout(() => setSuccessBanner(null), 5000);
          loadData();
        }}
        uySuppliers={uySuppliers}
        canManageCost={canManageCostAndApproval}
      />

      {/* =====================================================================
          MODAL: MASTER DE ALMACENES URUGUAY & CONTROL DE CAPACIDAD FÍSICA
      ===================================================================== */}
      {isMasterAlmacenesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Master de Almacenes Uruguay & Gestión Física
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Capacidad física, ocupación en unidades y ejecución de transferencias inter-depósito locales.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMasterAlmacenesOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1"
              >
                ×
              </button>
            </div>

            {/* Grid de Almacenes Uruguay con métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {uyWarehouses.map((wh) => {
                const whBatches = col5Batches.filter((b) => b.warehouse_id === wh.id);
                const totalStock = whBatches.reduce((acc, b) => acc + (b.cantidad || 0), 0);
                const capacity = wh.capacidad_unidades || 10000;
                const occupancyPct = Math.min(100, Math.round((totalStock / capacity) * 100));
                const totalValorUSD = whBatches.reduce(
                  (acc, b) => acc + (b.cantidad || 0) * (b.precio_venta || 0),
                  0
                );

                return (
                  <div
                    key={wh.id}
                    className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
                          {wh.id}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {wh.tipo}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2">
                        {wh.nombre}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                        <MapPin size={11} className="flex-shrink-0" />
                        <span className="truncate">{wh.ubicacion}</span>
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                        <span>Stock Ocupado:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {totalStock.toLocaleString('es-UY')} / {capacity.toLocaleString('es-UY')} u.
                        </span>
                      </div>

                      {/* Barra de Progreso de Ocupación */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            occupancyPct > 85 ? 'bg-rose-500' : occupancyPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${occupancyPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Ocupación: {occupancyPct}%</span>
                        <span>{whBatches.length} lotes activos</span>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                        <span className="text-slate-400 text-[11px]">Inventario Valorizado:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${totalValorUSD.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMasterAlmacenesOpen(false);
                          handleOpenWarehouseFicha(wh.id);
                        }}
                        className="flex-1 py-1.5 px-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-600 text-center transition-colors"
                      >
                        Ver Detalle Stock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Red Logística Local: 3 Nodos Activos en Uruguay (Central MVD, Pocitos y Salto).
              </span>
              <button
                type="button"
                onClick={() => setIsMasterAlmacenesOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
