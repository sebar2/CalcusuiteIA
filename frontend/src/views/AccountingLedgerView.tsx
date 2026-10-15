import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Receipt, 
  Scale, 
  PlusCircle, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingDown, 
  Building2, 
  ShieldCheck, 
  Sparkles,
  FileSpreadsheet,
  X,
  Search
} from 'lucide-react';
import { apiService } from '../services/api';
import type { ExpenseItem, JournalEntryItem, TaxSummaryResponse } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export const AccountingLedgerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'journal' | 'expenses' | 'tax_summary'>('journal');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-07');
  
  // Data states
  const [journalEntries, setJournalEntries] = useState<JournalEntryItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [showExpenseModal, setShowExpenseModal] = useState(false);
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
      const [journal, exps, tax] = await Promise.all([
        apiService.getJournal(100),
        apiService.getExpenses({ periodo: selectedPeriod || undefined }),
        apiService.getTaxSummary(selectedPeriod || undefined)
      ]);
      setJournalEntries(journal);
      setExpenses(exps);
      setTaxSummary(tax);
    } catch (err) {
      console.error('Error fetching accounting data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.proveedor_beneficiario.trim() || !expenseForm.concepto.trim() || expenseForm.subtotal_neto <= 0) {
      setFormError('Por favor complete los campos obligatorios y un monto válido.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiService.createExpense(expenseForm);
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
      setFormError(err.response?.data?.detail || 'Error al registrar gasto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDebeConsolidado = journalEntries.reduce((acc, e) => acc + e.total_debe, 0);
  const totalHaberConsolidado = journalEntries.reduce((acc, e) => acc + e.total_haber, 0);
  const isLedgerBalanced = Math.abs(totalDebeConsolidado - totalHaberConsolidado) < 0.05;

  return (
    <ErrorBoundary fallbackTitle="Error al cargar Libros Contables & Gastos">
      <div className="space-y-6">
        {/* Cabecera & Selector de Período */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
              <Scale size={22} />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Gastos &amp; Libros Contables
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                  Partida Doble &amp; DGI
                </span>
              </div>
              <p className="text-xs text-[#535c69] dark:text-slate-400">
                Libro Diario con validación contable estricta, registro de gastos deducibles y liquidación de tributos (IVA, BPS, IRAE).
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
        <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'journal'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <BookOpen size={15} />
            <span>Libro Diario (General Ledger)</span>
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
            <span>Registro de Gastos Operativos ({expenses.length})</span>
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
        {/* PESTAÑA 1: LIBRO DIARIO CONTABLE                                      */}
        {/* ===================================================================== */}
        {activeTab === 'journal' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Banner de Balance Contable */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
              isLedgerBalanced 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}>
              <div className="flex items-center space-x-3">
                <span className={`p-2 rounded-xl ${isLedgerBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {isLedgerBalanced ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                </span>
                <div>
                  <h4 className="font-bold text-sm">
                    {isLedgerBalanced ? 'Libro Diario Cuadrado y Balanceado' : 'Alerta de Desbalance Contable'}
                  </h4>
                  <p className="text-[11px] opacity-80">
                    Suma Total Debe: ${totalDebeConsolidado.toLocaleString(undefined, { minimumFractionDigits: 2 })} • 
                    Suma Total Haber: ${totalHaberConsolidado.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <span className="font-mono font-bold text-xs px-3 py-1 bg-white dark:bg-slate-900 rounded-lg shadow-2xs border border-emerald-200 dark:border-emerald-700">
                {journalEntries.length} Asientos Contables
              </span>
            </div>

            {/* Lista de Asientos */}
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
        {/* PESTAÑA 2: REGISTRO DE GASTOS OPERATIVOS                               */}
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
                <span className="text-xs text-slate-500 font-medium">
                  {expenses.length} comprobantes en {selectedPeriod || 'Todos'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f5f7f8] dark:bg-slate-800/80 text-[#535c69] dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-3">Proveedor / Beneficiario</th>
                      <th className="py-3 px-3">Concepto &amp; Categoría</th>
                      <th className="py-3 px-3 text-right">Subtotal Neto</th>
                      <th className="py-3 px-3 text-right">IVA Crédito (Compras)</th>
                      <th className="py-3 px-3 text-right">Total Comprobante</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {expenses.filter(e => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return e.proveedor_beneficiario.toLowerCase().includes(q) || e.concepto.toLowerCase().includes(q) || e.categoria_gasto.toLowerCase().includes(q);
                    }).map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{e.fecha}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-100">
                          {e.proveedor_beneficiario}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-800 dark:text-slate-200">{e.concepto}</div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {e.categoria_gasto}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          ${e.subtotal_neto.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          ${e.monto_iva.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ${e.monto_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                            {e.estado}
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
        {/* PESTAÑA 3: LIQUIDACIÓN FISCAL DGI / BPS                               */}
        {/* ===================================================================== */}
        {activeTab === 'tax_summary' && taxSummary && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* KPI Cards Fiscales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="IVA Débito Fiscal (Ventas)"
                value={`$${taxSummary.iva_debito_fiscal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                subtitle="Generado por e-Facturas emitidas"
                icon={TrendingDown}
                iconColor="text-indigo-600 dark:text-indigo-400"
                iconBg="bg-indigo-50 dark:bg-indigo-950/40"
              />
              <MetricCard
                title="IVA Crédito Fiscal (Compras)"
                value={`$${taxSummary.iva_credito_fiscal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                subtitle="Deducible por compras y gastos"
                icon={Receipt}
                iconColor="text-emerald-600 dark:text-emerald-400"
                iconBg="bg-emerald-50 dark:bg-emerald-950/40"
              />
              <MetricCard
                title="Saldo Neto IVA (DGI)"
                value={`$${Math.abs(taxSummary.saldo_iva_neto).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                subtitle={taxSummary.saldo_iva_neto > 0 ? 'Monto a pagar a DGI' : 'Saldo a Favor de la Empresa'}
                icon={Scale}
                iconColor={taxSummary.saldo_iva_neto > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
                iconBg={taxSummary.saldo_iva_neto > 0 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-emerald-50 dark:bg-emerald-950/40'}
              />
              <MetricCard
                title="Previsión BPS & Cargas"
                value={`$${taxSummary.total_bps.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                subtitle="Jubilatorio 7.5% + FONASA 5.0%"
                icon={Building2}
                iconColor="text-sky-600 dark:text-sky-400"
                iconBg="bg-sky-50 dark:bg-sky-950/40"
              />
            </div>

            {/* Cuadro de Liquidación Consolidada & Recomendación Fiscal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                  <FileSpreadsheet size={18} className="text-indigo-600" />
                  <span>Matriz de Obligaciones Tributarias Consolidada</span>
                </h3>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-sans text-slate-600 dark:text-slate-400">1. Saldo Neto IVA Formulario 2176 (DGI):</span>
                    <span className={`font-bold ${taxSummary.saldo_iva_neto > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {taxSummary.saldo_iva_neto > 0 ? `+$${taxSummary.saldo_iva_neto.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `-$${Math.abs(taxSummary.saldo_iva_neto).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-sans text-slate-600 dark:text-slate-400">2. Aportes Patronales BPS (Nómina imponible ${taxSummary.nomina_imponible.toLocaleString()}):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      ${taxSummary.total_bps.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-sans text-slate-600 dark:text-slate-400">3. Anticipo Mensual IRAE (Coeficiente 2.4% sobre facturación neta):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      ${taxSummary.anticipo_irae.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between py-3 font-bold text-sm text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-100 dark:border-indigo-950">
                    <span className="font-sans">Total Obligaciones Fiscales Exigibles:</span>
                    <span>${taxSummary.total_obligaciones_fiscales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Box de IA Fiscal Copilot */}
              <div className="lg:col-span-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-white">Copiloto Fiscal &amp; Auditoría Tributaria</h4>
                    <p className="text-xs text-indigo-200/70">Asesoramiento regulatorio automático</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {taxSummary.recomendacion_fiscal_ia}
                </p>

                <div className="p-3 bg-indigo-900/40 rounded-xl border border-indigo-700/50 space-y-1.5 text-[11px]">
                  <div className="font-bold text-indigo-200 uppercase tracking-wider">Protocolo de Cierre DGI:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>Verificar correspondencia de CFE recibidos contra reporte e-Factura DGI.</li>
                    <li>Conciliar cuentas de IVA Crédito Fiscal contra Libro Diario antes del día 20.</li>
                    <li>Provisionar fondo de liquidez para aportes unificados BPS-DGI.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Registrar Gasto */}
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Receipt size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    Registrar Gasto Operativo (Libro Diario)
                  </h3>
                </div>
                <button onClick={() => setShowExpenseModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
                {formError && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Proveedor / Beneficiario</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UTE / ANCAP / Inmobiliaria"
                    value={expenseForm.proveedor_beneficiario}
                    onChange={(e) => setExpenseForm({ ...expenseForm, proveedor_beneficiario: e.target.value })}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Concepto del Gasto</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Consumo Eléctrico Depósito Salto"
                    value={expenseForm.concepto}
                    onChange={(e) => setExpenseForm({ ...expenseForm, concepto: e.target.value })}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                    <select
                      value={expenseForm.categoria_gasto}
                      onChange={(e) => setExpenseForm({ ...expenseForm, categoria_gasto: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="SERVICIOS_PUBLICOS">Servicios Públicos (UTE, ANTEL)</option>
                      <option value="COMBUSTIBLE">Combustible Flota 3PL</option>
                      <option value="ALQUILERES">Alquileres Inmuebles</option>
                      <option value="NOMINA">Nómina y Salarios</option>
                      <option value="MANTENIMIENTO">Mantenimiento Flota</option>
                      <option value="PAPELERIA_SUMINISTROS">Papelería y WMS</option>
                      <option value="CLOUD_TI">Servidores Cloud &amp; TI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subtotal Neto ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      value={expenseForm.subtotal_neto}
                      onChange={(e) => setExpenseForm({ ...expenseForm, subtotal_neto: Number(e.target.value) })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tasa de IVA</label>
                    <select
                      value={expenseForm.tasa_iva_pct}
                      onChange={(e) => setExpenseForm({ ...expenseForm, tasa_iva_pct: Number(e.target.value) })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={22.0}>Tasa Básica (22%)</option>
                      <option value={10.0}>Tasa Mínima (10%)</option>
                      <option value={0.0}>Exento (0%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Forma de Pago</label>
                    <select
                      value={expenseForm.forma_pago}
                      onChange={(e) => setExpenseForm({ ...expenseForm, forma_pago: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="CHEQUE_DIFERIDO">Cheque Diferido</option>
                      <option value="EFECTIVO">Efectivo / Caja Chica</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : 'Registrar & Generar Asiento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
