import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Building2,
  DollarSign,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Copy,
  Layers,
  TrendingUp,
  Mail,
  Zap,
  Scale,
  Check,
  Globe,
  Download,
  ExternalLink,
  FileText,
  X,
  Loader2,
  Search,
  RefreshCw,
  Lightbulb,
  Armchair,
  Tag,
  Settings,
  Bot,
  ArrowRight,
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  TenderEvaluateRequest,
  TenderEvaluateResponse,
  TenderItemSecure,
  TenderItemEvaluationResult,
  TenderSummaryItem,
  UserRole,
  EngineMode,
  InventoryAlertItem,
  TenderFeedItem,
  BiddingVerticalItem,
  BiddingKeywordItem,
  BiddingAIExpandKeywordsResponse,
} from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { formatCurrency } from '../utils/formatters';

interface TendersViewProps {
  engineMode?: EngineMode;
  currentRole?: UserRole;
}

const QUICK_CHIPS: Array<{
  label: string;
  query: string;
  nicho: string;
}> = [
  { label: '💡 Columnas & Alumbrado', query: 'columnas', nicho: 'ILUMINACION_EFICIENCIA' },
  { label: '💡 Drivers DALI', query: 'driver', nicho: 'ILUMINACION_EFICIENCIA' },
  { label: '💡 Paneles 60x60', query: 'panel led', nicho: 'ILUMINACION_EFICIENCIA' },
  { label: '🪑 Sillas Operativas', query: 'silla', nicho: 'MOBILIARIO_EQUIPAMIENTO' },
  { label: '🪑 Armarios & Mostradores', query: 'armario', nicho: 'MOBILIARIO_EQUIPAMIENTO' },
  { label: '🏗️ Obra & Yeso Drywall', query: 'yeso', nicho: 'OBRA_CIVIL_CONSTRUCCION' },
  { label: '⚡ Tableros & Cables', query: 'tablero electrico', nicho: 'ELECTROMECANICA_SUMINISTROS' },
  { label: '🏥 Camillas & Clínico', query: 'camilla', nicho: 'EQUIPAMIENTO_HOSPITALARIO' },
  { label: '💻 Racks & Fibra Óptica', query: 'rack', nicho: 'TECNOLOGIA_REDES' },
  { label: '🧹 Servicio de Limpieza', query: 'servicio de limpieza', nicho: 'SERVICIOS_LIMPIEZA_MANTENIMIENTO' },
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

const cleanMarkdown = (raw?: string) => {
  if (!raw) return '';
  return raw
    .replace(/^```markdown\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
};

export const TendersView: React.FC<TendersViewProps> = ({
  engineMode = 'auto',
  currentRole = 'controller_admin',
}) => {
  // Formulario del Proyecto
  const [proyectoNombre, setProyectoNombre] = useState<string>('Licitación B2B - Suministro & Eficiencia');
  const [clienteLicitacion, setClienteLicitacion] = useState<string>('Conaprole SA - Planta Industrial');
  const [nicho, setNicho] = useState<string>('ILUMINACION_EFICIENCIA');
  const [plazoEntregaDias, setPlazoEntregaDias] = useState<number>(30);
  const [moneda, setMoneda] = useState<'USD' | 'UYU'>('USD');
  const [margenPct, setMargenPct] = useState<number>(35);
  const [observaciones, setObservaciones] = useState<string>('Requiere certificación UNIT / IEC y entrega en depósito Montevideo.');
  const [pliegoUrl, setPliegoUrl] = useState<string>('');
  const [pliegoPdfRef, setPliegoPdfRef] = useState<string>('');
  const [fechaLimiteLicitacion, setFechaLimiteLicitacion] = useState<string>('');

  const handleFechaLimiteChange = (newDateStr: string) => {
    setFechaLimiteLicitacion(newDateStr);
    if (newDateStr) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(newDateStr + 'T00:00:00');
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      setPlazoEntregaDias(diffDays);
    }
  };

  // Partidas
  const [items, setItems] = useState<TenderItemSecure[]>([
    { sku: 'LUM-6060', cantidad_solicitada: 80 },
    { sku: 'UFO-150W', cantidad_solicitada: 45 },
  ]);

  // Catálogo disponible para autocompletar
  const [catalog, setCatalog] = useState<InventoryAlertItem[]>([]);
  const [tasaBrou, setTasaBrou] = useState<number>(40.40);

  // Estados de Evaluación y Persistencia
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<TenderEvaluateResponse | null>(null);
  const [savedTenders, setSavedTenders] = useState<TenderSummaryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeDialecticTab, setActiveDialecticTab] = useState<'both' | 'david' | 'aristoteles' | 'email'>('both');
  const [evaluatingStep, setEvaluatingStep] = useState<'idle' | 'david' | 'aristoteles'>('idle');
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // Estados para Feed de Licitaciones Públicas B2B Multi-Rubro (ARCE)
  const [isFeedModalOpen, setIsFeedModalOpen] = useState<boolean>(false);
  const [feedItems, setFeedItems] = useState<TenderFeedItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(false);
  const [isSyncingFeed, setIsSyncingFeed] = useState<boolean>(false);
  const [importingFeedId, setImportingFeedId] = useState<string | null>(null);
  const [feedNichoFilter, setFeedNichoFilter] = useState<string>('TODAS');
  const [feedSearchQuery, setFeedSearchQuery] = useState<string>('');
  const [feedMeta, setFeedMeta] = useState<{
    total: number;
    fuente_estado?: string;
    incluye_demo?: boolean;
    analizadas?: number;
    descartadas?: number;
    mensaje?: string | null;
    actualizado_al?: string;
  }>({ total: 0 });

  // Gestión de Verticales Comerciales y Modelos Ollama
  const [verticals, setVerticals] = useState<BiddingVerticalItem[]>(CANONICAL_VERTICALS);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('qwen2.5:7b');
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([
    'qwen2.5:7b',
    'llama3:latest',
    'mistral:latest',
    'deepseek-r1:7b',
  ]);

  // Modal de Gestión de Rubros y Palabras Clave
  const [isKeywordsModalOpen, setIsKeywordsModalOpen] = useState<boolean>(false);
  const [selectedVerticalForMgmt, setSelectedVerticalForMgmt] = useState<string>('ILUMINACION_EFICIENCIA');
  const [currentKeywords, setCurrentKeywords] = useState<BiddingKeywordItem[]>([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState<boolean>(false);
  const [newKeywordText, setNewKeywordText] = useState<string>('');
  const [newKeywordTipo, setNewKeywordTipo] = useState<'INCLUSION' | 'EXCLUSION'>('INCLUSION');

  // Asistente IA Ollama para Expansión de Keywords & Temporizador 7 minutos
  const [aiExpandQuery, setAiExpandQuery] = useState<string>('');
  const [isExpandingAI, setIsExpandingAI] = useState<boolean>(false);
  const [aiExpandElapsedSeconds, setAiExpandElapsedSeconds] = useState<number>(0);
  const [showFallbackPrompt, setShowFallbackPrompt] = useState<boolean>(false);
  const [aiExpandResult, setAiExpandResult] = useState<BiddingAIExpandKeywordsResponse | null>(null);

  // Carga inicial de Verticales y Modelos Ollama
  useEffect(() => {
    const initBiddingData = async () => {
      try {
        const [vertsData, modelsData] = await Promise.all([
          apiService.getBiddingVerticals().catch(() => null),
          apiService.getOllamaModels().catch(() => null),
        ]);
        if (vertsData && vertsData.length > 0) {
          setVerticals(vertsData);
        }
        if (modelsData && modelsData.models && modelsData.models.length > 0) {
          setAvailableOllamaModels(modelsData.models.map((m: any) => m.name));
          if (modelsData.active_model) {
            setSelectedOllamaModel(modelsData.active_model);
          }
        }
      } catch (err) {
        console.warn('Error inicializando metadatos de licitaciones:', err);
      }
    };
    initBiddingData();
  }, []);

  // Temporizador para operaciones de Ollama (con alerta y opción de fallback a los 7 minutos = 420s)
  useEffect(() => {
    let timer: any = null;
    if (isExpandingAI) {
      setAiExpandElapsedSeconds(0);
      setShowFallbackPrompt(false);
      timer = setInterval(() => {
        setAiExpandElapsedSeconds((prev) => {
          const next = prev + 1;
          if (next === 420) {
            setShowFallbackPrompt(true);
          }
          return next;
        });
      }, 1000);
    } else {
      setAiExpandElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isExpandingAI]);

  // Carga de Keywords para la vertical seleccionada
  const fetchKeywordsForVertical = useCallback(async (vId: string) => {
    setIsLoadingKeywords(true);
    try {
      const kws = await apiService.getBiddingKeywords(vId);
      setCurrentKeywords(kws || []);
    } catch (err) {
      console.error('Error cargando keywords:', err);
    } finally {
      setIsLoadingKeywords(false);
    }
  }, []);

  const handleOpenKeywordsModal = async (vId?: string) => {
    const targetId = vId || selectedVerticalForMgmt || (feedNichoFilter !== 'TODAS' ? feedNichoFilter : 'ILUMINACION_EFICIENCIA');
    setSelectedVerticalForMgmt(targetId);
    setIsKeywordsModalOpen(true);
    await fetchKeywordsForVertical(targetId);
  };

  const handleAddKeywords = async () => {
    if (!newKeywordText.trim()) return;
    const splitKws = newKeywordText
      .split(/[,;\n]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (splitKws.length === 0) return;

    try {
      await apiService.addBiddingKeywordsBulk(selectedVerticalForMgmt, {
        keywords: splitKws,
        tipo: newKeywordTipo,
      });
      setNewKeywordText('');
      await fetchKeywordsForVertical(selectedVerticalForMgmt);
      const updatedVerts = await apiService.getBiddingVerticals();
      if (updatedVerts && updatedVerts.length > 0) {
        setVerticals(updatedVerts);
      }
      setNotification({
        type: 'success',
        message: `Se agregaron ${splitKws.length} palabras clave de ${newKeywordTipo === 'INCLUSION' ? 'inclusión' : 'exclusión'}.`,
      });
    } catch (err: any) {
      console.error('Error agregando keywords:', err);
      setNotification({ type: 'error', message: 'No se pudieron guardar las palabras clave.' });
    }
  };

  const handleDeleteKeyword = async (keywordId: number) => {
    try {
      await apiService.deleteBiddingKeyword(keywordId);
      setCurrentKeywords((prev) => prev.filter((k) => k.id !== keywordId));
      const updatedVerts = await apiService.getBiddingVerticals();
      if (updatedVerts && updatedVerts.length > 0) {
        setVerticals(updatedVerts);
      }
    } catch (err) {
      console.error('Error eliminando keyword:', err);
    }
  };

  const handleExpandKeywordsAI = async (forcedFallback = false, customQuery?: string, customVerticalId?: string) => {
    setIsExpandingAI(true);
    try {
      const vId = customVerticalId || selectedVerticalForMgmt;
      const q = customQuery !== undefined ? customQuery : aiExpandQuery;
      const activeV = verticals.find((v) => v.id === vId);
      const res = await apiService.expandBiddingKeywordsAI({
        vertical_id: vId,
        rubro_nombre: activeV ? activeV.nombre : vId,
        query: q.trim() || undefined,
        model: forcedFallback ? 'FALLBACK_HEURISTICO' : selectedOllamaModel,
        include_exclusions: true,
      });
      setAiExpandResult(res);
      setShowFallbackPrompt(false);
    } catch (err: any) {
      console.error('Error en expansión con IA:', err);
      setNotification({
        type: 'error',
        message: 'Fallo la inferencia local de Ollama. Utilice el Fallback Heurístico Seguro.',
      });
    } finally {
      setIsExpandingAI(false);
    }
  };

  // Tarea 2.2 / Bugfix: Aplicar sugerencia de Ollama directamente a la búsqueda del radar y/o guardarla en la BD
  const handleApplySuggestionToSearch = async (
    term: string,
    targetVerticalId?: string,
    options?: {
      saveToDb?: boolean;
      tipo?: 'INCLUSION' | 'EXCLUSION';
      closeModal?: boolean;
    }
  ) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;

    const vId = targetVerticalId || selectedVerticalForMgmt || (feedNichoFilter !== 'TODAS' ? feedNichoFilter : 'ILUMINACION_EFICIENCIA');

    if (options?.saveToDb) {
      try {
        await apiService.addBiddingKeywordsBulk(vId, {
          keywords: [cleanTerm],
          tipo: options.tipo || 'INCLUSION',
        });
        await fetchKeywordsForVertical(vId);
        const updatedVerts = await apiService.getBiddingVerticals();
        if (updatedVerts && updatedVerts.length > 0) {
          setVerticals(updatedVerts);
        }
        setNotification({
          type: 'success',
          message: `Palabra "${cleanTerm}" guardada en ${vId} e integrada al radar de búsqueda.`,
        });
      } catch (err) {
        console.warn('Error guardando keyword en BD:', err);
      }
    }

    setFeedSearchQuery(cleanTerm);
    if (vId && vId !== 'TODAS') {
      setFeedNichoFilter(vId);
      setSelectedVerticalForMgmt(vId);
    }

    if (options?.closeModal) {
      setIsKeywordsModalOpen(false);
    }

    setIsFeedModalOpen(true);
    await fetchFeed(vId === 'TODAS' ? undefined : vId, cleanTerm);
  };

  // Guardar en bloque todas las sugerencias de la IA y lanzar la búsqueda en el radar
  const handleAddAllSuggestionsAndSearch = async () => {
    if (!aiExpandResult) return;
    const vId = selectedVerticalForMgmt;
    const inclusions = [
      ...(aiExpandResult.sinonimos_sugeridos || []),
      ...(aiExpandResult.keywords_inclusion_sugeridas || []),
    ].filter(Boolean);
    const exclusions = (aiExpandResult.keywords_exclusion_sugeridas || []).filter(Boolean);

    try {
      if (inclusions.length > 0) {
        await apiService.addBiddingKeywordsBulk(vId, {
          keywords: inclusions,
          tipo: 'INCLUSION',
        });
      }
      if (exclusions.length > 0) {
        await apiService.addBiddingKeywordsBulk(vId, {
          keywords: exclusions,
          tipo: 'EXCLUSION',
        });
      }
      await fetchKeywordsForVertical(vId);
      const updatedVerts = await apiService.getBiddingVerticals();
      if (updatedVerts && updatedVerts.length > 0) {
        setVerticals(updatedVerts);
      }

      const searchTerm = aiExpandQuery.trim() || inclusions[0] || '';
      setFeedSearchQuery(searchTerm);
      setFeedNichoFilter(vId);
      setIsKeywordsModalOpen(false);
      setIsFeedModalOpen(true);
      await fetchFeed(vId, searchTerm);

      setNotification({
        type: 'success',
        message: `Se agregaron ${inclusions.length + exclusions.length} términos al rubro ${vId} y se lanzó la búsqueda en el radar.`,
      });
    } catch (err) {
      console.error('Error guardando todas las sugerencias:', err);
      setNotification({
        type: 'error',
        message: 'No se pudieron guardar todas las sugerencias en bloque.',
      });
    }
  };

  const [feedOffset, setFeedOffset] = useState<number>(0);
  const [isFetchingMoreFeed, setIsFetchingMoreFeed] = useState<boolean>(false);

  // Manejo de Carga y Filtrado del Feed de Licitaciones
  const fetchFeed = useCallback(async (nicho?: string, q?: string) => {
    setIsLoadingFeed(true);
    setFeedOffset(0);
    try {
      const resp = await apiService.getTendersLiveFeed({
        nicho: nicho === 'TODAS' ? undefined : nicho,
        q: q ? q.trim() : undefined,
      });
      setFeedItems(resp.items || []);
      setFeedMeta({
        total: resp.total,
        fuente_estado: resp.fuente_estado,
        incluye_demo: resp.incluye_demo,
        analizadas: resp.analizadas,
        descartadas: resp.descartadas,
        mensaje: resp.mensaje,
        actualizado_al: resp.actualizado_al,
      });
    } catch (err: any) {
      console.error('Error al cargar feed de licitaciones:', err);
      setNotification({
        type: 'error',
        message: 'No se pudo conectar con el servicio de feed oficial de compras públicas.',
      });
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  const handleOpenLiveFeed = async () => {
    setIsFeedModalOpen(true);
    await fetchFeed(feedNichoFilter, feedSearchQuery);
  };

  const handleSyncFeedNow = async () => {
    setIsSyncingFeed(true);
    try {
      const targetVertical = feedNichoFilter !== 'TODAS' ? feedNichoFilter : selectedVerticalForMgmt;
      const resp = await apiService.syncTendersFeed({
        model: selectedOllamaModel,
        vertical_id: targetVertical,
        limit: 20,
        offset: 0,
        append_mode: false,
      });
      setFeedItems(resp.items || []);
      setFeedOffset(20);
      setFeedMeta({
        total: resp.total,
        fuente_estado: resp.fuente_estado,
        incluye_demo: resp.incluye_demo,
        analizadas: resp.analizadas,
        descartadas: resp.descartadas,
        mensaje: resp.mensaje,
        actualizado_al: resp.actualizado_al,
      });
      setNotification({
        type: 'success',
        message: `Sincronización con Compras Estatales completada (${selectedOllamaModel}): ${resp.total} llamados relevantes analizados.`,
      });
    } catch (err: any) {
      console.error('Error al sincronizar feed:', err);
      setNotification({
        type: 'error',
        message: 'Fallo al sincronizar contra el portal oficial de Compras Estatales.',
      });
    } finally {
      setIsSyncingFeed(false);
    }
  };

  const handleFetchMoreFeed = async () => {
    setIsFetchingMoreFeed(true);
    try {
      const nextOffset = feedOffset + 20;
      const targetVertical = feedNichoFilter !== 'TODAS' ? feedNichoFilter : selectedVerticalForMgmt;
      const resp = await apiService.syncTendersFeed({
        model: selectedOllamaModel,
        vertical_id: targetVertical,
        limit: 20,
        offset: nextOffset,
        append_mode: true,
      });

      const newItems = resp.items || [];
      setFeedItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const added = newItems.filter((i) => !existingIds.has(i.id));
        return [...prev, ...added];
      });
      setFeedOffset(nextOffset);
      setFeedMeta((prev) => ({
        ...prev,
        analizadas: (prev.analizadas || 0) + (resp.analizadas || 0),
        descartadas: (prev.descartadas || 0) + (resp.descartadas || 0),
        mensaje: resp.mensaje || prev.mensaje,
      }));
      setNotification({
        type: 'success',
        message: `Se consultaron 20 licitaciones adicionales de ARCE.`,
      });
    } catch (err: any) {
      console.error('Error cargando 20 licitaciones más:', err);
      setNotification({
        type: 'error',
        message: 'No se pudieron recuperar más licitaciones del portal.',
      });
    } finally {
      setIsFetchingMoreFeed(false);
    }
  };

  // Tarea 2.2: Sincronización Automática con el Formulario en 1 Clic
  const handleImportToForm = (item: TenderFeedItem) => {
    // 1. Campos de identificación de obra y cliente
    setProyectoNombre(item.titulo);
    setClienteLicitacion(item.organismo);

    // 2. URLs y pliegos técnicos oficiales
    setPliegoUrl(item.pliego_url || '');
    setPliegoPdfRef(item.pdf_nombre_archivo || item.pdf_download_url || '');

    // 3. Plazo de entrega calculado
    const diasCalc = item.plazo_entrega_dias || item.dias_para_apertura || item.plazo_dias_estimado || 30;
    setPlazoEntregaDias(diasCalc);

    if (item.fecha_apertura) {
      const datePart = item.fecha_apertura.split('T')[0];
      setFechaLimiteLicitacion(datePart);
    }

    // 4. Rubro comercial B2B
    if (item.nicho) {
      setNicho(item.nicho);
      setSelectedVerticalForMgmt(item.nicho);
    }

    // 5. Partidas sugeridas
    const candidateSkus = (item.skus_detectados && item.skus_detectados.length > 0)
      ? item.skus_detectados
      : (item.skus_sugeridos_catalogo || []);

    if (candidateSkus.length > 0) {
      setItems(
        candidateSkus.map((sku) => ({
          sku,
          cantidad_solicitada: item.cantidades_sugeridas?.[sku] || (sku === 'LUM-6060' ? 80 : 45),
        }))
      );
    }

    // 6. Cierre del modal y aviso al usuario
    setIsFeedModalOpen(false);
    setNotification({
      type: 'success',
      message: `Licitación '${item.numero_llamado || item.id}' cargada en el cotizador. Verifique las partidas y presione 'Evaluar Factibilidad'.`,
    });
  };

  // Importación con Evaluación Instantánea IA (David & Aristóteles)
  const handleImportFeedItem = async (feedItem: TenderFeedItem) => {
    setImportingFeedId(feedItem.id);
    try {
      const resp = await apiService.importTenderFeedItem({
        feed_item_id: feedItem.id,
        proyecto_nombre: feedItem.titulo,
      });

      setNotification({
        type: 'success',
        message: `Licitación ${feedItem.id} importada y evaluada con IA exitosamente (ID: ${resp.tender_id.slice(0, 8)}).`,
      });

      // Precargar los datos en el cotizador activo
      setProyectoNombre(feedItem.titulo);
      setClienteLicitacion(feedItem.organismo);
      setPliegoUrl(feedItem.pliego_url || '');
      setPliegoPdfRef(feedItem.pdf_nombre_archivo || feedItem.pdf_download_url || '');
      setPlazoEntregaDias(feedItem.plazo_entrega_dias || 30);
      if (feedItem.fecha_apertura) {
        setFechaLimiteLicitacion(feedItem.fecha_apertura.split('T')[0]);
      }

      if (feedItem.skus_detectados && feedItem.skus_detectados.length > 0) {
        setItems(
          feedItem.skus_detectados.map((sku) => ({
            sku,
            cantidad_solicitada: feedItem.cantidades_sugeridas?.[sku] || 50,
          }))
        );
      }

      if (resp.evaluation) {
        setEvaluationResult(resp.evaluation);
        if (resp.evaluation.tasa_cambio_brou) {
          setTasaBrou(resp.evaluation.tasa_cambio_brou);
        }
      }

      // Actualizar listado de licitaciones guardadas
      const updatedList = await apiService.getTenders();
      setSavedTenders(updatedList);

      setIsFeedModalOpen(false);
    } catch (err: any) {
      console.error('Error importing feed item:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Error al importar y evaluar el pliego de licitación.',
      });
    } finally {
      setImportingFeedId(null);
    }
  };

  // Cargar catálogo de inventario y tasa BROU inicial
  const loadInitialData = useCallback(async () => {
    try {
      const [invData, brouData, tendersList] = await Promise.all([
        apiService.getInventoryAlerts().catch(() => []),
        apiService.getBROUExchangeRate().catch(() => ({ rate_used: 40.40 })),
        apiService.getTenders().catch(() => []),
      ]);
      setCatalog(invData);
      setTasaBrou(brouData.rate_used || 40.40);
      setSavedTenders(tendersList);
    } catch (err) {
      console.error('Error loading initial tender data', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Manejo de partidas
  const handleAddItem = () => {
    setItems((prev) => [...prev, { sku: 'LUM-6060', cantidad_solicitada: 50 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof TenderItemSecure, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Presets Rápidos B2B
  const applyPreset = (presetName: string) => {
    if (presetName === 'serlux_conaprole') {
      setProyectoNombre('Ampliación Planta Conaprole Complejo Rincón');
      setClienteLicitacion('Conaprole SA');
      setNicho('ILUMINACION_EFICIENCIA');
      setSelectedVerticalForMgmt('ILUMINACION_EFICIENCIA');
      setPlazoEntregaDias(15);
      setMoneda('USD');
      setMargenPct(35);
      setItems([
        { sku: 'LUM-6060', cantidad_solicitada: 300 }, // Disparará Quiebre (stock 80)
        { sku: 'UFO-150W', cantidad_solicitada: 30 },  // Viable stock (stock 45)
      ]);
    } else if (presetName === 'intendencia_vial') {
      setProyectoNombre('Alumbrado Corredor Accesos & Avenidas');
      setClienteLicitacion('Intendencia de Montevideo');
      setNicho('ILUMINACION_EFICIENCIA');
      setSelectedVerticalForMgmt('ILUMINACION_EFICIENCIA');
      setPlazoEntregaDias(90);
      setMoneda('UYU');
      setMargenPct(32);
      setItems([
        { sku: 'PRY-100W', cantidad_solicitada: 120 },
        { sku: 'DRV-DALI', cantidad_solicitada: 50 },
      ]);
    } else if (presetName === 'oficinas_wtc') {
      setProyectoNombre('Modernización Lumínica Torres WTC');
      setClienteLicitacion('World Trade Center Montevideo');
      setNicho('ILUMINACION_EFICIENCIA');
      setSelectedVerticalForMgmt('ILUMINACION_EFICIENCIA');
      setPlazoEntregaDias(45);
      setMoneda('USD');
      setMargenPct(40);
      setItems([
        { sku: 'LUM-6060', cantidad_solicitada: 60 },
        { sku: 'DRV-DALI', cantidad_solicitada: 15 },
      ]);
    }
  };

  // Ejecutar Evaluación Determinística & Dialéctica
  const handleEvaluate = async () => {
    if (!proyectoNombre.trim() || !clienteLicitacion.trim()) {
      setNotification({ type: 'error', message: 'Nombre de obra y cliente son obligatorios.' });
      return;
    }
    if (items.length === 0) {
      setNotification({ type: 'error', message: 'Debe ingresar al menos una luminaria en la cotización.' });
      return;
    }

    setIsEvaluating(true);
    setEvaluatingStep('david');
    const stepTimer = setTimeout(() => {
      setEvaluatingStep('aristoteles');
    }, 10000);
    setNotification(null);
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
        pliego_url: pliegoUrl.trim() || undefined,
        pliego_pdf_ref: pliegoPdfRef.trim() || undefined,
        fecha_limite_licitacion: fechaLimiteLicitacion || undefined,
        items: items.map((it) => ({
          sku: it.sku.trim().toUpperCase(),
          cantidad_solicitada: Number(it.cantidad_solicitada),
          precio_objetivo_unitario: it.precio_objetivo_unitario ? Number(it.precio_objetivo_unitario) : undefined,
        })),
      };

      const res = await apiService.evaluateTender(payload);
      setEvaluationResult(res);
      setTasaBrou(res.tasa_cambio_brou);
      setNotification({
        type: 'success',
        message: res.alerta_critica
          ? 'Evaluación completada con Alerta de Quiebre Logístico. Revise dictamen de David.'
          : 'Evaluación aprobada con viabilidad logística completa.',
      });
    } catch (err: any) {
      console.error('Error evaluating tender:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Error al evaluar la viabilidad de la licitación.',
      });
    } finally {
      clearTimeout(stepTimer);
      setIsEvaluating(false);
      setEvaluatingStep('idle');
    }
  };

  // Guardar Licitación en Base de Datos
  const handleSaveTender = async () => {
    if (currentRole === 'analista_operaciones') {
      setNotification({
        type: 'error',
        message: 'Acceso Restringido: El rol Operaciones tiene perfil de auditoría técnica y no puede formalizar licitaciones comerciales.',
      });
      return;
    }
    if (!evaluationResult) {
      await handleEvaluate();
    }
    setIsSaving(true);
    try {
      const payload: TenderEvaluateRequest = {
        proyecto_nombre: proyectoNombre.trim(),
        cliente_licitacion: clienteLicitacion.trim(),
        nicho,
        plazo_entrega_dias: Number(plazoEntregaDias),
        moneda,
        margen_comercial_pct: Number(margenPct) / 100.0,
        observaciones: observaciones.trim() || undefined,
        pliego_url: pliegoUrl.trim() || undefined,
        pliego_pdf_ref: pliegoPdfRef.trim() || undefined,
        fecha_limite_licitacion: fechaLimiteLicitacion || undefined,
        items: items.map((it) => ({
          sku: it.sku.trim().toUpperCase(),
          cantidad_solicitada: Number(it.cantidad_solicitada),
        })),
      };

      const saved = await apiService.createTender(payload);
      setNotification({
        type: 'success',
        message: `Licitación guardada exitosamente (ID: ${saved.id.slice(0, 8)}).`,
      });
      const updatedList = await apiService.getTenders();
      setSavedTenders(updatedList);
    } catch (err: any) {
      console.error('Error saving tender:', err);
      setNotification({
        type: 'error',
        message: 'No se pudo guardar la licitación en la base de datos.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Copiar propuesta de email
  const handleCopyEmail = () => {
    if (evaluationResult?.dictamen_aristoteles?.estrategia_completa) {
      navigator.clipboard.writeText(evaluationResult.dictamen_aristoteles.estrategia_completa);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notificación Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-3 text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-[#e74c3c] border border-rose-200 dark:border-rose-800'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Banner con Contexto de Fusión */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl border border-indigo-900/50 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
              Luminar B2B Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono">
              BROU: {tasaBrou.toFixed(2)} UYU
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-200 border border-white/20 uppercase font-mono">
              IA: {engineMode}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 uppercase font-mono">
              Rol: {currentRole}
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Cotizador de Licitaciones & Homologación Lumínica</span>
          </h2>
          <p className="text-xs text-indigo-200/80 max-w-2xl">
            Cálculo determinístico de viabilidad logística con stock en Montevideo vs. importación,
            cruce cambiario oficial y dictamen dialéctico: <strong>Ing. David Jiménez Vera (Rigor UNIT)</strong> vs. <strong>Aristóteles (Estrategia B2B)</strong>.
          </p>
        </div>

        {/* Presets Rápidos & Historial & Feed Oficial */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenLiveFeed}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-cyan-950/40 cursor-pointer transition-all border border-cyan-400/30"
            title="Sintonizar llamados de compras públicas uruguayas en vivo (ARCE, UTE, IMM, OSE)"
          >
            <Globe size={14} className="text-cyan-200" />
            <span>🌐 Licitaciones Públicas en Tiempo Real</span>
          </button>

          <div className="text-[11px] text-indigo-200 font-semibold mx-1">Casos de Prueba B2B:</div>
          <button
            onClick={() => applyPreset('serlux_conaprole')}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/60 text-xs font-medium cursor-pointer transition-colors"
            title="Caso con quiebre de stock en paneles 60x60"
          >
            🏭 Conaprole (Quiebre)
          </button>
          <button
            onClick={() => applyPreset('intendencia_vial')}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/60 text-xs font-medium cursor-pointer transition-colors"
            title="Alumbrado vial en UYU"
          >
            🏛️ Intendencia (Vial)
          </button>
          <button
            onClick={() => applyPreset('oficinas_wtc')}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/60 text-xs font-medium cursor-pointer transition-colors"
            title="Oficinas corporativas WTC"
          >
            🏢 WTC (Oficinas)
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer border border-white/20 transition-colors"
          >
            {showHistory ? 'Ocultar Historial' : `Historial (${savedTenders.length})`}
          </button>
        </div>
      </div>

      {/* Historial Colapsable */}
      {showHistory && (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Licitaciones y Proyectos Evaluados ({savedTenders.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Proyecto / Obra</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Plazo</th>
                  <th className="px-3 py-2">Moneda</th>
                  <th className="px-3 py-2">Monto Ofertado</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {savedTenders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400">
                      No hay licitaciones guardadas aún.
                    </td>
                  </tr>
                ) : (
                  savedTenders.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-mono text-[11px]">{t.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{t.proyecto_nombre}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{t.cliente_licitacion}</td>
                      <td className="px-3 py-2">{t.plazo_entrega_dias} días</td>
                      <td className="px-3 py-2 font-mono">{t.moneda}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(t.total_ofertado)}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-[#00a2e8] text-[10px] font-bold">
                          {t.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid de Configuración del Pliego & Partidas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Parámetros del Pliego (5 cols) */}
        <div className="lg:col-span-5 space-y-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Building2 size={16} className="text-[#00a2e8]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Datos de la Licitación / Obra
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombre de la Obra / Licitación
              </label>
              <input
                type="text"
                required
                value={proyectoNombre}
                onChange={(e) => setProyectoNombre(e.target.value)}
                placeholder="ej. Ampliación Planta Conaprole"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Entidad / Cliente Comitente
              </label>
              <input
                type="text"
                required
                value={clienteLicitacion}
                onChange={(e) => setClienteLicitacion(e.target.value)}
                placeholder="ej. Conaprole SA, Intendencia de Canelones..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                URL del Pliego / Bases de Licitación
              </label>
              <input
                type="url"
                value={pliegoUrl}
                onChange={(e) => setPliegoUrl(e.target.value)}
                placeholder="https://comprasestatales.gub.uy/pliegos/..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Archivo / Ref. Pliego PDF
                </label>
                <input
                  type="text"
                  value={pliegoPdfRef}
                  onChange={(e) => setPliegoPdfRef(e.target.value)}
                  placeholder="ej. PLIEGO-CONAPROLE-2026.pdf"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha Límite (Auto-Plazo)
                </label>
                <input
                  type="date"
                  value={fechaLimiteLicitacion}
                  onChange={(e) => handleFechaLimiteChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Rubro Comercial B2B
                </label>
                <button
                  type="button"
                  onClick={() => handleOpenKeywordsModal(nicho)}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center space-x-1"
                  title="Configurar palabras clave y sinónimos para este rubro"
                >
                  <Settings size={11} />
                  <span>Configurar Keywords</span>
                </button>
              </div>
              <select
                value={nicho}
                onChange={(e) => {
                  const val = e.target.value;
                  setNicho(val);
                  setSelectedVerticalForMgmt(val);
                  setFeedNichoFilter(val);
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none font-semibold text-xs"
              >
                {verticals.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.icon} {v.nombre}
                  </option>
                ))}
              </select>
              {(() => {
                const activeV = verticals.find((v) => v.id === nicho);
                if (!activeV) return null;
                return (
                  <p className="text-[11px] text-slate-400 mt-1 italic">
                    {activeV.descripcion || 'Especialidad B2B configurada para filtrado y análisis de pliegos.'}
                  </p>
                );
              })()}
            </div>

            <div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Plazo de Entrega (Días)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={plazoEntregaDias}
                  onChange={(e) => setPlazoEntregaDias(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Moneda de Oferta
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setMoneda('USD')}
                    className={`flex-1 py-2 font-bold transition-colors cursor-pointer ${
                      moneda === 'USD'
                        ? 'bg-[#00a2e8] text-white'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoneda('UYU')}
                    className={`flex-1 py-2 font-bold transition-colors cursor-pointer ${
                      moneda === 'UYU'
                        ? 'bg-[#00a2e8] text-white'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    UYU ($)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Margen Comercial Deseado
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="80"
                    value={margenPct}
                    onChange={(e) => setMargenPct(Number(e.target.value))}
                    className="w-full p-2.5 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-bold">%</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Requerimientos Técnicos del Pliego / Observaciones
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones de fotometría, UGR, marca de driver..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#00a2e8] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Columna Derecha: Partidas de Luminarias (7 cols) */}
        <div className="lg:col-span-7 space-y-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Layers size={16} className="text-[#00a2e8]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Luminarias Solicitadas ({items.length} partidas)
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus size={13} />
                <span>Agregar Luminaria</span>
              </button>
            </div>

            {/* Listado dinámico de ítems */}
            <div className="space-y-3 pt-3 overflow-y-auto max-h-[360px]">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Modelo / SKU</label>
                    <select
                      value={item.sku}
                      onChange={(e) => handleUpdateItem(idx, 'sku', e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs font-semibold"
                    >
                      <optgroup label="Perfil Serlux / Iluminación Técnica">
                        <option value="LUM-6060">LUM-6060: Panel LED 60x60 40W 4000K UGR&lt;19 (Stock: 80u)</option>
                        <option value="UFO-150W">UFO-150W: Campana Industrial 150W IP65 (Stock: 45u)</option>
                        <option value="DRV-DALI">DRV-DALI: Driver Regulable DALI-2 50W (Stock: 15u)</option>
                        <option value="PRY-100W">PRY-100W: Proyector Exterior 100W (Stock: 420u)</option>
                      </optgroup>
                      <optgroup label="Otros SKUs Registrados">
                        {catalog
                          .filter((c) => !['LUM-6060', 'UFO-150W', 'DRV-DALI', 'PRY-100W'].includes(c.sku))
                          .map((c) => (
                            <option key={c.sku} value={c.sku}>
                              {c.sku}: {c.nombre} (Stock: {c.stock_actual}u)
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="w-28 space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Cantidad (u)</label>
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad_solicitada}
                      onChange={(e) => handleUpdateItem(idx, 'cantidad_solicitada', Number(e.target.value))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono font-bold text-xs"
                    />
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-2 self-end sm:self-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                      title="Eliminar partida"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Botonera de Acción */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={handleSaveTender}
              disabled={isSaving || !evaluationResult}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Save size={15} />
              <span>{isSaving ? 'Guardando...' : 'Guardar en BD'}</span>
            </button>

            <button
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#00a2e8] hover:bg-[#0092d0] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Sparkles size={16} className={isEvaluating ? 'animate-spin' : ''} />
              <span>{isEvaluating ? 'Calculando con David & Aristóteles...' : '⚡ Evaluar Factibilidad & Dialéctica'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Estado de Carga: Indicador de Pensamiento Dialéctico Multi-Agente */}
      {isEvaluating && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-amber-950 text-white border border-indigo-500/40 shadow-xl space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center">
                <Sparkles className="animate-spin text-amber-400" size={20} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Ollama qwen2.5:7b Local
                  </span>
                  <span className="text-[11px] text-indigo-200">Inferencia encadenada en curso</span>
                </div>
                <h4 className="text-sm font-bold text-white">
                  {evaluatingStep === 'david'
                    ? '🏛️ Ing. David analizando pliego, fotometría y curvas .IES...'
                    : '⚖️ Aristóteles estructurando propuesta comercial y retórica B2B...'}
                </h4>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono">
              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                evaluatingStep === 'david'
                  ? 'bg-indigo-600 text-white border-indigo-400 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700'
              }`}>
                <span>1. Auditoría David</span>
                {evaluatingStep === 'david' && <span className="animate-pulse">●</span>}
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                evaluatingStep === 'aristoteles'
                  ? 'bg-amber-600 text-white border-amber-400 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700'
              }`}>
                <span>2. Réplica Aristóteles</span>
                {evaluatingStep === 'aristoteles' && <span className="animate-pulse">●</span>}
              </div>
            </div>
          </div>

          <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-indigo-500 to-amber-400 transition-all duration-1000 ${
                evaluatingStep === 'david' ? 'w-1/2' : 'w-full'
              }`}
            />
          </div>
        </div>
      )}

      {/* Resultados de la Evaluación */}
      {evaluationResult && (
        <div className="space-y-6 animate-in fade-in">
          {/* Métricas Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title={`Total Ofertado (${evaluationResult.moneda})`}
              value={formatCurrency(evaluationResult.total_ofertado)}
              icon={DollarSign}
              badge={{
                text: `${evaluationResult.margen_total_pct.toFixed(1)}% Margen`,
                variant: 'success',
              }}
              subtitle={`Costo base: ${formatCurrency(evaluationResult.total_costo)}`}
            />

            <MetricCard
              title="Viabilidad Logística"
              value={evaluationResult.alerta_critica ? 'QUIEBRE CRÍTICO' : 'VIABLE EN PLAZA'}
              icon={evaluationResult.alerta_critica ? AlertTriangle : ShieldCheck}
              badge={{
                text: evaluationResult.alerta_critica ? 'Riesgo Alto' : 'Óptimo',
                variant: evaluationResult.alerta_critica ? 'danger' : 'success',
              }}
              subtitle={`Plazo oficial: ${evaluationResult.plazo_entrega_dias} días`}
            />

            <MetricCard
              title="Ahorro Energético (ROI)"
              value={`${evaluationResult.dictamen_david.roi_energetico.ahorro_energetico_pct}%`}
              icon={Zap}
              badge={{
                text: `${evaluationResult.dictamen_david.roi_energetico.meses_retorno_roi}m Payback`,
                variant: 'info',
              }}
              subtitle={`USD ${Math.round(evaluationResult.dictamen_david.roi_energetico.ahorro_dolares_anual).toLocaleString()} ahorro/año`}
            />

            <MetricCard
              title="Estándar UNIT"
              value={`${evaluationResult.dictamen_david.lux_objetivo} Lux`}
              icon={TrendingUp}
              badge={{
                text: `UGR < ${evaluationResult.dictamen_david.ugr_maximo}`,
                variant: 'info',
              }}
              subtitle={evaluationResult.dictamen_david.norma_aplicable.split('/')[0]}
            />
          </div>

          {/* Tabla de Desglose de Partidas con Badges Logísticos */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Desglose Logístico & Económico por Partida
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                Tasa BROU: {evaluationResult.tasa_cambio_brou.toFixed(2)} UYU
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Luminaria / SKU</th>
                    <th className="px-4 py-3">Cant.</th>
                    <th className="px-4 py-3">Stock MVD</th>
                    <th className="px-4 py-3">Lead Time</th>
                    <th className="px-4 py-3">Viabilidad Logística</th>
                    <th className="px-4 py-3">Costo Unit.</th>
                    <th className="px-4 py-3">Precio Sugerido</th>
                    <th className="px-4 py-3">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {evaluationResult.items.map((it: TenderItemEvaluationResult) => {
                    const isCritico = it.viabilidad_logistica === 'QUIEBRE_LOGISTICO_CRITICO';
                    const isInmediato = it.viabilidad_logistica === 'VIABLE_STOCK_INMEDIATO';
                    return (
                      <tr key={it.sku} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{it.sku}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">{it.descripcion}</div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">{it.cantidad_solicitada}</td>
                        <td className="px-4 py-3 font-mono">{it.stock_deposito} u.</td>
                        <td className="px-4 py-3 font-mono">{Math.round(it.lead_time_dias)} días</td>
                        <td className="px-4 py-3">
                          {isInmediato ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 size={12} />
                              <span>Stock Inmediato</span>
                            </span>
                          ) : isCritico ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-[#e74c3c] border border-rose-200 dark:border-rose-800">
                              <AlertTriangle size={12} />
                              <span>Quiebre: Faltan {it.unidades_faltantes}u ({it.dias_retraso_estimado}d retraso)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-[#f39c12] border border-amber-200 dark:border-amber-800">
                              <Clock size={12} />
                              <span>Tránsito / Importación</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {formatCurrency(it.costo_unitario_moneda)}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency(it.precio_sugerido_unitario)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(it.subtotal_precio)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Consola de Dictamen Dialéctico Generativo (David vs. Aristóteles) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header de la Consola */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-bold text-[#00a2e8] tracking-wider">
                    Módulo Dialéctico B2B • Inferencia Local
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                    {evaluationResult.dictamen_david.modelo_utilizado || 'qwen2.5:7b'}
                  </span>
                  {evaluationResult.dictamen_aristoteles.latency_ms && (
                    <span className="text-[10px] font-mono text-slate-500">
                      ({(evaluationResult.dictamen_aristoteles.latency_ms / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                  <span>Debate de Ingeniería & Estrategia Retórica Comercial</span>
                </h3>
              </div>

              {/* Selector de Paneles */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => setActiveDialecticTab('both')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activeDialecticTab === 'both'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ⚔️ Debate Completo (2 Col)
                </button>
                <button
                  onClick={() => setActiveDialecticTab('david')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activeDialecticTab === 'david'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  🏛️ David (Técnico UNIT)
                </button>
                <button
                  onClick={() => setActiveDialecticTab('aristoteles')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activeDialecticTab === 'aristoteles'
                      ? 'bg-white dark:bg-slate-900 text-amber-500 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ⚖️ Aristóteles (Comercial)
                </button>
                <button
                  onClick={() => setActiveDialecticTab('email')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activeDialecticTab === 'email'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ✉️ Propuesta Formal (Email)
                </button>
              </div>
            </div>

            {/* Contenido de Paneles */}
            <div className="p-6">
              {/* VISTA 1: Ambos Agentes en Grilla de 2 Columnas */}
              {activeDialecticTab === 'both' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Tarjeta Azul Marino / Acero (Ing. David Jiménez Vera) */}
                  <div className="bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 p-5 space-y-4 shadow-md flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Header David */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold text-sm">
                            DJ
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                🏛️ Dictamen Electrotécnico & Normativo UNIT
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-white">
                              {evaluationResult.dictamen_david.agente}
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              {evaluationResult.dictamen_david.cargo}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
                            UGR &lt; {evaluationResult.dictamen_david.ugr_maximo}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 font-semibold">
                            {evaluationResult.dictamen_david.lux_objetivo} Lux
                          </span>
                        </div>
                      </div>

                      {/* Semáforo de Plazo & Homologación */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-900/80 rounded-2xl border border-slate-800 text-[11px]">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-400">Compatibilidad:</span>
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                            <CheckCircle2 size={12} />
                            <span>UNIT 180 Aprobada</span>
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-400">Plazo vs Marítimo (60d):</span>
                          {evaluationResult.dictamen_david.semaforo_plazo === 'VERDE' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                              <span>🟢 Seguro (&gt;60d)</span>
                            </span>
                          ) : evaluationResult.dictamen_david.semaforo_plazo === 'AMARILLO' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                              <span>🟡 Moderado (30-60d)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold bg-rose-950 text-rose-300 border border-rose-800 text-[10px]">
                              <span>🔴 Crítico (&lt;30d)</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sustitución Local Sugerida en caso de Quiebre */}
                      {evaluationResult.dictamen_david.sustitucion_local_sugerida && (
                        <div className={`p-3 rounded-2xl border text-[11px] leading-relaxed ${
                          evaluationResult.alerta_critica
                            ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                            : 'bg-indigo-950/30 border-indigo-800/50 text-indigo-200'
                        }`}>
                          <div className="font-bold flex items-center space-x-1.5 mb-1">
                            <Layers size={13} className={evaluationResult.alerta_critica ? 'text-rose-400' : 'text-indigo-400'} />
                            <span>Plan de Sustitución & Homologación Local:</span>
                          </div>
                          <p>{evaluationResult.dictamen_david.sustitucion_local_sugerida}</p>
                        </div>
                      )}

                      {/* Cuerpo Markdown David */}
                      <div className="text-xs text-slate-300 leading-relaxed max-h-[500px] overflow-y-auto pr-2 space-y-2">
                        <ReactMarkdown>
                          {cleanMarkdown(evaluationResult.dictamen_david.dictamen_completo)}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {evaluationResult.alerta_critica && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px] flex items-center space-x-2">
                        <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                        <span>Alerta de quiebre activo: Requiere homologación por partidas con stock en plaza Montevideo.</span>
                      </div>
                    )}
                  </div>

                  {/* Tarjeta Ámbar / Dorada (Aristóteles) */}
                  <div className="bg-[#181308] dark:bg-[#140f06] text-amber-50 rounded-3xl border border-amber-900/40 p-5 space-y-4 shadow-md flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Header Aristóteles */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-900/40">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold text-sm">
                            <Scale size={18} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#f39c12]">
                                ⚖️ Estrategia Retórica B2B & Propuesta
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-amber-100">
                              Aristóteles
                            </h4>
                            <p className="text-[11px] text-amber-300/70">
                              Director Estratégico de Cierre Comercial B2B
                            </p>
                          </div>
                        </div>

                        {/* Botón Destacado: Copiar Propuesta Formal */}
                        <button
                          onClick={handleCopyEmail}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shadow-md transition-colors self-start sm:self-auto"
                        >
                          {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedEmail ? '¡Copiado!' : '📋 Copiar Propuesta Formal'}</span>
                        </button>
                      </div>

                      {/* Lema Estratégico */}
                      <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-xs text-amber-200 italic">
                        "{evaluationResult.dictamen_aristoteles.frase_fuerza}"
                      </div>

                      {/* Cuerpo Markdown Aristóteles */}
                      <div className="text-xs text-amber-100/90 leading-relaxed max-h-[440px] overflow-y-auto pr-2 space-y-2">
                        <ReactMarkdown>
                          {cleanMarkdown(evaluationResult.dictamen_aristoteles.estrategia_completa)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VISTA 2: David Full Width */}
              {activeDialecticTab === 'david' && (
                <div className="bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-md">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold text-base">
                        DJ
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                          🏛️ Dictamen Electrotécnico & Normativo UNIT
                        </span>
                        <h4 className="font-bold text-base text-white">
                          {evaluationResult.dictamen_david.agente}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {evaluationResult.dictamen_david.cargo}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
                      {evaluationResult.dictamen_david.norma_aplicable}
                    </span>
                  </div>

                  <div className="text-xs text-slate-200 leading-relaxed max-h-[600px] overflow-y-auto pr-2 space-y-3">
                    <ReactMarkdown>
                      {cleanMarkdown(evaluationResult.dictamen_david.dictamen_completo)}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* VISTA 3: Aristóteles Full Width */}
              {activeDialecticTab === 'aristoteles' && (
                <div className="bg-[#181308] dark:bg-[#140f06] text-amber-50 rounded-3xl border border-amber-900/40 p-6 space-y-4 shadow-md">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-900/40">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold text-base">
                        <Scale size={22} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#f39c12]">
                          ⚖️ Estrategia Retórica B2B & Negociación
                        </span>
                        <h4 className="font-bold text-base text-amber-100">
                          Aristóteles
                        </h4>
                        <p className="text-xs text-amber-300/70">
                          Director Estratégico de Cierre Comercial B2B
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleCopyEmail}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shadow-md transition-colors"
                    >
                      {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedEmail ? '¡Copiado!' : '📋 Copiar Propuesta Formal'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-sm font-semibold text-amber-200 italic">
                    "{evaluationResult.dictamen_aristoteles.frase_fuerza}"
                  </div>

                  <div className="text-xs text-amber-100/90 leading-relaxed max-h-[600px] overflow-y-auto pr-2 space-y-3">
                    <ReactMarkdown>
                      {cleanMarkdown(evaluationResult.dictamen_aristoteles.estrategia_completa)}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* VISTA 4: Propuesta Formal para Email */}
              {activeDialecticTab === 'email' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40">
                    <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                      <Mail size={16} className="text-[#00a2e8]" />
                      <span>Propuesta ejecutiva lista para copiar y enviar a <strong>{evaluationResult.cliente_licitacion}</strong></span>
                    </div>
                    <button
                      onClick={handleCopyEmail}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-md transition-colors"
                    >
                      {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedEmail ? '¡Copiado al portapapeles!' : '📋 Copiar Propuesta Formal'}</span>
                    </button>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-sans text-xs leading-relaxed max-h-[600px] overflow-y-auto text-slate-800 dark:text-slate-200 space-y-3">
                    <ReactMarkdown>
                      {cleanMarkdown(evaluationResult.dictamen_aristoteles.estrategia_completa)}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL / DRAWER: Feed de Licitaciones Públicas B2B (ARCE / UTE / IMM / OSE - SERLUX) */}
      {isFeedModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 md:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-400 text-slate-950 uppercase tracking-wider flex items-center space-x-1">
                    <Globe size={11} />
                    <span>Radar ARCE · Compras Estatales Uruguay</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-cyan-200 border border-white/20 font-mono">
                    Calcu B2B Multi-Rubro
                  </span>
                  {feedMeta.fuente_estado === 'LIVE' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      🟢 En Vivo (RSS OCDS)
                    </span>
                  ) : feedMeta.incluye_demo ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40" title="Sin llamados activos en el RSS para las keywords; mostrando ejemplos de demostración">
                      🟡 Banco Multi-Rubro Verificado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40">
                      ⚪ Offline / En Espera
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>Licitaciones Públicas B2B en Tiempo Real (Uruguay)</span>
                </h3>
                <p className="text-xs text-indigo-200/80 max-w-3xl">
                  Filtrado determinístico y semántico asistido por <strong>Agente Ollama Local</strong> sobre convocatorias de comprasestatales.gub.uy. Pliegos verificados, enlaces oficiales y precarga automática en el cotizador.
                </p>
              </div>

              {/* Selector de Modelo Ollama y Botón de Gestión */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center space-x-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20 text-xs">
                  <Bot size={14} className="text-cyan-300" />
                  <span className="text-[10px] text-slate-300 font-medium">Modelo Ollama:</span>
                  <select
                    value={selectedOllamaModel}
                    onChange={(e) => setSelectedOllamaModel(e.target.value)}
                    className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
                    title="Seleccione el modelo local de Ollama para clasificación y sugerencias"
                  >
                    {availableOllamaModels.map((m) => (
                      <option key={m} value={m} className="bg-slate-900 text-white">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => handleOpenKeywordsModal(feedNichoFilter !== 'TODAS' ? feedNichoFilter : undefined)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                  title="Configurar los 7 rubros y gestionar palabras clave de inclusión/exclusión"
                >
                  <Settings size={13} />
                  <span>Configurar Rubros & Keywords</span>
                </button>
                <button
                  onClick={() => setIsFeedModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  title="Cerrar ventana"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Barra de Filtros, Nichos y Sincronización */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Selector Rápido Dropdown + Tabs Dinámicas por Vertical Comercial */}
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar max-w-full md:max-w-[65%]">
                {/* Selector Dropdown de Rubro */}
                <div className="shrink-0 flex items-center space-x-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Rubro:</span>
                  <select
                    value={feedNichoFilter}
                    onChange={(e) => {
                      const vId = e.target.value;
                      setFeedNichoFilter(vId);
                      if (vId !== 'TODAS') {
                        setSelectedVerticalForMgmt(vId);
                      }
                      fetchFeed(vId, feedSearchQuery);
                    }}
                    className="bg-transparent text-slate-800 dark:text-slate-100 font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="TODAS">🌐 Todos los Rubros ({feedMeta.total})</option>
                    {verticals.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.icon} {v.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tabs Horizontales */}
                <button
                  onClick={() => {
                    setFeedNichoFilter('TODAS');
                    fetchFeed('TODAS', feedSearchQuery);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    feedNichoFilter === 'TODAS'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Todas ({feedMeta.total})
                </button>
                {verticals.map((v) => {
                  const isSelected = feedNichoFilter === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setFeedNichoFilter(v.id);
                        setSelectedVerticalForMgmt(v.id);
                        fetchFeed(v.id, feedSearchQuery);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 border ${
                        isSelected
                          ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{v.icon}</span>
                      <span>{v.nombre.split('&')[0].trim()}</span>
                      {v.keywords_count !== undefined && (
                        <span className="text-[10px] opacity-75 font-mono">({v.keywords_count})</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Búsqueda y Botón de Sincronización Manual */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1 md:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={feedSearchQuery}
                    onChange={(e) => setFeedSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        fetchFeed(feedNichoFilter, feedSearchQuery);
                      }
                    }}
                    placeholder="Buscar por organismo, término..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => fetchFeed(feedNichoFilter, feedSearchQuery)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                  title="Aplicar búsqueda"
                >
                  Filtrar
                </button>
                <button
                  onClick={handleSyncFeedNow}
                  disabled={isSyncingFeed}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50 transition-all shrink-0"
                  title="Consultar los últimos releases de ARCE en vivo"
                >
                  <RefreshCw size={13} className={isSyncingFeed ? 'animate-spin' : ''} />
                  <span>{isSyncingFeed ? 'Sincronizando...' : '🔄 Sincronizar ARCE'}</span>
                </button>
              </div>
            </div>

            {/* Chips de Búsqueda Rápida 1-Clic Multi-Rubro */}
            <div className="px-6 py-2 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                Atajos de pliegos uruguayos:
              </span>
              <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                {QUICK_CHIPS.map((chip) => {
                  const isActive = feedSearchQuery.toLowerCase() === chip.query.toLowerCase();
                  return (
                    <button
                      key={chip.label}
                      onClick={() => {
                        setFeedSearchQuery(chip.query);
                        setFeedNichoFilter(chip.nicho);
                        fetchFeed(chip.nicho, chip.query);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                      title={`Filtrar por ${chip.query}`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
                {feedSearchQuery && (
                  <button
                    onClick={() => {
                      setFeedSearchQuery('');
                      fetchFeed(feedNichoFilter, '');
                    }}
                    className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 cursor-pointer transition-colors shrink-0"
                    title="Limpiar búsqueda"
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Sub-barra de Telemetría */}
            {(feedMeta.analizadas !== undefined || feedMeta.mensaje) && (
              <div className="px-6 py-2 bg-slate-100/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <div>
                  {feedMeta.analizadas !== undefined && (
                    <span>
                      Auditoría de Ingesta: <strong>{feedMeta.analizadas}</strong> analizadas · <strong>{feedMeta.descartadas || 0}</strong> descartadas por rubro ajeno.
                    </span>
                  )}
                  {feedMeta.mensaje && (
                    <span className="ml-2 text-slate-600 dark:text-slate-300">
                      ({feedMeta.mensaje})
                    </span>
                  )}
                </div>
                {feedMeta.actualizado_al && (
                  <span className="font-mono text-[10px]">
                    Actualizado: {new Date(feedMeta.actualizado_al).toLocaleTimeString('es-UY')}
                  </span>
                )}
              </div>
            )}

            {/* Modal Body: Lista de Llamados */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {isLoadingFeed ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-500">
                  <Loader2 className="animate-spin text-cyan-500" size={36} />
                  <p className="text-sm font-semibold">Consultando llamados y clasificando pertinencia con Agente Ollama ({selectedOllamaModel})...</p>
                  <p className="text-xs text-slate-400">Verificando pliegos oficiales en Compras Estatales y aplicando matriz de palabras clave.</p>
                </div>
              ) : feedItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-4 max-w-xl mx-auto">
                  <FileText size={42} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      No se encontraron llamados para {feedSearchQuery ? `"${feedSearchQuery}"` : 'el filtro seleccionado'}.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      En compras públicas uruguayas los pliegos suelen redactarse con terminología formal o sinónimos alternativos.
                    </p>
                  </div>

                  {/* Sugerencias de Sinónimos de la IA Local y Botón de Consulta Dinámica */}
                  <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-left space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                        <Sparkles size={14} className="text-indigo-500 animate-pulse" />
                        <span>Sugerencias de Búsqueda de la IA ({selectedOllamaModel}):</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExpandKeywordsAI(false, feedSearchQuery || undefined, feedNichoFilter !== 'TODAS' ? feedNichoFilter : undefined)}
                          disabled={isExpandingAI}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-xs cursor-pointer flex items-center space-x-1.5 transition-all"
                          title="Consultar al modelo local de Ollama para expandir sinónimos de este rubro"
                        >
                          {isExpandingAI ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Analizando ({aiExpandElapsedSeconds}s)...</span>
                            </>
                          ) : (
                            <>
                              <Bot size={12} />
                              <span>🧠 Pedir Sugerencias a Ollama</span>
                            </>
                          )}
                        </button>
                        {isExpandingAI && (
                          <button
                            onClick={() => handleExpandKeywordsAI(true, feedSearchQuery || undefined, feedNichoFilter !== 'TODAS' ? feedNichoFilter : undefined)}
                            className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-xs transition-colors"
                            title="Activar fallback heurístico seguro inmediato"
                          >
                            ⚡ Fallback Inmediato
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setAiExpandQuery(feedSearchQuery);
                            handleOpenKeywordsModal(feedNichoFilter !== 'TODAS' ? feedNichoFilter : undefined);
                          }}
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center space-x-1"
                        >
                          <span>Gestionar Rubro</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Si la IA generó sugerencias, mostrarlas con prioridad y acciones de 1-clic */}
                    {aiExpandResult && (aiExpandResult.sinonimos_sugeridos?.length > 0 || aiExpandResult.keywords_inclusion_sugeridas?.length > 0) && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                            <Sparkles size={12} />
                            <span>Propuestas del Agente Local ({aiExpandResult.model_used}):</span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Haga clic en el término para buscar, o en '+' para guardar y buscar
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            ...(aiExpandResult.sinonimos_sugeridos || []),
                            ...(aiExpandResult.keywords_inclusion_sugeridas || []),
                          ].map((term) => (
                            <div
                              key={term}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(term, feedNichoFilter !== 'TODAS' ? feedNichoFilter : undefined)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center space-x-1 cursor-pointer transition-colors"
                                title={`Buscar pliegos con "${term}" inmediatamente`}
                              >
                                <span>🔍 {term}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(term, feedNichoFilter !== 'TODAS' ? feedNichoFilter : undefined, { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${term}" en el rubro e iniciar búsqueda`}
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sugerencias Canónicas por Rubro con Botones de 1 Clic */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Atajos recomendados para pliegos de este rubro:
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(feedNichoFilter === 'ILUMINACION_EFICIENCIA' || feedSearchQuery.toLowerCase().includes('luz') || feedSearchQuery.toLowerCase().includes('foco')) && (
                          ['luminaria', 'proyector', 'panel led', 'campana high bay', 'driver dali', 'alumbrado publico'].map((syn) => (
                            <div
                              key={syn}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'ILUMINACION_EFICIENCIA')}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                                title={`Buscar "${syn}"`}
                              >
                                🔍 {syn}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'ILUMINACION_EFICIENCIA', { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${syn}" en Iluminación y buscar`}
                              >
                                +
                              </button>
                            </div>
                          ))
                        )}
                        {(feedNichoFilter === 'MOBILIARIO_EQUIPAMIENTO' || feedSearchQuery.toLowerCase().includes('mueble') || feedSearchQuery.toLowerCase().includes('silla')) && (
                          ['silla giratoria', 'armario metalico', 'escritorio operativo', 'mostrador', 'puesto de trabajo'].map((syn) => (
                            <div
                              key={syn}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'MOBILIARIO_EQUIPAMIENTO')}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                                title={`Buscar "${syn}"`}
                              >
                                🔍 {syn}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'MOBILIARIO_EQUIPAMIENTO', { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${syn}" en Mobiliario y buscar`}
                              >
                                +
                              </button>
                            </div>
                          ))
                        )}
                        {(feedNichoFilter === 'OBRA_CIVIL_CONSTRUCCION' || feedSearchQuery.toLowerCase().includes('obra') || feedSearchQuery.toLowerCase().includes('construccion')) && (
                          ['tabiqueria yeso', 'drywall', 'cielorraso', 'impermeabilizacion', 'albanileria'].map((syn) => (
                            <div
                              key={syn}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'OBRA_CIVIL_CONSTRUCCION')}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                                title={`Buscar "${syn}"`}
                              >
                                🔍 {syn}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'OBRA_CIVIL_CONSTRUCCION', { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${syn}" en Obra Civil y buscar`}
                              >
                                +
                              </button>
                            </div>
                          ))
                        )}
                        {(feedNichoFilter === 'ELECTROMECANICA_SUMINISTROS' || feedSearchQuery.toLowerCase().includes('electr')) && (
                          ['tablero electrico', 'termomagnetica', 'disyuntor', 'cable subterraneo', 'generador'].map((syn) => (
                            <div
                              key={syn}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'ELECTROMECANICA_SUMINISTROS')}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                                title={`Buscar "${syn}"`}
                              >
                                🔍 {syn}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'ELECTROMECANICA_SUMINISTROS', { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${syn}" en Electromecánica y buscar`}
                              >
                                +
                              </button>
                            </div>
                          ))
                        )}
                        {(feedNichoFilter === 'EQUIPAMIENTO_HOSPITALARIO' || feedSearchQuery.toLowerCase().includes('salud') || feedSearchQuery.toLowerCase().includes('hospital')) && (
                          ['camilla de transporte', 'mobiliario clinico', 'acero inoxidable', 'autoclave', 'negatoscopio'].map((syn) => (
                            <div
                              key={syn}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'EQUIPAMIENTO_HOSPITALARIO')}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                                title={`Buscar "${syn}"`}
                              >
                                🔍 {syn}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'EQUIPAMIENTO_HOSPITALARIO', { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${syn}" en Hospitalario y buscar`}
                              >
                                +
                              </button>
                            </div>
                          ))
                        )}
                        {(feedNichoFilter === 'TECNOLOGIA_REDES' || feedSearchQuery.toLowerCase().includes('red') || feedSearchQuery.toLowerCase().includes('comput')) && (
                          ['rack 42u', 'switch administrable', 'fibra optica', 'patch cord cat6a', 'ups online'].map((syn) => (
                            <div
                              key={syn}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'TECNOLOGIA_REDES')}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                                title={`Buscar "${syn}"`}
                              >
                                🔍 {syn}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'TECNOLOGIA_REDES', { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${syn}" en Tecnología y buscar`}
                              >
                                +
                              </button>
                            </div>
                          ))
                        )}
                        {(feedNichoFilter === 'SERVICIOS_LIMPIEZA_MANTENIMIENTO' || feedSearchQuery.toLowerCase().includes('limpi') || feedSearchQuery.toLowerCase().includes('servicio')) && (
                          ['servicio de limpieza', 'limpieza integral', 'higiene y desinfeccion', 'mantenimiento edilicio', 'areas verdes'].map((syn) => (
                            <div
                              key={syn}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'SERVICIOS_LIMPIEZA_MANTENIMIENTO')}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                                title={`Buscar "${syn}"`}
                              >
                                🔍 {syn}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, 'SERVICIOS_LIMPIEZA_MANTENIMIENTO', { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${syn}" en Servicios y buscar`}
                              >
                                +
                              </button>
                            </div>
                          ))
                        )}
                        {feedNichoFilter === 'TODAS' && (
                          ['columnas alumbrado', 'sillas operativas', 'obra civil yeso', 'tableros electricos', 'servicio de limpieza', 'racks servidores'].map((syn) => (
                            <div
                              key={syn}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, undefined)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                                title={`Buscar "${syn}" en todos los rubros`}
                              >
                                🔍 {syn}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(syn, undefined, { saveToDb: true, tipo: 'INCLUSION' })}
                                className="px-1.5 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${syn}" e iniciar búsqueda`}
                              >
                                +
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setFeedSearchQuery('');
                        fetchFeed(feedNichoFilter, '');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Limpiar Filtros y Ver Todas
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedItems.map((item) => {
                    const isImporting = importingFeedId === item.id;
                    const orgName = item.organismo || '';
                    const isMob = item.nicho === 'MOBILIARIO_CORPORATIVO';

                    const orgBadgeColor =
                      orgName.includes('UTE')
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        : orgName.includes('IMM') || orgName.includes('Montevideo')
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                        : orgName.includes('BROU')
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : orgName.includes('OSE')
                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                        : orgName.includes('ANTEL')
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';

                    const nichoBadgeColor = isMob
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border-amber-300 dark:border-amber-800';

                    const candidateSkus = (item.skus_detectados && item.skus_detectados.length > 0)
                      ? item.skus_detectados
                      : (item.skus_sugeridos_catalogo || []);

                    const hasCatalogSkus = candidateSkus.length > 0;

                    return (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-500/50 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1">
                          {/* Encabezado con Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${orgBadgeColor}`}>
                              {orgName.includes('Montevideo') ? '🏛️ IMM' : orgName.includes('UTE') ? '⚡ UTE' : orgName.includes('BROU') ? '🏦 BROU' : orgName.includes('OSE') ? '💧 OSE' : orgName.includes('ANTEL') ? '📡 ANTEL' : '🏢 ' + orgName}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${nichoBadgeColor} flex items-center space-x-1`}>
                              {isMob ? <Armchair size={11} /> : <Lightbulb size={11} />}
                              <span>{isMob ? 'Mobiliario Corporativo' : 'Iluminación Técnica'}</span>
                            </span>
                            {item.es_demo && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                Demostración
                              </span>
                            )}
                            <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {item.numero_llamado || item.id}
                            </span>
                            {item.fecha_apertura && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center space-x-1">
                                <Clock size={11} />
                                <span>Apertura: {new Date(item.fecha_apertura).toLocaleDateString('es-UY')} ({item.dias_para_apertura ?? item.plazo_entrega_dias ?? 15}d)</span>
                              </span>
                            )}
                          </div>

                          {/* Título Oficial */}
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                            {item.titulo}
                          </h4>

                          {/* Resumen de Necesidad */}
                          {item.resumen_necesidad && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                              {item.resumen_necesidad}
                            </p>
                          )}

                          {/* Cita / Snippet de Coincidencia en Pliego */}
                          {item.snippet_coincidencia && (
                            <blockquote className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border-l-4 border-amber-500 text-xs italic text-slate-700 dark:text-slate-300">
                              "{item.snippet_coincidencia}"
                            </blockquote>
                          )}

                          {/* Tags de Palabras Clave Detectadas */}
                          {item.keywords_detectadas && item.keywords_detectadas.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] font-semibold text-slate-400">Coincidencias clave:</span>
                              {item.keywords_detectadas.map((kw) => (
                                <span
                                  key={kw}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 flex items-center space-x-1"
                                >
                                  <Tag size={9} />
                                  <span>{kw}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Métricas y SKUs Detectados */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 pt-1">
                            {item.monto_estimado_usd !== null && item.monto_estimado_usd !== undefined && item.monto_estimado_usd > 0 && (
                              <div>
                                <span className="text-slate-400 font-medium">Presupuesto Estimado: </span>
                                <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(item.monto_estimado_usd)}
                                </strong>
                              </div>
                            )}

                            {hasCatalogSkus && (
                              <div className="flex items-center space-x-1.5">
                                <span className="text-slate-400 font-medium">Mapeo Catálogo B2B: </span>
                                <div className="flex flex-wrap gap-1">
                                  {candidateSkus.map((sku) => {
                                    const qty = item.cantidades_sugeridas?.[sku];
                                    return (
                                      <span
                                        key={sku}
                                        className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-bold border border-indigo-200 dark:border-indigo-800"
                                      >
                                        {sku} {qty ? `(${qty}u)` : ''}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {item.clasificacion_fuente && (
                              <span className="text-[10px] text-slate-400 italic">
                                Clasificado por: {item.clasificacion_fuente === 'LLM' ? `Agente Ollama (${selectedOllamaModel})` : 'Motor Multi-Rubro Calcu'}
                                {item.confianza ? ` (${Math.round(item.confianza * 100)}%)` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botonera de Acciones */}
                        <div className="flex flex-wrap md:flex-col items-stretch gap-2 shrink-0 md:min-w-[210px]">
                          {/* Enlaces Oficiales Verificados */}
                          <div className="flex items-center gap-1.5 w-full">
                            <a
                              href={item.pliego_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1 transition-colors cursor-pointer text-center"
                              title="Ver ficha oficial del llamado en comprasestatales.gub.uy"
                            >
                              <ExternalLink size={12} />
                              <span className="truncate">Pliego ARCE</span>
                            </a>
                            {item.pdf_download_url ? (
                              <a
                                href={item.pdf_download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1 transition-colors cursor-pointer text-center"
                                title="Descargar pliego de bases técnicas"
                              >
                                <Download size={12} />
                                <span className="truncate">PDF Bases</span>
                              </a>
                            ) : null}
                          </div>

                          {/* Tarea 2.2: Importar al Cotizador en 1 clic */}
                          <button
                            onClick={() => handleImportToForm(item)}
                            className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer transition-all hover:scale-[1.01]"
                            title="Rellenar formulario de cotización al instante con este pliego"
                          >
                            <Zap size={13} className="text-amber-300" />
                            <span>⚡ Importar al Cotizador</span>
                          </button>

                          {/* Acción Alternativa: Evaluación Directa con IA (si tiene partidas) */}
                          {hasCatalogSkus && (
                            <button
                              onClick={() => handleImportFeedItem(item)}
                              disabled={isImporting}
                              className={`w-full px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1.5 cursor-pointer border transition-all ${
                                isImporting
                                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed border-transparent'
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                              }`}
                              title="Evaluar factibilidad logística y generar dictámenes de David y Aristóteles"
                            >
                              {isImporting ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>Evaluando...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles size={12} />
                                  <span>Evaluar con IA Directo</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Botón Acumulativo de Paginación ARCE: Buscar 20 Más */}
              {feedItems.length > 0 && (
                <div className="pt-4 pb-2 flex flex-col items-center justify-center">
                  <button
                    onClick={handleFetchMoreFeed}
                    disabled={isFetchingMoreFeed}
                    className="px-6 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center space-x-2 shadow-xs cursor-pointer transition-all disabled:opacity-50 hover:scale-[1.01]"
                    title="Consultar los siguientes 20 llamados oficiales sin borrar los actuales"
                  >
                    {isFetchingMoreFeed ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                        <span>Consultando siguientes 20 licitaciones en ARCE...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span>➕ Cargar 20 licitaciones más (sin borrar las actuales)</span>
                      </>
                    )}
                  </button>
                  <span className="text-[10px] text-slate-400 pt-1">
                    Inspección paginada de comprasestatales.gub.uy con modelo {selectedOllamaModel}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {feedItems.length} licitaciones mostradas · Filtro: {feedNichoFilter === 'TODAS' ? 'Todos los rubros' : feedNichoFilter}
              </span>
              <button
                onClick={() => setIsFeedModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cerrar Explorador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GESTIÓN DE RUBROS COMERCIALES Y MATRIZ DE PALABRAS CLAVE */}
      {isKeywordsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <Settings size={16} />
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Gestión de Rubros y Matriz de Palabras Clave (B2B Multi-Rubro)
                  </h3>
                </div>
                <p className="text-xs text-indigo-200/80">
                  Configure los rubros comerciales, palabras clave de inclusión y señales de exclusión para escanear pliegos de compras públicas en Uruguay (ARCE).
                </p>
              </div>
              <button
                onClick={() => setIsKeywordsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de Vertical */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">Rubro activo:</span>
              {verticals.map((v) => {
                const isSelected = selectedVerticalForMgmt === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVerticalForMgmt(v.id);
                      fetchKeywordsForVertical(v.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-all border flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{v.icon}</span>
                    <span>{v.nombre.split('&')[0].trim()}</span>
                    {v.keywords_count !== undefined && (
                      <span className="text-[10px] opacity-75 font-mono">({v.keywords_count})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Sección 1: Formulario para Agregar Keywords */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <Plus size={14} className="text-indigo-500" />
                    <span>Agregar Nuevas Palabras Clave</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Soporta múltiples términos separados por comas o saltos de línea
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <select
                    value={newKeywordTipo}
                    onChange={(e: any) => setNewKeywordTipo(e.target.value)}
                    className="p-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="INCLUSION">🟢 INCLUSIÓN (Puntaje positivo)</option>
                    <option value="EXCLUSION">🔴 EXCLUSIÓN (Descarte / Penalización)</option>
                  </select>

                  <input
                    type="text"
                    value={newKeywordText}
                    onChange={(e) => setNewKeywordText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddKeywords();
                    }}
                    placeholder="Ej: faroles, balasto, downlight (o separados por coma)..."
                    className="flex-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <button
                    onClick={handleAddKeywords}
                    disabled={!newKeywordText.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all cursor-pointer shadow-sm shrink-0"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {/* Sección 2: Asistente IA Local Ollama para Sugerir Sinónimos y Palabras Clave */}
              <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-indigo-950/20 dark:via-slate-900 dark:to-purple-950/20 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Sparkles size={16} />
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Asistente IA Local (Ollama: {selectedOllamaModel})
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    Sin timeout forzado · Control Heurístico Seguro
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Escriba un concepto o necesidad comercial para que el modelo analice y sugiera sinónimos técnicos habituales en compras estatales uruguayas y palabras de descarte.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiExpandQuery}
                    onChange={(e) => setAiExpandQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleExpandKeywordsAI(false);
                    }}
                    placeholder="Ej: Proyectores para alumbrado vial de rotondas..."
                    className="flex-1 p-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => handleExpandKeywordsAI(false)}
                    disabled={isExpandingAI}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white transition-all cursor-pointer shadow-sm flex items-center space-x-1.5 shrink-0"
                  >
                    {isExpandingAI ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Consultando ({aiExpandElapsedSeconds}s)...</span>
                      </>
                    ) : (
                      <>
                        <Bot size={13} />
                        <span>Sugerir con IA</span>
                      </>
                    )}
                  </button>
                  {isExpandingAI && (
                    <button
                      onClick={() => handleExpandKeywordsAI(true)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer shrink-0"
                      title="Activar de inmediato el fallback heurístico determinístico sin esperar más a Ollama"
                    >
                      ⚡ Fallback Inmediato
                    </button>
                  )}
                </div>

                {/* Resultado de la IA */}
                {aiExpandResult && (
                  <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white dark:bg-slate-800/80 space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Sugerencias Generadas ({aiExpandResult.model_used})
                        </span>
                        {aiExpandResult.es_fallback_heuristico ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            ⚡ Fallback Heurístico
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            🧠 Inferencia Local Ollama
                          </span>
                        )}
                      </div>

                      {/* Botón Maestro: Agregar Todo y Buscar */}
                      <button
                        onClick={handleAddAllSuggestionsAndSearch}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-all flex items-center space-x-1.5"
                        title="Guardar todas las inclusiones y sinónimos en este rubro e iniciar búsqueda en el radar"
                      >
                        <Zap size={13} className="text-amber-300" />
                        <span>⚡ Agregar Todas y Buscar en Radar</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                      "{aiExpandResult.explicacion}"
                    </p>

                    {/* Sinónimos */}
                    {aiExpandResult.sinonimos_sugeridos?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            Sinónimos identificados ({aiExpandResult.sinonimos_sugeridos.length}):
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Haga clic en el término para buscar, o en '+ Buscar' para guardar y buscar
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {aiExpandResult.sinonimos_sugeridos.map((s) => (
                            <div
                              key={s}
                              className="inline-flex items-center rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(s, selectedVerticalForMgmt, { closeModal: true })}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center space-x-1 cursor-pointer transition-colors"
                                title={`Buscar inmediatamente "${s}" en el Radar`}
                              >
                                <Search size={11} className="text-indigo-500" />
                                <span>{s}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(s, selectedVerticalForMgmt, { saveToDb: true, tipo: 'INCLUSION', closeModal: true })}
                                className="px-2 py-1 text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Guardar "${s}" en el rubro e iniciar búsqueda en el Radar`}
                              >
                                + Buscar
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiService.addBiddingKeywordsBulk(selectedVerticalForMgmt, { keywords: [s], tipo: 'INCLUSION' });
                                  fetchKeywordsForVertical(selectedVerticalForMgmt);
                                  const updatedVerts = await apiService.getBiddingVerticals();
                                  if (updatedVerts && updatedVerts.length > 0) setVerticals(updatedVerts);
                                  setNotification({ type: 'success', message: `"${s}" guardada en ${selectedVerticalForMgmt}.` });
                                }}
                                className="px-1.5 py-1 text-xs text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 border-l border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
                                title={`Solo guardar en la base de datos`}
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inclusiones Sugeridas */}
                    {aiExpandResult.keywords_inclusion_sugeridas?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            Inclusiones recomendadas ({aiExpandResult.keywords_inclusion_sugeridas.length}):
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Términos que aumentan el puntaje de coincidencia del llamado
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {aiExpandResult.keywords_inclusion_sugeridas.map((kw) => (
                            <div
                              key={kw}
                              className="inline-flex items-center rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(kw, selectedVerticalForMgmt, { closeModal: true })}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center space-x-1 cursor-pointer transition-colors"
                                title={`Buscar inmediatamente "${kw}" en el Radar`}
                              >
                                <Search size={11} className="text-emerald-500" />
                                <span>{kw}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(kw, selectedVerticalForMgmt, { saveToDb: true, tipo: 'INCLUSION', closeModal: true })}
                                className="px-2 py-1 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 border-l border-emerald-200 dark:border-emerald-800 cursor-pointer transition-colors"
                                title={`Guardar "${kw}" en el rubro e iniciar búsqueda en el Radar`}
                              >
                                + Buscar
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiService.addBiddingKeywordsBulk(selectedVerticalForMgmt, { keywords: [kw], tipo: 'INCLUSION' });
                                  fetchKeywordsForVertical(selectedVerticalForMgmt);
                                  const updatedVerts = await apiService.getBiddingVerticals();
                                  if (updatedVerts && updatedVerts.length > 0) setVerticals(updatedVerts);
                                  setNotification({ type: 'success', message: `"${kw}" guardada en ${selectedVerticalForMgmt}.` });
                                }}
                                className="px-1.5 py-1 text-xs text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-700 border-l border-emerald-200 dark:border-emerald-800 cursor-pointer transition-colors"
                                title={`Solo guardar en la base de datos`}
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exclusiones Sugeridas */}
                    {aiExpandResult.keywords_exclusion_sugeridas?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            Exclusiones para descartar falsos positivos ({aiExpandResult.keywords_exclusion_sugeridas.length}):
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Filtran llamados no deseados (ej. insumos ajenos o servicios incompatibles)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {aiExpandResult.keywords_exclusion_sugeridas.map((kw) => (
                            <div
                              key={kw}
                              className="inline-flex items-center rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/40 shadow-xs overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(kw, selectedVerticalForMgmt, { closeModal: true })}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center space-x-1 cursor-pointer transition-colors"
                                title={`Verificar pliegos con "${kw}" antes de excluir`}
                              >
                                <Search size={11} className="text-rose-500" />
                                <span>{kw}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplySuggestionToSearch(kw, selectedVerticalForMgmt, { saveToDb: true, tipo: 'EXCLUSION', closeModal: false })}
                                className="px-2 py-1 text-[11px] font-bold bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-200 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-500 border-l border-rose-200 dark:border-rose-800 cursor-pointer transition-colors"
                                title={`Guardar "${kw}" como filtro de exclusión`}
                              >
                                - Excluir
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sección 3: Listado de Palabras Clave Configuradas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Palabras Clave Configuradas ({currentKeywords.length})
                  </h4>
                  {isLoadingKeywords && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                </div>

                {/* Palabras de Inclusión */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Inclusión ({currentKeywords.filter((k) => k.tipo === 'INCLUSION').length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentKeywords
                      .filter((k) => k.tipo === 'INCLUSION')
                      .map((k) => (
                        <span
                          key={k.id}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-2 shadow-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleApplySuggestionToSearch(k.keyword, selectedVerticalForMgmt, { closeModal: true })}
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 transition-colors cursor-pointer"
                            title={`Filtrar el Radar de licitaciones por "${k.keyword}"`}
                          >
                            <Search size={11} />
                          </button>
                          <span>{k.keyword}</span>
                          <button
                            onClick={() => handleDeleteKeyword(k.id)}
                            className="text-emerald-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            title="Eliminar palabra clave"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>

                {/* Palabras de Exclusión */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-rose-700 dark:text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Exclusión / Filtro Negativo ({currentKeywords.filter((k) => k.tipo === 'EXCLUSION').length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentKeywords
                      .filter((k) => k.tipo === 'EXCLUSION')
                      .map((k) => (
                        <span
                          key={k.id}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center space-x-2 shadow-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleApplySuggestionToSearch(k.keyword, selectedVerticalForMgmt, { closeModal: true })}
                            className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 transition-colors cursor-pointer"
                            title={`Ver qué pliegos contienen "${k.keyword}"`}
                          >
                            <Search size={11} />
                          </button>
                          <span>{k.keyword}</span>
                          <button
                            onClick={() => handleDeleteKeyword(k.id)}
                            className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors cursor-pointer"
                            title="Eliminar palabra de exclusión"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {currentKeywords.length} palabras clave activas para {selectedVerticalForMgmt}
              </span>
              <button
                onClick={() => setIsKeywordsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALERTA: 7 MINUTOS DE ESPERA EN OLLAMA (INTERVENCIÓN DEL USUARIO) */}
      {showFallbackPrompt && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center space-x-3 text-amber-500">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Tiempo de Inferencia Superó los 7 Minutos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transcurridos: <strong>{Math.floor(aiExpandElapsedSeconds / 60)} min {aiExpandElapsedSeconds % 60} seg</strong> con {selectedOllamaModel}.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              El modelo local de Ollama continúa procesando sin límite forzado de timeout. Conforme a su preferencia, puede conmutar en este instante al <strong>Fallback Heurístico Seguro</strong> (instantáneo y calibrado) o <strong>continuar esperando</strong> hasta que el modelo finalice.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => handleExpandKeywordsAI(true)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer transition-all flex items-center justify-center space-x-2"
              >
                <span>⚡ Activar Fallback Heurístico Inmediato</span>
              </button>
              <button
                onClick={() => setShowFallbackPrompt(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                ⏳ Seguir Esperando a Ollama
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
