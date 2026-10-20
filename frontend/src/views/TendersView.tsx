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
  FileText,
  Clock,
  DollarSign,
  Building2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Tag,
  ArrowRight,
  Zap,
  Copy,
  Info,
  Download,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileSpreadsheet,
  Layers,
  Lock,
  Unlock,
  Package,
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  UserRole,
  EngineMode,
  BiddingVerticalItem,
  BiddingKeywordItem,
  BiddingAIExpandKeywordsResponse,
  ProcurementCallItem,
  ProcurementPdfAnalysisBlock,
  ProcurementRadarSuggestedItem,
  ProcurementCalendarCrossStockItem,
  ProcurementReserveTwinResponse,
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

export interface TendersViewProps {
  engineMode?: EngineMode;
  currentRole?: UserRole;
  initialTab?: 'radar' | 'benchmarks' | 'competitors' | 'buyers' | 'calendar' | 'cotizador';
  hideTabBar?: boolean;
}


const CANONICAL_SKU_SUGGESTIONS = [
  { label: 'LUM-6060 (Panel LED 60x60 40W 4000K)', sku: 'LUM-6060', category: 'Iluminación', cost: 14.50, siceMediana: 28.00 },
  { label: 'UFO-150W (Campana LED High Bay UFO 150W IP65)', sku: 'UFO-150W', category: 'Iluminación', cost: 48.00, siceMediana: 89.50 },
  { label: 'PANEL-LED-40W (Panel LED Embutir 40W Microprismático)', sku: 'PANEL-LED-40W', category: 'Iluminación', cost: 16.20, siceMediana: 31.00 },
  { label: 'LUM-VIAL-100W (Luminaria Alumbrado Público LED 100W IP66)', sku: 'LUM-VIAL-100W', category: 'Iluminación', cost: 72.00, siceMediana: 135.00 },
  { label: 'TUBO-LED-T8 (Tubo LED T8 120cm 18W Vidrio)', sku: 'TUBO-LED-T8', category: 'Iluminación', cost: 3.20, siceMediana: 6.80 },
  { label: 'SILLA-ERG-01 (Silla de Oficina Ergonómica Syncro 3D)', sku: 'SILLA-ERG-01', category: 'Mobiliario', cost: 85.00, siceMediana: 165.00 },
  { label: 'MESA-REUN-240 (Mesa Directorio Melamínica 240x120cm)', sku: 'MESA-REUN-240', category: 'Mobiliario', cost: 240.00, siceMediana: 460.00 },
  { label: 'CABLE-SUBT-4X16 (Cable Subterráneo Cobre 4x16mm2)', sku: 'CABLE-SUBT-4X16', category: 'Electromecánica', cost: 12.80, siceMediana: 24.50 },
  { label: 'CAMILLA-HOSP-01 (Camilla Hospitalaria Traslado Hidráulica)', sku: 'CAMILLA-HOSP-01', category: 'Salud', cost: 680.00, siceMediana: 1280.00 },
  { label: 'RACK-42U-800 (Rack Servidor 42U 800x1000mm)', sku: 'RACK-42U-800', category: 'Tecnología', cost: 450.00, siceMediana: 820.00 },
];

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
  initialTab = 'radar',
  hideTabBar = false,
}) => {
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'radar' | 'benchmarks' | 'competitors' | 'buyers' | 'calendar' | 'cotizador'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);


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
  const [callsStartDateFrom, setCallsStartDateFrom] = useState<string>('');
  const [callsStartDateTo, setCallsStartDateTo] = useState<string>('');
  const [callsEndDateFrom, setCallsEndDateFrom] = useState<string>('');
  const [callsEndDateTo, setCallsEndDateTo] = useState<string>('');
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

  // Modal de Análisis de Pliego PDF con IA Local (4 Bloques)
  const [pdfAnalysisModalOpen, setPdfAnalysisModalOpen] = useState<boolean>(false);
  const [pdfAnalysisCall, setPdfAnalysisCall] = useState<ProcurementCallItem | null>(null);
  const [pdfAnalysisData, setPdfAnalysisData] = useState<ProcurementPdfAnalysisBlock | null>(null);
  const [isLoadingPdfAnalysis, setIsLoadingPdfAnalysis] = useState<boolean>(false);

  // Bandeja de Ítems Sugeridos desde Radar SICE en Precios & SICE
  const [radarSuggestedItems, setRadarSuggestedItems] = useState<ProcurementRadarSuggestedItem[]>([]);
  const [isLoadingRadarSuggested, setIsLoadingRadarSuggested] = useState<boolean>(false);
  const [selectedSuggestedItem, setSelectedSuggestedItem] = useState<ProcurementRadarSuggestedItem | null>(null);

  // Filtros avanzados de Competidores y Compradores
  const [competitorRubroFilter, setCompetitorRubroFilter] = useState<string>('TODOS');
  const [buyerRubroFilter, setBuyerRubroFilter] = useState<string>('TODOS');
  const [buyerTipoCompraFilter, setBuyerTipoCompraFilter] = useState<string>('TODOS');

  // Cruce de Stock y Factibilidad IA en Calendario
  const [crossStockItems, setCrossStockItems] = useState<ProcurementCalendarCrossStockItem[]>([]);
  const [isCrossingStock, setIsCrossingStock] = useState<boolean>(false);
  const [crossStockStats, setCrossStockStats] = useState<{ tier1: number; tier2: number; tier3: number } | null>(null);

  // Reserva de Stock 3D en Gemelo Digital y Exportación de Oferta SICE
  const [reservationResult, setReservationResult] = useState<ProcurementReserveTwinResponse | null>(null);
  const [isReservingTwin, setIsReservingTwin] = useState<boolean>(false);
  const [isExportingOffer, setIsExportingOffer] = useState<boolean>(false);

  // Autocompletado Predictivo (>= 3 chars)
  const [activeSkuAutocompleteIdx, setActiveSkuAutocompleteIdx] = useState<number | null>(null);

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
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState<boolean>(false);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<any | null>(null);
  const [isLoadingSupplierDetail, setIsLoadingSupplierDetail] = useState<boolean>(false);
  const [isImportingCompetitor, setIsImportingCompetitor] = useState<boolean>(false);
  const [importedCompetitorRuts, setImportedCompetitorRuts] = useState<Set<string>>(new Set());

  // =========================================================================
  // TAB 4: RADIOGRAFÍA DE COMPRADORES & INTENDENCIAS
  // =========================================================================
  const [buyersList, setBuyersList] = useState<ProcurementBuyerItem[]>([]);
  const [buyersSearchQuery, setBuyersSearchQuery] = useState<string>('');
  const [buyerStartDate, setBuyerStartDate] = useState<string>('');
  const [buyerEndDate, setBuyerEndDate] = useState<string>('');
  const [selectedBuyerDetail, setSelectedBuyerDetail] = useState<any | null>(null);
  const [isLoadingBuyerDetail, setIsLoadingBuyerDetail] = useState<boolean>(false);
  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState<boolean>(false);
  const [isLoadingIntendencias, setIsLoadingIntendencias] = useState<boolean>(false);

  // =========================================================================
  // TAB 5: CALENDARIO DE VENCIMIENTOS & CONTROL LOGÍSTICO
  // =========================================================================
  const [calendarItems, setCalendarItems] = useState<ProcurementCalendarItem[]>([]);
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

  // Cargar Ítems Sugeridos desde Radar SICE para Precios & SICE
  const fetchRadarSuggestedItems = useCallback(async () => {
    setIsLoadingRadarSuggested(true);
    try {
      const res = await apiService.getRadarSuggestedPricingItems();
      if (res.success && res.data) {
        setRadarSuggestedItems(res.data.items || []);
      }
    } catch (err) {
      console.warn('Error al cargar items sugeridos de Radar SICE:', err);
    } finally {
      setIsLoadingRadarSuggested(false);
    }
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
        start_date_from: callsStartDateFrom || undefined,
        start_date_to: callsStartDateTo || undefined,
        end_date_from: callsEndDateFrom || undefined,
        end_date_to: callsEndDateTo || undefined,
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
  }, [callsSearchQuery, callsBuyerFilter, callsStartDateFrom, callsStartDateTo, callsEndDateFrom, callsEndDateTo]);

  useEffect(() => {
    if (activeTab === 'radar' && openCalls.length === 0) {
      fetchRadarCalls(1, false);
    }
    if (activeTab === 'benchmarks' && radarSuggestedItems.length === 0) {
      fetchRadarSuggestedItems();
    }
  }, [activeTab, fetchRadarCalls, fetchRadarSuggestedItems, openCalls.length, radarSuggestedItems.length]);

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

  // Cargar en el Cotizador con 1 Clic (Autocompletando partidas, organismo y plazos)
  const handleLoadInCotizador = (call: any) => {
    const title = call.title || `Licitación #${call.compraId}`;
    const buyerName = call.buyer?.name || call.buyerName || call.buyer || 'Organismo Comprador';
    setProyectoNombre(title);
    setClienteLicitacion(buyerName);
    setPlazoEntregaDias(call.dias_restantes ? Math.max(15, call.dias_restantes) : 30);

    const itemsSol = call.items_solicitados || [];
    if (itemsSol.length > 0) {
      const mapped = itemsSol.map((it: any) => ({
        sku: it.codigo_sice || it.siceCode || 'LUM-6060',
        cantidad_solicitada: parseInt(String(it.cantidad || 1), 10) || 1,
      }));
      setItems(mapped);
    } else {
      setItems([
        { sku: 'LUM-6060', cantidad_solicitada: 80 },
        { sku: 'UFO-150W', cantidad_solicitada: 45 },
      ]);
    }

    setActiveTab('cotizador');
    setNotification({
      type: 'success',
      message: `Convocatoria #${call.compraId} e ítems solicitados cargados en el Cotizador B2B.`,
    });
  };

  // Lector y Extractor Automático de Pliegos PDF con IA Local (4 Bloques)
  const handleAnalyzePdfPliego = async (call: ProcurementCallItem) => {
    const id = String(call.compraId);
    setPdfAnalysisCall(call);
    setIsLoadingPdfAnalysis(true);
    setPdfAnalysisModalOpen(true);
    setPdfAnalysisData(null);
    try {
      const res = await apiService.analyzeProcurementPdf(id, {
        titulo: call.title,
        organismo: call.buyer?.name || (call as any).buyerName || 'Organismo Comprador',
        vertical_id: selectedVertical,
        objeto_contratacion: call.objeto_contratacion || call.title,
        items_solicitados: call.items_solicitados || [],
        pliego_pdf_url: call.url_pliego_pdf,
        pliego_web_url: call.url_pliego_arce,
        plazo_entrega_dias: 30,
        model: selectedOllamaModel || 'gemma4:latest',
      });
      if (res.success && res.data) {
        setPdfAnalysisData(res.data);
        setNotification({
          type: 'success',
          message: `Dictamen de 4 bloques extraído con éxito (${res.data.fuente || 'IA'}).`,
        });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'No se pudo analizar el PDF con IA.' });
    } finally {
      setIsLoadingPdfAnalysis(false);
    }
  };


  // Agregar Competidor al Catálogo de Proveedores / Reventa
  const handleAddCompetitorToSuppliers = async (item: any, competitorName: string, competitorRut?: string) => {
    try {
      const res = await apiService.addCompetitorToSuppliersBridge({
        competitor_name: competitorName,
        competitor_rut: competitorRut,
        rubro: selectedVertical,
        product_sku: item.sku_sice || item.id || 'SKU-COMP',
        product_name: item.nombre_producto || item.description || 'Producto Adjudicado',
        precio_adjudicado: item.precio_unitario_adjudicado || item.unitPrice || 10,
        moneda: item.moneda || 'USD',
        fecha_precio: item.fecha_precio,
        contract_id: item.numero_contrato,
      });
      setNotification({ type: 'success', message: res.message });
      if (competitorRut) {
        setImportedCompetitorRuts((prev) => new Set([...prev, competitorRut]));
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'No se pudo agregar al catálogo de proveedores.' });
    }
  };

  // Cruce de Stock y Factibilidad IA en Calendario
  const handleCrossStockFeasibility = async () => {
    setIsCrossingStock(true);
    try {
      const res = await apiService.crossStockFeasibility({ vertical_id: selectedVertical });
      if (res.success && res.data) {
        setCrossStockItems(res.data.items || []);
        setCrossStockStats({
          tier1: res.data.tier1_count || 0,
          tier2: res.data.tier2_count || 0,
          tier3: res.data.tier3_count || 0,
        });
        setNotification({
          type: 'success',
          message: `Cruce IA completado: ${res.data.tier1_count} convocatorias con 100% stock hoy en Montevideo.`,
        });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al cruzar stock con convocatorias del calendario.' });
    } finally {
      setIsCrossingStock(false);
    }
  };

  // Reserva en Gemelo Digital 3D (SOFT vs HARD)
  const handleReserveDigitalTwin = async (reservationType: 'SOFT' | 'HARD') => {
    setIsReservingTwin(true);
    try {
      const skus = items.map((it) => it.sku);
      const res = await apiService.reserveDigitalTwin({
        tender_id: proyectoNombre || 'LIC-2026',
        skus,
        reservation_type: reservationType,
        margin_pct: margenPct,
      });
      setReservationResult(res);
      setNotification({
        type: 'success',
        message: res.message,
      });
    } catch (err) {
      setNotification({ type: 'error', message: 'No se pudo procesar la reserva en el Gemelo Digital 3D.' });
    } finally {
      setIsReservingTwin(false);
    }
  };

  // Exportar Oferta Económica Oficial SICE (Excel / PDF)
  const handleExportSiceOffer = async (format: 'pdf' | 'excel') => {
    setIsExportingOffer(true);
    try {
      const lines = items.map((it, idx) => {
        const matchingSugg = CANONICAL_SKU_SUGGESTIONS.find((s) => s.sku === it.sku.toUpperCase());
        const baseCost = matchingSugg ? matchingSugg.cost : 14.50;
        const offerPrice = Math.round(baseCost * (1 + margenPct / 100) * 100) / 100;
        return {
          sku: it.sku,
          codigo_sice: it.sku,
          descripcion: matchingSugg ? matchingSugg.label : `Partida #${idx + 1} - ${it.sku}`,
          cantidad: it.cantidad_solicitada,
          unidad_medida: 'UNIDAD',
          costo_unitario: baseCost,
          precio_unitario_oferta: offerPrice,
          margen_pct: margenPct,
          subtotal_oferta: offerPrice * it.cantidad_solicitada,
        };
      });

      await apiService.exportSiceOffer({
        empresa_nombre: 'CALCU SUPPLY CHAIN & ENERGY SOLUTIONS S.A.',
        empresa_rut: '219876540019',
        empresa_contacto: 'licitaciones@calcu.com.uy | +598 2900 1234',
        numero_licitacion: proyectoNombre.slice(0, 30),
        organismo_comprador: clienteLicitacion,
        objeto_llamado: proyectoNombre,
        plazo_entrega_dias: plazoEntregaDias,
        moneda: moneda,
        tipo_cambio_brou: tasaBrou || 40.10,
        items: lines,
        format,
      });

      setNotification({
        type: 'success',
        message: `Planilla oficial SICE (${format.toUpperCase()}) descargada con éxito.`,
      });
    } catch (err) {
      setNotification({ type: 'error', message: 'Error al exportar la planilla económica oficial.' });
    } finally {
      setIsExportingOffer(false);
    }
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
        // setTopSuppliersList
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

  const handleImportCompetitor = async (detail: any) => {
    if (!detail) return;
    setIsImportingCompetitor(true);
    try {
      const sName = detail.supplier?.name || detail.name || 'Proveedor Estatal';
      const sRut = detail.rupe?.rut || detail.supplier?.supplierId || detail.rut || '';
      const sContracts = detail.recentContracts || detail.contracts || [];

      const res = await apiService.importCompetitorToSuppliers({
        id: detail.supplier?.id || detail.id,
        nombre: sName,
        razon_social: detail.rupe?.razonSocial || sName,
        rut: sRut,
        rubro: detail.supplier?.topCategories?.[0] || 'Licitaciones & Suministros',
        contracts: sContracts,
      });

      if (res.success) {
        if (sRut) setImportedCompetitorRuts((prev) => new Set(prev).add(sRut));
        setNotification({
          type: 'success',
          message: `¡Éxito! ${sName} homologado en Proveedores con ${res.imported_items_count} productos en su catálogo comercial.`,
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.response?.data?.detail || 'Error al guardar el competidor en proveedores.',
      });
    } finally {
      setIsImportingCompetitor(false);
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
        // setIntendenciasData
      }
    } catch (err) {
      console.warn('Error cargando compradores e intendencias:', err);
    } finally {
      setIsLoadingIntendencias(false);
    }
  }, [buyersSearchQuery]);

  const handleSelectBuyer = async (deptOrBuyer: any) => {
    setIsLoadingBuyerDetail(true);
    setSelectedBuyerDetail(null);
    setIsBuyerModalOpen(true);
    try {
      const bId = deptOrBuyer.name || deptOrBuyer.id || deptOrBuyer.code;
      const res = await apiService.getProcurementBuyerDetail(bId, {
        start_date: buyerStartDate || undefined,
        end_date: buyerEndDate || undefined,
      });
      if (res.success && res.data) {
        setSelectedBuyerDetail(res.data);
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: 'No se pudo cargar la radiografía del organismo comprador.',
      });
    } finally {
      setIsLoadingBuyerDetail(false);
    }
  };

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
        {!hideTabBar && (
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
              <span>📡 Radar de Convocatorias</span>
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
              <span>🪙 Precios & SICE</span>
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
              <span>🛡️ Competidores & Proveedores</span>
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
              <span>🏛️ Compradores & Intendencias</span>
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
              <span>📅 Calendario & Logística MVD</span>
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
        )}
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
                    setCallsStartDateFrom('');
                    setCallsStartDateTo('');
                    setCallsEndDateFrom('');
                    setCallsEndDateTo('');
                    fetchRadarCalls(1, false);
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300"
                  title="Restablecer filtros"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Fila 2: Filtros por Fechas de Apertura y Cierre */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3.5 border-t border-slate-800 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  📅 Apertura Desde
                </label>
                <input
                  type="date"
                  value={callsStartDateFrom}
                  onChange={(e) => setCallsStartDateFrom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  📅 Apertura Hasta
                </label>
                <input
                  type="date"
                  value={callsStartDateTo}
                  onChange={(e) => setCallsStartDateTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  ⏰ Cierre Desde
                </label>
                <input
                  type="date"
                  value={callsEndDateFrom}
                  onChange={(e) => setCallsEndDateFrom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  ⏰ Cierre Hasta
                </label>
                <input
                  type="date"
                  value={callsEndDateTo}
                  onChange={(e) => setCallsEndDateTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
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
              <p className="text-xs text-slate-400 mt-1">Pruebe ampliando el criterio de búsqueda o seleccionando otro rango de fechas.</p>
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
                  const startDateStr = (call.tenderPeriod?.startDate || (call as any).datePublished || (call as any).date)
                    ? String(call.tenderPeriod?.startDate || (call as any).datePublished || (call as any).date).split('T')[0]
                    : 'Sin fecha';
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

                        {/* Fechas de Apertura y Cierre */}
                        <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 bg-slate-800/60 rounded-xl border border-slate-700/60 my-2">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span>Apertura: <strong className="text-emerald-300 font-mono">{startDateStr}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>Cierre: <strong className="text-amber-300 font-mono">{endDateStr}</strong></span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-400 mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate font-medium text-slate-300">{call.buyer?.name || (call as any).buyerName || 'Organismo Estatal'}</span>
                          </div>
                          {call.procurementMethodDetails && (
                            <div className="flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span className="text-slate-300">{call.procurementMethodDetails}</span>
                            </div>
                          )}
                          {call.objeto_contratacion && (
                            <div className="text-[11px] text-slate-400 italic line-clamp-2 mt-1">
                              "{call.objeto_contratacion}"
                            </div>
                          )}
                        </div>

                        {/* Tabla de Productos / Servicios Solicitados */}
                        {call.items_solicitados && call.items_solicitados.length > 0 && (
                          <div className="my-3 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2 px-0.5">
                              <span className="flex items-center gap-1.5 text-indigo-400">
                                <Package className="w-3.5 h-3.5" /> Ítems Licitados ({call.items_solicitados.length})
                              </span>
                              <span className="text-[10px] text-slate-500">Catálogo SICE / ARCE</span>
                            </div>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {call.items_solicitados.map((it: any, iIdx: number) => (
                                <div key={iIdx} className="flex items-center justify-between text-xs bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    <span className="font-mono text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                      {it.codigo_sice || it.siceCode || 'SICE'}
                                    </span>
                                    <span className="text-slate-200 truncate text-[11px] font-medium">{it.descripcion || 'Ítem licitado'}</span>
                                  </div>
                                  <span className="font-bold text-amber-400 text-xs shrink-0 font-mono">
                                    {it.cantidad || 1} {it.unidad_medida || 'u.'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Botones de Acceso Directo y Acciones */}
                      <div className="border-t border-slate-800/80 pt-3 flex flex-wrap items-center gap-2">
                        {call.url_pliego_arce && (
                          <a
                            href={call.url_pliego_arce}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                            title="Abrir llamado oficial en Compras Estatales (ARCE)"
                          >
                            <Globe className="w-3.5 h-3.5 text-cyan-400" />
                            <span>🌐 Pliego Web</span>
                          </a>
                        )}

                        {call.url_pliego_pdf && (
                          <a
                            href={call.url_pliego_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                            title="Descargar documento PDF del pliego"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>📄 PDF Pliego</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleViewCallSummary(call)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                          title="Ver Resumen IA de Pliego"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Resumen IA</span>
                        </button>

                        <button
                          onClick={() => handleViewCallBenchmarks(call)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                          title="Ver Benchmarks de Precios SICE"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Benchmarks</span>
                        </button>

                        <button
                          onClick={() => handleAnalyzePdfPliego(call)}
                          className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          title="Lector de Pliego PDF con IA Local (4 Bloques Clave)"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Analizar PDF IA</span>
                        </button>

                        <button
                          onClick={() => handleRequestTechnicalOpinion(call)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                          title="Consultar dictamen del Perito de Ingeniería"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>Dictamen Técnico</span>
                        </button>

                        <button
                          onClick={() => handleLoadInCotizador(call)}
                          className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                          title="Cargar esta licitación y sus ítems en el Cotizador B2B"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                          <span>Cargar en Cotizador</span>
                        </button>

                        <button
                          onClick={() => handleSaveTracking(call)}
                          className={`p-1.5 rounded-xl border transition-all ml-auto ${
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
          {/* BANDEJA INTERACTIVA: Ítems en Licitaciones Abiertas Hoy (Sugeridos desde Radar SICE) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    🎯 Ítems en Licitaciones Abiertas Hoy (Sugeridos desde Radar SICE)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Precios adjudicados reales, comparativas y oferta recomendada Calcu (Margen 30-35% en Decimal).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl font-mono text-emerald-400">
                  Dólar BROU: ${tasaBrou ? tasaBrou.toFixed(2) : '40.10'}
                </span>
                <button
                  onClick={fetchRadarSuggestedItems}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300"
                  title="Refrescar ítems sugeridos de licitaciones abiertas"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingRadarSuggested ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {isLoadingRadarSuggested ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                <span className="text-xs">Sincronizando ítems de convocatorias activas...</span>
              </div>
            ) : radarSuggestedItems.length === 0 ? (
              <div className="py-6 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800 text-xs">
                No hay ítems sugeridos en este momento. Active o explore el Radar SICE para detectar convocatorias.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {radarSuggestedItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedSuggestedItem(item);
                      setCalcSku(item.codigo_sice);
                      setCalcCosto(Math.round((item.ultimo_precio_adjudicado / 1.35) * 100) / 100);
                      setCalcSiceCode(item.codigo_sice);
                      setCalcMedianaSice(item.precio_promedio);
                      setCalcCantidad(item.cantidad_licitacion_activa);
                      handleExecuteMarkupCalculator();
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedSuggestedItem?.codigo_sice === item.codigo_sice
                        ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-mono font-bold text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {item.codigo_sice}
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {item.cantidad_licitacion_activa} {item.unidad_medida}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-1 mb-1">{item.descripcion}</h4>
                    <span className="text-[11px] text-slate-400 truncate block mb-2">{item.organismo}</span>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800/80 font-mono">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Último Adjudicado:</span>
                        <strong className="text-slate-200">${item.ultimo_precio_adjudicado.toFixed(2)}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-indigo-400 text-[10px] block font-sans font-semibold">Oferta Recomendada:</span>
                        <strong className="text-emerald-400 font-bold">${item.precio_oferta_recomendado_calcu.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
          {/* NIVEL SUPERIOR: TABLA MAESTRO DE COMPETIDORES Y CONTRATOS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    🛡️ Directorio Maestro de Competidores & Contratos SICE
                  </h3>
                  <p className="text-xs text-slate-400">
                    Historial de empresas adjudicatarias en compras públicas, ordenables por fecha reciente y rubro.
                  </p>
                </div>
              </div>

              {/* Filtro por Rubro y Orden */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={competitorRubroFilter}
                  onChange={(e) => {
                    setCompetitorRubroFilter(e.target.value);
                    setTimeout(fetchSuppliersData, 50);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="TODOS">Todos los Rubros</option>
                  {verticals.map((v) => (
                    <option key={v.id} value={v.nombre}>{v.nombre}</option>
                  ))}
                </select>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchSuppliersData()}
                    placeholder="Buscar competidor o RUT..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={fetchSuppliersData}
                  disabled={isLoadingSuppliers}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  {isLoadingSuppliers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Buscar</span>
                </button>
              </div>
            </div>

            {/* Tabla Maestro de Competidores */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Nombre / Razón Social</th>
                    <th className="py-2.5 px-3">RUT</th>
                    <th className="py-2.5 px-3">Rubro Principal</th>
                    <th className="py-2.5 px-3 text-center">Cant. Contratos</th>
                    <th className="py-2.5 px-3 text-right">Monto Adjudicado</th>
                    <th className="py-2.5 px-3">Organismo Principal</th>
                    <th className="py-2.5 px-3">Fecha Contrato</th>
                    <th className="py-2.5 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {suppliersList.map((s) => {
                    const sId = s.supplierId || s.id || '';
                    const isSelected = selectedSupplierDetail?.supplier?.id === sId || selectedSupplierDetail?.supplier?.name === s.name;
                    return (
                      <tr
                        key={sId}
                        onClick={() => handleSelectSupplier(sId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-950/40 font-semibold' : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-3 px-3 text-white font-medium flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                          <span>{s.name}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">{s.rut || sId || '-'}</td>
                        <td className="py-3 px-3 text-slate-300">{s.rubro_principal || s.category || 'Licitaciones'}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-200 font-bold">{s.cant_contratos || s.totalContracts || 1}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          ${formatCurrency(s.monto_adjudicado || s.totalValue || 0)}
                        </td>
                        <td className="py-3 px-3 text-slate-300 truncate max-w-[150px]">{s.organismo || 'Administración Central'}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{s.fecha_contrato || 'Reciente'}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSupplier(sId);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-semibold"
                          >
                            Ver Productos
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* NIVEL INFERIOR: DETALLE DE PRODUCTOS ADJUDICADOS EN EL CONTRATO */}
          {isLoadingSupplierDetail ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-400" />
              <p className="text-sm">Cargando contratos y productos adjudicados del competidor...</p>
            </div>
          ) : selectedSupplierDetail && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                      <Package className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        📦 Productos Adjudicados de {selectedSupplierDetail.supplier?.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Precios de corte adjudicados en pliego, alertas de arbitraje local y alta en 1 clic al catálogo.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(() => {
                    const compRut = selectedSupplierDetail.rupe?.rut || selectedSupplierDetail.supplier?.supplierId || selectedSupplierDetail.supplier?.rut || '';
                    const isAlreadyImported = compRut ? importedCompetitorRuts.has(compRut) : false;
                    return (
                      <button
                        onClick={() => handleImportCompetitor(selectedSupplierDetail)}
                        disabled={isImportingCompetitor || isAlreadyImported}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-all ${
                          isAlreadyImported
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                        }`}
                      >
                        {isImportingCompetitor ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isAlreadyImported ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>{isAlreadyImported ? '✅ Homologado en Proveedores' : 'Dar de Alta Todo en Proveedores'}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Lista de Contratos con sus Productos */}
              <div className="space-y-4">
                {(selectedSupplierDetail.recentContracts || []).map((contract: any, cIdx: number) => {
                  const contractId = contract.id || `LIC-2026-${cIdx + 1}`;
                  const itemsList = contract.items || [];
                  return (
                    <div key={cIdx} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            Contrato #{contractId}
                          </span>
                          <span className="text-xs font-bold text-white">{contract.buyerName || contract.buyer?.name || 'Organismo Estatal'}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-400">Fecha: {contract.date || '2026'}</span>
                      </div>

                      {/* Tabla de Productos del Contrato */}
                      {itemsList.length === 0 ? (
                        <p className="text-xs text-slate-500 py-2">Sin desglose de partidas individuales para este contrato.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                                <th className="py-2 px-2">SKU / Cód. SICE</th>
                                <th className="py-2 px-2">Nombre del Producto</th>
                                <th className="py-2 px-2 text-center">Cantidad</th>
                                <th className="py-2 px-2 text-right">Precio Adjudicado</th>
                                <th className="py-2 px-2">Moneda</th>
                                <th className="py-2 px-2">Fecha Precio</th>
                                <th className="py-2 px-2 text-center">Oportunidad Reventa</th>
                                <th className="py-2 px-2 text-center">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {itemsList.map((it: any, itIdx: number) => (
                                <tr key={itIdx} className="hover:bg-slate-900/60 transition-colors">
                                  <td className="py-2.5 px-2 font-mono font-bold text-indigo-300">
                                    {it.sku_sice || it.siceCode || it.id || 'SICE'}
                                  </td>
                                  <td className="py-2.5 px-2 text-slate-200 font-medium">
                                    {it.nombre_producto || it.description || 'Producto Licitado'}
                                  </td>
                                  <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-300">
                                    {it.cantidad || it.quantity || 1}
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-400">
                                    ${Number(it.precio_unitario_adjudicado || it.unitPrice || 0).toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-2 font-mono text-slate-400">{it.moneda || 'USD'}</td>
                                  <td className="py-2.5 px-2 font-mono text-slate-400">{it.fecha_precio || contract.date || '-'}</td>
                                  <td className="py-2.5 px-2 text-center">
                                    {it.oportunidad_abastecimiento_local ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        💡 OPORTUNIDAD ABASTECIMIENTO LOCAL
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">Precio estándar</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    <button
                                      onClick={() => handleAddCompetitorToSuppliers(
                                        it,
                                        selectedSupplierDetail.supplier?.name || 'Proveedor Local',
                                        selectedSupplierDetail.rupe?.rut || selectedSupplierDetail.supplier?.supplierId
                                      )}
                                      className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 mx-auto"
                                      title="Dar de alta en Catálogo de Proveedores / Reventa"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Agregar a Catálogo</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'buyers' && (
        <div className="space-y-6">
          {/* Métricas y Comunas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-400" />
                  🏛️ Radiografía de Organismos Compradores & Semáforo de Pago (DSO SIIF)
                </h3>
                <p className="text-xs text-slate-400">
                  Filtros multicriterio, historial de licitaciones y semáforo financiero de cobro (DSO: Verde &le;45d, Amarillo 46-75d, Rojo &gt;75d).
                </p>
              </div>
            </div>

            {/* Barra de Filtros Combinados */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 mb-6 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* 1. Filtro por Rubro / Vertical */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Rubro / Vertical</label>
                  <select
                    value={buyerRubroFilter}
                    onChange={(e) => setBuyerRubroFilter(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TODOS">Todos los Rubros</option>
                    {verticals.map((v) => (
                      <option key={v.id} value={v.nombre}>{v.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Filtro por Tipo de Compra */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Tipo de Compra</label>
                  <select
                    value={buyerTipoCompraFilter}
                    onChange={(e) => setBuyerTipoCompraFilter(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TODOS">Todas las Modalidades</option>
                    <option value="Compra Directa">Compra Directa</option>
                    <option value="Concurso de Precios">Concurso de Precios</option>
                    <option value="Licitación Abreviada">Licitación Abreviada</option>
                    <option value="Licitación Pública">Licitación Pública</option>
                  </select>
                </div>

                {/* 3. Búsqueda predictiva (>= 3 chars) */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Organismo (&ge; 3 caracteres)</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
                    <input
                      type="text"
                      value={buyersSearchQuery}
                      onChange={(e) => setBuyersSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchBuyersData()}
                      placeholder="UTE, OSE, Canelones..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* 4. Fechas y Botón Filtrar */}
                <div className="flex items-end gap-2">
                  <button
                    onClick={fetchBuyersData}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Filtrar</span>
                  </button>
                  <button
                    onClick={() => {
                      setBuyersSearchQuery('');
                      setBuyerRubroFilter('TODOS');
                      setBuyerTipoCompraFilter('TODOS');
                      setBuyerStartDate('');
                      setBuyerEndDate('');
                      setTimeout(fetchBuyersData, 50);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white"
                    title="Limpiar filtros"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Listado de Organismos con Semáforo Financiero de Pago DSO */}
            {isLoadingIntendencias ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                <p className="text-xs">Consultando compradores y plazos de pago SIIF...</p>
              </div>
            ) : buyersList.length === 0 ? (
              <div className="py-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800 text-xs">
                No se encontraron organismos que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {buyersList
                  .filter((b) => {
                    if (buyerTipoCompraFilter !== 'TODOS') {
                      const mod = (b.tipo_compra_predominante || '').toLowerCase();
                      if (!mod.includes(buyerTipoCompraFilter.toLowerCase())) return false;
                    }
                    if (buyerRubroFilter !== 'TODOS') {
                      const rub = (b.rubro_principal || '').toLowerCase();
                      if (!rub.includes(buyerRubroFilter.toLowerCase())) return false;
                    }
                    return true;
                  })
                  .map((buyer: any, bIdx: number) => {
                    const dsoDays = buyer.dso_estimado_dias || 45;
                    const semaforo = buyer.dso_semaforo || (dsoDays <= 45 ? 'VERDE' : (dsoDays <= 75 ? 'AMARILLO' : 'ROJO'));
                    const semaforoColor = semaforo === 'VERDE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : semaforo === 'AMARILLO'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                    return (
                      <div
                        key={bIdx}
                        onClick={() => handleSelectBuyer(buyer)}
                        className="p-4 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 rounded-2xl cursor-pointer transition-all hover:shadow-lg group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                              {buyer.name}
                            </h4>
                            <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                              ${formatCurrency(buyer.totalSpendingUYU || buyer.totalSpending || 0)}
                            </span>
                          </div>

                          <div className="space-y-1 text-[11px] text-slate-400 mb-3">
                            <div>Contratos adjudicados: <strong className="text-slate-200">{buyer.totalContracts || 0}</strong></div>
                            <div>Modalidad predominante: <strong className="text-slate-300">{buyer.tipo_compra_predominante || 'Licitación Pública'}</strong></div>
                            <div>Último contrato: <strong className="text-slate-400 font-mono">{buyer.fecha_ultimo_contrato || 'Reciente'}</strong></div>
                          </div>
                        </div>

                        {/* Semáforo Financiero de Cobro DSO */}
                        <div className="pt-2 border-t border-slate-800">
                          <div className={`p-2 rounded-xl border text-[11px] flex items-center justify-between ${semaforoColor}`}>
                            <span className="font-semibold flex items-center gap-1.5">
                              {semaforo === 'VERDE' ? '🟢' : semaforo === 'AMARILLO' ? '🟡' : '🔴'} DSO SIIF:
                            </span>
                            <span className="font-mono font-bold">~{dsoDays} días de cobro</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Cabecera del Semáforo Logístico */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  📅 Calendario de Factibilidad & Cruce de Stock IA
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Licitaciones abiertas por orden de cierre. Cruza con existencias reales en Montevideo, Salto y Tránsito Marítimo.
                </p>
              </div>

              {/* Botón Destacado: Cruzar con Mi Stock & Ordenar por Factibilidad */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCrossStockFeasibility}
                  disabled={isCrossingStock}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  {isCrossingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>🧠 Cruzar con Mi Stock & Ordenar por Factibilidad (IA)</span>
                </button>
              </div>
            </div>

            {/* Badges de Estadísticas del Cruce */}
            {crossStockStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl mb-4 text-xs font-mono">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300">
                  <span className="block text-[10px] uppercase font-bold text-emerald-400">🟢 Tier 1 (100% Stock MVD):</span>
                  <span className="text-lg font-bold">{crossStockStats.tier1} convocatorias viables hoy</span>
                </div>
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300">
                  <span className="block text-[10px] uppercase font-bold text-amber-400">🟡 Tier 2 (Salto / Reventa Local):</span>
                  <span className="text-lg font-bold">{crossStockStats.tier2} convocatorias completables 24-48h</span>
                </div>
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300">
                  <span className="block text-[10px] uppercase font-bold text-rose-400">🔴 Tier 3 (Tránsito Marítimo):</span>
                  <span className="text-lg font-bold">{crossStockStats.tier3} requieren flete marítimo</span>
                </div>
              </div>
            )}

            {/* Filtros de Lista */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setCalendarFilter('TODOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  calendarFilter === 'TODOS' ? 'bg-slate-700 text-white' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                Todos ({crossStockItems.length > 0 ? crossStockItems.length : calendarItems.length})
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
                🟡 Transferencia / Reventa Local
              </button>
              <button
                onClick={() => setCalendarFilter('ROJO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  calendarFilter === 'ROJO' ? 'bg-rose-600 text-white' : 'bg-slate-800/60 text-rose-400'
                }`}
              >
                🔴 Espera Marítima (45-60d)
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

          {/* Listado Reordenado por Factibilidad */}
          <div className="space-y-3">
            {isLoadingCalendar ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                <p className="text-xs">Consultando calendario y semáforo logístico...</p>
              </div>
            ) : crossStockItems.length > 0 ? (
              crossStockItems
                .filter((item) => {
                  if (calendarFilter !== 'TODOS' && item.semaforo_logistico !== calendarFilter) return false;
                  if (calendarSearch && !item.title.toLowerCase().includes(calendarSearch.toLowerCase()) && !item.buyer.toLowerCase().includes(calendarSearch.toLowerCase())) return false;
                  return true;
                })
                .map((item) => (
                  <div
                    key={item.compraId}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1.5 flex-1">
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
                            ? '🟢 Tier 1: 100% Stock MVD'
                            : item.semaforo_logistico === 'AMARILLO'
                            ? '🟡 Tier 2: Salto / Reventa Local'
                            : '🔴 Tier 3: Espera Marítima'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">#{item.compraId}</span>
                        <span className="text-xs font-mono font-bold text-indigo-400 ml-auto">
                          Cobertura Inmediata: {item.cobertura_stock_inmediato_pct}%
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white hover:text-indigo-400 transition-colors">
                        {item.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>🏛️ {item.buyer}</span>
                        <span>•</span>
                        <span>⏰ Cierre: <strong className="text-amber-300 font-mono">{item.endDate ? item.endDate.split('T')[0] : 'Vigente'}</strong></span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">{item.dias_restantes} días restantes</span>
                      </div>

                      <p className="text-xs text-slate-300 bg-slate-950/50 p-2 rounded-lg border border-slate-800/80">
                        {item.diagnostico_logistico}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadInCotizador(item)}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                        <span>🚀 Cargar en Cotizador B2B</span>
                      </button>
                    </div>
                  </div>
                ))
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
                          : '🔴 Requiere Importación'}
                      </span>
                      <span className="text-xs font-mono text-slate-400">#{item.compraId}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white hover:text-indigo-400 transition-colors">
                      {item.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>🏛️ {item.buyer}</span>
                      <span>•</span>
                      <span>⏰ Cierre: <strong className="text-amber-300 font-mono">{item.endDate.split('T')[0]}</strong></span>
                      <span>•</span>
                      <span className="text-slate-300">{item.dias_restantes} días restantes</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoadInCotizador({ compraId: item.compraId, title: item.title, buyer: { name: item.buyer } })}
                      className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Cargar en Cotizador</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'cotizador' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-400" />
                  🧮 Cotizador B2B & Generador Oficial de Ofertas SICE
                </h3>
                <p className="text-xs text-slate-400">
                  Cálculo de márgenes en Decimal, semáforo logístico, debate dialéctico y reserva en Gemelo Digital 3D.
                </p>
              </div>

              {/* Selector Rápido de Oportunidades desde Radar o Calendario */}
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    const selId = e.target.value;
                    const found = openCalls.find((c) => String(c.compraId) === selId) || crossStockItems.find((c) => String(c.compraId) === selId);
                    if (found) handleLoadInCotizador(found);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 max-w-xs truncate"
                >
                  <option value="">⚡ Cargar Licitación desde Radar...</option>
                  {openCalls.map((c) => (
                    <option key={c.compraId} value={String(c.compraId)}>
                      #{c.compraId} - {c.title.slice(0, 45)}...
                    </option>
                  ))}
                </select>
              </div>
            </div>

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

            {/* Partidas y Comparativa Integral en Decimal */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Partidas a Cotizar & Comparativa de Costos vs Ganador SICE
                </label>
                <span className="text-[11px] text-slate-400 font-mono">Dólar BROU: ${tasaBrou ? tasaBrou.toFixed(2) : '40.10'}</span>
              </div>

              {items.map((it, idx) => {
                const matchingSugg = CANONICAL_SKU_SUGGESTIONS.find((s) => s.sku === it.sku.toUpperCase());
                const baseCost = matchingSugg ? matchingSugg.cost : 14.50;
                const lastWinner = matchingSugg ? matchingSugg.siceMediana : 28.00;
                const unitOffer = Math.round(baseCost * (1 + margenPct / 100) * 100) / 100;
                const subtotal = Math.round(unitOffer * it.cantidad_solicitada * 100) / 100;
                const stockMvd = matchingSugg ? 120 : 80;
                const semaforoStock = stockMvd >= it.cantidad_solicitada ? '🟢 Inmediato MVD' : '🟡 Salto/Reventa';

                return (
                  <div key={idx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                      {/* SKU Input con autocompletado */}
                      <div className="relative md:col-span-2">
                        <input
                          type="text"
                          value={it.sku}
                          onFocus={() => setActiveSkuAutocompleteIdx(idx)}
                          onChange={(e) => {
                            const copy = [...items];
                            copy[idx].sku = e.target.value;
                            setItems(copy);
                          }}
                          placeholder="SKU (ej. LUM-6060, UFO-150W)..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                        />
                        {activeSkuAutocompleteIdx === idx && it.sku.length >= 2 && (
                          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                            {CANONICAL_SKU_SUGGESTIONS.filter((s) => s.sku.toLowerCase().includes(it.sku.toLowerCase()) || s.label.toLowerCase().includes(it.sku.toLowerCase())).map((s, sIdx) => (
                              <div
                                key={sIdx}
                                onClick={() => {
                                  const copy = [...items];
                                  copy[idx].sku = s.sku;
                                  setItems(copy);
                                  setActiveSkuAutocompleteIdx(null);
                                }}
                                className="p-2 hover:bg-slate-800 cursor-pointer text-xs flex justify-between border-b border-slate-800"
                              >
                                <span className="font-mono text-indigo-400 font-bold">{s.sku}</span>
                                <span className="text-slate-300 text-[11px] truncate max-w-[150px]">{s.category}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cantidad Solicitada */}
                      <div>
                        <input
                          type="number"
                          value={it.cantidad_solicitada}
                          onChange={(e) => {
                            const copy = [...items];
                            copy[idx].cantidad_solicitada = parseInt(e.target.value) || 1;
                            setItems(copy);
                          }}
                          placeholder="Cant."
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white text-center font-mono"
                        />
                      </div>

                      {/* Costo Landed & Stock */}
                      <div className="text-[11px] font-mono text-slate-300">
                        <div>Costo: <strong className="text-slate-100">${baseCost.toFixed(2)}</strong></div>
                        <div className="text-[10px] text-emerald-400">{semaforoStock} ({stockMvd}u)</div>
                      </div>

                      {/* Último Ganador SICE & Oferta Unit */}
                      <div className="text-[11px] font-mono text-slate-300">
                        <div>Últ. Ganador: <strong className="text-amber-400">${lastWinner.toFixed(2)}</strong></div>
                        <div>Oferta: <strong className="text-indigo-400">${unitOffer.toFixed(2)}</strong></div>
                      </div>

                      {/* Subtotal & Borrar */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-emerald-400">${subtotal.toFixed(2)}</span>
                        <button
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-500 hover:text-rose-400"
                          title="Eliminar partida"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => setItems([...items, { sku: 'LUM-6060', cantidad_solicitada: 50 }])}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Partida
              </button>
            </div>

            {/* Botones Principales de Evaluación y Exportación */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={handleEvaluateTender}
                disabled={isEvaluating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>✨ Evaluar Factibilidad & Debate Dialéctico</span>
              </button>

              <button
                onClick={() => handleExportSiceOffer('excel')}
                disabled={isExportingOffer}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 ml-auto"
                title="Generar planilla oficial SICE en Excel con datos RUPE y desglose IVA 22%"
              >
                {isExportingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                <span>📄 Exportar Planilla SICE (Excel)</span>
              </button>

              <button
                onClick={() => handleExportSiceOffer('pdf')}
                disabled={isExportingOffer}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm"
                title="Generar anexo formal de oferta económica en PDF listo para firmar y subir a RUPE"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>📄 Exportar Oferta (PDF)</span>
              </button>
            </div>

            {/* Botones de Reserva Directa en Gemelo Digital 3D */}
            <div className="mt-4 p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Reserva Directa en Gemelo Digital 3D (Depósito Montevideo)</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Bloquee las posiciones físicas en las estanterías del almacén para garantizar el despacho.
                </p>
                {reservationResult && (
                  <div className="mt-2 text-xs font-mono text-emerald-400 bg-slate-900 px-2 py-1 rounded border border-emerald-500/30">
                    {reservationResult.message} • Slots: {reservationResult.slots_reserved.join(', ')} (Status {reservationResult.http_code})
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReserveDigitalTwin('SOFT')}
                  disabled={isReservingTwin}
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="Activar Pre-Reserva Blanda para licitación en curso"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>🟡 Pre-Reserva Blanda</span>
                </button>

                <button
                  onClick={() => handleReserveDigitalTwin('HARD')}
                  disabled={isReservingTwin}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all"
                  title="Bloquear posiciones físicas en el Almacén 3D con estado LOCKED (HTTP 423)"
                >
                  <Lock className="w-3.5 h-3.5 text-white" />
                  <span>🔵 Reserva Dura (Locked 3D)</span>
                </button>
              </div>
            </div>

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
                    ⚖️ Debate Completo (Finanzas vs Ventas)
                  </button>
                  <button
                    onClick={() => setActiveDialecticTab('david')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activeDialecticTab === 'david' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    🛡️ Veredicto Financiero
                  </button>
                  <button
                    onClick={() => setActiveDialecticTab('aristoteles')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activeDialecticTab === 'aristoteles' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    🚀 Estrategia Comercial
                  </button>
                </div>

                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-200 text-xs leading-relaxed">
                  {activeDialecticTab === 'both' ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-900/90 border border-indigo-500/30 rounded-xl">
                        <span className="font-bold text-indigo-400 block mb-1">🛡️ Dictamen Técnico & Financiero (Ing. David Jiménez):</span>
                        <div className="prose prose-invert max-w-none text-xs">
                          <ReactMarkdown>{evaluationResult.dictamen_david?.dictamen_completo || evaluationResult.dictamen_david?.postura_david || 'Aprobado técnicamente.'}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/90 border border-emerald-500/30 rounded-xl">
                        <span className="font-bold text-emerald-400 block mb-1">🚀 Estrategia Comercial (Aristóteles):</span>
                        <div className="prose prose-invert max-w-none text-xs">
                          <ReactMarkdown>{evaluationResult.dictamen_aristoteles?.estrategia_completa || evaluationResult.dictamen_aristoteles?.pitch_apertura || 'Margen competitivo verificado.'}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ) : activeDialecticTab === 'david' ? (
                    <div className="prose prose-invert max-w-none text-xs">
                      <ReactMarkdown>{evaluationResult.dictamen_david?.dictamen_completo || evaluationResult.dictamen_david?.postura_david || 'Dictamen David generado.'}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-xs">
                      <ReactMarkdown>{evaluationResult.dictamen_aristoteles?.estrategia_completa || evaluationResult.dictamen_aristoteles?.pitch_apertura || 'Estrategia comercial generada.'}</ReactMarkdown>
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
      {/* MODAL: LECTOR Y EXTRACTOR DE PLIEGOS PDF CON IA LOCAL (4 BLOQUES) */}
      {/* =================================================================== */}
      {pdfAnalysisModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Lector de Pliego PDF con IA Local (4 Bloques Clave)
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    <span className="text-indigo-400 font-mono">Modelo: {pdfAnalysisData?.modelo_ia || selectedOllamaModel}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">{pdfAnalysisData?.fuente || 'IA Local'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPdfAnalysisModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contexto del llamado */}
            {pdfAnalysisCall && (
              <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-2">
                <div className="truncate max-w-lg">
                  <span className="font-semibold text-slate-200 block truncate">{pdfAnalysisCall.title}</span>
                  <span className="text-slate-400 text-[11px]">
                    {pdfAnalysisCall.buyer?.name || (pdfAnalysisCall as any).buyerName || 'Organismo Comprador'} • #{pdfAnalysisCall.compraId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {pdfAnalysisCall.url_pliego_pdf && (
                    <a
                      href={pdfAnalysisCall.url_pliego_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Ver PDF Original
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setPdfAnalysisModalOpen(false);
                      handleLoadInCotizador(pdfAnalysisCall);
                    }}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1"
                  >
                    <ArrowRight className="w-3 h-3" /> Cargar en Cotizador
                  </button>
                </div>
              </div>
            )}

            {/* Contenido de los 4 Bloques Clave */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {isLoadingPdfAnalysis ? (
                <div className="py-24 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                  <p className="font-semibold text-sm text-slate-200">
                    Descargando pliego PDF y procesando con IA local...
                  </p>
                  <p className="text-slate-400 text-xs max-w-md mx-auto">
                    Extrayendo texto con pypdf y estructurando los 4 bloques: variantes técnicas, plazos y multas, certificaciones requeridas y requisitos RUPE/TOCAF.
                  </p>
                </div>
              ) : pdfAnalysisData ? (
                <div className="space-y-4">
                  {/* Bloque 1: Detalle Técnico de Ítems */}
                  <div className="p-4 bg-slate-950/70 border border-indigo-500/30 rounded-xl">
                    <div className="flex items-center gap-2 font-bold text-sm text-indigo-300 mb-2">
                      <span className="p-1 bg-indigo-500/10 rounded">📦</span>
                      <h4>1. Detalle Técnico de Ítems y Variantes Exigidas</h4>
                    </div>
                    <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed text-xs">
                      <ReactMarkdown>{pdfAnalysisData.items_y_variantes || 'No especificado en el pliego.'}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Bloque 2: Plazos, Lugar y Multas */}
                  <div className="p-4 bg-slate-950/70 border border-amber-500/30 rounded-xl">
                    <div className="flex items-center gap-2 font-bold text-sm text-amber-300 mb-2">
                      <span className="p-1 bg-amber-500/10 rounded">⏱️</span>
                      <h4>2. Plazo de Entrega, Lugar de Recepción y Multas por Mora</h4>
                    </div>
                    <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed text-xs">
                      <ReactMarkdown>{pdfAnalysisData.plazos_lugar_multas || 'No especificado en el pliego.'}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Bloque 3: Muestras y Certificaciones */}
                  <div className="p-4 bg-slate-950/70 border border-emerald-500/30 rounded-xl">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-300 mb-2">
                      <span className="p-1 bg-emerald-500/10 rounded">🧪</span>
                      <h4>3. Requisitos de Muestras, Garantías y Certificaciones (UNIT / URSEA / MSP)</h4>
                    </div>
                    <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed text-xs">
                      <ReactMarkdown>{pdfAnalysisData.muestras_garantias_certificaciones || 'No especificado en el pliego.'}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Bloque 4: Excluyentes RUPE / TOCAF */}
                  <div className="p-4 bg-slate-950/70 border border-rose-500/30 rounded-xl">
                    <div className="flex items-center gap-2 font-bold text-sm text-rose-300 mb-2">
                      <span className="p-1 bg-rose-500/10 rounded">⚠️</span>
                      <h4>4. Requisitos Excluyentes en RUPE / TOCAF</h4>
                    </div>
                    <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed text-xs">
                      <ReactMarkdown>{pdfAnalysisData.requisitos_excluyentes_rupe_tocaf || 'No especificado en el pliego.'}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-12">No se pudo generar el análisis del pliego PDF.</p>
              )}
            </div>

            {/* Footer de Acciones */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
              <button
                onClick={() => {
                  if (pdfAnalysisData?.resumen_ejecutivo_markdown) {
                    navigator.clipboard.writeText(pdfAnalysisData.resumen_ejecutivo_markdown);
                    setNotification({ type: 'success', message: 'Dictamen de 4 bloques copiado al portapapeles.' });
                  }
                }}
                disabled={!pdfAnalysisData}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl font-medium text-xs flex items-center gap-2 border border-slate-700 transition-colors"
              >
                <Copy className="w-4 h-4" /> Copiar Resumen Ejecutivo
              </button>
              <button
                onClick={() => setPdfAnalysisModalOpen(false)}
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
      {/* =================================================================== */}
      {/* MODAL: RADIOGRAFÍA DE COMPRADOR / INTENDENCIA & DESCARGA DE PLIEGOS */}
      {/* =================================================================== */}
      {isBuyerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                  <Landmark className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedBuyerDetail?.name || 'Ficha del Organismo Comprador'}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    RUT: {selectedBuyerDetail?.rut || selectedBuyerDetail?.id || 'No registrado'}
                    {selectedBuyerDetail?.department && ` • Comuna / Dpto: ${selectedBuyerDetail.department}`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsBuyerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {isLoadingBuyerDetail ? (
                <div className="py-24 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                  <p className="font-semibold text-sm text-slate-200">
                    Cargando expediente, datos de contacto y pliegos oficiales...
                  </p>
                  <p className="text-slate-500 text-xs">
                    Consultando compras estatales y antecedentes licitatorios.
                  </p>
                </div>
              ) : selectedBuyerDetail ? (
                <div className="space-y-6">
                  {/* Tarjetas de Datos de Contacto */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-800/70 border border-slate-700/60 rounded-xl space-y-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                        <Mail className="w-3.5 h-3.5 text-indigo-400" /> Email de Compras
                      </span>
                      <p className="text-xs font-semibold text-white truncate" title={selectedBuyerDetail.contact?.email || selectedBuyerDetail.email || 'compras@gub.uy'}>
                        {selectedBuyerDetail.contact?.email || selectedBuyerDetail.email || 'compras@gub.uy'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-800/70 border border-slate-700/60 rounded-xl space-y-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" /> Teléfono Central
                      </span>
                      <p className="text-xs font-semibold text-white">
                        {selectedBuyerDetail.contact?.phone || selectedBuyerDetail.phone || '+598 2900 0000'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-800/70 border border-slate-700/60 rounded-xl space-y-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" /> Dirección Física
                      </span>
                      <p className="text-xs font-semibold text-white truncate" title={selectedBuyerDetail.contact?.address || selectedBuyerDetail.address || 'Montevideo, Uruguay'}>
                        {selectedBuyerDetail.contact?.address || selectedBuyerDetail.address || 'Montevideo, Uruguay'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-800/70 border border-slate-700/60 rounded-xl space-y-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" /> Portal Web Oficial
                      </span>
                      {selectedBuyerDetail.website || selectedBuyerDetail.contact?.website ? (
                        <a
                          href={selectedBuyerDetail.website || selectedBuyerDetail.contact?.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1 truncate"
                        >
                          <span>Visitar Portal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="text-xs font-semibold text-slate-400">gub.uy</p>
                      )}
                    </div>
                  </div>

                  {/* Resumen de Contrataciones */}
                  <div className="flex flex-wrap items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Total Contratos</span>
                        <strong className="text-sm text-white font-mono">{selectedBuyerDetail.totalContracts || (selectedBuyerDetail.contracts || []).length}</strong>
                      </div>
                      <div className="h-6 w-px bg-slate-800" />
                      <div>
                        <span className="text-[11px] text-slate-400 block">Gasto Total Estimado</span>
                        <strong className="text-sm text-emerald-400 font-mono">
                          UYU ${formatCurrency(selectedBuyerDetail.totalSpend || selectedBuyerDetail.totalSpendingUYU || 0)}
                        </strong>
                      </div>
                    </div>
                    {(buyerStartDate || buyerEndDate) && (
                      <div className="text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg">
                        Filtro Activo: {buyerStartDate || 'Inicio'} ➔ {buyerEndDate || 'Fin'}
                      </div>
                    )}
                  </div>

                  {/* Listado de Contratos con Link a Pliego */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                      <span>Licitaciones y Contratos Registrados ({(selectedBuyerDetail.contracts || []).length})</span>
                      <span className="text-[11px] text-slate-400 font-normal">Pliegos Oficiales SICE / Compras Estatales</span>
                    </h4>

                    {(selectedBuyerDetail.contracts || []).length === 0 ? (
                      <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
                        No se registraron contratos en el período seleccionado.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {(selectedBuyerDetail.contracts || []).map((contract: any, cIdx: number) => {
                          const cTitle = contract.title || contract.description || `Licitación #${contract.id || cIdx + 1}`;
                          const cDate = contract.date ? (typeof contract.date === 'string' && contract.date.includes('T') ? contract.date.split('T')[0] : String(contract.date)) : 'Fecha s/d';
                          const cAmount = Number(contract.amount || contract.totalValue || 0);
                          const cCurr = contract.currency || 'UYU';
                          const pliegoUrl = contract.pliego_url || `https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/id/${contract.id || contract.compra_id || ''}`;

                          return (
                            <div
                              key={cIdx}
                              className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex items-start gap-2">
                                  <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="font-semibold text-white text-xs leading-snug">{cTitle}</h5>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
                                      <span>Fecha: {cDate}</span>
                                      {contract.modalidad && (
                                        <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-indigo-300 border border-slate-800">
                                          {contract.modalidad}
                                        </span>
                                      )}
                                      {cAmount > 0 && (
                                        <span className="text-emerald-400 font-bold">
                                          {cCurr} ${formatCurrency(cAmount)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-2">
                                <a
                                  href={pliegoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                                  title="Ver o descargar el pliego oficial de bases y condiciones"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Pliego Oficial (PDF / DOC)</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-12">No se encontró detalle para este organismo.</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button
                onClick={() => setIsBuyerModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TendersView;
