import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Sparkles,
  Plus,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Edit2,
  RefreshCw,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiService } from '../../services/api';
import type {
  BudgetCommitmentItem,
  BudgetCommitmentCreatePayload,
  BudgetCommitmentAIAuditResponse,
} from '../../types';
import { MetricCard } from '../common/MetricCard';
import { formatCurrency } from '../../utils/formatters';

interface BudgetCommitmentsManagerProps {
  selectedPeriod: string;
}

export const BudgetCommitmentsManager: React.FC<BudgetCommitmentsManagerProps> = ({
  selectedPeriod,
}) => {
  const [commitments, setCommitments] = useState<BudgetCommitmentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuditingAI, setIsAuditingAI] = useState<boolean>(false);
  const [aiAuditResult, setAiAuditResult] = useState<BudgetCommitmentAIAuditResponse | null>(null);
  const [isAiAccordionOpen, setIsAiAccordionOpen] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal para Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCommitment, setEditingCommitment] = useState<BudgetCommitmentItem | null>(null);
  const [formTarea, setFormTarea] = useState<string>('');
  const [formArea, setFormArea] = useState<string>('Operaciones');
  const [formResponsable, setFormResponsable] = useState<string>('Responsable General');
  const [formMonto, setFormMonto] = useState<number>(0);
  const [formFechaLimite, setFormFechaLimite] = useState<string>('');
  const [formUrgencia, setFormUrgencia] = useState<string>('MEDIA');
  const [formEstado, setFormEstado] = useState<string>('PENDIENTE');

  const fetchCommitments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getCommitments();
      setCommitments(data);
    } catch (err) {
      console.error('Error fetching budget commitments', err);
      setNotification({ type: 'error', message: 'Error al consultar compromisos presupuestarios.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommitments();
  }, [fetchCommitments]);

  // Ejecutar Auditoría IA
  const handleRunAiAudit = async () => {
    setIsAuditingAI(true);
    setNotification(null);
    try {
      const audit = await apiService.auditCommitmentsAI(selectedPeriod);
      setAiAuditResult(audit);
      setNotification({
        type: 'success',
        message: 'Auditoría IA completada. Se generaron 3 recomendaciones urgentes de contención.',
      });
    } catch (err: any) {
      console.error('Error running AI audit:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Error al ejecutar auditoría predictiva IA.',
      });
    } finally {
      setIsAuditingAI(false);
    }
  };

  // Adoptar una tarea sugerida por IA
  const handleAdoptAiSuggestion = async (sug: BudgetCommitmentCreatePayload) => {
    try {
      await apiService.createCommitment(sug);
      setNotification({
        type: 'success',
        message: `Plan de contención '${sug.tarea.slice(0, 40)}...' incorporado formalmente.`,
      });
      // Remover de sugerencias pendientes
      if (aiAuditResult) {
        setAiAuditResult({
          ...aiAuditResult,
          compromisos_urgentes_sugeridos: aiAuditResult.compromisos_urgentes_sugeridos.filter(
            (s) => s.tarea !== sug.tarea
          ),
        });
      }
      await fetchCommitments();
    } catch (err) {
      console.error('Error adopting AI suggestion:', err);
      setNotification({ type: 'error', message: 'Error al registrar compromiso sugerido.' });
    }
  };

  const handleOpenNewModal = () => {
    setEditingCommitment(null);
    setFormTarea('');
    setFormArea('Operaciones');
    setFormResponsable('Responsable General');
    setFormMonto(0);
    const inTwoWeeks = new Date();
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
    setFormFechaLimite(inTwoWeeks.toISOString().split('T')[0]);
    setFormUrgencia('MEDIA');
    setFormEstado('PENDIENTE');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: BudgetCommitmentItem) => {
    setEditingCommitment(c);
    setFormTarea(c.tarea);
    setFormArea(c.area);
    setFormResponsable(c.responsable);
    setFormMonto(c.monto);
    setFormFechaLimite(c.fecha_limite);
    setFormUrgencia(c.urgencia);
    setFormEstado(c.estado);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTarea.trim()) {
      alert('La descripción de la tarea es obligatoria.');
      return;
    }

    try {
      if (editingCommitment) {
        await apiService.updateCommitment(editingCommitment.id, {
          tarea: formTarea.trim(),
          area: formArea.trim(),
          responsable: formResponsable.trim(),
          monto: Number(formMonto),
          fecha_limite: formFechaLimite,
          urgencia: formUrgencia,
          estado: formEstado,
        });
        setNotification({ type: 'success', message: 'Compromiso actualizado con éxito.' });
      } else {
        await apiService.createCommitment({
          tarea: formTarea.trim(),
          area: formArea.trim(),
          responsable: formResponsable.trim(),
          monto: Number(formMonto),
          fecha_limite: formFechaLimite,
          urgencia: formUrgencia,
          estado: formEstado,
          origen: 'Mesa de Presupuestos',
        });
        setNotification({ type: 'success', message: 'Compromiso registrado con éxito.' });
      }
      setIsModalOpen(false);
      await fetchCommitments();
    } catch (err) {
      console.error('Error saving commitment:', err);
      alert('Error al persistir el compromiso presupuestario.');
    }
  };

  const handleUpdateStatus = async (id: number | string, nuevoEstado: string) => {
    try {
      await apiService.updateCommitment(id, { estado: nuevoEstado });
      setCommitments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estado: nuevoEstado } : c))
      );
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const totalMontoComprometido = commitments.reduce((acc, c) => acc + (c.monto || 0), 0);
  const urgentesAlta = commitments.filter((c) => c.urgencia === 'ALTA').length;
  const pendientes = commitments.filter((c) => c.estado === 'PENDIENTE').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-[#e74c3c] border-rose-200 dark:border-rose-800'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <ShieldAlert size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Gobernanza Presupuestaria & Compromisos de Contención
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Planes de acción correctiva y tareas urgentes auditadas por el motor de inferencia IA para el período {selectedPeriod}.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunAiAudit}
            disabled={isAuditingAI}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
            title="Analiza partidas de sobrecosto y genera 3 tareas urgentes de contención"
          >
            <Sparkles size={14} className={isAuditingAI ? 'animate-spin' : ''} />
            <span>{isAuditingAI ? 'Auditoría en curso...' : '🤖 Consultar Tareas Urgentes Pendientes (IA)'}</span>
          </button>

          <button
            onClick={handleOpenNewModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Nuevo Compromiso</span>
          </button>

          <button
            onClick={fetchCommitments}
            disabled={isLoading}
            className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Refrescar lista"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Métricas Top */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Compromisos Registrados"
          value={commitments.length.toString()}
          icon={ShieldAlert}
          badge={{ text: `${pendientes} Pendientes`, variant: pendientes > 0 ? 'warning' : 'success' }}
          subtitle={`Capital en contención: ${formatCurrency(totalMontoComprometido)}`}
        />
        <MetricCard
          title="Tareas de Urgencia Alta"
          value={urgentesAlta.toString()}
          icon={TrendingDown}
          badge={{ text: urgentesAlta > 0 ? 'Atención Crítica' : 'Controlado', variant: urgentesAlta > 0 ? 'danger' : 'success' }}
          subtitle="Planes con impacto directo en margen"
        />
        <MetricCard
          title="Estado del Período"
          value={selectedPeriod}
          icon={Calendar}
          badge={{ text: 'En Ejecución', variant: 'info' }}
          subtitle="Seguimiento de minutas ejecutivas"
        />
      </div>

      {/* Banner / Tarjeta de Recomendaciones IA si se ejecutó auditoría (Acordeón de Contención) */}
      {aiAuditResult && (
        <div className="bg-gradient-to-br from-indigo-950 to-slate-950 text-white rounded-2xl border border-indigo-800 shadow-xl overflow-hidden transition-all">
          <div 
            onClick={() => setIsAiAccordionOpen(!isAiAccordionOpen)}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors select-none"
          >
            <div className="flex items-center space-x-2.5">
              <Sparkles size={18} className="text-amber-400 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-indigo-100 flex items-center space-x-2">
                  <span>Diagnóstico Predictivo de Contención Presupuestaria (IA FP&amp;A)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-200">
                    {aiAuditResult.compromisos_urgentes_sugeridos.length} sugerencias
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/80 border border-indigo-700 text-indigo-300">
                Período: {aiAuditResult.periodo}
              </span>
              <button
                type="button"
                className="p-1 rounded-md text-indigo-300 hover:text-white cursor-pointer"
                title={isAiAccordionOpen ? "Colapsar diagnóstico" : "Expandir diagnóstico"}
              >
                {isAiAccordionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {isAiAccordionOpen && (
            <div className="p-5 pt-0 border-t border-indigo-800/60 space-y-4">
              <p className="text-xs text-indigo-200/90 leading-relaxed mt-3">
                {aiAuditResult.diagnostico_ia}
              </p>

              {aiAuditResult.compromisos_urgentes_sugeridos.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                    Tareas Urgentes Inferidas para Incorporar:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {aiAuditResult.compromisos_urgentes_sugeridos.map((sug, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-900/90 border border-indigo-700/60 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                              {sug.urgencia}
                            </span>
                            <span className="text-xs font-mono font-bold text-indigo-300">
                              {formatCurrency(sug.monto || 0)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-100 line-clamp-3">
                            {sug.tarea}
                          </p>
                          <div className="text-[10px] text-slate-400 mt-2 space-y-0.5">
                            <div>Área: <strong className="text-slate-300">{sug.area}</strong></div>
                            <div>Responsable: <strong className="text-slate-300">{sug.responsable}</strong></div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdoptAiSuggestion(sug);
                          }}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Incorporar al Plan</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabla Principal de Compromisos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Registro Oficial de Acciones y Compromisos Presupuestarios ({commitments.length})
          </h3>
          <span className="text-xs text-slate-500">
            Minutas ejecutivas &amp; Auditorías
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Tarea / Plan de Acción</th>
                <th className="px-4 py-3">Área / Sector</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3 text-right">Monto Contención</th>
                <th className="px-4 py-3">Fecha Límite</th>
                <th className="px-4 py-3">Urgencia</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {commitments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No hay compromisos presupuestarios registrados aún. Haz clic en '+ Nuevo Compromiso' o consulta a la IA.
                  </td>
                </tr>
              ) : (
                commitments.map((c, idx) => {
                  const isAlta = c.urgencia === 'ALTA';
                  const isCumplido = c.estado === 'CUMPLIDO';
                  return (
                    <tr key={c.id ?? `commitment-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 max-w-[280px]">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          {c.tarea}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Origen: {c.origen}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                          {c.area}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {c.responsable}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {c.monto > 0 ? formatCurrency(c.monto) : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                        {c.fecha_limite}
                      </td>
                      <td className="px-4 py-3">
                        {isAlta ? (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-rose-50 dark:bg-rose-950/50 text-[#e74c3c] border border-rose-200 dark:border-rose-800 text-[10px]">
                            ALTA
                          </span>
                        ) : c.urgencia === 'MEDIA' ? (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/50 text-[#f39c12] border border-amber-200 dark:border-amber-800 text-[10px]">
                            MEDIA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-sky-50 dark:bg-sky-950/50 text-[#00a2e8] border border-sky-200 dark:border-sky-800 text-[10px]">
                            BAJA
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.estado}
                          onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none dark:bg-slate-800 cursor-pointer ${
                            isCumplido
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-[#2ecc71] border-emerald-300 dark:border-emerald-800'
                              : c.estado === 'EN_CURSO'
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-[#f39c12] border-amber-300 dark:border-amber-800'
                          }`}
                        >
                          <option value="PENDIENTE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">PENDIENTE</option>
                          <option value="EN_CURSO" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">EN CURSO</option>
                          <option value="CUMPLIDO" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">CUMPLIDO</option>
                          <option value="BLOQUEADO" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">BLOQUEADO</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Editar compromiso"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Compromiso */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingCommitment ? 'Editar Compromiso Presupuestario' : 'Registrar Nuevo Compromiso'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descripción del Plan / Tarea
                </label>
                <textarea
                  rows={2}
                  required
                  value={formTarea}
                  onChange={(e) => setFormTarea(e.target.value)}
                  placeholder="ej. Renegociar tarifa de seguros de transporte marítimo..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Área Responsable
                  </label>
                  <input
                    type="text"
                    required
                    value={formArea}
                    onChange={(e) => setFormArea(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Líder / Responsable
                  </label>
                  <input
                    type="text"
                    required
                    value={formResponsable}
                    onChange={(e) => setFormResponsable(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Monto Contención (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formMonto}
                    onChange={(e) => setFormMonto(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fecha Límite
                  </label>
                  <input
                    type="date"
                    required
                    value={formFechaLimite}
                    onChange={(e) => setFormFechaLimite(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Urgencia
                  </label>
                  <select
                    value={formUrgencia}
                    onChange={(e) => setFormUrgencia(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALTA">ALTA (Prioridad Máxima)</option>
                    <option value="MEDIA">MEDIA</option>
                    <option value="BAJA">BAJA</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Estado
                  </label>
                  <select
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="EN_CURSO">EN CURSO</option>
                    <option value="CUMPLIDO">CUMPLIDO</option>
                    <option value="BLOQUEADO">BLOQUEADO</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-all hover:scale-[1.02]"
                >
                  {editingCommitment ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
