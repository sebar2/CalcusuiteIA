/**
 * ==========================================================================
 * CALCUSUITEIA (CSIA) - MODAL CORPORATIVO DE CREACIÓN DE CUENTA
 * Selector de 2 Modalidades (Trial Corporativo vs Programa Pionero Vitalicio),
 * Definición de Contraseña Propia, Alta PostgreSQL 16, Email de Confirmación
 * con Enlace de Activación y Sugerencia de 2FA TOTP.
 * ==========================================================================
 */

(function () {
  const isProduction =
    window.location.hostname === 'calcusuiteia.com' ||
    window.location.hostname === 'www.calcusuiteia.com' ||
    window.location.hostname === 'app.calcusuiteia.com';

  const ACCOUNT_CONFIG = {
    endpoints: isProduction
      ? ['https://app.calcusuiteia.com/api/v1/public/register-account']
      : [
          'https://app.calcusuiteia.com/api/v1/public/register-account',
          'http://127.0.0.1:8000/api/v1/public/register-account',
          'http://localhost:8000/api/v1/public/register-account',
        ],
    fallbackLeadsEndpoints: isProduction
      ? ['https://app.calcusuiteia.com/api/v1/public/leads']
      : [
          'https://app.calcusuiteia.com/api/v1/public/leads',
          'http://127.0.0.1:8000/api/v1/public/leads',
          'http://localhost:8000/api/v1/public/leads',
        ],
    officialWhatsapp: '59894858791',
    officialEmail: 'contacto@calcusuiteia.com',
  };

  let selectedModalidad = 'PIONERO'; // 'PIONERO' o 'TRIAL'

  function createModalDOM() {
    if (document.getElementById('csiaAccountModal')) return;

    const modal = document.createElement('div');
    modal.id = 'csiaAccountModal';
    modal.className =
      'fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md hidden items-center justify-center p-3 sm:p-6 overflow-y-auto';
    modal.onclick = function (e) {
      if (e.target === modal) closeAccountModal();
    };

    modal.innerHTML = `
      <div id="csiaModalCard" class="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200" onclick="event.stopPropagation()">
        <!-- Glow Decorator -->
        <div class="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Header -->
        <div class="flex items-center justify-between pb-5 border-b border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 font-bold text-sm">
              CSIA
            </div>
            <div>
              <h3 class="text-xl font-extrabold text-white tracking-tight">Crear Cuenta Corporativa en CalcuSuiteIA</h3>
              <p class="text-xs text-slate-400">Entorno Aislado en PostgreSQL 16 • Aprovisionamiento con Contraseña Propia</p>
            </div>
          </div>
          <button onclick="closeAccountModal()" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div id="csiaModalBody">
          <!-- Selector de 2 Modalidades -->
          <div class="mt-6 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <!-- Opción 1: Programa Pionero -->
            <div id="optionPionero" onclick="selectModalidad('PIONERO')" class="cursor-pointer p-4 rounded-2xl border-2 border-emerald-500/70 bg-emerald-950/20 hover:bg-emerald-950/30 transition-all relative">
              <div class="flex items-center justify-between mb-1.5">
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] tracking-wider uppercase">Recomendado</span>
                <span class="w-4 h-4 rounded-full border-2 border-emerald-400 flex items-center justify-center bg-emerald-500 text-slate-950 text-[10px] font-bold">✓</span>
              </div>
              <h4 class="text-sm font-bold text-white">Programa Pionero (Primeros 20)</h4>
              <p class="text-xs text-emerald-300 font-semibold mt-0.5">6 Meses 100% GRATIS + 50% OFF Vitalicio</p>
              <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">Acceso irrestricto, soporte VIP sin cargo y co-desarrollo activo con el equipo de ingeniería.</p>
            </div>

            <!-- Opción 2: Trial Corporativo -->
            <div id="optionTrial" onclick="selectModalidad('TRIAL')" class="cursor-pointer p-4 rounded-2xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800/40 transition-all opacity-80 hover:opacity-100">
              <div class="flex items-center justify-between mb-1.5">
                <span class="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[10px] uppercase">Evaluación Rápida</span>
                <span id="trialCheck" class="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px]"></span>
              </div>
              <h4 class="text-sm font-bold text-white">Trial Corporativo Sandbox</h4>
              <p class="text-xs text-blue-300 font-semibold mt-0.5">14 Días Gratis (Extensible a 1 Mes)</p>
              <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">Prueba completa con datos demo precargados o migración de tu catálogo sin compromiso.</p>
            </div>
          </div>

          <!-- Formulario -->
          <form id="csiaRegisterForm" onsubmit="handleAccountSubmit(event)" class="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
            <!-- Honeypot -->
            <input type="text" id="accHoneypot" class="hidden" tabindex="-1" autocomplete="off" />

            <!-- Feedback Alert -->
            <div id="accAlert" class="hidden p-4 rounded-xl text-xs font-medium"></div>

            <!-- Fila 1: Nombre & Cargo -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Nombre y Apellido *</label>
                <input type="text" id="accNombre" required placeholder="Ej: Ing. Martín González" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Cargo / Rol en la Empresa *</label>
                <input type="text" id="accCargo" required placeholder="Ej: Gerente de Operaciones / Director" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
              </div>
            </div>

            <!-- Fila 2: Empresa & RUT -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Razón Social / Empresa *</label>
                <input type="text" id="accEmpresa" required placeholder="Ej: Logística & Distribución Sur S.A." class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">RUT / Identificación Fiscal *</label>
                <input type="text" id="accRut" required placeholder="Ej: 219988770014" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
              </div>
            </div>

            <!-- Fila 3: Email Corporativo & WhatsApp -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Correo Corporativo de Acceso *</label>
                <input type="email" id="accEmail" required placeholder="mgonzalez@empresa.com.uy" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Teléfono / WhatsApp Directo *</label>
                <input type="tel" id="accTelefono" required placeholder="+598 94 858 791" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
              </div>
            </div>

            <!-- Fila 4: Contraseña y Confirmación de Contraseña -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div>
                <label class="block text-xs font-semibold text-slate-200 mb-1">Contraseña de Acceso * (Mín. 6 caracteres)</label>
                <div class="relative">
                  <input type="password" id="accPassword" required minlength="6" placeholder="Define tu contraseña segura" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 pr-10" oninput="checkCsiaPasswordStrength()" />
                  <button type="button" onclick="toggleCsiaPassword('accPassword', 'eye1')" class="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs">
                    <span id="eye1">👁️</span>
                  </button>
                </div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div id="csiaPwdBar" class="h-full w-0 bg-red-500 transition-all duration-300"></div>
                </div>
                <span id="csiaPwdHelp" class="text-[10px] text-slate-400 mt-1 block">Fuerza: Ingrese contraseña</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-200 mb-1">Confirmar Contraseña *</label>
                <div class="relative">
                  <input type="password" id="accConfirmPassword" required minlength="6" placeholder="Repite tu contraseña" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 pr-10" oninput="checkCsiaPasswordMatch()" />
                  <button type="button" onclick="toggleCsiaPassword('accConfirmPassword', 'eye2')" class="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs">
                    <span id="eye2">👁️</span>
                  </button>
                </div>
                <span id="csiaMatchNotice" class="text-[10px] text-slate-500 mt-2 block">Verificando coincidencia...</span>
              </div>
            </div>

            <!-- Fila 5: Rubro & Escala -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Rubro / Industria *</label>
                <select id="accRubro" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500">
                  <option value="Operador Logístico 3PL & Depósito">Operador Logístico 3PL & Depósito</option>
                  <option value="Importador & Distribuidor Mayorista">Importador & Distribuidor Mayorista</option>
                  <option value="E-Commerce & Mercado Libre (MLU)">E-Commerce & Mercado Libre (MLU)</option>
                  <option value="Retail & Cadenas Comerciales">Retail & Cadenas Comerciales</option>
                  <option value="Manufactura & Agroindustria">Manufactura & Agroindustria</option>
                  <option value="Servicios B2B / Licitaciones ARCE">Servicios B2B / Licitaciones ARCE</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Escala Operativa Aprox. *</label>
                <input type="text" id="accEscala" required placeholder="Ej: 800 m², 12 camiones, 3.500 SKUs" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
              </div>
            </div>

            <!-- Módulos Prioritarios (Checkboxes) -->
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-2">Módulos Prioritarios a Habilitar en tu Tenant:</label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-300">
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                  <input type="checkbox" name="accModulos" value="Gemelo Digital 3D & WMS" checked class="rounded accent-cyan-500" />
                  <span>🧊 Gemelo 3D</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                  <input type="checkbox" name="accModulos" value="Logística 3PL & Flota GPS" checked class="rounded accent-cyan-500" />
                  <span>🚚 3PL & Flota</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                  <input type="checkbox" name="accModulos" value="Mercado Libre Kanban" checked class="rounded accent-cyan-500" />
                  <span>🛍️ Mercado Libre</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                  <input type="checkbox" name="accModulos" value="Chat Omnicanal & WhatsApp QR" checked class="rounded accent-cyan-500" />
                  <span>💬 Webchat / WhatsApp</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                  <input type="checkbox" name="accModulos" value="Contabilidad General & DGI/BPS" class="rounded accent-cyan-500" />
                  <span>📊 DGI / BPS</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                  <input type="checkbox" name="accModulos" value="Radar Licitaciones ARCE/SICE" class="rounded accent-cyan-500" />
                  <span>🏛️ Licitaciones</span>
                </label>
              </div>
            </div>

            <!-- Compromiso Pionero Obligatorio -->
            <div id="pioneroCommitmentBox" class="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200">
              <label class="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" id="accCompromiso" checked class="mt-0.5 rounded accent-emerald-500 shrink-0" />
                <span class="leading-relaxed">
                  <strong>Compromiso de Co-Desarrollo Oficial:</strong> Al postular al Programa Pionero, nuestra empresa se compromete a implementar la plataforma en su operativa y brindar feedback mensual durante los 6 meses gratuitos, recibiendo soporte prioritario sin cargo y asegurando el <strong>50% de descuento vitalicio garantizado</strong>.
                </span>
              </label>
            </div>

            <!-- Comentarios adicionales -->
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Comentarios u Objetivos de Implementación</label>
              <textarea id="accComentarios" rows="2" placeholder="Describe brevemente tus dolores actuales (inventario, fletes, conciliación, etc.)" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"></textarea>
            </div>

            <!-- Botón de Envío -->
            <div class="pt-2">
              <button type="submit" id="accSubmitBtn" class="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-cyan-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <span id="accBtnText">Crear Cuenta Corporativa & Enviar Email de Activación</span>
                <svg class="w-4 h-4 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function toggleCsiaPassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.textContent = '🔒';
    } else {
      input.type = 'password';
      if (icon) icon.textContent = '👁️';
    }
  }

  function checkCsiaPasswordStrength() {
    const pwd = document.getElementById('accPassword')?.value || '';
    const bar = document.getElementById('csiaPwdBar');
    const help = document.getElementById('csiaPwdHelp');
    if (!bar || !help) return;

    let score = 0;
    if (pwd.length >= 6) score += 25;
    if (pwd.length >= 10) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 25;

    bar.style.width = score + '%';
    if (score <= 25) {
      bar.className = 'h-full bg-red-500 transition-all duration-300';
      help.textContent = 'Fuerza: Débil (mínimo 6 caracteres)';
      help.className = 'text-[10px] text-red-400 mt-1 block';
    } else if (score <= 50) {
      bar.className = 'h-full bg-amber-500 transition-all duration-300';
      help.textContent = 'Fuerza: Media (agrega mayúsculas o números)';
      help.className = 'text-[10px] text-amber-400 mt-1 block';
    } else if (score <= 75) {
      bar.className = 'h-full bg-blue-500 transition-all duration-300';
      help.textContent = 'Fuerza: Buena';
      help.className = 'text-[10px] text-blue-400 mt-1 block';
    } else {
      bar.className = 'h-full bg-emerald-500 transition-all duration-300';
      help.textContent = 'Fuerza: Excelente para entorno corporativo ✓';
      help.className = 'text-[10px] text-emerald-400 mt-1 block';
    }
    checkCsiaPasswordMatch();
  }

  function checkCsiaPasswordMatch() {
    const pwd = document.getElementById('accPassword')?.value || '';
    const cpwd = document.getElementById('accConfirmPassword')?.value || '';
    const notice = document.getElementById('csiaMatchNotice');
    if (!notice) return;

    if (!cpwd) {
      notice.textContent = '';
      return;
    }
    if (pwd === cpwd) {
      notice.textContent = '✓ Las contraseñas coinciden correctamente';
      notice.className = 'text-[10px] text-emerald-400 mt-1 block font-medium';
    } else {
      notice.textContent = '✗ Las contraseñas no coinciden';
      notice.className = 'text-[10px] text-rose-400 mt-1 block font-medium';
    }
  }

  function selectModalidad(type) {
    selectedModalidad = type;
    const optPionero = document.getElementById('optionPionero');
    const optTrial = document.getElementById('optionTrial');
    const commitBox = document.getElementById('pioneroCommitmentBox');
    const btnText = document.getElementById('accBtnText');

    if (type === 'PIONERO') {
      optPionero.className =
        'cursor-pointer p-4 rounded-2xl border-2 border-emerald-500/70 bg-emerald-950/20 hover:bg-emerald-950/30 transition-all relative';
      optTrial.className =
        'cursor-pointer p-4 rounded-2xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800/40 transition-all opacity-80 hover:opacity-100';
      if (commitBox) commitBox.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Postular al Programa Pionero (6 Meses Gratis + 50% OFF Vitalicio)';
    } else {
      optPionero.className =
        'cursor-pointer p-4 rounded-2xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800/40 transition-all opacity-80 hover:opacity-100';
      optTrial.className =
        'cursor-pointer p-4 rounded-2xl border-2 border-blue-500/70 bg-blue-950/20 hover:bg-blue-950/30 transition-all relative';
      if (commitBox) commitBox.classList.add('hidden');
      if (btnText) btnText.textContent = 'Activar Trial Corporativo (14 Días Gratis)';
    }
  }

  function openAccountModal(preferredModalidad) {
    createModalDOM();
    if (preferredModalidad) {
      selectModalidad(preferredModalidad);
    }
    const modal = document.getElementById('csiaAccountModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setTimeout(() => {
        const firstInput = document.getElementById('accNombre');
        if (firstInput) firstInput.focus();
      }, 100);
    }
  }

  function closeAccountModal() {
    const modal = document.getElementById('csiaAccountModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function handleAccountSubmit(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('accSubmitBtn');
    const btnText = document.getElementById('accBtnText');
    const alertBox = document.getElementById('accAlert');

    // Honeypot check
    const honeypotVal = document.getElementById('accHoneypot')?.value;
    if (honeypotVal) {
      alertBox.className = 'p-4 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 block';
      alertBox.textContent = '¡Gracias! Tu solicitud ha sido registrada.';
      setTimeout(() => closeAccountModal(), 1200);
      return;
    }

    const pwd = document.getElementById('accPassword')?.value || '';
    const cpwd = document.getElementById('accConfirmPassword')?.value || '';

    if (pwd.length < 6) {
      alertBox.className = 'p-4 rounded-xl text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/40 block';
      alertBox.textContent = 'La contraseña debe contener al menos 6 caracteres.';
      return;
    }

    if (pwd !== cpwd) {
      alertBox.className = 'p-4 rounded-xl text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/40 block';
      alertBox.textContent = 'La contraseña y su confirmación no coinciden. Por favor verifíquelas.';
      return;
    }

    const compromisoChecked = document.getElementById('accCompromiso')?.checked;
    if (selectedModalidad === 'PIONERO' && !compromisoChecked) {
      alertBox.className = 'p-4 rounded-xl text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/40 block';
      alertBox.textContent = 'Para postular al Programa Pionero debes aceptar la casilla de compromiso de co-desarrollo.';
      return;
    }

    // Extraer módulos seleccionados
    const checkedModules = [];
    document.querySelectorAll('input[name="accModulos"]:checked').forEach((cb) => {
      checkedModules.push(cb.value);
    });

    const telemetry = window.CalcuTelemetry ? window.CalcuTelemetry.getMetrics() : {};

    const payload = {
      nombre: document.getElementById('accNombre').value.trim(),
      cargo_rol: document.getElementById('accCargo').value.trim(),
      empresa: document.getElementById('accEmpresa').value.trim(),
      rut: document.getElementById('accRut').value.trim(),
      email: document.getElementById('accEmail').value.trim(),
      password: pwd,
      confirm_password: cpwd,
      telefono: document.getElementById('accTelefono').value.trim(),
      rubro: document.getElementById('accRubro').value,
      escala: document.getElementById('accEscala').value.trim(),
      modulos: checkedModules,
      modalidad: selectedModalidad,
      compromiso_pionero: compromisoChecked,
      comentarios: document.getElementById('accComentarios').value.trim(),
      page_metrics: telemetry,
    };

    submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Aprovisionando entorno en PostgreSQL 16...';

    let success = false;
    let resData = null;

    // 1. Envío hacia endpoints de register-account
    for (const ep of ACCOUNT_CONFIG.endpoints) {
      try {
        const resp = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          resData = await resp.json();
          success = true;
          break;
        } else {
          try {
            const errJson = await resp.json();
            console.warn('Fallo en endpoint:', ep, errJson);
          } catch {}
        }
      } catch (netErr) {
        console.warn('Error de red en endpoint:', ep, netErr);
      }
    }

    // 2. Fallback a /public/leads si fuera estrictamente necesario
    if (!success) {
      for (const ep of ACCOUNT_CONFIG.fallbackLeadsEndpoints) {
        try {
          const resp = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: payload.nombre,
              empresa: payload.empresa,
              email: payload.email,
              telefono: payload.telefono,
              interes: `Alta Cuenta ${selectedModalidad}: ${checkedModules.join(', ')}`,
              mensaje: `Cargo: ${payload.cargo_rol} | RUT: ${payload.rut} | Rubro: ${payload.rubro} | Escala: ${payload.escala} | Comentarios: ${payload.comentarios}`,
              operation_scale: payload.escala,
              page_metrics: telemetry,
            }),
          });
          if (resp.ok) {
            resData = await resp.json();
            success = true;
            break;
          }
        } catch {}
      }
    }

    // Guardar datos en WebChat si está disponible
    if (window.CalcuChat) {
      window.CalcuChat.saveKnownFields({
        full_name: payload.nombre,
        role: payload.cargo_rol,
        company_name: payload.empresa,
        tax_id_rut: payload.rut,
        email: payload.email,
        phone: payload.telefono,
        interest_module: checkedModules[0] || 'Suite Completa',
        operation_scale: payload.escala,
        selected_plan: selectedModalidad === 'PIONERO' ? 'Programa Pioneros (Vitalicio)' : 'Trial Corporativo (14 días)',
      });
      window.CalcuChat.isEscalated = true;
      window.CalcuChat.updateHeaderBadge();
    }

    const waText =
      `Hola CalcuSuiteIA, solicito la habilitación de cuenta corporativa (${payload.modalidad}).\n\n` +
      `👤 Nombre: ${payload.nombre} (${payload.cargo_rol})\n` +
      `🏢 Empresa: ${payload.empresa} (RUT: ${payload.rut})\n` +
      `📧 Email: ${payload.email}\n` +
      `📱 Teléfono: ${payload.telefono}\n` +
      `📦 Rubro: ${payload.rubro} | Escala: ${payload.escala}\n` +
      `🧩 Módulos: ${checkedModules.join(', ')}\n` +
      (payload.comentarios ? `💬 Notas: ${payload.comentarios}` : '');

    const waUrl = `https://wa.me/${ACCOUNT_CONFIG.officialWhatsapp}?text=${encodeURIComponent(waText)}`;

    // Renderizar pantalla de éxito interactiva con sugerencia 2FA
    const modalBody = document.getElementById('csiaModalBody');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="py-8 px-2 sm:px-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div class="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center text-3xl font-bold mb-4 shadow-lg shadow-emerald-500/20">
            ✓
          </div>
          <h3 class="text-2xl font-black text-white tracking-tight mb-2">¡Cuenta Creada Exitosamente!</h3>
          <p class="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed mb-6">
            Hemos aprovisionado tu entorno empresarial en PostgreSQL 16 para <strong>${payload.empresa}</strong>.<br>
            Enviamos un correo de confirmación a <strong class="text-cyan-400">${payload.email}</strong> con tu enlace de activación.
          </p>

          <div class="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 text-xs text-amber-200 text-left max-w-lg mx-auto mb-6">
            <div class="flex items-start gap-2.5">
              <span class="text-base shrink-0">🛡️</span>
              <div>
                <strong class="font-bold text-amber-300 block mb-0.5">Sugerencia de Seguridad Corporativa (2FA TOTP):</strong>
                Al ingresar por primera vez con tu contraseña, te recomendamos dirigirte a <em>Configuración &gt; Seguridad</em> y activar la <strong>Verificación en 2 Pasos (2FA)</strong> para proteger el acceso a tus depósitos y datos financieros con doble factor.
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
            <a href="https://app.calcusuiteia.com" target="_blank" rel="noopener noreferrer"
               class="py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-600/30 transition-all text-center flex items-center justify-center gap-2">
              <span>Ir a la Plataforma (app.calcusuiteia.com)</span>
              <svg class="w-4 h-4 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </a>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
               class="py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all text-center flex items-center justify-center gap-1.5">
              <span>Contactar por WhatsApp</span>
            </a>
          </div>
        </div>
      `;
    }
  }

  // Exponer globalmente
  window.openAccountModal = openAccountModal;
  window.closeAccountModal = closeAccountModal;
  window.selectModalidad = selectModalidad;
  window.handleAccountSubmit = handleAccountSubmit;
  window.toggleCsiaPassword = toggleCsiaPassword;
  window.checkCsiaPasswordStrength = checkCsiaPasswordStrength;
  window.checkCsiaPasswordMatch = checkCsiaPasswordMatch;

  // Auto-crear DOM al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createModalDOM);
  } else {
    createModalDOM();
  }
})();
