import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  ShoppingBag,
  FileText,
  Search,
  Plus,
  Upload,
  RefreshCw,
  Building2,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Package,
  Clock,
  CheckCircle2,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  SupplierItem,
  SupplierCatalogProductItem,
  SupplierCatalogTenderContract,
  SupplierCatalogTenderAwardItem
} from '../types';
import { formatCurrency } from '../utils/formatters';

interface SupplierCatalogsViewProps {
  initialSupplierId?: number | null;
}

export const SupplierCatalogsView: React.FC<SupplierCatalogsViewProps> = ({ initialSupplierId }) => {
  // Proveedores
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(initialSupplierId || null);
  const [loadingSuppliers, setLoadingSuppliers] = useState<boolean>(true);

  // Modo de visualización: 'products' (PVP / PVM) vs 'tenders' (Contratos Estatales)
  const [activeMode, setActiveMode] = useState<'products' | 'tenders'>('products');

  // Estado de Productos del Catálogo
  const [products, setProducts] = useState<SupplierCatalogProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [productRubroFilter, setProductRubroFilter] = useState<string>('TODOS');

  // Estado de Licitaciones / Contratos Estatales
  const [tenderContracts, setTenderContracts] = useState<SupplierCatalogTenderContract[]>([]);
  const [loadingTenders, setLoadingTenders] = useState<boolean>(false);
  const [expandedContractIds, setExpandedContractIds] = useState<Set<string>>(new Set());

  // Modal Crear / Editar Producto
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<SupplierCatalogProductItem | null>(null);
  const [productForm, setProductForm] = useState({
    sku_proveedor: '',
    sku_calcu: '',
    nombre: '',
    rubro: 'Iluminación',
    costo_compra: 0,
    precio_venta_comercios: 0,
    precio_venta_publico: 0,
    stock_estimado: 'En Stock MVD'
  });
  const [savingProduct, setSavingProduct] = useState<boolean>(false);

  // Modal Importación Planilla
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<{ processed: number; created: number; updated: number; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Cargar lista de proveedores
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoadingSuppliers(true);
        const data = await apiService.getSuppliers();
        setSuppliers(data);
        if (data.length > 0 && !selectedSupplierId) {
          if (initialSupplierId && data.some((s) => s.id === initialSupplierId)) {
            setSelectedSupplierId(initialSupplierId);
          } else {
            setSelectedSupplierId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Error al cargar proveedores:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    fetchSuppliers();
  }, [initialSupplierId]);

  // Proveedor seleccionado actual
  const currentSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  // 2. Cargar Catálogo de Productos
  const loadCatalogProducts = async (supplierId: number) => {
    try {
      setLoadingProducts(true);
      const res = await apiService.getSupplierCatalogProducts(supplierId, {
        rubro: productRubroFilter !== 'TODOS' ? productRubroFilter : undefined,
        search: productSearch.trim() || undefined
      });
      setProducts(res.items || []);
    } catch (err) {
      console.error('Error al cargar productos del catálogo:', err);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // 3. Cargar Contratos Estatales
  const loadSupplierTenders = async (supplierId: number) => {
    try {
      setLoadingTenders(true);
      const res = await apiService.getSupplierCatalogTenders(supplierId);
      setTenderContracts(res.contracts || []);
    } catch (err) {
      console.error('Error al cargar contratos estatales del proveedor:', err);
      setTenderContracts([]);
    } finally {
      setLoadingTenders(false);
    }
  };

  // Disparar carga según el modo y proveedor activo
  useEffect(() => {
    if (!selectedSupplierId) return;
    if (activeMode === 'products') {
      loadCatalogProducts(selectedSupplierId);
    } else {
      loadSupplierTenders(selectedSupplierId);
    }
  }, [selectedSupplierId, activeMode, productRubroFilter]);

  // Búsqueda debounce o al pulsar enter
  const handleProductSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSupplierId) {
      loadCatalogProducts(selectedSupplierId);
    }
  };

  // Toggle expansión de contrato
  const toggleExpandContract = (contractId: string) => {
    setExpandedContractIds((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  };

  // Abrir modal de producto
  const openProductModal = (prod?: SupplierCatalogProductItem) => {
    if (prod) {
      setEditingProduct(prod);
      setProductForm({
        sku_proveedor: prod.sku_proveedor,
        sku_calcu: prod.sku_calcu || '',
        nombre: prod.nombre,
        rubro: prod.rubro || 'Iluminación',
        costo_compra: prod.costo_compra,
        precio_venta_comercios: prod.precio_venta_comercios,
        precio_venta_publico: prod.precio_venta_publico,
        stock_estimado: prod.stock_estimado || 'En Stock MVD'
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        sku_proveedor: '',
        sku_calcu: '',
        nombre: '',
        rubro: currentSupplier?.rubro || 'Iluminación',
        costo_compra: 0,
        precio_venta_comercios: 0,
        precio_venta_publico: 0,
        stock_estimado: 'En Stock MVD'
      });
    }
    setIsProductModalOpen(true);
  };

  // Guardar producto
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) return;
    if (!productForm.sku_proveedor.trim() || !productForm.nombre.trim()) {
      alert('El SKU del proveedor y el Nombre del producto son obligatorios.');
      return;
    }

    try {
      setSavingProduct(true);
      if (editingProduct) {
        await apiService.updateSupplierCatalogProduct(selectedSupplierId, editingProduct.id, productForm);
      } else {
        await apiService.saveSupplierCatalogProduct(selectedSupplierId, productForm);
      }
      setIsProductModalOpen(false);
      await loadCatalogProducts(selectedSupplierId);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al guardar el ítem del catálogo.');
    } finally {
      setSavingProduct(false);
    }
  };

  // Eliminar producto
  const handleDeleteProduct = async (itemId: number) => {
    if (!selectedSupplierId) return;
    if (!confirm('¿Confirma eliminar este ítem del catálogo del proveedor?')) return;
    try {
      await apiService.deleteSupplierCatalogProduct(selectedSupplierId, itemId);
      await loadCatalogProducts(selectedSupplierId);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al eliminar el ítem.');
    }
  };

  // Manejo de carga de archivo
  const handleUploadFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !uploadFile) return;

    try {
      setUploading(true);
      setUploadResult(null);
      const res = await apiService.uploadSupplierCatalogSpreadsheet(selectedSupplierId, uploadFile);
      setUploadResult(res);
      await loadCatalogProducts(selectedSupplierId);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al procesar la planilla de precios.');
    } finally {
      setUploading(false);
    }
  };

  // Métricas preview en vivo para el modal de producto
  const modalMetrics = useMemo(() => {
    const cost = Number(productForm.costo_compra) || 0;
    const pvm = Number(productForm.precio_venta_comercios) || 0;
    const pvp = Number(productForm.precio_venta_publico) || 0;

    const tradeDiscount = pvp > 0 && pvp >= pvm ? Math.round((((pvp - pvm) / pvp) * 100) * 100) / 100 : 0;
    const resaleMargin = pvm > 0 ? Math.round((((pvm - cost) / pvm) * 100) * 100) / 100 : 0;
    const markup = cost > 0 ? Math.round((((pvp - cost) / cost) * 100) * 100) / 100 : 0;

    return { tradeDiscount, resaleMargin, markup };
  }, [productForm.costo_compra, productForm.precio_venta_comercios, productForm.precio_venta_publico]);

  // Rubros únicos disponibles en productos
  const availableRubros = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.rubro) set.add(p.rubro);
    });
    return Array.from(set);
  }, [products]);

  // Resumen KPI de productos
  const productsKpi = useMemo(() => {
    if (products.length === 0) {
      return { total: 0, avgMargin: 0, avgDiscount: 0, avgMarkup: 0 };
    }
    const sumMargin = products.reduce((acc, p) => acc + (p.margen_reventa_pct || 0), 0);
    const sumDiscount = products.reduce((acc, p) => acc + (p.descuento_comercios_pct || 0), 0);
    const sumMarkup = products.reduce((acc, p) => acc + (p.markup_costo_pct || 0), 0);

    return {
      total: products.length,
      avgMargin: Math.round((sumMargin / products.length) * 10) / 10,
      avgDiscount: Math.round((sumDiscount / products.length) * 10) / 10,
      avgMarkup: Math.round((sumMarkup / products.length) * 10) / 10
    };
  }, [products]);

  // Resumen KPI de contratos
  const tendersKpi = useMemo(() => {
    const totalCount = tenderContracts.length;
    const totalAmount = tenderContracts.reduce((acc, c) => acc + (c.amount || 0), 0);
    const buyersSet = new Set<string>();
    tenderContracts.forEach((c) => {
      if (c.buyerName) buyersSet.add(c.buyerName);
    });
    return {
      totalCount,
      totalAmount,
      uniqueBuyers: buyersSet.size
    };
  }, [tenderContracts]);

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* 1. Header Principal Modern SaaS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Catálogos Comerciales & Contratos Estatales
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Matriz de precios PVP / PVM de distribuidores y trazabilidad de ítems adjudicados en compras públicas.
              </p>
            </div>
          </div>
        </div>

        {/* Selector Activo de Proveedor */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[280px]">
            <select
              value={selectedSupplierId || ''}
              onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
              disabled={loadingSuppliers || suppliers.length === 0}
              aria-label="Seleccionar Proveedor Estratégico"
              className="w-full pl-3 pr-8 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm cursor-pointer"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} {s.rut ? `(RUT: ${s.rut})` : ''} - {s.rubro || 'General'}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          <button
            onClick={() => selectedSupplierId && (activeMode === 'products' ? loadCatalogProducts(selectedSupplierId) : loadSupplierTenders(selectedSupplierId))}
            title="Refrescar catálogo"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loadingProducts || loadingTenders ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Tarjeta Ficha del Proveedor Seleccionado */}
      {currentSupplier && (
        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={currentSupplier.logo_url || 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=80&auto=format&fit=crop&q=80'}
              alt={currentSupplier.nombre}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=80&auto=format&fit=crop&q=80';
              }}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 bg-white p-1 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{currentSupplier.nombre}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                  {currentSupplier.rubro || 'General'}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {currentSupplier.tipo_proveedor === 'exterior' ? '🌍 Exterior / Fábrica' : '🇺🇾 Plaza Local'}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                {currentSupplier.rut && <span>RUT: <strong className="font-mono">{currentSupplier.rut}</strong></span>}
                <span>Condición: <strong>{currentSupplier.condicion_pago || 'Contado'}</strong></span>
                <span>Ítems en Lista: <strong>{products.length} productos</strong></span>
              </div>
            </div>
          </div>

          {/* Toggle Switcher de Modos */}
          <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl border border-slate-300/60 dark:border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setActiveMode('products')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'products'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>🛒 Catálogo Productos (PVP / PVM)</span>
            </button>

            <button
              onClick={() => setActiveMode('tenders')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'tenders'
                  ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>📜 Licitaciones (Contratos Estatales)</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. MODO: CATÁLOGO DE PRODUCTOS (PVP / PVM) */}
      {activeMode === 'products' && (
        <div className="space-y-5 animate-fadeIn">
          {/* KPI Strip de Productos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total SKUs Activos</span>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{productsKpi.total}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Margen Reventa PVM Prom.</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{productsKpi.avgMargin}%</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Descuento Comercio Prom.</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{productsKpi.avgDiscount}%</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Markup sobre Costo</span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{productsKpi.avgMarkup}%</p>
            </div>
          </div>

          {/* Toolbar de Filtros y Acciones */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 flex-1">
              <form onSubmit={handleProductSearchSubmit} className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por SKU, Nombre o Calcu Match..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </form>

              {availableRubros.length > 0 && (
                <div className="relative">
                  <select
                    value={productRubroFilter}
                    onChange={(e) => setProductRubroFilter(e.target.value)}
                    aria-label="Filtrar por Rubro comercial"
                    className="pl-3 pr-8 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="TODOS">Todos los Rubros</option>
                    {availableRubros.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setUploadResult(null);
                  setUploadFile(null);
                  setIsUploadModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Upload className="w-4 h-4 text-indigo-500" />
                <span>📥 Importar Planilla</span>
              </button>

              <button
                onClick={() => openProductModal()}
                className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Producto</span>
              </button>
            </div>
          </div>

          {/* Tabla de Productos del Catálogo */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            {loadingProducts ? (
              <div className="py-20 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Cargando catálogo comercial...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Package className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <h3 className="font-bold text-slate-700 dark:text-slate-300">No hay productos en el catálogo de este proveedor</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Agregue nuevos productos manualmente o importe una planilla Excel/CSV con los costos, precios mayoristas (PVM) y precios de venta al público (PVP).
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() => openProductModal()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                  >
                    + Agregar Primer Producto
                  </button>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
                  >
                    📥 Cargar Excel / CSV
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase font-bold border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">SKU / Match</th>
                      <th className="py-3.5 px-4">Producto & Rubro</th>
                      <th className="py-3.5 px-4 text-right">Costo Compra</th>
                      <th className="py-3.5 px-4 text-right">PVM (Mayorista)</th>
                      <th className="py-3.5 px-4 text-right">PVP (Público)</th>
                      <th className="py-3.5 px-4 text-right">Margen Reventa</th>
                      <th className="py-3.5 px-4 text-right">Markup Costo</th>
                      <th className="py-3.5 px-4 text-center">Disponibilidad</th>
                      <th className="py-3.5 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-200">
                    {products.map((p) => {
                      const isHighMargin = p.margen_reventa_pct >= 25;
                      const isMediumMargin = p.margen_reventa_pct >= 15 && p.margen_reventa_pct < 25;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">
                              {p.sku_proveedor}
                            </span>
                            {p.sku_calcu ? (
                              <span className="inline-block mt-0.5 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                Calcu: {p.sku_calcu}
                              </span>
                            ) : (
                              <span className="inline-block mt-0.5 text-[10px] font-mono text-slate-400">
                                Sin match Calcu
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block leading-snug">
                              {p.nombre}
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">{p.rubro}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            UYU $ {formatCurrency(p.costo_compra)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            UYU $ {formatCurrency(p.precio_venta_comercios)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            UYU $ {formatCurrency(p.precio_venta_publico)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                                isHighMargin
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : isMediumMargin
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                              }`}
                            >
                              {p.margen_reventa_pct}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                            +{p.markup_costo_pct}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {p.stock_estimado || 'Consultar'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openProductModal(p)}
                                title="Editar producto"
                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                title="Eliminar producto"
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MODO: LICITACIONES (CONTRATOS ESTATALES) */}
      {activeMode === 'tenders' && (
        <div className="space-y-5 animate-fadeIn">
          {/* KPI Strip de Contratos Estatales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contratos Ganados</span>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{tendersKpi.totalCount}</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monto Total Adjudicado</span>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  UYU $ {formatCurrency(tendersKpi.totalAmount)}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Organismos Clientes</span>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{tendersKpi.uniqueBuyers}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Listado de Contratos */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Registro de Adjudicaciones SICE / ARCE
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Licitaciones públicas, abreviadas y compras directas donde este proveedor resultó adjudicatario.
                </p>
              </div>
              {currentSupplier?.rut && (
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                  RUT auditado: {currentSupplier.rut}
                </span>
              )}
            </div>

            {loadingTenders ? (
              <div className="py-20 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  Consultando base de compras estatales (SICE/ARCE)...
                </p>
              </div>
            ) : tenderContracts.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Building2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <h4 className="font-bold text-slate-700 dark:text-slate-300">
                  No se registraron contratos públicos directos
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  El proveedor no registra adjudicaciones públicas recientes bajo su RUT en SICE/ARCE o participa como subcontratista en consorcios.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {tenderContracts.map((c) => {
                  const isExpanded = expandedContractIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden transition-all"
                    >
                      <div
                        onClick={() => toggleExpandContract(c.id)}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                              {c.buyerName}
                            </span>
                            {c.date && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {c.date.slice(0, 10)}
                              </span>
                            )}
                            {c.status && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                {c.status}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1.5 leading-snug">
                            {c.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-4 self-end md:self-center">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Contrato</span>
                            <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100">
                              {c.currency} $ {formatCurrency(c.amount)}
                            </span>
                          </div>

                          <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Desglose Expandible de Ítems Adjudicados */}
                      {isExpanded && (
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Ítems Adjudicados en el Pliego ({c.items?.length || 0})
                          </h5>

                          {(!c.items || c.items.length === 0) ? (
                            <p className="text-xs text-slate-400 italic">No se detalla desglose de renglones para este pliego.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 uppercase font-semibold">
                                  <tr>
                                    <th className="py-2 px-3">Descripción de Renglón</th>
                                    <th className="py-2 px-3 text-center">Cantidad</th>
                                    <th className="py-2 px-3 text-center">Unidad</th>
                                    <th className="py-2 px-3 text-right">Precio Unitario Adjudicado</th>
                                    <th className="py-2 px-3 text-right">Total Renglón</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                  {c.items.map((it: SupplierCatalogTenderAwardItem, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                      <td className="py-2 px-3 font-medium">{it.description}</td>
                                      <td className="py-2 px-3 text-center font-mono font-bold">{it.quantity}</td>
                                      <td className="py-2 px-3 text-center text-slate-400">{it.unitName || 'un'}</td>
                                      <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                        {it.currency} $ {formatCurrency(it.unitPrice)}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                        {it.currency} $ {formatCurrency(it.totalPrice || (it.quantity * it.unitPrice))}
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL ALTA / EDICIÓN DE PRODUCTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {editingProduct ? 'Editar Producto del Catálogo' : 'Nuevo Producto en Catálogo'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    SKU Proveedor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. PHIL-LED-50W"
                    value={productForm.sku_proveedor}
                    onChange={(e) => setProductForm({ ...productForm, sku_proveedor: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    SKU Propio Calcu (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. CAL-LUM-01"
                    value={productForm.sku_calcu}
                    onChange={(e) => setProductForm({ ...productForm, sku_calcu: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nombre del Producto / Descripción *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Luminaria Vial LED 50W IP66 IK08 6500K"
                  value={productForm.nombre}
                  onChange={(e) => setProductForm({ ...productForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Rubro / Vertical
                  </label>
                  <select
                    value={productForm.rubro}
                    onChange={(e) => setProductForm({ ...productForm, rubro: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Iluminación">Iluminación</option>
                    <option value="Mobiliario Corporativo">Mobiliario Corporativo</option>
                    <option value="Obra Civil">Obra Civil</option>
                    <option value="Electromecánica">Electromecánica</option>
                    <option value="Equipamiento Hospitalario">Equipamiento Hospitalario</option>
                    <option value="Ferretería">Ferretería</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Stock Estimado Plaza
                  </label>
                  <select
                    value={productForm.stock_estimado}
                    onChange={(e) => setProductForm({ ...productForm, stock_estimado: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="En Stock MVD">En Stock MVD</option>
                    <option value="24-48 hs">24-48 hs</option>
                    <option value="5-7 días">5-7 días</option>
                    <option value="Agotado">Agotado</option>
                    <option value="Bajo Pedido Fábrica">Bajo Pedido Fábrica</option>
                  </select>
                </div>
              </div>

              {/* Fila Financiera: Costo, PVM, PVP */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Matriz de Precios B2B
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Costo Compra (UYU)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.costo_compra}
                      onChange={(e) => setProductForm({ ...productForm, costo_compra: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block mb-1">
                      PVM Mayorista (UYU)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.precio_venta_comercios}
                      onChange={(e) => setProductForm({ ...productForm, precio_venta_comercios: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      PVP Público (UYU)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.precio_venta_publico}
                      onChange={(e) => setProductForm({ ...productForm, precio_venta_publico: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Previsualización en vivo de fórmulas matemáticas */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Desc. Comercios:</span>
                    <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                      {modalMetrics.tradeDiscount}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Margen PVM:</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                      {modalMetrics.resaleMargin}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Markup PVP:</span>
                    <strong className="font-mono text-amber-600 dark:text-amber-400">
                      +{modalMetrics.markup}%
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-50"
                >
                  {savingProduct ? 'Guardando...' : editingProduct ? 'Actualizar Ítem' : 'Guardar Ítem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL IMPORTACIÓN DE PLANILLA (EXCEL / CSV) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Carga Masiva de Lista de Precios
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadFileSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Suba la planilla de precios del distribuidor (formato <strong>.xlsx</strong> o <strong>.csv</strong>).
                Las columnas reconocidas son: <code>sku</code>, <code>producto</code>, <code>costo</code>, <code>pvm</code> (precio comercio), <code>pvp</code> (precio público), <code>rubro</code> y <code>stock</code>.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl text-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-colors"
              >
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {uploadFile ? uploadFile.name : 'Haga clic para seleccionar o arrastre el archivo'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Archivos Excel (.xlsx, .xls) o CSV</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              {uploadResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{uploadResult.message}</span>
                  </div>
                  <p>
                    Procesados: <strong>{uploadResult.processed}</strong> | Nuevos creados: <strong>{uploadResult.created}</strong> | Actualizados: <strong>{uploadResult.updated}</strong>
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <span>Procesar Planilla</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierCatalogsView;
