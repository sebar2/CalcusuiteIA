import { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  Briefcase, 
  TrendingUp, 
  Truck,
  CheckSquare,
  Plus,
  Zap,
  CheckCircle2,
  Cpu,
  FileSpreadsheet,
  Loader2,
  Edit2,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  AlertTriangle,
  X,
  Save,
} from 'lucide-react';
import type { CrossReportResponse, AccionCompromiso, EngineMode } from '../types';
import { apiService, downloadExecutiveExcel, downloadExecutivePdf } from '../services/api';

interface ExecutiveReportsViewProps {
  selectedPeriod: string;
  engineMode?: EngineMode;
}

export const ExecutiveReportsView = ({
  selectedPeriod,
  engineMode = 'auto',
}: ExecutiveReportsViewProps) => {
  const [audience, setAudience] = useState<string>('Directorio / Gerencia General');
  const [currentPeriod, setCurrentPeriod] = useState<string>(selectedPeriod || '2026-07');
  const [analysisFocus, setAnalysisFocus] = useState<string>('all');
  const [extraContext, setExtraContext] = useState<string>('');
  const [report, setReport] = useState<CrossReportResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionsList, setActionsList] = useState<AccionCompromiso[]>([]);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionArea, setNewActionArea] = useState('Comercial');
  const [newActionResp, setNewActionResp] = useState('Analista Senior');
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [isConvertingActions, setIsConvertingActions] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState<string | null>(null);

  // Estados para búsqueda, filtro y ordenamiento de compromisos
  const [searchActionText, setSearchActionText] = useState('');
  const [filterActionArea, setFilterActionArea] = useState('Todas');
  const [filterActionStatus, setFilterActionStatus] = useState('Todos');
  const [sortField, setSortField] = useState<'titulo' | 'responsable' | 'fecha_limite' | 'estado'>('fecha_limite');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Estado para edición modal
  const [editingAction, setEditingAction] = useState<AccionCompromiso | null>(null);
  const [editForm, setEditForm] = useState({
    titulo: '',
    area: 'Comercial',
    responsable: '',
    fecha_limite: '',
    estado: 'Pendiente'
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Estados para exportación nativa de reportes (P1.3)
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    setDownloadFeedback(null);
    try {
      await downloadExecutiveExcel();
      setDownloadFeedback({ type: 'success', message: 'Reporte Excel (.xlsx) descargado exitosamente.' });
      setTimeout(() => setDownloadFeedback(null), 4000);
    } catch (err: any) {
      setDownloadFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Error al generar o descargar el reporte Excel.',
      });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    setDownloadFeedback(null);
    try {
      await downloadExecutivePdf();
      setDownloadFeedback({ type: 'success', message: 'Minuta Ejecutiva PDF descargada exitosamente.' });
      setTimeout(() => setDownloadFeedback(null), 4000);
    } catch (err: any) {
      setDownloadFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Error al generar o descargar la Minuta PDF.',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Cargar acciones al montar
  const loadActions = async () => {
    try {
      const data = await apiService.getActions();
      setActionsList(data);
    } catch (err) {
      console.warn('Error loading actions', err);
    }
  };

  useEffect(() => {
    loadActions();
  }, []);

  const handleCreateAction = async () => {
    if (!newActionTitle.trim()) return;
    setIsCreatingAction(true);
    try {
      const today = new Date();
      today.setDate(today.getDate() + 14);
      const deadlineStr = today.toISOString().split('T')[0];
      await apiService.createAction({
        titulo: newActionTitle.trim(),
        area: newActionArea,
        responsable: newActionResp,
        fecha_limite: deadlineStr,
        estado: 'Pendiente',
        origen: `Minuta ${audience}`,
      });
      setNewActionTitle('');
      await loadActions();
    } catch (err) {
      console.error('Error creating action', err);
    } finally {
      setIsCreatingAction(false);
    }
  };

  // Convertir recomendaciones de la minuta en acciones persistidas con deduplicación preventiva
  const handleConvertRecommendations = async () => {
    if (!report) return;
    setIsConvertingActions(true);
    setConversionSuccess(null);
    try {
      const raw = report.raw_markdown || report.executive_summary;
      // Extraer líneas numeradas o bullets
      const lines = raw.split('\n');
      const candidates: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^(?:[0-9]+\.|\*|-)\s+(.*)/.test(trimmed)) {
          const match = trimmed.replace(/^(?:[0-9]+\.|\*|-)\s+/, '').trim();
          if (match.length > 15 && !match.toLowerCase().includes('resumen') && !match.toLowerCase().includes('ventas totales')) {
            candidates.push(match);
          }
        }
      }

      const defaultActions = [
        `Revisión y disciplina presupuestaria para ${audience}`,
        `Ajuste de margen mínimo de contribución y control de descuentos`,
        `Monitoreo semanal del ROP y cobertura de inventario DOH`
      ];

      const toSave = (candidates.length >= 2 ? candidates.slice(0, 4) : defaultActions).map((item, idx) => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 7 * (idx + 1));
        const area = idx % 2 === 0 ? 'Finanzas' : (audience.includes('Logística') ? 'Logística' : 'Comercial');
        return {
          titulo: item.length > 120 ? item.substring(0, 117) + '...' : item,
          area: area,
          responsable: idx === 0 ? 'Controller Financiero' : 'Responsable de Área',
          fecha_limite: targetDate.toISOString().split('T')[0],
          estado: 'Pendiente',
          origen: `Minuta IA (${audience})`
        };
      });

      // Deduplicación preventiva contra la matriz viva existente
      const existingSignatures = new Set(
        actionsList.map(a => `${a.titulo.trim().toLowerCase()}|${(a.area || '').trim().toLowerCase()}`)
      );
      const filteredToSave = toSave.filter(item => {
        const sig = `${item.titulo.trim().toLowerCase()}|${item.area.trim().toLowerCase()}`;
        return !existingSignatures.has(sig);
      });

      if (filteredToSave.length === 0) {
        setConversionSuccess('Todos los compromisos derivados ya existen en la matriz con estado activo.');
        return;
      }

      await apiService.createActionsBatch(filteredToSave);
      setConversionSuccess(
        `Se han registrado ${filteredToSave.length} compromisos operativos extraídos de la minuta` +
        (toSave.length > filteredToSave.length ? ` (se omitieron ${toSave.length - filteredToSave.length} duplicados).` : '.')
      );
      await loadActions();
    } catch (err: any) {
      console.error('Error converting recommendations to actions', err);
    } finally {
      setIsConvertingActions(false);
    }
  };

  const handleSort = (field: 'titulo' | 'responsable' | 'fecha_limite' | 'estado') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleToggleStatus = async (act: AccionCompromiso) => {
    const nextStatus = act.estado === 'Pendiente' ? 'En Curso' : (act.estado === 'En Curso' ? 'Completada' : 'Pendiente');
    try {
      await apiService.updateAction(act.id, { estado: nextStatus });
      await loadActions();
    } catch (err) {
      console.error('Error toggling status', err);
    }
  };

  const handleOpenEdit = (act: AccionCompromiso) => {
    setEditingAction(act);
    setEditForm({
      titulo: act.titulo,
      area: act.area,
      responsable: act.responsable,
      fecha_limite: act.fecha_limite,
      estado: act.estado
    });
  };

  const handleSaveEdit = async () => {
    if (!editingAction) return;
    setIsSavingEdit(true);
    try {
      await apiService.updateAction(editingAction.id, editForm);
      setEditingAction(null);
      await loadActions();
    } catch (err) {
      console.error('Error saving action edit', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteAction = async (id: number) => {
    if (!window.confirm('¿Confirmas eliminar este compromiso operativo?')) return;
    try {
      await apiService.deleteAction(id);
      await loadActions();
    } catch (err) {
      console.error('Error deleting action', err);
    }
  };

  // Filtrado y ordenamiento interactivo
  const filteredAndSortedActions = useMemo(() => {
    return actionsList
      .filter(act => {
        if (filterActionArea !== 'Todas' && act.area.toLowerCase() !== filterActionArea.toLowerCase()) {
          return false;
        }
        if (filterActionStatus !== 'Todos' && act.estado.toLowerCase() !== filterActionStatus.toLowerCase()) {
          return false;
        }
        if (searchActionText.trim()) {
          const q = searchActionText.toLowerCase();
          return (
            act.titulo.toLowerCase().includes(q) ||
            act.responsable.toLowerCase().includes(q) ||
            act.area.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'estado') {
          const priority: Record<string, number> = { 'pendiente': 1, 'en curso': 2, 'completada': 3 };
          const pA = priority[(a.estado || '').toLowerCase()] || 0;
          const pB = priority[(b.estado || '').toLowerCase()] || 0;
          return sortOrder === 'asc' ? pA - pB : pB - pA;
        }
        const valA = a[sortField] || '';
        const valB = b[sortField] || '';
        const cmp = String(valA).localeCompare(String(valB));
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [actionsList, searchActionText, filterActionArea, filterActionStatus, sortField, sortOrder]);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audiences = [
    {
      id: 'Directorio / Gerencia General',
      title: 'Directorio / Gerencia General',
      subtitle: 'Foco en EBITDA, Cash-Flow, márgenes netos y riesgos macro',
      icon: Briefcase,
    },
    {
      id: 'Gerencia Comercial',
      title: 'Gerencia Comercial',
      subtitle: 'Cumplimiento de presupuesto comercial, mix y dispersión de precios',
      icon: TrendingUp,
    },
    {
      id: 'Jefatura de Logística / Operaciones',
      title: 'Jefatura de Logística / Operaciones',
      subtitle: 'Cobertura de DOH, tiempos de entrega y quiebres de inventario',
      icon: Truck,
    },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setConversionSuccess(null);
    try {
      const combinedContext = [
        analysisFocus !== 'all' ? `Foco prioritario de evaluación: ${analysisFocus}` : null,
        extraContext.trim() || null
      ].filter(Boolean).join(' | ');

      const res = await apiService.getCrossReport({
        audience,
        periodo: currentPeriod,
        extra_context: combinedContext || undefined,
      });
      setReport(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al generar la minuta con IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!report) return;
    const textToCopy = report.raw_markdown || report.executive_summary;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Barra de Exportación Formal de Dirección & Operaciones (Excel & PDF) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 rounded-2xl p-5 text-white shadow-md border border-slate-700/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#00a2e8]/20 text-[#2fc6f6] border border-[#00a2e8]/40 rounded-full uppercase tracking-wider">
              Iniciativa P1.3
            </span>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Exportador Formal de Reportes y Minutas
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            Descarga de libros contables auditables en Microsoft Excel (.xlsx) y minutas de aprobación en PDF para Dirección.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Botón Excel */}
          <button
            onClick={handleDownloadExcel}
            disabled={isDownloadingExcel}
            className="flex-1 md:flex-none inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-emerald-900/30 transition-all disabled:opacity-50 cursor-pointer"
            title="Descargar libro Excel con 3 hojas: Resumen, Inventario y Presupuesto OPEX"
          >
            {isDownloadingExcel ? (
              <Loader2 size={15} className="animate-spin text-white" />
            ) : (
              <FileSpreadsheet size={15} className="text-emerald-200" />
            )}
            <span>{isDownloadingExcel ? 'Generando Excel...' : 'Descargar Excel (.xlsx)'}</span>
          </button>

          {/* Botón PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="flex-1 md:flex-none inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-rose-900/30 transition-all disabled:opacity-50 cursor-pointer"
            title="Exportar minuta ejecutiva formal imprimible con semáforo y firmas"
          >
            {isDownloadingPdf ? (
              <Loader2 size={15} className="animate-spin text-white" />
            ) : (
              <FileText size={15} className="text-rose-200" />
            )}
            <span>{isDownloadingPdf ? 'Generando PDF...' : 'Exportar Minuta PDF'}</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback de Descarga */}
      {downloadFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-1 ${
            downloadFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className={downloadFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
            <span className="font-medium">{downloadFeedback.message}</span>
          </div>
          <button
            onClick={() => setDownloadFeedback(null)}
            className="text-[10px] font-bold underline cursor-pointer ml-3 opacity-80 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Header and Audience Selection */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-xl">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#333333] dark:text-slate-100">
                Generador de Minutas y Reportes Cross-Área con IA
              </h3>
              <p className="text-xs text-[#535c69] dark:text-slate-400 mt-0.5">
                Adapta el tono, métricas clave y recomendaciones según el stakeholder destinatario
              </p>
            </div>
          </div>
        </div>

        {/* Selector de Período y Foco de Gestión Multisectorial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              📅 Período Presupuestario &amp; Operativo:
            </label>
            <select
              value={currentPeriod}
              onChange={(e) => setCurrentPeriod(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
            >
              <option value="2026-07">Presupuesto M7 - Julio 2026 (Demo)</option>
              <option value="2026-08">Presupuesto M8 - Agosto 2026 (Demo)</option>
              <option value="2026-09">Presupuesto M9 - Setiembre 2026 (Demo)</option>
              <option value="2026-10">Presupuesto M10 - Octubre 2026 (Demo)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              🎯 Foco Primario de la Reunión / Minuta:
            </label>
            <select
              value={analysisFocus}
              onChange={(e) => setAnalysisFocus(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
            >
              <option value="all">Balance Integral (Finanzas, Ventas, WMS y 3PL)</option>
              <option value="costs">Contención de Gastos &amp; Desvíos OPEX</option>
              <option value="sales">Cumplimiento Comercial, Margen &amp; Pricing B2B</option>
              <option value="stock">Riesgos de Quiebre de Inventario &amp; ROP (WMS)</option>
              <option value="logistics">Tiempos de Entrega, Fletes &amp; Desempeño 3PL</option>
            </select>
          </div>
        </div>

        {/* Audience Selector Cards */}
        <div>
          <label className="block text-xs font-semibold text-[#535c69] dark:text-slate-300 mb-2">
            Seleccionar Audiencia de la Minuta:
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {audiences.map((aud) => {
              const Icon = aud.icon;
              const isSelected = audience === aud.id;
              return (
                <button
                  key={aud.id}
                  onClick={() => setAudience(aud.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-[#00a2e8] bg-sky-50/50 dark:bg-sky-950/40 shadow-xs ring-1 ring-[#00a2e8]'
                      : 'border-slate-200 dark:border-slate-700 bg-[#f5f7f8] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-[#535c69] dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1.5">
                    <Icon size={16} className={isSelected ? 'text-[#00a2e8]' : 'text-slate-400'} />
                    <span className="font-bold text-xs text-[#333333] dark:text-slate-100">{aud.title}</span>
                  </div>
                  <p className="text-[11px] text-[#535c69] dark:text-slate-400 leading-relaxed">{aud.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Context Textarea */}
        <div>
          <label className="block text-xs font-semibold text-[#535c69] dark:text-slate-300 mb-1">
            Instrucciones o Contexto Adicional (Opcional):
          </label>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            rows={2}
            placeholder="Ej: Considerar la huelga en aduana prevista para la próxima quincena o el acuerdo de descuento especial por volumen con mayoristas..."
            className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-[#333333] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00a2e8]"
          />
        </div>

        {/* Advertencia de espera activa si force_llm */}
        {engineMode === 'force_llm' && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-[11px] text-purple-700 dark:text-purple-300 flex items-center space-x-2">
            <Cpu size={16} className="shrink-0 text-purple-600" />
            <span>
              <strong>Modo Inferencia Profunda Activo:</strong> Qwen 2.5:7b procesará la minuta en GPU/CPU local.
            </span>
          </div>
        )}

        {/* Generate Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] text-[#535c69] dark:text-slate-400">
            Periodo de base: <strong className="text-[#333333] dark:text-slate-200">{selectedPeriod}</strong>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-xl shadow-sm hover:shadow-bitrix-glow transition-all disabled:opacity-50"
          >
            <Sparkles size={15} className={isGenerating ? 'animate-spin' : ''} />
            <span>{isGenerating ? 'Redactando Minuta con LLM...' : 'Generar Minuta Ejecutiva'}</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-[#e74c3c]">
            {error}
          </div>
        )}
      </div>

      {/* Generated Report Display */}
      {report && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <FileText size={18} className="text-[#00a2e8]" />
              <h4 className="font-bold text-sm text-[#333333] dark:text-slate-100">
                Minuta Generada para {report.audience}
              </h4>
              <span className="px-2 py-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-full">
                ⚡ {report.latency_ms.toFixed(0)} ms
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Botón Convertir Recomendaciones en Acciones */}
              <button
                onClick={handleConvertRecommendations}
                disabled={isConvertingActions}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-all"
                title="Transformar las directrices de la minuta en compromisos operativos auditables"
              >
                <Zap size={14} className={isConvertingActions ? 'animate-bounce' : ''} />
                <span>{isConvertingActions ? 'Extrayendo...' : '⚡ Convertir Recomendaciones en Acciones'}</span>
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#535c69] dark:text-slate-300 hover:text-[#00a2e8] bg-[#f5f7f8] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-[#2ecc71]" />
                    <span className="text-[#2ecc71]">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar Markdown</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {conversionSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{conversionSuccess}</span>
            </div>
          )}

          {/* Advertencia contable CMV = $0 si ventas > 0 */}
          {(() => {
            const km = report.key_metrics || {};
            const cmvVal = km.costo_total ?? km.cmv ?? km['Costo Total'] ?? km['CMV'];
            const ventasVal = km.ventas_totales ?? km.ingresos ?? km['Ventas Totales'] ?? km['Ingresos'];
            const isCmvZero = cmvVal === 0 || cmvVal === '$0' || cmvVal === '$0.00' || String(cmvVal).trim() === '0';
            const hasVentas = ventasVal && ventasVal !== 0 && ventasVal !== '$0' && String(ventasVal).trim() !== '0';
            if (isCmvZero && hasVentas) {
              return (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl flex items-center space-x-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-semibold">⚠️ CMV no imputado en el período (Margen contable provisional)</span>
                </div>
              );
            }
            return null;
          })()}

          {/* Key Metrics Pill Grid */}
          {report.key_metrics && Object.keys(report.key_metrics).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(report.key_metrics).map(([k, v]) => (
                <div key={k} className="p-2.5 bg-[#f5f7f8] dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700">
                  <span className="text-[10px] text-[#535c69] dark:text-slate-400 font-medium block uppercase tracking-wider">
                    {k.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-bold text-[#333333] dark:text-slate-100 font-mono">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Formatted Markdown / Text con clase semántica Dark Mode */}
          <div className="prose prose-slate dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-slate-800 dark:text-slate-100 shadow-sm leading-relaxed text-xs whitespace-pre-wrap font-sans">
            {report.raw_markdown || report.executive_summary}
          </div>
        </div>
      )}

      {/* Dimensión 5: Panel de Acciones y Compromisos Cross-Área */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <CheckSquare size={18} />
            </span>
            <div>
              <h4 className="font-bold text-sm text-[#333333] dark:text-slate-100">
                Matriz de Acciones y Compromisos Cross-Área
              </h4>
              <p className="text-xs text-[#535c69] dark:text-slate-400">
                Trazabilidad operativa de acuerdos derivados de los informes y minutas ejecutivas
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">
              {filteredAndSortedActions.length} de {actionsList.length} compromisos
            </span>
          </div>
        </div>

        {/* Quick Add Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-[#f8fafc] dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700 items-center">
          <div className="md:col-span-5">
            <input
              type="text"
              placeholder="Nueva acción o compromiso operativo..."
              value={newActionTitle}
              onChange={(e) => setNewActionTitle(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={newActionArea}
              onChange={(e) => setNewActionArea(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
            >
              <option value="Comercial">Área: Comercial</option>
              <option value="Logística">Área: Logística</option>
              <option value="Finanzas">Área: Finanzas</option>
              <option value="Operaciones">Área: Operaciones</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Responsable..."
              value={newActionResp}
              onChange={(e) => setNewActionResp(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
            />
          </div>
          <div className="md:col-span-2">
            <button
              onClick={handleCreateAction}
              disabled={isCreatingAction || !newActionTitle.trim()}
              className="w-full py-1.5 px-3 bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
            >
              <Plus size={14} />
              <span>Registrar</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros, Búsqueda y Herramientas */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por título, responsable o área..."
              value={searchActionText}
              onChange={(e) => setSearchActionText(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-[#333333] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#00a2e8]"
            />
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Filter size={13} className="text-slate-400" />
              <select
                value={filterActionArea}
                onChange={(e) => setFilterActionArea(e.target.value)}
                className="bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="Todas">Todas las áreas</option>
                <option value="Comercial">Comercial</option>
                <option value="Logística">Logística</option>
                <option value="Finanzas">Finanzas</option>
                <option value="Operaciones">Operaciones</option>
              </select>
            </div>
            <div>
              <select
                value={filterActionStatus}
                onChange={(e) => setFilterActionStatus(e.target.value)}
                className="bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En Curso">En Curso</option>
                <option value="Completada">Completada</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table of Actions con Ordenamiento y Acciones */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] dark:bg-slate-800 text-[#535c69] dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-700">
              <tr>
                <th 
                  onClick={() => handleSort('titulo')}
                  className="py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-[#00a2e8] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Compromiso</span>
                    {sortField === 'titulo' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-[#00a2e8]" /> : <ArrowDown size={12} className="text-[#00a2e8]" />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold">Área</th>
                <th 
                  onClick={() => handleSort('responsable')}
                  className="py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-[#00a2e8] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Responsable</span>
                    {sortField === 'responsable' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-[#00a2e8]" /> : <ArrowDown size={12} className="text-[#00a2e8]" />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('fecha_limite')}
                  className="py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-[#00a2e8] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Fecha Límite</span>
                    {sortField === 'fecha_limite' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-[#00a2e8]" /> : <ArrowDown size={12} className="text-[#00a2e8]" />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('estado')}
                  className="py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-[#00a2e8] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Estado</span>
                    {sortField === 'estado' ? (
                      sortOrder === 'asc' ? <ArrowUp size={12} className="text-[#00a2e8]" /> : <ArrowDown size={12} className="text-[#00a2e8]" />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredAndSortedActions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No se encontraron compromisos que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredAndSortedActions.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[#333333] dark:text-slate-200">{act.titulo}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-semibold">{act.area}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{act.responsable}</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{act.fecha_limite}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleStatus(act)}
                        title="Clic para alternar estado (Pendiente ➔ En Curso ➔ Completada)"
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-transform hover:scale-105 active:scale-95 ${
                          act.estado === 'Completada'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : act.estado === 'En Curso'
                            ? 'bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {act.estado}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(act)}
                          title="Editar compromiso"
                          className="p-1 rounded-md text-slate-400 hover:text-[#00a2e8] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteAction(act.id)}
                          title="Eliminar compromiso"
                          className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edición de Compromiso */}
      {editingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Edit2 size={16} className="text-[#00a2e8]" />
                <h3 className="font-bold text-sm text-[#333333] dark:text-slate-100">
                  Editar Compromiso Operativo
                </h3>
              </div>
              <button
                onClick={() => setEditingAction(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título / Compromiso:
                </label>
                <textarea
                  rows={2}
                  value={editForm.titulo}
                  onChange={(e) => setEditForm(prev => ({ ...prev, titulo: e.target.value }))}
                  className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Área:
                  </label>
                  <select
                    value={editForm.area}
                    onChange={(e) => setEditForm(prev => ({ ...prev, area: e.target.value }))}
                    className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                  >
                    <option value="Comercial">Comercial</option>
                    <option value="Logística">Logística</option>
                    <option value="Finanzas">Finanzas</option>
                    <option value="Operaciones">Operaciones</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estado:
                  </label>
                  <select
                    value={editForm.estado}
                    onChange={(e) => setEditForm(prev => ({ ...prev, estado: e.target.value }))}
                    className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Curso">En Curso</option>
                    <option value="Completada">Completada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Responsable:
                  </label>
                  <input
                    type="text"
                    value={editForm.responsable}
                    onChange={(e) => setEditForm(prev => ({ ...prev, responsable: e.target.value }))}
                    className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha Límite:
                  </label>
                  <input
                    type="date"
                    value={editForm.fecha_limite}
                    onChange={(e) => setEditForm(prev => ({ ...prev, fecha_limite: e.target.value }))}
                    className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingAction(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editForm.titulo.trim()}
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] disabled:opacity-50 rounded-xl transition-colors shadow-sm"
              >
                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
