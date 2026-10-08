import { useState, useEffect } from 'react';
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
  Cpu
} from 'lucide-react';
import type { CrossReportResponse, AccionCompromiso, EngineMode } from '../types';
import { apiService } from '../services/api';

interface ExecutiveReportsViewProps {
  selectedPeriod: string;
  engineMode?: EngineMode;
}

export const ExecutiveReportsView = ({
  selectedPeriod,
  engineMode = 'auto',
}: ExecutiveReportsViewProps) => {
  const [audience, setAudience] = useState<string>('Directorio / Gerencia General');
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

  // Convertir recomendaciones de la minuta en acciones persistidas
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

      await apiService.createActionsBatch(toSave);
      setConversionSuccess(`Se han registrado ${toSave.length} compromisos operativos extraídos de la minuta.`);
      await loadActions();
    } catch (err: any) {
      console.error('Error converting recommendations to actions', err);
    } finally {
      setIsConvertingActions(false);
    }
  };

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
      const res = await apiService.getCrossReport({
        audience,
        periodo: selectedPeriod,
        extra_context: extraContext.trim() || undefined,
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

          {/* Formatted Markdown / Text */}
          <div className="p-4 bg-[#fbfcfd] dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800 text-xs leading-relaxed text-[#333333] dark:text-slate-200 whitespace-pre-wrap font-sans">
            {report.raw_markdown || report.executive_summary}
          </div>
        </div>
      )}

      {/* Dimensión 5: Panel de Acciones y Compromisos Cross-Área */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
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
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">
            {actionsList.length} compromisos registrados
          </span>
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

        {/* Table of Actions */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] dark:bg-slate-800 text-[#535c69] dark:text-slate-400 uppercase text-[10px] tracking-wider border-y border-slate-200/80 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Compromiso</th>
                <th className="py-2.5 px-3 font-semibold">Área</th>
                <th className="py-2.5 px-3 font-semibold">Responsable</th>
                <th className="py-2.5 px-3 font-semibold">Fecha Límite</th>
                <th className="py-2.5 px-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {actionsList.map((act) => (
                <tr key={act.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-[#333333] dark:text-slate-200">{act.titulo}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-semibold">{act.area}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{act.responsable}</td>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{act.fecha_limite}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      act.estado === 'Completada'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : act.estado === 'En Curso'
                        ? 'bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}>
                      {act.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
