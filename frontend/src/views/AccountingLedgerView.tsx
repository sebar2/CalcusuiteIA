import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Receipt, 
  Scale, 
  PlusCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles,
  FileSpreadsheet,
  X,
  Search,
  Clock,
  UserX,
  Gavel,
  Printer,
  Copy
} from 'lucide-react';
import { apiService } from '../services/api';
import type { 
  ExpenseItem, 
  JournalEntryItem, 
  TaxSummaryResponse, 
  CollectionsOverviewResponse, 
  LegalNoticeResponse,
  GeneralLedgerAccount
} from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export const AccountingLedgerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'collections' | 'journal' | 'expenses' | 'tax_summary' | 'general_ledger'>('collections');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-07');
  
  // Data states
  const [journalEntries, setJournalEntries] = useState<JournalEntryItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummaryResponse | null>(null);
  const [collectionsData, setCollectionsData] = useState<CollectionsOverviewResponse | null>(null);
  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [legalNoticeData, setLegalNoticeData] = useState<LegalNoticeResponse | null>(null);
  const [isLoadingNotice, setIsLoadingNotice] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Form State Gasto
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor_beneficiario: '',
    rut_proveedor: '',
    concepto: '',
    categoria_gasto: 'SERVICIOS_PUBLICOS',
    subtotal_neto: 0,
    tasa_iva_pct: 22.0,
    moneda: 'UYU',
    numero_comprobante: '',
    forma_pago: 'TRANSFERENCIA',
    estado: 'PAGADO'
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [journal, exps, tax, col, ledger] = await Promise.all([
        apiService.getJournal(100),
        apiService.getExpenses({ periodo: selectedPeriod || undefined }),
        apiService.getTaxSummary(selectedPeriod || undefined),
        apiService.getCollectionsOverview(),
        apiService.getGeneralLedger(selectedPeriod || undefined)
      ]);
      setJournalEntries(journal);
      setExpenses(exps);
      setTaxSummary(tax);
      setCollectionsData(col);
      setGeneralLedger(ledger);
    } catch (err) {
      console.error('Error fetching accounting and collections data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const handleOpenLegalNotice = async (rut: string) => {
    setIsLoadingNotice(true);
    try {
      const res = await apiService.getLegalNotice(rut);
      setLegalNoticeData(res);
      setCopiedNotice(false);
    } catch (err) {
      console.error('Error fetching legal notice:', err);
    } finally {
      setIsLoadingNotice(false);
    }
  };

  const handleCopyNotice = () => {
    if (legalNoticeData?.texto_intimacion) {
      navigator.clipboard.writeText(legalNoticeData.texto_intimacion);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiService.createExpense({
        ...expenseForm,
        subtotal_neto: Number(expenseForm.subtotal_neto) || 0,
        tasa_iva_pct: Number(expenseForm.tasa_iva_pct) || 22.0
      });
      setShowExpenseModal(false);
      setExpenseForm({
        fecha: new Date().toISOString().split('T')[0],
        proveedor_beneficiario: '',
        rut_proveedor: '',
        concepto: '',
        categoria_gasto: 'SERVICIOS_PUBLICOS',
        subtotal_neto: 0,
        tasa_iva_pct: 22.0,
        moneda: 'UYU',
        numero_comprobante: '',
        forma_pago: 'TRANSFERENCIA',
        estado: 'PAGADO'
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message || 'Error al registrar gasto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter(e => 
    e.proveedor_beneficiario.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.concepto.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.categoria_gasto.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Scale size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Contabilidad &amp; Cobranzas
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                  Kanban 5 Etapas &amp; DGI
                </span>
              </div>
              <p className="text-xs text-[#535c69] dark:text-slate-400">
                Gestión de deudores por mora, libro diario por partida doble, liquidación fiscal y libro mayor por cuenta.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-[#00a2e8]"
            >
              <option value="">Consolidado 2026 (Todos)</option>
              <option value="2026-07">M7 - Julio 2026 (Demo)</option>
              <option value="2026-08">M8 - Agosto 2026 (Demo)</option>
              <option value="2026-09">M9 - Setiembre 2026 (Demo)</option>
              <option value="2026-10">M10 - Octubre 2026 (Demo)</option>
            </select>

            <button
              onClick={() => setShowExpenseModal(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <PlusCircle size={15} />
              <span>Registrar Gasto</span>
            </button>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('collections')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'collections'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Clock size={15} />
            <span>Cobranzas (Kanban 5 Etapas)</span>
            {collectionsData && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {collectionsData.deudores.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'journal'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <BookOpen size={15} />
            <span>Libro Diario (Partida Doble)</span>
          </button>

          <button
            onClick={() => setActiveTab('general_ledger')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'general_ledger'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>Libro Mayor por Cuenta ({generalLedger.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Receipt size={15} />
            <span>Registro de Gastos ({expenses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tax_summary')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'tax_summary'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <ShieldCheck size={15} />
            <span>Liquidación Fiscal DGI / BPS</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* PESTAÑA 1: COBRANZAS & KANBAN 5 ETAPAS                                */}
        {/* ===================================================================== */}
        {activeTab === 'collections' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* KPIs de Cartera Vencida */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Cartera Total Vencida"
                value={`$${(collectionsData?.resumen.total_cartera_vencida || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle="Suma de facturas impagas vencidas"
                icon={AlertTriangle}
                iconColor="text-rose-600"
                iconBg="bg-rose-50 dark:bg-rose-950/40"
              />
              <MetricCard
                title="Clientes Deudores"
                value={String(collectionsData?.resumen.cantidad_deudores || 0)}
                subtitle="Cuentas con facturas >30d vencidas"
                icon={UserX}
                iconColor="text-amber-600"
                iconBg="bg-amber-50 dark:bg-amber-950/40"
              />
              <MetricCard
                title="Días de Mora Promedio"
                value={`${collectionsData?.resumen.dias_mora_promedio || 0} días`}
                subtitle="Antigüedad media de la deuda (Aging)"
                icon={Clock}
                iconColor="text-indigo-600"
                iconBg="bg-indigo-50 dark:bg-indigo-950/40"
              />
              <MetricCard
                title="Casos Críticos (>60 días)"
                value={String(collectionsData?.resumen.casos_criticos_60d || 0)}
                subtitle="Intimación legal o estudio jurídico"
                icon={Gavel}
                iconColor="text-purple-600"
                iconBg="bg-purple-50 dark:bg-purple-950/40"
              />
            </div>

            {/* Tablero Kanban de 5 Columnas */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
              {collectionsData?.kanban && Object.entries(collectionsData.kanban).map(([stageKey, stage]) => {
                const headerColors: Record<string, string> = {
                  '1_NUEVO_DEUDOR': 'border-t-4 border-amber-400 bg-amber-50/40 dark:bg-amber-950/20',
                  '2_CONTACTADO': 'border-t-4 border-orange-500 bg-orange-50/40 dark:bg-orange-950/20',
                  '3_ADVERTIDO': 'border-t-4 border-rose-500 bg-rose-50/40 dark:bg-rose-950/20',
                  '4_COMPLICADO': 'border-t-4 border-red-600 bg-red-50/40 dark:bg-red-950/20',
                  '5_JURIDICO': 'border-t-4 border-purple-600 bg-purple-50/40 dark:bg-purple-950/20',
                };

                return (
                  <div 
                    key={stageKey}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-xs flex flex-col space-y-3 min-h-[480px] ${headerColors[stageKey] || ''}`}
                  >
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                          {stage.titulo}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {stage.items.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        {stage.descripcion}
                      </p>
                      <div className="mt-1 text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                        ${stage.total_monto.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="space-y-2.5 overflow-y-auto max-h-[500px]">
                      {stage.items.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-[11px] italic">
                          Sin deudores en esta etapa
                        </div>
                      ) : (
                        stage.items.map((debtor) => (
                          <div
                            key={debtor.cliente_rut}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 shadow-2xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block leading-snug">
                                  {debtor.cliente_nombre}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 block">
                                  {debtor.tipo_documento}: {debtor.cliente_rut}
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 whitespace-nowrap">
                                +{debtor.dias_max_vencido}d
                              </span>
                            </div>

                            <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700 flex justify-between items-center text-xs">
                              <span className="text-slate-500 text-[10px]">Deuda Total:</span>
                              <span className="font-mono font-black text-slate-900 dark:text-white">
                                ${debtor.monto_total_deuda.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {/* Límite de Crédito vs Deuda */}
                            <div className="text-[10px] font-mono flex justify-between text-slate-500">
                              <span>Límite Crédito:</span>
                              <span>${debtor.limite_credito.toLocaleString()}</span>
                            </div>
                            {debtor.excede_limite && (
                              <span className="block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 text-center">
                                ⚠️ Excede Límite de Crédito
                              </span>
                            )}

                            {/* Facturas que componen la deuda */}
                            <div className="pt-1 text-[10px] space-y-0.5">
                              <span className="text-slate-400 block font-semibold">Facturas Adeudadas:</span>
                              <div className="flex flex-wrap gap-1">
                                {debtor.facturas_numeros.map((fn, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-mono text-[9px] border border-slate-200 dark:border-slate-700">
                                    {fn}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Botón de Intimación Legal para Etapa 4 y 5 */}
                            {(stageKey === '4_COMPLICADO' || stageKey === '5_JURIDICO') && (
                              <button
                                onClick={() => handleOpenLegalNotice(debtor.cliente_rut)}
                                disabled={isLoadingNotice}
                                className="w-full mt-2 py-1.5 px-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-bold text-[10px] flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                              >
                                <Gavel size={12} />
                                <span>{isLoadingNotice ? 'Generando...' : 'Emitir Intimación Legal'}</span>
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PESTAÑA 2: LIBRO DIARIO (PARTIDA DOBLE)                               */}
        {/* ===================================================================== */}
        {activeTab === 'journal' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 flex items-center justify-between text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-xs block">Principio Contable Universal: Partida Doble Cuadrada</span>
                  <span className="text-[11px] opacity-90">Cada asiento contable mantiene rigurosamente Sum(Debe) == Sum(Haber).</span>
                </div>
              </div>
              <span className="font-mono font-bold text-xs px-3 py-1 bg-white dark:bg-slate-900 rounded-lg shadow-2xs border border-emerald-200 dark:border-emerald-700">
                {journalEntries.length} Asientos Contables
              </span>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  Cargando asientos contables del Libro Diario...
                </div>
              ) : journalEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No se encontraron asientos contables en este período.
                </div>
              ) : (
                journalEntries.map((entry) => (
                  <div key={entry.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-100 dark:border-indigo-900">
                          Asiento #{entry.numero_asiento}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {entry.glosa}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                        <span>Ref: <strong>{entry.referencia_doc || 'N/A'}</strong></span>
                        <span>Fecha: {entry.fecha}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {entry.tipo_operacion}
                        </span>
                      </div>
                    </div>

                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[10px] uppercase font-mono border-b border-slate-100 dark:border-slate-800">
                          <th className="text-left py-1">Código Cuenta</th>
                          <th className="text-left py-1">Nombre de Cuenta Imputada</th>
                          <th className="text-right py-1">Debe ($)</th>
                          <th className="text-right py-1">Haber ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 font-mono text-[11px]">
                        {entry.lines.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-1 text-slate-500">{l.cuenta_codigo}</td>
                            <td className="py-1 font-sans text-slate-800 dark:text-slate-200">{l.cuenta_nombre}</td>
                            <td className="py-1 text-right text-slate-800 dark:text-slate-200 font-semibold">
                              {l.debe > 0 ? `$${l.debe.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="py-1 text-right text-slate-800 dark:text-slate-200 font-semibold">
                              {l.haber > 0 ? `$${l.haber.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PESTAÑA 3: LIBRO MAYOR POR CUENTA (T-ACCOUNTS)                        */}
        {/* ===================================================================== */}
        {activeTab === 'general_ledger' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block mb-1">
                Libro Mayor General — Mayores por Cuenta Contable
              </span>
              <p className="text-xs text-slate-500">
                Muestra los débitos y créditos consolidados por código contable y su saldo neto acumulado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generalLedger.map((acc) => (
                <div key={acc.cuenta_codigo} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mr-2">
                        {acc.cuenta_codigo}
                      </span>
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                        {acc.cuenta_nombre}
                      </span>
                    </div>
                    <span className={`font-mono font-black text-xs ${acc.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      Saldo: ${acc.saldo.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block">TOTAL DEBE:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        ${acc.total_debe.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">TOTAL HABER:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        ${acc.total_haber.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Movimientos de la Cuenta */}
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono">
                    {acc.movimientos.map((m, idx) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/40 text-slate-600 dark:text-slate-400">
                        <span>{m.fecha} - Asiento #{m.asiento}</span>
                        <span>
                          {m.debe > 0 ? `+${m.debe.toLocaleString()}` : `-${m.haber.toLocaleString()}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PESTAÑA 4: REGISTRO DE GASTOS OPERATIVOS                               */}
        {/* ===================================================================== */}
        {activeTab === 'expenses' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar gasto por proveedor, concepto o categoría..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {filteredExpenses.length} Gastos Registrados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f5f7f8] dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Proveedor / Beneficiario</th>
                      <th className="py-3 px-4">Concepto</th>
                      <th className="py-3 px-4">Categoría Gasto</th>
                      <th className="py-3 px-4">Centro Costo</th>
                      <th className="py-3 px-4 text-right">Neto ($)</th>
                      <th className="py-3 px-4 text-right">IVA Crédito ($)</th>
                      <th className="py-3 px-4 text-right">Total ($)</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {exp.fecha}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {exp.proveedor_beneficiario}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          {exp.concepto}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {exp.categoria_gasto}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {exp.centro_costo_nombre || 'General'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          ${exp.subtotal_neto.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                          ${exp.monto_iva.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ${exp.monto_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {exp.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PESTAÑA 5: LIQUIDACIÓN FISCAL DGI / BPS / IRAE                        */}
        {/* ===================================================================== */}
        {activeTab === 'tax_summary' && taxSummary && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <Sparkles size={18} className="text-amber-500" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Dictamen Fiscal IA (DGI &amp; BPS Uruguay) — Período: {taxSummary.periodo}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/40">
                {taxSummary.recomendacion_fiscal_ia}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">1. Impuesto al Valor Agregado (IVA)</span>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">IVA Débito (Ventas):</span>
                      <span className="text-rose-600 font-semibold">${taxSummary.iva_debito_fiscal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">IVA Crédito (Compras):</span>
                      <span className="text-emerald-600 font-semibold">${taxSummary.iva_credito_fiscal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                      <span>Saldo Neto DGI:</span>
                      <span className={taxSummary.saldo_iva_neto > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        ${taxSummary.saldo_iva_neto.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">2. Cargas Sociales (BPS / FONASA)</span>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nómina Imponible:</span>
                      <span>${taxSummary.nomina_imponible.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Aportes Patronales (7.5%):</span>
                      <span>${taxSummary.bps_patronal_jubilatorio.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">FONASA Patronal (5%):</span>
                      <span>${taxSummary.bps_fonasa.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                      <span>Total BPS a Pagar:</span>
                      <span className="text-indigo-600">${taxSummary.total_bps.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200/60 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">3. Anticipo Mensual IRAE</span>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ingresos Netos:</span>
                      <span>${taxSummary.ventas_netas.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Coeficiente Base DGI:</span>
                      <span>2.4%</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                      <span>Anticipo IRAE:</span>
                      <span className="text-indigo-600">${taxSummary.anticipo_irae.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* MODAL: Registrar Nuevo Gasto                                          */}
        {/* ===================================================================== */}
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 text-xs animate-in fade-in zoom-in-95 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Registrar Nuevo Gasto Operativo</h3>
                <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateExpense} className="space-y-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Proveedor / Beneficiario</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UTE, Antel, Arrendador Nave Logística"
                    value={expenseForm.proveedor_beneficiario}
                    onChange={(e) => setExpenseForm({ ...expenseForm, proveedor_beneficiario: e.target.value })}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">RUT Proveedor</label>
                    <input
                      type="text"
                      placeholder="219998880017"
                      value={expenseForm.rut_proveedor}
                      onChange={(e) => setExpenseForm({ ...expenseForm, rut_proveedor: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Categoría</label>
                    <select
                      value={expenseForm.categoria_gasto}
                      onChange={(e) => setExpenseForm({ ...expenseForm, categoria_gasto: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                    >
                      <option value="SERVICIOS_PUBLICOS">Servicios Públicos (Luz/Agua/Tel)</option>
                      <option value="ALQUILERES">Alquileres y Arrendamientos</option>
                      <option value="COMBUSTIBLE">Combustible & Fletes Flota</option>
                      <option value="NOMINA">Nómina y Salarios</option>
                      <option value="CLOUD_TI">SaaS, Cloud & TI</option>
                      <option value="MANTENIMIENTO">Mantenimiento Naves & Flota</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Concepto del Gasto</label>
                  <input
                    type="text"
                    required
                    placeholder="Descripción del gasto"
                    value={expenseForm.concepto}
                    onChange={(e) => setExpenseForm({ ...expenseForm, concepto: e.target.value })}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Subtotal Neto ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expenseForm.subtotal_neto}
                      onChange={(e) => setExpenseForm({ ...expenseForm, subtotal_neto: Number(e.target.value) })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Tasa IVA</label>
                    <select
                      value={expenseForm.tasa_iva_pct}
                      onChange={(e) => setExpenseForm({ ...expenseForm, tasa_iva_pct: Number(e.target.value) })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-800 dark:text-slate-100"
                    >
                      <option value="22">22% (Básico)</option>
                      <option value="10">10% (Mínimo)</option>
                      <option value="0">0% (Exento)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : 'Registrar Gasto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* MODAL: Borrador Formal de Intimación Legal Prejudicial                 */}
        {/* ===================================================================== */}
        {legalNoticeData && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 text-xs animate-in fade-in zoom-in-95 space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Gavel size={18} className="text-red-600" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    Intimación Legal Prejudicial de Pago (CGP Uruguay)
                  </h3>
                </div>
                <button onClick={() => setLegalNoticeData(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                {legalNoticeData.texto_intimacion}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">
                  Cliente: <strong>{legalNoticeData.cliente_nombre}</strong> | Deuda: <strong>${legalNoticeData.monto_total.toLocaleString()} UYU</strong>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyNotice}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center space-x-1 cursor-pointer hover:bg-slate-200"
                  >
                    <Copy size={13} />
                    <span>{copiedNotice ? '¡Copiado!' : 'Copiar Texto'}</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Imprimir Intimación</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default AccountingLedgerView;
