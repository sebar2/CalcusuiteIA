import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Radio,
  BarChart3,
  Users,
  Landmark,
  Calendar,
  Calculator,
  Search,
  RefreshCw,
  Sparkles,
  Save,
  Trash2,
  Plus,
  Eye,
  FileText,
  Clock,
  DollarSign,
  Building2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Truck,
  X,
  Loader2,
  Tag,
  ArrowRight,
  Zap,
  Copy,
  Info,
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  UserRole,
  EngineMode,
  BiddingVerticalItem,
  BiddingKeywordItem,
  BiddingAIExpandKeywordsResponse,
  ProcurementCallItem,
  ProcurementCallSummaryData,
  ProcurementBenchmarkItem,
  ProcurementProductItem,
  ProcurementSupplierItem,
  ProcurementBuyerItem,
  ProcurementCalendarItem,
  ProcurementCompetitiveMarkupResponse,
  TenderEvaluateRequest,
  TenderEvaluateResponse,
  TenderItemSecure,
  TenderSummaryItem,
} from '../types';
import { formatCurrency } from '../utils/formatters';

interface TendersViewProps {
  engineMode?: EngineMode;
  currentRole?: UserRole;
}

export const CANONICAL_VERTICALS: BiddingVerticalItem[] = [
  { id: 'ILUMINACION_EFICIENCIA', nombre: 'Iluminación & Eficiencia Energética', icon: '💡', color_badge: 'amber', descripcion: 'Luminarias LED, alumbrado vial, proyectores, drivers DALI', activo: true, keywords_count: 30 },
  { id: 'MOBILIARIO_EQUIPAMIENTO', nombre: 'Mobiliario Corporativo & Equipamiento', icon: '🪑', color_badge: 'indigo', descripcion: 'Sillas operativas, puestos de trabajo, armarios, mostradores', activo: true, keywords_count: 22 },
  { id: 'OBRA_CIVIL_CONSTRUCCION', nombre: 'Obra Civil & Construcción', icon: '🏗️', color_badge: 'orange', descripcion: 'Albañilería, hormigón, yeso, cielorrasos, pintura y sanitaria', activo: true, keywords_count: 18 },
  { id: 'ELECTROMECANICA_SUMINISTROS', nombre: 'Electromecánica & Suministros Eléctricos', icon: '⚡', color_badge: 'yellow', descripcion: 'Tableros, disyuntores, cables subterráneos, generadores', activo: true, keywords_count: 15 },
  { id: 'EQUIPAMIENTO_HOSPITALARIO', nombre: 'Equipamiento Hospitalario & Salud', icon: '🏥', color_badge: 'rose', descripcion: 'Camillas, mobiliario clínico, negatoscopios, autoclaves', activo: true, keywords_count: 12 },
  { id: 'TECNOLOGIA_REDES', nombre: 'Tecnología, Redes & Networking', icon: '🖥️', color_badge: 'cyan', descripcion: 'Racks 42U, patch panels, fibra óptica preconectorizada, switches', activo: true, keywords_count: 14 },
  { id: 'SERVICIOS_LIMPIEZA_MANTENIMIENTO', nombre: 'Servicios de Limpieza & Mantenimiento', icon: '🧹', color_badge: 'emerald', descripcion: 'Servicio integral de limpieza, higiene, áreas verdes', activo: true, keywords_count: 10 },
];

