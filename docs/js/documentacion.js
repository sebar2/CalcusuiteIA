/**
 * ==========================================================================
 * CALCU SUITE 2026 - DOCUMENTACIÓN & ASESOR IA DE PAUTA (DOCUMENTACION.JS)
 * Lógica del Simulador de Difusión Multicanal y Controles de Navegación
 * ==========================================================================
 */

function updateAdvisorSim() {
  const budgetInput = document.getElementById('adBudgetInput');
  const industryInput = document.getElementById('adIndustryInput');
  const label = document.getElementById('adBudgetLabel');
  if (!budgetInput || !industryInput || !label) return;

  const budget = Number(budgetInput.value);
  const industry = industryInput.value;
  label.innerText = `$${budget} USD`;

  let pG = 0.40, pM = 0.30, pW = 0.20, pE = 0.10;
  let estCpl = 4.2;
  let comment = "";

  if (industry === 'b2b_wholesale') {
    pG = 0.45; pM = 0.20; pW = 0.25; pE = 0.10;
    estCpl = 5.5;
    comment = "Para distribución mayorista en Uruguay, priorice Google Search para captar compras de stock en volumen y WhatsApp Cloud API para cierre directo con listas de precios.";
  } else if (industry === 'logistics_3pl') {
    pG = 0.50; pM = 0.20; pW = 0.15; pE = 0.15;
    estCpl = 6.8;
    comment = "En logística 3PL y depósito, la intención de búsqueda en Google (pallets, almacenaje fiscal, ruteo) tiene la mayor tasa de conversión calificada.";
  } else if (industry === 'retail_meli') {
    pG = 0.25; pM = 0.45; pW = 0.20; pE = 0.10;
    estCpl = 2.4;
    comment = "En retail y MeLi, los formatos visuales de Meta Ads (Reels/Carruseles) generan alto volumen con soporte de WhatsApp para dudas previas.";
  } else {
    pG = 0.35; pM = 0.25; pW = 0.20; pE = 0.20;
    estCpl = 4.8;
    comment = "Estrategia equilibrada: Google Ads para captura inicial, reforzado con secuencias de correo masivo Resend para maduración de tratos B2B.";
  }

  const costG = Math.round(budget * pG);
  const costM = Math.round(budget * pM);
  const costW = Math.round(budget * pW);
  const costE = Math.round(budget * pE);

  const elG = document.getElementById('pctGoogle');
  const elM = document.getElementById('pctMeta');
  const elW = document.getElementById('pctWhatsApp');
  const elE = document.getElementById('pctEmail');

  if (elG) elG.innerText = `$${costG} USD (${Math.round(pG * 100)}%)`;
  if (elM) elM.innerText = `$${costM} USD (${Math.round(pM * 100)}%)`;
  if (elW) elW.innerText = `$${costW} USD (${Math.round(pW * 100)}%)`;
  if (elE) elE.innerText = `$${costE} USD (${Math.round(pE * 100)}%)`;

  const barG = document.getElementById('barGoogle');
  const barM = document.getElementById('barMeta');
  const barW = document.getElementById('barWhatsApp');
  const barE = document.getElementById('barEmail');

  if (barG) barG.style.width = `${pG * 100}%`;
  if (barM) barM.style.width = `${pM * 100}%`;
  if (barW) barW.style.width = `${pW * 100}%`;
  if (barE) barE.style.width = `${pE * 100}%`;

  const leads = Math.round(budget / estCpl);
  const leadsEl = document.getElementById('advisorLeadsEst');
  const commentEl = document.getElementById('advisorComment');

  if (leadsEl) leadsEl.innerText = `≈ ${leads} Leads Calificados`;
  if (commentEl) commentEl.innerText = comment;
}

document.addEventListener('DOMContentLoaded', () => {
  updateAdvisorSim();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