const renderSafeValue = (val: any, fallback: string = 'No especificado'): React.ReactNode => {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return fallback;
    return (
      <ul className="list-disc list-inside space-y-1 text-slate-300">
        {val.map((item, idx) => (
          <li key={idx} className="leading-relaxed">
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof val === 'object') {
    return (
      <div className="space-y-1.5">
        {Object.entries(val).map(([k, v]) => (
          <div key={k} className="flex flex-col sm:flex-row sm:gap-2 text-xs">
            <span className="font-semibold text-slate-400 capitalize">
              {k.replace(/([A-Z])/g, ' $1')}:
            </span>
            <span className="text-slate-200">
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return String(val);
};

export const TendersView: React.FC<TendersViewProps> = ({
  engineMode = 'auto',
  currentRole = 'controller_admin',
}) => {
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'radar' | 'benchmarks' | 'competitors' | 'buyers' | 'calendar' | 'cotizador'>('radar');

  // Notificaciones de usuario
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Tasa BROU
  const [tasaBrou, setTasaBrou] = useState<number>(40.40);

  // Verticales y Ollama
  const [verticals, setVerticals] = useState<BiddingVerticalItem[]>(CANONICAL_VERTICALS);
  const [selectedVertical, setSelectedVertical] = useState<string>('ILUMINACION_EFICIENCIA');
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('qwen2.5:7b');

  // Modal de Palabras Clave y Expansión IA
  const [isKeywordsModalOpen, setIsKeywordsModalOpen] = useState<boolean>(false);
  const [currentKeywords, setCurrentKeywords] = useState<BiddingKeywordItem[]>([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState<boolean>(false);
  const [newKeywordText, setNewKeywordText] = useState<string>('');
  const [newKeywordTipo, setNewKeywordTipo] = useState<'INCLUSION' | 'EXCLUSION'>('INCLUSION');
  const [aiExpandQuery, setAiExpandQuery] = useState<string>('');
  const [isExpandingAI, setIsExpandingAI] = useState<boolean>(false);
  const [aiExpandResult, setAiExpandResult] = useState<BiddingAIExpandKeywordsResponse | null>(null);

  // =========================================================================
  // TAB 1: RADAR DE CONVOCATORIAS EN VIVO
  // =========================================================================
  const [openCalls, setOpenCalls] = useState<ProcurementCallItem[]>([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState<boolean>(false);
  const [callsPage, setCallsPage] = useState<number>(1);
  const [callsTotal, setCallsTotal] = useState<number>(0);
  const [callsSearchQuery, setCallsSearchQuery] = useState<string>('');
  const [callsBuyerFilter, setCallsBuyerFilter] = useState<string>('');
  const [isLoadingMoreCalls, setIsLoadingMoreCalls] = useState<boolean>(false);

  // Modal de Resumen IA de Pliego
  const [selectedSummaryCallId, setSelectedSummaryCallId] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<ProcurementCallSummaryData | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);

  // Modal de Benchmarks de Pliego
  const [selectedBenchmarkCallId, setSelectedBenchmarkCallId] = useState<string | null>(null);
  const [selectedBenchmarkCallTitle, setSelectedBenchmarkCallTitle] = useState<string>('');
  const [selectedBenchmarkBuyer, setSelectedBenchmarkBuyer] = useState<string>('');
  const [benchmarksData, setBenchmarksData] = useState<ProcurementBenchmarkItem[]>([]);
  const [isLoadingBenchmarks, setIsLoadingBenchmarks] = useState<boolean>(false);

  // Drawer Lateral de Dictamen Técnico
  const [technicalOpinionModalOpen, setTechnicalOpinionModalOpen] = useState<boolean>(false);
  const [technicalOpinionCall, setTechnicalOpinionCall] = useState<ProcurementCallItem | null>(null);
  const [technicalOpinionData, setTechnicalOpinionData] = useState<any | null>(null);
  const [isLoadingOpinion, setIsLoadingOpinion] = useState<boolean>(false);

  // =========================================================================
  // TAB 2: INTELIGENCIA DE PRECIOS & BENCHMARKS SICE
  // =========================================================================
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [productsList, setProductsList] = useState<ProcurementProductItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<any | null>(null);
  const [isLoadingProductDetail, setIsLoadingProductDetail] = useState<boolean>(false);

  // Calculadora de Markup Competitivo
  const [calcSku, setCalcSku] = useState<string>('LUM-6060');
  const [calcCosto, setCalcCosto] = useState<number>(14.50);
  const [calcSiceCode, setCalcSiceCode] = useState<string>('');
  const [calcMedianaSice, setCalcMedianaSice] = useState<number>(28.00);
  const [calcMoneda, setCalcMoneda] = useState<'USD' | 'UYU'>('USD');
  const [calcCantidad, setCalcCantidad] = useState<number>(80);
  const [calcDescuentoPct, setCalcDescuentoPct] = useState<number>(6.0);
  const [markupResult, setMarkupResult] = useState<ProcurementCompetitiveMarkupResponse | null>(null);
  const [isCalculatingMarkup, setIsCalculatingMarkup] = useState<boolean>(false);

  // =========================================================================
  // TAB 3: ANÁLISIS DE COMPETIDORES (PROVEEDORES)
  // =========================================================================
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<string>('');
  const [suppliersList, setSuppliersList] = useState<ProcurementSupplierItem[]>([]);
  const [topSuppliersList, setTopSuppliersList] = useState<ProcurementSupplierItem[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState<boolean>(false);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<any | null>(null);
  const [isLoadingSupplierDetail, setIsLoadingSupplierDetail] = useState<boolean>(false);

  // =========================================================================
  // TAB 4: RADIOGRAFÍA DE COMPRADORES & INTENDENCIAS
  // =========================================================================
  const [buyersList, setBuyersList] = useState<ProcurementBuyerItem[]>([]);
  const [buyersSearchQuery, setBuyersSearchQuery] = useState<string>('');
  const [intendenciasData, setIntendenciasData] = useState<any | null>(null);
  const [isLoadingIntendencias, setIsLoadingIntendencias] = useState<boolean>(false);

  // =========================================================================
  // TAB 5: CALENDARIO DE VENCIMIENTOS & CONTROL LOGÍSTICO
  // =========================================================================
  const [calendarItems, setCalendarItems] = useState<ProcurementCalendarItem[]>([]);
  const [calendarMeta, setCalendarMeta] = useState<{ deposito_central: number; transito: number }>({ deposito_central: 0, transito: 0 });
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<boolean>(false);
  const [calendarFilter, setCalendarFilter] = useState<'TODOS' | 'VERDE' | 'AMARILLO' | 'ROJO' | 'GUARDADOS'>('TODOS');
  const [calendarSearch, setCalendarSearch] = useState<string>('');

  // =========================================================================
  // TAB 6: COTIZADOR B2B Y DEBATE DIALÉCTICO
  // =========================================================================
  const [proyectoNombre, setProyectoNombre] = useState<string>('Licitación B2B - Suministro & Eficiencia');
  const [clienteLicitacion, setClienteLicitacion] = useState<string>('Conaprole SA - Planta Industrial');
  const [nicho] = useState<string>('ILUMINACION_EFICIENCIA');
  const [plazoEntregaDias, setPlazoEntregaDias] = useState<number>(30);
  const [moneda] = useState<'USD' | 'UYU'>('USD');
  const [margenPct, setMargenPct] = useState<number>(35);
  const [observaciones] = useState<string>('Requiere certificación UNIT / IEC y entrega en depósito Montevideo.');
  const [items, setItems] = useState<TenderItemSecure[]>([
    { sku: 'LUM-6060', cantidad_solicitada: 80 },
    { sku: 'UFO-150W', cantidad_solicitada: 45 },
  ]);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<TenderEvaluateResponse | null>(null);
  const [savedTenders, setSavedTenders] = useState<TenderSummaryItem[]>([]);
  const [activeDialecticTab, setActiveDialecticTab] = useState<'both' | 'david' | 'aristoteles'>('both');

  // Carga inicial
  useEffect(() => {
    const initData = async () => {
      try {
        const [brouData, savedList, vertsData, modelsData] = await Promise.all([
          apiService.getBROUExchangeRate().catch(() => ({ rate_used: 40.40 })),
          apiService.getProcurementSavedTracking().catch(() => []),
          apiService.getBiddingVerticals().catch(() => null),
          apiService.getOllamaModels().catch(() => null),
        ]);
        setTasaBrou(brouData.rate_used || 40.40);
        setSavedTenders(savedList);
        if (vertsData && vertsData.length > 0) setVerticals(vertsData);
        if (modelsData && Array.isArray(modelsData.models) && modelsData.models.length > 0) {
          if (modelsData.active_model) setSelectedOllamaModel(modelsData.active_model);
        }
      } catch (err) {
        console.warn('Error en inicialización del Hub de Licitaciones:', err);
      }
    };
    initData();
  }, []);

  // Cargar Radar al inicio
  const fetchRadarCalls = useCallback(async (pageToLoad = 1, append = false) => {
    if (append) setIsLoadingMoreCalls(true);
    else setIsLoadingCalls(true);

    try {
      const resp = await apiService.getProcurementOpenCalls({
        page: pageToLoad,
        limit: 20,
        q: callsSearchQuery.trim() || undefined,
        buyer: callsBuyerFilter.trim() || undefined,
        sort: 'closingSoon',
      });

      if (resp.success && resp.data) {
        const newCalls = resp.data.calls || [];
        if (append) {
          setOpenCalls((prev) => [...prev, ...newCalls]);
        } else {
          setOpenCalls(newCalls);
        }
        setCallsTotal(resp.data.pagination?.total || 0);
        setCallsPage(pageToLoad);
      }
    } catch (err) {
      console.error('Error cargando convocatorias de compras estatales:', err);
      setNotification({ type: 'error', message: 'No se pudieron recuperar las licitaciones en vivo.' });
    } finally {
      setIsLoadingCalls(false);
      setIsLoadingMoreCalls(false);
    }
  }, [callsSearchQuery, callsBuyerFilter]);

  useEffect(() => {
    if (activeTab === 'radar' && openCalls.length === 0) {
      fetchRadarCalls(1, false);
    }
  }, [activeTab, fetchRadarCalls, openCalls.length]);

  // Manejo de Cargar Más Licitaciones
  const handleLoadMoreCalls = () => {
    fetchRadarCalls(callsPage + 1, true);
  };

  // Ver Resumen IA de Pliego
  const handleViewCallSummary = async (call: ProcurementCallItem) => {
    const id = String(call.compraId);
    setSelectedSummaryCallId(id);
    setIsLoadingSummary(true);
    setSummaryData(null);
    try {
      const res = await apiService.getProcurementCallSummary(id);
      if (res.success && res.data) {
        setSummaryData(res.data.summary || null);
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'No se pudo obtener el resumen IA del pliego.' });
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Ver Benchmarks de Pliego
  const handleViewCallBenchmarks = async (call: ProcurementCallItem) => {
    const id = String(call.compraId);
    setSelectedBenchmarkCallId(id);
    setSelectedBenchmarkCallTitle(call.title || `Licitación #${id}`);
    setSelectedBenchmarkBuyer(call.buyer?.name || 'Organismo Público');
    setIsLoadingBenchmarks(true);
    setBenchmarksData([]);
    try {
      const res: any = await apiService.getProcurementCallBenchmarks(id);
      
      // Desempaquetado defensivo multinivel
      let items: ProcurementBenchmarkItem[] = [];
      const raw = res?.data || res;
      if (Array.isArray(raw)) {
        items = raw;
      } else if (Array.isArray(raw?.items)) {
        items = raw.items;
      } else if (Array.isArray(raw?.benchmarks)) {
        items = raw.benchmarks;
      } else if (Array.isArray(res?.items)) {
        items = res.items;
      } else if (Array.isArray(res?.benchmarks)) {
        items = res.benchmarks;
      } else if (Array.isArray(res?.data?.data?.items)) {
        items = res.data.data.items;
      } else if (Array.isArray(res?.data?.data?.benchmarks)) {
        items = res.data.data.benchmarks;
      }

      setBenchmarksData(items);
    } catch (err) {
      setNotification({ type: 'error', message: 'No se pudieron obtener los precios de referencia del pliego.' });
    } finally {
      setIsLoadingBenchmarks(false);
    }
  };

  // Solicitar Dictamen Técnico de Ingeniería (Ollama Local)
  const handleRequestTechnicalOpinion = async (call: ProcurementCallItem) => {
    const id = String(call.compraId);
    setTechnicalOpinionCall(call);
    setIsLoadingOpinion(true);
    setTechnicalOpinionModalOpen(true);
    setTechnicalOpinionData(null);
    try {
      // Tomamos el resumen si está precargado para este llamado
      const summaryContext = (selectedSummaryCallId === id && summaryData) ? summaryData : undefined;
      // Tomamos los benchmarks si están precargados para este llamado
      const benchmarksContext = (selectedBenchmarkCallId === id && benchmarksData.length > 0) ? benchmarksData : undefined;

      const res = await apiService.auditExpertTender(id, {
        vertical_id: selectedVertical,
        model: selectedOllamaModel,
        titulo: call.title,
        organismo: call.buyer?.name,
        plazo_entrega_dias: 30,
        summary: summaryContext,
        benchmarks: benchmarksContext,
      });
      setTechnicalOpinionData(res);
      setNotification({
        type: 'success',
        message: `Dictamen emitido por ${res.perito_nombre} (${res.fuente_ia}).`,
      });
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al generar el dictamen técnico con Ollama.' });
    } finally {
      setIsLoadingOpinion(false);
    }
  };

  // Guardar en Seguimiento
  const handleSaveTracking = async (call: ProcurementCallItem) => {
    try {
      const res = await apiService.saveProcurementTracking(call.compraId, {
        compra_id: String(call.compraId),
        proyecto_nombre: call.title,
        cliente_licitacion: call.buyer?.name || 'Organismo Estatal',
        nicho: selectedVertical,
        fecha_apertura: call.tenderPeriod?.endDate ? call.tenderPeriod.endDate.split('T')[0] : undefined,
        plazo_entrega_dias: 30,
        moneda: 'USD',
      });
      setNotification({ type: 'success', message: res.message });
      const updatedList = await apiService.getProcurementSavedTracking();
      setSavedTenders(updatedList);
    } catch (err) {
      setNotification({ type: 'error', message: 'No se pudo guardar la convocatoria en seguimiento.' });
    }
  };

  // Cargar en el Cotizador con 1 Clic
  const handleLoadInCotizador = (call: { compraId: any; title: string; buyer?: { name?: string } }) => {
    setProyectoNombre(call.title);
    setClienteLicitacion(call.buyer?.name || 'Organismo Estatal');
    setActiveTab('cotizador');
    setNotification({
      type: 'success',
      message: `Convocatoria #${call.compraId} cargada en el Cotizador B2B.`,
    });
  };

  // Modal de Palabras Clave
  const handleOpenKeywordsModal = async () => {
    setIsKeywordsModalOpen(true);
    setIsLoadingKeywords(true);
    try {
      const kws = await apiService.getBiddingKeywords(selectedVertical);
      setCurrentKeywords(kws || []);
    } catch (err) {
      console.warn('Error cargando keywords:', err);
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeywordText.trim()) return;
    try {
      await apiService.addBiddingKeywordsBulk(selectedVertical, {
        keywords: [newKeywordText.trim()],
        tipo: newKeywordTipo,
      });
      setNewKeywordText('');
      const updated = await apiService.getBiddingKeywords(selectedVertical);
      setCurrentKeywords(updated || []);
      setNotification({ type: 'success', message: 'Palabra clave agregada exitosamente.' });
    } catch (err) {
      setNotification({ type: 'error', message: 'No se pudo guardar la palabra clave.' });
    }
  };

  const handleDeleteKeyword = async (id: number) => {
    try {
      await apiService.deleteBiddingKeyword(id);
      setCurrentKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.warn('Error eliminando keyword:', err);
    }
  };

  const handleExpandKeywordsAI = async () => {
    setIsExpandingAI(true);
    try {
      const res = await apiService.expandBiddingKeywordsAI({
        vertical_id: selectedVertical,
        rubro_nombre: selectedVertical,
        query: aiExpandQuery.trim() || undefined,
        model: selectedOllamaModel,
      });
      setAiExpandResult(res);
      setNotification({ type: 'success', message: 'Sugerencias de keywords generadas por Ollama.' });
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al expandir palabras clave con IA.' });
    } finally {
      setIsExpandingAI(false);
    }
  };

  // =========================================================================
  // CARGAS PARA TAB 2: BENCHMARKS SICE
  // =========================================================================
  const handleSearchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const res = await apiService.getProcurementProducts({
        q: productSearchQuery.trim() || undefined,
        limit: 20,
      });
      if (res.success && res.data) {
        setProductsList(res.data.products || []);
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al buscar productos en SICE.' });
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleSelectProduct = async (code: string) => {
    setSelectedProductCode(code);
    setIsLoadingProductDetail(true);
    try {
      const res = await apiService.getProcurementProductDetail(code);
      if (res.success && res.data) {
        setSelectedProductDetail(res.data);
        setCalcSiceCode(code);
        const pUnits = res.data.priceUnits || [];
        if (pUnits.length > 0) {
          const med = pUnits[0].p50 || pUnits[0].median || 0;
          if (med > 0) setCalcMedianaSice(Number(med));
        }
      }
    } catch (err) {
      setNotification({ type: 'error', message: `No se pudo obtener detalle para el código SICE ${code}.` });
    } finally {
      setIsLoadingProductDetail(false);
    }
  };

  const handleExecuteMarkupCalculator = async () => {
    setIsCalculatingMarkup(true);
    try {
      const res = await apiService.calculateCompetitiveMarkup({
        sku: calcSku.trim() || undefined,
        costo_nacionalizado: Number(calcCosto),
        product_code: calcSiceCode.trim() || undefined,
        precio_mediana_sice: Number(calcMedianaSice),
        moneda: calcMoneda,
        cantidad_solicitada: Number(calcCantidad),
        tasa_cambio_brou: Number(tasaBrou),
        descuento_estrategico_pct: Number(calcDescuentoPct),
      });
      setMarkupResult(res);
      setNotification({
        type: 'success',
        message: `Markup calculado: Precio ganador sugerido ${calcMoneda} ${res.precio_ganador_sugerido}.`,
      });
    } catch (err) {
      setNotification({ type: 'error', message: 'Error en la calculadora de markup competitivo.' });
    } finally {
      setIsCalculatingMarkup(false);
    }
  };

  // =========================================================================
  // CARGAS PARA TAB 3: PROVEEDORES
  // =========================================================================
  const fetchSuppliersData = useCallback(async () => {
    setIsLoadingSuppliers(true);
    try {
      const [searchRes, topRes] = await Promise.all([
        apiService.getProcurementSuppliers({ search: supplierSearchQuery.trim() || undefined, limit: 15 }),
        apiService.getProcurementTopSuppliers(10),
      ]);
      if (searchRes.success && searchRes.data) {
        setSuppliersList(searchRes.data.suppliers || []);
      }
      if (topRes.success && Array.isArray(topRes.data)) {
        setTopSuppliersList(topRes.data || []);
      }
    } catch (err) {
      console.warn('Error cargando proveedores:', err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, [supplierSearchQuery]);

  useEffect(() => {
    if (activeTab === 'competitors' && suppliersList.length === 0) {
      fetchSuppliersData();
    }
  }, [activeTab, fetchSuppliersData, suppliersList.length]);

  const handleSelectSupplier = async (supplierId: string) => {
    setIsLoadingSupplierDetail(true);
    setSelectedSupplierDetail(null);
    try {
      const res = await apiService.getProcurementSupplierDetail(supplierId);
      if (res.success && res.data) {
        setSelectedSupplierDetail(res.data);
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'No se pudo obtener la ficha completa del proveedor.' });
    } finally {
      setIsLoadingSupplierDetail(false);
    }
  };

  // =========================================================================
  // CARGAS PARA TAB 4: COMPRADORES & INTENDENCIAS
  // =========================================================================
  const fetchBuyersData = useCallback(async () => {
    setIsLoadingIntendencias(true);
    try {
      const [bRes, intRes] = await Promise.all([
        apiService.getProcurementBuyers({ search: buyersSearchQuery.trim() || undefined, limit: 20 }),
        apiService.getProcurementIntendencias(),
      ]);
      if (bRes.success && bRes.data) {
        setBuyersList(bRes.data.buyers || []);
      }
      if (intRes.success && intRes.data) {
        setIntendenciasData(intRes.data);
      }
    } catch (err) {
      console.warn('Error cargando compradores e intendencias:', err);
    } finally {
      setIsLoadingIntendencias(false);
    }
  }, [buyersSearchQuery]);

  useEffect(() => {
    if (activeTab === 'buyers' && buyersList.length === 0) {
      fetchBuyersData();
    }
  }, [activeTab, fetchBuyersData, buyersList.length]);

  // =========================================================================
  // CARGAS PARA TAB 5: CALENDARIO & SEMÁFORO LOGÍSTICO
  // =========================================================================
  const fetchCalendarData = useCallback(async () => {
    setIsLoadingCalendar(true);
    try {
      const res = await apiService.getProcurementCalendar();
      if (res.success && res.data) {
        setCalendarItems(res.data.items || []);
        setCalendarMeta({
          deposito_central: res.data.deposito_central_mvd_unidades || 0,
          transito: res.data.transito_maritimo_unidades || 0,
        });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al consultar el calendario logístico de licitaciones.' });
    } finally {
      setIsLoadingCalendar(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar' && calendarItems.length === 0) {
      fetchCalendarData();
    }
  }, [activeTab, fetchCalendarData, calendarItems.length]);

  // Filtrado de items del calendario
  const filteredCalendarItems = calendarItems.filter((it) => {
    if (calendarFilter === 'GUARDADOS' && !it.saved) return false;
    if (calendarFilter === 'VERDE' && it.semaforo_logistico !== 'VERDE') return false;
    if (calendarFilter === 'AMARILLO' && it.semaforo_logistico !== 'AMARILLO') return false;
    if (calendarFilter === 'ROJO' && it.semaforo_logistico !== 'ROJO') return false;
    if (calendarSearch.trim()) {
      const q = calendarSearch.toLowerCase();
      return (
        it.title.toLowerCase().includes(q) ||
        it.buyer.toLowerCase().includes(q) ||
        it.compraId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // =========================================================================
  // EVALUACIÓN TRADICIONAL DEL COTIZADOR
  // =========================================================================
  const handleEvaluateTender = async () => {
    if (!proyectoNombre.trim() || !clienteLicitacion.trim()) {
      setNotification({ type: 'error', message: 'Nombre de obra y cliente son obligatorios.' });
      return;
    }
    setIsEvaluating(true);
    try {
      const payload: TenderEvaluateRequest = {
        proyecto_nombre: proyectoNombre.trim(),
        cliente_licitacion: clienteLicitacion.trim(),
        nicho,
        plazo_entrega_dias: Number(plazoEntregaDias),
        moneda,
        margen_comercial_pct: Number(margenPct) / 100.0,
        observaciones: observaciones.trim() || undefined,
        engine_mode: engineMode,
        items: items.map((it) => ({
          sku: it.sku.trim().toUpperCase(),
          cantidad_solicitada: Number(it.cantidad_solicitada),
        })),
      };
      const res = await apiService.evaluateTender(payload);
      setEvaluationResult(res);
      setNotification({
        type: 'success',
        message: res.alerta_critica
          ? 'Evaluación completada con Alerta Logística de Quiebre.'
          : 'Evaluación aprobada con viabilidad logística completa.',
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Error al evaluar la viabilidad de la licitación.' });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* HEADER PRINCIPAL: HUB DE LICITACIONES E INTELIGENCIA ESTATAL B2B */}
      {/* =================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                <Landmark className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  Hub de Licitaciones e Inteligencia Estatal B2B
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    API Uruguay Conectada (600 req/min)
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Radar en vivo de convocatorias públicas, benchmarks SICE, análisis de competidores, radiografía de intendencias y semáforo logístico Montevideo.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Ollama: <strong>{selectedOllamaModel}</strong></span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Dólar BROU: <strong>${tasaBrou.toFixed(2)}</strong></span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-400">
              Rol: <strong className="text-white capitalize">{currentRole.replace('_', ' ')}</strong>
            </div>
          </div>
        </div>

        {/* Notificación Global */}
        {notification && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* NAVEGACIÓN POR PESTAÑAS (TABS) */}
        {/* =================================================================== */}
        <div className="flex flex-wrap items-center gap-2 mt-6 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveTab('radar')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'radar'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Tab 1: 📡 Radar en Vivo</span>
          </button>

          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'benchmarks'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Tab 2: 📊 Inteligencia de Precios SICE</span>
          </button>

          <button
            onClick={() => setActiveTab('competitors')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'competitors'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tab 3: 🕵️ Competidores (Proveedores)</span>
          </button>

          <button
            onClick={() => setActiveTab('buyers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'buyers'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Tab 4: 🏛️ Compradores & Intendencias</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'calendar'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Tab 5: 📅 Vencimientos & Control Logístico</span>
          </button>

          <button
            onClick={() => setActiveTab('cotizador')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ml-auto ${
              activeTab === 'cotizador'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-slate-800/60 text-amber-400 hover:text-amber-300 hover:bg-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>💼 Cotizador & Dictamen B2B</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* CONTENIDO DE TAB 1: RADAR DE CONVOCATORIAS EN VIVO */}
      {/* =================================================================== */}
      {activeTab === 'radar' && (
        <div className="space-y-6">
          {/* Barra de Filtros y Búsqueda del Radar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              {/* Selector de Vertical */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Vertical / Nicho
                  </label>
                  <button
                    onClick={handleOpenKeywordsModal}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                    title="Configurar palabras clave con IA de Ollama"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Keywords IA</span>
                  </button>
                </div>
                <select
                  value={selectedVertical}
                  onChange={(e) => setSelectedVertical(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {verticals.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.icon} {v.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Búsqueda por palabra clave */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Palabra Clave / Objeto
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={callsSearchQuery}
                    onChange={(e) => setCallsSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchRadarCalls(1, false)}
                    placeholder="Ej. luminaria, cable, silla, yeso..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Filtro por Organismo */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Organismo Comprador
                </label>
                <input
                  type="text"
                  value={callsBuyerFilter}
                  onChange={(e) => setCallsBuyerFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchRadarCalls(1, false)}
                  placeholder="Ej. UTE, OSE, Intendencia..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
              </div>

              {/* Botón Buscar */}
              <div className="flex items-end gap-2 pt-2 md:pt-6">
                <button
                  onClick={() => fetchRadarCalls(1, false)}
                  disabled={isLoadingCalls}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  {isLoadingCalls ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Explorar Radar</span>
                </button>
                <button
                  onClick={() => {
                    setCallsSearchQuery('');
                    setCallsBuyerFilter('');
                    fetchRadarCalls(1, false);
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300"
                  title="Restablecer filtros"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Listado de Tarjetas de Convocatorias */}
          {isLoadingCalls ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
              <p className="text-sm">Consultando convocatorias públicas en vivo...</p>
            </div>
          ) : openCalls.length === 0 ? (
            <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-white">No se hallaron convocatorias abiertas</h3>
              <p className="text-xs text-slate-400 mt-1">Pruebe ampliando el criterio de búsqueda o seleccionando otro rubro.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Mostrando <strong>{openCalls.length}</strong> de <strong>{callsTotal}</strong> convocatorias vigentes</span>
                <span>Fuente: Portal Oficial de Compras Estatales (ARCE / SICE)</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {openCalls.map((call) => {
                  const compraId = String(call.compraId);
                  const isSaved = savedTenders.some((s) => s.id === compraId);
                  const endDateStr = call.tenderPeriod?.endDate ? call.tenderPeriod.endDate.split('T')[0] : 'Sin fecha';

                  return (
                    <div
                      key={compraId}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
                    >
                      <div>
                        {/* Cabecera de la tarjeta */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                            ID: {compraId}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {call.status || 'VIGENTE'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white line-clamp-2 mb-2 hover:text-indigo-400 transition-colors">
                          {call.title}
                        </h3>

                        <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate">{call.buyer?.name || 'Organismo Estatal'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span>Cierre de ofertas: <strong>{endDateStr}</strong></span>
                          </div>
                          {call.procurementMethodDetails && (
                            <div className="flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span className="text-slate-300">{call.procurementMethodDetails}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="border-t border-slate-800/80 pt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleViewCallSummary(call)}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Ver Resumen IA</span>
                        </button>

                        <button
                          onClick={() => handleViewCallBenchmarks(call)}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Benchmarks</span>
                        </button>

                        <button
                          onClick={() => handleRequestTechnicalOpinion(call)}
                          className="flex-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl px-2.5 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Dictamen Técnico</span>
                        </button>

                        <button
                          onClick={() => handleSaveTracking(call)}
                          className={`p-1.5 rounded-xl border transition-all ${
                            isSaved
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                          }`}
                          title={isSaved ? 'En seguimiento' : 'Guardar en seguimiento'}
                        >
                          <Save className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleLoadInCotizador(call)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl"
                          title="Cargar en cotizador B2B"
                        >
                          <ArrowRight className="w-4 h-4 text-amber-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botón Paginación Acumulativa */}
              {openCalls.length < callsTotal && (
                <div className="pt-4 flex justify-center">
                  <button
                    onClick={handleLoadMoreCalls}
                    disabled={isLoadingMoreCalls}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg transition-all"
                  >
                    {isLoadingMoreCalls ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <Plus className="w-4 h-4" />}
                    <span>➕ Cargar 20 licitaciones más</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* CONTENIDO DE TAB 2: BENCHMARKS SICE & CALCULADORA DE MARKUP */}
      {/* =================================================================== */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-6">
          {/* Calculadora de Markup Competitivo */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                <Calculator className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Calculadora de Markup Competitivo</h2>
                <p className="text-xs text-slate-400">
                  Cruce de Costo Nacionalizado en Montevideo contra la Mediana Histórica de SICE (medianValue).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">SKU Calcu</label>
                <input
                  type="text"
                  value={calcSku}
                  onChange={(e) => setCalcSku(e.target.value)}
                  placeholder="LUM-6060"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Costo Montevideo ({calcMoneda})</label>
                <input
                  type="number"
                  step="0.01"
                  value={calcCosto}
                  onChange={(e) => setCalcCosto(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Cód. SICE / CUBS</label>
                <input
                  type="text"
                  value={calcSiceCode}
                  onChange={(e) => setCalcSiceCode(e.target.value)}
                  placeholder="Ej. 7843"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Mediana Estatal ({calcMoneda})</label>
                <input
                  type="number"
                  step="0.01"
                  value={calcMedianaSice}
                  onChange={(e) => setCalcMedianaSice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Moneda & Cantidad</label>
                <div className="flex gap-1.5">
                  <select
                    value={calcMoneda}
                    onChange={(e) => setCalcMoneda(e.target.value as 'USD' | 'UYU')}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="UYU">UYU</option>
                  </select>
                  <input
                    type="number"
                    value={calcCantidad}
                    onChange={(e) => setCalcCantidad(parseInt(e.target.value) || 1)}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Estrategia Descuento %</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={calcDescuentoPct}
                    onChange={(e) => setCalcDescuentoPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                  <button
                    onClick={handleExecuteMarkupCalculator}
                    disabled={isCalculatingMarkup}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 rounded-xl text-sm flex items-center justify-center shadow-lg shadow-amber-600/20"
                    title="Calcular precio óptimo y markup"
                  >
                    {isCalculatingMarkup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado de la Calculadora de Markup */}
            {markupResult && (
              <div className="mt-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <span className="text-xs text-slate-400 block">Precio Ganador Sugerido</span>
                    <span className="text-xl font-bold text-emerald-400">
                      {markupResult.moneda} {markupResult.precio_ganador_sugerido}
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Rango: {markupResult.moneda} {markupResult.rango_competitivo_min} - {markupResult.rango_competitivo_max}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block">Markup sobre Costo</span>
                    <span className="text-xl font-bold text-indigo-400">+{markupResult.markup_pct}%</span>
                    <span className="text-xs text-slate-500 block mt-0.5">Margen Bruto: {markupResult.margen_bruto_pct}%</span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block">Contribución Total ({markupResult.moneda})</span>
                    <span className="text-xl font-bold text-amber-400">
                      ${formatCurrency(Number(markupResult.contribucion_total))}
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Unitario: ${markupResult.contribucion_unitaria}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block">Probabilidad de Adjudicación</span>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold mt-1 ${
                        markupResult.probabilidad_ganar === 'ALTA'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : markupResult.probabilidad_ganar === 'MEDIA'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {markupResult.probabilidad_ganar}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                  💡 <strong>Diagnóstico de Pricing:</strong> {markupResult.diagnostico_estrategico}
                </p>
              </div>
            )}
          </div>

          {/* Buscador de Códigos SICE/CUBS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-3">Catálogo y Precios Históricos SICE</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchProducts()}
                placeholder="Buscar por código SICE o término (ej. panel, columna, silla, yeso)..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500"
              />
              <button
                onClick={handleSearchProducts}
                disabled={isLoadingProducts}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                {isLoadingProducts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Buscar</span>
              </button>
            </div>

            {/* Ficha de Detalle de Producto Seleccionado */}
            {selectedProductDetail && (
              <div className="mb-6 p-4 bg-slate-950/70 border border-indigo-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {selectedProductDetail.code} - {selectedProductDetail.description}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {selectedProductDetail.famiName} &gt; {selectedProductDetail.clasName}
                    </p>
                  </div>
                  <button onClick={() => setSelectedProductDetail(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Total Comprado (UYU)</span>
                    <strong className="text-emerald-400 text-sm">
                      ${formatCurrency(selectedProductDetail.totalUYU || 0)}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Líneas Adjudicadas</span>
                    <strong className="text-white text-sm">{selectedProductDetail.lineCount || 0}</strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Organismos Compradores</span>
                    <strong className="text-white text-sm">{selectedProductDetail.buyerCount || 0}</strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Proveedores Adjudicatarios</span>
                    <strong className="text-white text-sm">{selectedProductDetail.supplierCount || 0}</strong>
                  </div>
                </div>

                {/* Baselines de Precios de SICE */}
                {selectedProductDetail.priceUnits && selectedProductDetail.priceUnits.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider">
                      Dispersión de Precios Históricos (Percentiles)
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {selectedProductDetail.priceUnits.map((pu: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                          <span className="font-bold text-indigo-400 block uppercase">
                            {pu.currency} / {pu.unitName || 'UNIDAD'}
                          </span>
                          <div className="flex justify-between mt-1 text-[11px]">
                            <span>Mediana (p50): <strong className="text-emerald-400">${pu.p50 || pu.median}</strong></span>
                            <span>p25: ${pu.p25}</span>
                            <span>p75: ${pu.p75}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabla de Productos SICE */}
            {productsList.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3">Código</th>
                      <th className="p-3">Descripción</th>
                      <th className="p-3">Familia / Rubro</th>
                      <th className="p-3">Total Comprado (UYU)</th>
                      <th className="p-3">Contratos</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {productsList.map((p) => (
                      <tr key={p.code} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-400">{p.code}</td>
                        <td className="p-3 font-medium text-white">{p.description}</td>
                        <td className="p-3 text-slate-400">{p.famiName || p.rubroPath || '-'}</td>
                        <td className="p-3 font-semibold text-emerald-400">
                          {p.totalUYU ? `$${formatCurrency(p.totalUYU)}` : '-'}
                        </td>
                        <td className="p-3">{p.contractCount || 0}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleSelectProduct(p.code)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                              selectedProductCode === p.code
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            }`}
                          >
                            {isLoadingProductDetail && selectedProductCode === p.code ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                            ) : (
                              'Ver Baselines'
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONTENIDO DE TAB 3: COMPETIDORES (PROVEEDORES) */}
      {/* =================================================================== */}
      {activeTab === 'competitors' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Buscador y Ranking de Proveedores */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Directorio de Empresas Adjudicatarias
                </h3>
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchSuppliersData()}
                  placeholder="Buscar por nombre o RUT (ej. UTE, ABB, Conaprole)..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500"
                />
                <button
                  onClick={fetchSuppliersData}
                  disabled={isLoadingSuppliers}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
                >
                  {isLoadingSuppliers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Buscar</span>
                </button>
              </div>

              {/* Lista de Proveedores */}
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {suppliersList.map((s) => {
                  const sId = s.supplierId || s.id || '';
                  return (
                    <div
                      key={sId}
                      onClick={() => handleSelectSupplier(sId)}
                      className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 rounded-xl cursor-pointer flex items-center justify-between transition-all"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white">{s.name}</h4>
                        <span className="text-xs text-slate-400 font-mono">ID: {sId}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-emerald-400 block">
                          ${formatCurrency(s.totalValue || s.totalAmount || 0)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {s.totalContracts || s.transactionCount || 0} contratos
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ficha del Competidor Seleccionado & Ranking Top */}
            <div className="space-y-6">
              {/* Ficha */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Ficha del Competidor
                </h3>

                {isLoadingSupplierDetail ? (
                  <div className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    <p className="text-xs">Cargando contratos y antecedentes RUPE...</p>
                  </div>
                ) : selectedSupplierDetail ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                      <h4 className="text-sm font-bold text-white">{selectedSupplierDetail.supplier?.name}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        RUT: {selectedSupplierDetail.rupe?.rut || selectedSupplierDetail.supplier?.supplierId || '-'}
                      </p>
                      <p className="text-xs text-emerald-400 font-semibold mt-1">
                        Total Contratos: {selectedSupplierDetail.supplier?.totalContracts || 0}
                      </p>
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Contratos Recientes Adjudicados
                      </h5>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {(selectedSupplierDetail.recentContracts || []).map((c: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs">
                            <p className="font-semibold text-slate-200 line-clamp-1">{c.title || 'Contrato Estatal'}</p>
                            <div className="flex justify-between text-slate-400 mt-1 text-[11px]">
                              <span>{c.buyerName || 'Organismo'}</span>
                              <span className="text-emerald-400 font-bold">
                                {c.currency || 'UYU'} ${formatCurrency(c.amount || 0)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    Seleccione una empresa de la lista para auditar sus contratos adjudicados y antecedentes.
                  </div>
                )}
              </div>

              {/* Ranking Top Proveedores */}
              {topSuppliersList.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Top Proveedores del Estado
                  </h4>
                  <div className="space-y-2 text-xs">
                    {topSuppliersList.slice(0, 5).map((ts, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                        <span className="text-white truncate max-w-[180px] font-medium">{ts.name}</span>
                        <span className="text-emerald-400 font-bold">
                          ${formatCurrency(ts.totalAmount || ts.totalValue || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONTENIDO DE TAB 4: RADIOGRAFÍA DE COMPRADORES & INTENDENCIAS */}
      {/* =================================================================== */}
      {activeTab === 'buyers' && (
        <div className="space-y-6">
          {/* Métricas y Comunas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-400" />
              Radiografía de las 19 Intendencias Departamentales
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Distribución de compra por comuna y modalidades de adjudicación (Compra Directa vs Licitación Abreviada vs Licitación Pública).
            </p>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={buyersSearchQuery}
                onChange={(e) => setBuyersSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchBuyersData()}
                placeholder="Buscar organismo comprador o intendencia (ej. UTE, OSE, Intendencia de Canelones)..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500"
              />
              <button
                onClick={fetchBuyersData}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>Buscar</span>
              </button>
            </div>

            {isLoadingIntendencias ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                <p className="text-xs">Cargando estadísticas departamentales...</p>
              </div>
            ) : intendenciasData?.departments ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {intendenciasData.departments.map((dept: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-white">{dept.name}</h4>
                      <span className="text-xs font-semibold text-emerald-400">
                        ${formatCurrency(dept.totalSpendingUYU || dept.totalSpend || 0)} UYU
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Contratos:</span>
                        <strong className="text-white">{dept.totalContracts || 0}</strong>
                      </div>
                      {dept.methodsBreakdown && (
                        <div className="mt-2 pt-2 border-t border-slate-700/60">
                          <span className="text-[11px] text-slate-400 block mb-1">Modalidades de Compra:</span>
                          <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${dept.methodsBreakdown.publica || 30}%` }}
                              className="bg-indigo-500 h-full"
                              title="Licitación Pública"
                            />
                            <div
                              style={{ width: `${dept.methodsBreakdown.abreviada || 40}%` }}
                              className="bg-amber-500 h-full"
                              title="Licitación Abreviada"
                            />
                            <div
                              style={{ width: `${dept.methodsBreakdown.directa || 30}%` }}
                              className="bg-emerald-500 h-full"
                              title="Compra Directa"
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>Pública</span>
                            <span>Abreviada</span>
                            <span>Directa</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sin datos departamentales disponibles.</p>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONTENIDO DE TAB 5: CALENDARIO DE VENCIMIENTOS & CONTROL LOGÍSTICO */}
      {/* =================================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Cabecera del Semáforo Logístico */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  Semáforo Logístico de Entregas (Depósitos Uruguay)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cruce automático de plazos de pliego con existencias físicas en Montevideo y tránsito marítimo.
                </p>
              </div>

              {/* Métricas de Stock */}
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs">
                  <span className="text-slate-400 block">Depósito Central MVD:</span>
                  <strong className="text-emerald-400 text-sm">{calendarMeta.deposito_central} u.</strong>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs">
                  <span className="text-slate-400 block">Tránsito Marítimo:</span>
                  <strong className="text-amber-400 text-sm">{calendarMeta.transito} u.</strong>
                </div>
              </div>
            </div>

            {/* Filtros del Semáforo */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setCalendarFilter('TODOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  calendarFilter === 'TODOS' ? 'bg-slate-700 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Todos ({calendarItems.length})
              </button>
              <button
                onClick={() => setCalendarFilter('VERDE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  calendarFilter === 'VERDE' ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-emerald-400'
                }`}
              >
                🟢 Entrega Inmediata MVD
              </button>
              <button
                onClick={() => setCalendarFilter('AMARILLO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  calendarFilter === 'AMARILLO' ? 'bg-amber-600 text-white' : 'bg-slate-800/60 text-amber-400'
                }`}
              >
                🟡 En Tránsito Marítimo
              </button>
              <button
                onClick={() => setCalendarFilter('ROJO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  calendarFilter === 'ROJO' ? 'bg-rose-600 text-white' : 'bg-slate-800/60 text-rose-400'
                }`}
              >
                🔴 Fabricación Requerida
              </button>
              <button
                onClick={() => setCalendarFilter('GUARDADOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  calendarFilter === 'GUARDADOS' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-indigo-400'
                }`}
              >
                ⭐ Solo Guardados
              </button>

              <div className="relative ml-auto min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                <input
                  type="text"
                  value={calendarSearch}
                  onChange={(e) => setCalendarSearch(e.target.value)}
                  placeholder="Filtrar por objeto o comprador..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Listado de Vencimientos */}
          <div className="space-y-3">
            {isLoadingCalendar ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                <p className="text-xs">Consultando calendario y semáforo logístico...</p>
              </div>
            ) : (
              filteredCalendarItems.map((item) => (
                <div
                  key={item.compraId}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          item.semaforo_logistico === 'VERDE'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.semaforo_logistico === 'AMARILLO'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {item.semaforo_logistico === 'VERDE'
                          ? '🟢 Stock Disponible MVD'
                          : item.semaforo_logistico === 'AMARILLO'
                          ? '🟡 En Tránsito Marítimo'
                          : '🔴 Requiere Fabricación'}
                      </span>
                      <span className="text-xs font-mono text-slate-400">ID: {item.compraId}</span>
                      {item.saved && (
                        <span className="text-[11px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                          En Seguimiento
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white line-clamp-1">{item.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{item.buyer}</span>
                      <span>•</span>
                      <span>Vence: <strong>{item.endDate ? item.endDate.split('T')[0] : 'Inmediato'}</strong> ({item.dias_restantes} días)</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{item.diagnostico_logistico}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleLoadInCotizador({ compraId: item.compraId, title: item.title, buyer: { name: item.buyer } })}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                    >
                      <span>Cotizar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CONTENIDO DE TAB 6: COTIZADOR & DICTAMEN B2B (DAVID VS ARISTÓTELES) */}
      {/* =================================================================== */}
      {activeTab === 'cotizador' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              Cotizador & Análisis Dialéctico de Factibilidad
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre de Obra / Proyecto</label>
                <input
                  type="text"
                  value={proyectoNombre}
                  onChange={(e) => setProyectoNombre(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Cliente / Organismo</label>
                <input
                  type="text"
                  value={clienteLicitacion}
                  onChange={(e) => setClienteLicitacion(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Plazo de Entrega (Días)</label>
                <input
                  type="number"
                  value={plazoEntregaDias}
                  onChange={(e) => setPlazoEntregaDias(parseInt(e.target.value) || 30)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Margen Objetivo %</label>
                <input
                  type="number"
                  value={margenPct}
                  onChange={(e) => setMargenPct(parseFloat(e.target.value) || 35)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            {/* Partidas */}
            <div className="space-y-2 mb-4">
              <label className="block text-xs font-semibold text-slate-400">Partidas a Cotizar</label>
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={it.sku}
                    onChange={(e) => {
                      const copy = [...items];
                      copy[idx].sku = e.target.value;
                      setItems(copy);
                    }}
                    placeholder="SKU"
                    className="w-1/3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white"
                  />
                  <input
                    type="number"
                    value={it.cantidad_solicitada}
                    onChange={(e) => {
                      const copy = [...items];
                      copy[idx].cantidad_solicitada = parseInt(e.target.value) || 1;
                      setItems(copy);
                    }}
                    className="w-1/4 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white"
                  />
                  <button
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setItems([...items, { sku: 'LUM-6060', cantidad_solicitada: 50 }])}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Partida
              </button>
            </div>

            <button
              onClick={handleEvaluateTender}
              disabled={isEvaluating}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Evaluar Factibilidad & Debate Dialéctico</span>
            </button>

            {/* Resultado de Evaluación Dialéctica */}
            {evaluationResult && (
              <div className="mt-6 border-t border-slate-800 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setActiveDialecticTab('both')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activeDialecticTab === 'both' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Debate Completo
                  </button>
                  <button
                    onClick={() => setActiveDialecticTab('david')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activeDialecticTab === 'david' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Ing. David (Técnico)
                  </button>
                  <button
                    onClick={() => setActiveDialecticTab('aristoteles')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activeDialecticTab === 'aristoteles' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Aristóteles (Comercial)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(activeDialecticTab === 'both' || activeDialecticTab === 'david') && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs prose prose-invert max-w-none">
                      <ReactMarkdown>
                        {typeof evaluationResult.dictamen_david === 'string'
                          ? evaluationResult.dictamen_david
                          : evaluationResult.dictamen_david?.dictamen_completo || ''}
                      </ReactMarkdown>
                    </div>
                  )}
                  {(activeDialecticTab === 'both' || activeDialecticTab === 'aristoteles') && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs prose prose-invert max-w-none">
                      <ReactMarkdown>
                        {typeof evaluationResult.dictamen_aristoteles === 'string'
                          ? evaluationResult.dictamen_aristoteles
                          : evaluationResult.dictamen_aristoteles?.estrategia_completa || evaluationResult.dictamen_aristoteles?.propuesta_formal || ''}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: RESUMEN IA DE PLIEGO */}
      {/* =================================================================== */}
      {selectedSummaryCallId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Resumen IA de Pliego Oficial (#{selectedSummaryCallId})
              </h3>
              <div className="flex items-center gap-2">
                {summaryData?.model && (
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                    {summaryData.model}
                  </span>
                )}
                <button onClick={() => setSelectedSummaryCallId(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {isLoadingSummary ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  <p>Extrayendo resumen analítico del pliego con IA...</p>
                </div>
              ) : summaryData ? (
                <div className="space-y-4">
                  {/* Objeto */}
                  <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl">
                    <span className="text-indigo-400 font-semibold block mb-1 uppercase tracking-wider text-[10px]">
                      Objeto de la Contratación
                    </span>
                    <p className="text-slate-200 leading-relaxed font-medium text-xs">
                      {renderSafeValue(summaryData.objeto, 'No especificado')}
                    </p>
                  </div>

                  {/* Plazos y Cronograma */}
                  <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl">
                    <span className="text-amber-400 font-semibold block mb-2 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Plazos y Cronograma Oficial
                    </span>
                    {summaryData.plazos && typeof summaryData.plazos === 'object' && !Array.isArray(summaryData.plazos) ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {summaryData.plazos.recepcionOfertas && (
                          <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Recepción de Ofertas</span>
                            <span className="text-xs text-white font-mono">{summaryData.plazos.recepcionOfertas}</span>
                          </div>
                        )}
                        {summaryData.plazos.aperturaOfertas && (
                          <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Apertura de Ofertas</span>
                            <span className="text-xs text-white font-mono">{summaryData.plazos.aperturaOfertas}</span>
                          </div>
                        )}
                        {summaryData.plazos.consultas && (
                          <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-semibold">Período de Consultas</span>
                            <span className="text-xs text-white font-mono">{summaryData.plazos.consultas}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-200">{renderSafeValue(summaryData.plazos, 'Según pliego')}</div>
                    )}
                    {summaryData.plazoEjecucion && (
                      <div className="mt-2 text-[11px] text-slate-300">
                        <strong className="text-slate-400">Plazo de ejecución:</strong> {summaryData.plazoEjecucion}
                      </div>
                    )}
                  </div>

                  {/* Condiciones Comerciales y Garantías */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl">
                      <span className="text-emerald-400 font-semibold block mb-1 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" /> Cotización & Presupuesto
                      </span>
                      <div className="text-slate-300 space-y-1">
                        {summaryData.formaCotizacion && (
                          <p><strong className="text-slate-400">Forma:</strong> {summaryData.formaCotizacion}</p>
                        )}
                        {summaryData.montoReferencia && (
                          <p><strong className="text-slate-400">Monto ref:</strong> {summaryData.montoReferencia}</p>
                        )}
                        {!summaryData.formaCotizacion && !summaryData.montoReferencia && (
                          <p className="text-slate-400">Conforme a términos del pliego.</p>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl">
                      <span className="text-blue-400 font-semibold block mb-1 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> Garantías Exigidas
                      </span>
                      <div className="text-slate-300">
                        {renderSafeValue(summaryData.garantias, 'No requeridas según pliego')}
                      </div>
                    </div>
                  </div>

                  {/* Requisitos Clave */}
                  {summaryData.requisitosClave && (
                    <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl">
                      <span className="text-indigo-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
                        Requisitos Clave & Normativa
                      </span>
                      {renderSafeValue(summaryData.requisitosClave)}
                    </div>
                  )}

                  {/* Criterios de Evaluación */}
                  {summaryData.criteriosEvaluacion && (
                    <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl">
                      <span className="text-emerald-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
                        Criterios de Evaluación & Adjudicación
                      </span>
                      {renderSafeValue(summaryData.criteriosEvaluacion)}
                    </div>
                  )}

                  {/* Documentación Requerida */}
                  {summaryData.documentacionRequerida && (
                    <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl">
                      <span className="text-amber-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
                        Documentación a Presentar
                      </span>
                      {renderSafeValue(summaryData.documentacionRequerida)}
                    </div>
                  )}

                  {/* Observaciones */}
                  {summaryData.observaciones && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <span className="text-amber-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Observaciones & Puntos Críticos
                      </span>
                      {renderSafeValue(summaryData.observaciones)}
                    </div>
                  )}

                  {/* Documentos de Pliego Original */}
                  {summaryData.sourceDocs && summaryData.sourceDocs.length > 0 && (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <span className="text-slate-400 font-semibold block mb-2 uppercase tracking-wider text-[10px]">
                        Pliegos Originales Adjuntos (Compras Estatales)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {summaryData.sourceDocs.map((url, uidx) => {
                          const fileName = url.split('/').pop() || `Pliego ${uidx + 1}`;
                          return (
                            <a
                              key={uidx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-lg border border-slate-700 text-xs transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{fileName}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  {summaryData.disclaimer && (
                    <p className="text-[10px] text-slate-500 italic text-center pt-2">
                      ℹ️ {summaryData.disclaimer}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">Resumen en procesamiento o no disponible para este pliego.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: BENCHMARKS DE PRECIOS & HISTORIAL ESTATAL SICE */}
      {/* =================================================================== */}
      {selectedBenchmarkCallId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  Precios de Referencia SICE & Benchmarks Estatales (#{selectedBenchmarkCallId})
                </h3>
                {selectedBenchmarkCallTitle && (
                  <p className="text-xs text-slate-400 truncate max-w-xl mt-0.5">
                    {selectedBenchmarkCallTitle} • <span className="text-slate-300 font-medium">{selectedBenchmarkBuyer}</span>
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedBenchmarkCallId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Advertencia Metodológica SICE */}
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-indigo-200/90 leading-relaxed text-[11px]">
                  <strong>Metodología de Precios del Estado:</strong> Los baselines reflejan la <strong>mediana histórica (p50)</strong> y el rango intercuartil (p25 a p75) de adquisiciones estatales en compras públicas (SICE/ARCE). El uso de la mediana mitiga distorsiones por cantidades anómalas registradas en pliegos.
                </p>
              </div>

              {isLoadingBenchmarks ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  <p>Consultando baselines y percentiles en compras públicas...</p>
                </div>
              ) : benchmarksData.length > 0 ? (
                <div className="space-y-4">
                  {benchmarksData.map((bm, idx) => {
                    const siceCode = bm.siceCode || bm.classificationId;
                    const itemName = bm.description || bm.label || `Ítem #${idx + 1}`;
                    const hasBaselines = bm.priceBaselines && bm.priceBaselines.length > 0;
                    const contractCount = bm.contractCount || bm.sampleCount || bm.product?.contractCount || 0;
                    const topSuppliers = bm.topSuppliers || bm.product?.topSuppliers || [];
                    const topBuyers = bm.topBuyers || bm.product?.topBuyers || [];

                    return (
                      <div key={idx} className="p-4 bg-slate-800/70 border border-slate-700/70 rounded-xl space-y-3">
                        {/* Header de Ítem */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 pb-2.5">
                          <div className="flex items-center gap-2">
                            {siceCode ? (
                              <span className="font-mono text-[10px] bg-slate-900 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md font-semibold">
                                SICE: {siceCode}
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md font-mono">
                                S/C
                              </span>
                            )}
                            <h4 className="font-bold text-white text-sm">{itemName}</h4>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {contractCount} adjudicaciones históricas analizadas
                          </span>
                        </div>

                        {/* Baselines de Precios o Badge de Sin Antecedentes */}
                        {!hasBaselines ? (
                          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-slate-300 text-[11px]">
                              Sin antecedentes directos de precios en SICE para este código. Se sugiere cotización basada en costo más margen objetivo.
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {bm.priceBaselines!.map((pb, pidx) => (
                              <div key={pidx} className="p-3 bg-slate-900/90 border border-slate-700/60 rounded-xl">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-bold text-indigo-300 uppercase font-mono tracking-wider">
                                    {pb.currency} / {pb.unitName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    N={pb.n} contratos
                                  </span>
                                </div>
                                <div className="mb-2">
                                  <span className="text-[10px] text-slate-400 block">Mediana Estatal (p50):</span>
                                  <span className="text-lg font-black text-emerald-400 block font-mono">
                                    ${Number(pb.p50 || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 flex justify-between border-t border-slate-800 pt-1.5 font-mono">
                                  <span>p25: ${Number(pb.p25 || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span>p75: ${Number(pb.p75 || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span>p95: ${Number(pb.p95 || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Historial de Proveedores Ganadores */}
                        {topSuppliers.length > 0 && (
                          <div className="pt-2 border-t border-slate-700/40">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-indigo-400" /> Principales Proveedores Adjudicados Anteriormente:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {topSuppliers.map((s: any, sidx: number) => (
                                <div key={sidx} className="p-1.5 px-2 bg-slate-900 border border-slate-800 rounded-lg text-[10px] flex items-center gap-2">
                                  <span className="font-semibold text-slate-200">{s.name}</span>
                                  {s.spendUYU && (
                                    <span className="text-emerald-400 font-mono">
                                      ${(s.spendUYU / 1000).toFixed(0)}k UYU
                                    </span>
                                  )}
                                  {s.lines && <span className="text-slate-500 font-mono">({s.lines} adjs)</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Organismos Compradores */}
                        {topBuyers.length > 0 && (
                          <div className="pt-2 border-t border-slate-700/40">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5 flex items-center gap-1">
                              <Landmark className="w-3 h-3 text-amber-400" /> Organismos que Más Compran este Ítem:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {topBuyers.map((b: any, bidx: number) => (
                                <span key={bidx} className="p-1 px-2 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-300">
                                  {b.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <BarChart3 className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>Sin baselines ni antecedentes de precios registrados en SICE para este pliego.</p>
                  <p className="text-[11px] text-slate-500">Se recomienda basar la oferta en la calculadora de markup competitivo.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DRAWER LATERAL: DICTAMEN TÉCNICO DE INGENIERÍA (OLLAMA LOCAL) */}
      {/* =================================================================== */}
      {technicalOpinionModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header del Drawer */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Dictamen Técnico de Ingeniería
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-indigo-400 font-medium">
                      Ollama Local: {selectedOllamaModel}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[11px] text-slate-400">
                      Rubro: {selectedVertical}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setTechnicalOpinionModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contexto de la Licitación */}
            {technicalOpinionCall && (
              <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
                <div className="truncate max-w-md">
                  <span className="font-semibold text-slate-200 truncate block">
                    {technicalOpinionCall.title}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {technicalOpinionCall.buyer?.name || 'Organismo Público'} • #{technicalOpinionCall.compraId}
                  </span>
                </div>
                {technicalOpinionData && (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
                    technicalOpinionData.viable
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {technicalOpinionData.viable ? '✅ Aprobado' : '⚠️ Condicionado'}
                  </span>
                )}
              </div>
            )}

            {/* Contenido Scrollable */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {isLoadingOpinion ? (
                <div className="py-24 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                  <p className="font-semibold text-sm text-slate-200">
                    Consultando al Agente Experto de Ingeniería...
                  </p>
                  <p className="text-slate-400 text-xs max-w-sm mx-auto">
                    Analizando pliego, normativa técnica ({selectedVertical}), inventario físico en Montevideo y baselines SICE con modelo <strong>{selectedOllamaModel}</strong>.
                  </p>
                </div>
              ) : technicalOpinionData ? (
                <div className="space-y-4">
                  {/* Tarjeta del Perito */}
                  <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{technicalOpinionData.perito_nombre}</h4>
                      <p className="text-slate-400 text-xs">{technicalOpinionData.perito_rol}</p>
                    </div>
                    <span className="text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full font-mono">
                      {technicalOpinionData.fuente_ia}
                    </span>
                  </div>

                  {/* Alerta si está condicionado */}
                  {technicalOpinionData.alerta_riesgo && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                      <span className="text-xs">{technicalOpinionData.alerta_riesgo}</span>
                    </div>
                  )}

                  {/* Markdown del Dictamen */}
                  <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl prose prose-invert max-w-none text-slate-200 leading-relaxed">
                    <ReactMarkdown>{technicalOpinionData.dictamen_markdown}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-12">No se pudo emitir el dictamen.</p>
              )}
            </div>

            {/* Footer de Acciones */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
              <button
                onClick={() => {
                  if (technicalOpinionData?.dictamen_markdown) {
                    navigator.clipboard.writeText(technicalOpinionData.dictamen_markdown);
                    setNotification({ type: 'success', message: 'Dictamen copiado al portapapeles.' });
                  }
                }}
                disabled={!technicalOpinionData}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl font-medium text-xs flex items-center gap-2 border border-slate-700 transition-colors"
              >
                <Copy className="w-4 h-4" /> Copiar Dictamen
              </button>
              <button
                onClick={() => setTechnicalOpinionModalOpen(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: GESTIÓN DE PALABRAS CLAVE & EXPANSIÓN OLLAMA */}
      {/* =================================================================== */}
      {isKeywordsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Gestión de Palabras Clave & Expansión con Ollama ({selectedVertical})
              </h3>
              <button onClick={() => setIsKeywordsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Asistente IA Ollama para Expansión */}
              <div className="p-4 bg-slate-950/60 border border-indigo-500/30 rounded-xl">
                <span className="text-xs font-bold text-white block mb-1">
                  🤖 Asistente de Expansión Semántica (Ollama Local: {selectedOllamaModel})
                </span>
                <p className="text-slate-400 mb-3">
                  Ingrese un concepto para que el modelo local sugiera sinónimos técnicos y términos de inclusión/exclusión para el radar.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiExpandQuery}
                    onChange={(e) => setAiExpandQuery(e.target.value)}
                    placeholder="Ej. driver dali, panel led, columna vial..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  />
                  <button
                    onClick={handleExpandKeywordsAI}
                    disabled={isExpandingAI}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 rounded-xl flex items-center gap-1.5"
                  >
                    {isExpandingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Expandir con IA</span>
                  </button>
                </div>

                {aiExpandResult && (
                  <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                    <span className="font-semibold text-slate-300 block">Sugerencias encontradas:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(aiExpandResult.sinonimos_sugeridos || []).map((term, i) => (
                        <span key={i} className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full text-[11px]">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Agregar Keyword Manual */}
              <div className="space-y-2">
                <span className="font-bold text-white block">Agregar Palabra Clave Manual</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeywordText}
                    onChange={(e) => setNewKeywordText(e.target.value)}
                    placeholder="Palabra o frase clave..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  />
                  <select
                    value={newKeywordTipo}
                    onChange={(e) => setNewKeywordTipo(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                  >
                    <option value="INCLUSION">Inclusión (+)</option>
                    <option value="EXCLUSION">Exclusión (-)</option>
                  </select>
                  <button
                    onClick={handleAddKeyword}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 rounded-xl flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>

              {/* Listado de Keywords Actuales */}
              <div>
                <span className="font-bold text-white block mb-2">
                  Palabras Clave Registradas ({currentKeywords.length})
                </span>
                {isLoadingKeywords ? (
                  <div className="py-6 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-400" />
                    <span>Cargando palabras clave...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950/40 rounded-xl border border-slate-800">
                    {currentKeywords.map((k) => (
                      <span
                        key={k.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${
                          k.tipo === 'INCLUSION'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}
                      >
                        <span>{k.keyword}</span>
                        <button
                          onClick={() => handleDeleteKeyword(k.id)}
                          className="hover:text-white ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TendersView;
