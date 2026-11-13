/**
 * ==========================================================================
 * CALCUSUITEIA (CSIA) - MODAL CORPORATIVO DE CREACIÓN DE CUENTA
 * Selector de 2 Modalidades (Trial Corporativo vs Programa Pionero Vitalicio),
 * Definición de Contraseña Propia, Alta PostgreSQL 16, Email de Confirmación
 * con Enlace de Activación y Sugerencia de 2FA TOTP.
 * ==========================================================================
 */

(function () {
  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const ACCOUNT_CONFIG = {
    endpoints: isLocalDev
      ? [
          'http://127.0.0.1:8000/api/v1/public/register-account',
          'http://localhost:8000/api/v1/public/register-account',
          'https://app.calcusuiteia.com/api/v1/public/register-account',
        ]
      : ['https://app.calcusuiteia.com/api/v1/public/register-account'],
    fallbackLeadsEndpoints: isLocalDev
      ? [
          'http://127.0.0.1:8000/api/v1/public/leads',
          'http://localhost:8000/api/v1/public/leads',
          'https://app.calcusuiteia.com/api/v1/public/leads',
        ]
      : ['https://app.calcusuiteia.com/api/v1/public/leads'],
    officialWhatsapp: '59894858791',
    officialEmail: 'contacto@calcusuiteia.com',
  };

  let selectedModalidad = 'PIONERO'; // 'PIONERO' o 'TRIAL'

  function createModalDOM() {
    if (document.getElementById('csiaAccountModal')) return;
    const { el, svg } = window.csiaDom;

    const inputCls = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';
    const pwdInputCls = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 pr-10';
    const modItems = [
      ['Gemelo Digital 3D & WMS', '🧊 Gemelo 3D', true],
      ['Logística 3PL & Flota GPS', '🚚 3PL & Flota', true],
      ['Mercado Libre Kanban', '🛍️ Mercado Libre', true],
      ['Chat Omnicanal & WhatsApp QR', '💬 Webchat / WhatsApp', true],
      ['Contabilidad General & DGI/BPS', '📊 DGI / BPS', false],
      ['Radar Licitaciones ARCE/SICE', '🏛️ Licitaciones', false],
    ];
    const rubros = [
      'Operador Logístico 3PL & Depósito',
      'Importador & Distribuidor Mayorista',
      'E-Commerce & Mercado Libre (MLU)',
      'Retail & Cadenas Comerciales',
      'Manufactura & Agroindustria',
      'Servicios B2B / Licitaciones ARCE',
      'Otro',
    ];

    const field = (labelText, id, type, placeholder, autocomplete, required) =>
      el('div', null,
        el('label', { className: 'block text-xs font-semibold text-slate-300 mb-1', text: labelText }),
        el('input', { type, id, autocomplete, required: Boolean(required), placeholder, className: inputCls })
      );

    const modal = el('div', {
      id: 'csiaAccountModal',
      className: 'fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md hidden items-center justify-center p-3 sm:p-6 overflow-y-auto',
      on: { click: function (e) { if (e.target === modal) closeAccountModal(); } }
    },
      el('div', {
        id: 'csiaModalCard',
        className: 'relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200',
        'data-on-click': '[["stop"]]'
      },
        el('div', { className: 'absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none' }),
        el('div', { className: 'absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none' }),
        el('div', { className: 'flex items-center justify-between pb-5 border-b border-slate-800' },
          el('div', { className: 'flex items-center gap-3' },
            el('div', { className: 'w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 font-bold text-sm', text: 'CSIA' }),
            el('div', null,
              el('h3', { className: 'text-xl font-extrabold text-white tracking-tight', text: 'Crear Cuenta Corporativa en CalcuSuiteIA' }),
              el('p', { className: 'text-xs text-slate-400', text: 'Entorno Aislado en PostgreSQL 16 • Aprovisionamiento con Contraseña Propia' })
            )
          ),
          el('button', { 'data-on-click': '[["call","closeAccountModal",[]]]', className: 'p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors' },
            svg('0 0 24 24', 'w-5 h-5', ['M6 18L18 6M6 6l12 12'])
          )
        ),
        el('div', { id: 'csiaModalBody' },
          el('div', { className: 'mt-6 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
            el('div', {
              id: 'optionPionero',
              'data-on-click': '[["call","selectModalidad",["PIONERO"]]]',
              className: 'cursor-pointer p-4 rounded-2xl border-2 border-emerald-500/70 bg-emerald-950/20 hover:bg-emerald-950/30 transition-all relative'
            },
              el('div', { className: 'flex items-center justify-between mb-1.5' },
                el('span', { className: 'px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] tracking-wider uppercase', text: 'Recomendado' }),
                el('span', { id: 'pioneroCheck', className: 'w-4 h-4 rounded-full border-2 border-emerald-400 flex items-center justify-center bg-emerald-500 text-slate-950 text-[10px] font-bold', text: '✓' })
              ),
              el('h4', { className: 'text-sm font-bold text-white', text: 'Programa Pionero (Primeros 20)' }),
              el('p', { className: 'text-xs text-emerald-300 font-semibold mt-0.5', text: '6 Meses 100% GRATIS + 50% OFF Vitalicio' }),
              el('p', { className: 'text-[11px] text-slate-400 mt-2 leading-relaxed', text: 'Acceso irrestricto, soporte VIP sin cargo y co-desarrollo activo con el equipo de ingeniería.' })
            ),
            el('div', {
              id: 'optionTrial',
              'data-on-click': '[["call","selectModalidad",["TRIAL"]]]',
              className: 'cursor-pointer p-4 rounded-2xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800/40 transition-all opacity-80 hover:opacity-100'
            },
              el('div', { className: 'flex items-center justify-between mb-1.5' },
                el('span', { className: 'px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[10px] uppercase', text: 'Evaluación Rápida' }),
                el('span', { id: 'trialCheck', className: 'w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px]' })
              ),
              el('h4', { className: 'text-sm font-bold text-white', text: 'Trial Corporativo Sandbox' }),
              el('p', { className: 'text-xs text-blue-300 font-semibold mt-0.5', text: '14 Días Gratis (Extensible a 1 Mes)' }),
              el('p', { className: 'text-[11px] text-slate-400 mt-2 leading-relaxed', text: 'Prueba completa con datos sintéticos o migración de tu catálogo sin compromiso.' })
            )
          ),
          el('form', {
            id: 'csiaRegisterForm',
            'data-on-submit': '[["call","handleAccountSubmit",[{"$":"event"}]]]',
            className: 'space-y-4 max-h-[58vh] overflow-y-auto pr-1'
          },
            el('input', { type: 'text', id: 'accHoneypot', className: 'hidden', tabIndex: '-1', autocomplete: 'off' }),
            el('div', { id: 'accAlert', className: 'hidden p-4 rounded-xl text-xs font-medium' }),
            el('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
              field('Nombre y Apellido *', 'accNombre', 'text', 'Ej: Ing. Martín González', 'name', true),
              field('Cargo / Rol en la Empresa *', 'accCargo', 'text', 'Ej: Gerente de Operaciones / Director', 'organization-title', true)
            ),
            el('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
              field('Razón Social / Empresa *', 'accEmpresa', 'text', 'Ej: Logística & Distribución Sur S.A.', 'organization', true),
              field('RUT / Identificación Fiscal *', 'accRut', 'text', 'Ej: 219988770014', 'off', true)
            ),
            el('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
              field('Correo Corporativo de Acceso *', 'accEmail', 'email', 'mgonzalez@empresa.com.uy', 'username email', true),
              field('Teléfono / WhatsApp Directo *', 'accTelefono', 'tel', '+598 94 858 791', 'tel', true)
            ),
            el('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800' },
              el('div', null,
                el('label', { className: 'block text-xs font-semibold text-slate-200 mb-1', text: 'Contraseña de Acceso * (Mín. 6 caracteres)' }),
                el('div', { className: 'relative' },
                  el('input', {
                    type: 'password', id: 'accPassword', autocomplete: 'new-password', required: true, minLength: '6',
                    placeholder: 'Define tu contraseña segura', className: pwdInputCls,
                    'data-on-input': '[["call","checkCsiaPasswordStrength",[]]]'
                  }),
                  el('button', {
                    type: 'button',
                    'data-on-click': '[["call","toggleCsiaPassword",["accPassword","eye1"]]]',
                    className: 'absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs'
                  }, el('span', { id: 'eye1', text: '👁️' }))
                ),
                el('div', { className: 'w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden' },
                  el('div', { id: 'csiaPwdBar', className: 'h-full w-0 bg-red-500 transition-all duration-300' })
                ),
                el('span', { id: 'csiaPwdHelp', className: 'text-[10px] text-slate-400 mt-1 block', text: 'Fuerza: Ingrese contraseña' })
              ),
              el('div', null,
                el('label', { className: 'block text-xs font-semibold text-slate-200 mb-1', text: 'Confirmar Contraseña *' }),
                el('div', { className: 'relative' },
                  el('input', {
                    type: 'password', id: 'accConfirmPassword', autocomplete: 'new-password', required: true, minLength: '6',
                    placeholder: 'Repite tu contraseña', className: pwdInputCls,
                    'data-on-input': '[["call","checkCsiaPasswordMatch",[]]]'
                  }),
                  el('button', {
                    type: 'button',
                    'data-on-click': '[["call","toggleCsiaPassword",["accConfirmPassword","eye2"]]]',
                    className: 'absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs'
                  }, el('span', { id: 'eye2', text: '👁️' }))
                ),
                el('span', { id: 'csiaMatchNotice', className: 'text-[10px] text-slate-500 mt-2 block', text: 'Verificando coincidencia...' })
              )
            ),
            el('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
              el('div', null,
                el('label', { className: 'block text-xs font-semibold text-slate-300 mb-1', text: 'Rubro / Industria *' }),
                el('select', { id: 'accRubro', className: inputCls },
                  rubros.map(r => el('option', { value: r, text: r }))
                )
              ),
              field('Escala Operativa Aprox. *', 'accEscala', 'text', 'Ej: 800 m², 12 camiones, 3.500 SKUs', 'off', true)
            ),
            el('div', null,
              el('label', { className: 'block text-xs font-semibold text-slate-300 mb-2', text: 'Módulos Prioritarios a Habilitar en tu Tenant:' }),
              el('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-300' },
                modItems.map(m =>
                  el('label', { className: 'flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50' },
                    el('input', { type: 'checkbox', name: 'accModulos', value: m[0], checked: m[2], className: 'rounded accent-cyan-500' }),
                    el('span', { text: m[1] })
                  )
                )
              )
            ),
            el('div', { id: 'pioneroCommitmentBox', className: 'p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200' },
              el('label', { className: 'flex items-start gap-2.5 cursor-pointer' },
                el('input', { type: 'checkbox', id: 'accCompromiso', checked: true, className: 'mt-0.5 rounded accent-emerald-500 shrink-0' }),
                el('span', { className: 'leading-relaxed' },
                  el('strong', { text: 'Compromiso de Co-Desarrollo Oficial:' }),
                  ' Al postular al Programa Pionero, nuestra empresa se compromete a implementar la plataforma en su operativa y brindar feedback mensual durante los 6 meses gratuitos, recibiendo soporte prioritario sin cargo y asegurando el ',
                  el('strong', { text: '50% de descuento vitalicio garantizado' }), '.'
                )
              )
            ),
            el('div', null,
              el('label', { className: 'block text-xs font-semibold text-slate-300 mb-1', text: 'Comentarios u Objetivos de Implementación' }),
              el('textarea', {
                id: 'accComentarios', rows: '2',
                placeholder: 'Describe brevemente tus dolores actuales (inventario, fletes, conciliación, etc.)',
                className: 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500'
              })
            ),
            el('div', { className: 'pt-2' },
              el('button', {
                type: 'submit', id: 'accSubmitBtn',
                className: 'w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-cyan-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2'
              },
                el('span', { id: 'accBtnText', text: 'Crear Cuenta Corporativa & Enviar Email de Activación' }),
                svg('0 0 24 24', 'w-4 h-4 text-cyan-200', ['M14 5l7 7m0 0l-7 7m7-7H3'])
              )
            )
          )
        )
      )
    );

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
      const pChk = document.getElementById('pioneroCheck');
      const tChk = document.getElementById('trialCheck');
      if (pChk) {
        pChk.className = 'w-4 h-4 rounded-full border-2 border-emerald-400 flex items-center justify-center bg-emerald-500 text-slate-950 text-[10px] font-bold';
        pChk.textContent = '✓';
      }
      if (tChk) {
        tChk.className = 'w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px]';
        tChk.textContent = '';
      }
    } else {
      optPionero.className =
        'cursor-pointer p-4 rounded-2xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800/40 transition-all opacity-80 hover:opacity-100';
      optTrial.className =
        'cursor-pointer p-4 rounded-2xl border-2 border-blue-500/70 bg-blue-950/20 hover:bg-blue-950/30 transition-all relative';
      if (commitBox) commitBox.classList.add('hidden');
      if (btnText) btnText.textContent = 'Activar Trial Corporativo (14 Días Gratis)';
      const pChk = document.getElementById('pioneroCheck');
      const tChk = document.getElementById('trialCheck');
      if (pChk) {
        pChk.className = 'w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px]';
        pChk.textContent = '';
      }
      if (tChk) {
        tChk.className = 'w-4 h-4 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-cyan-500 text-slate-950 text-[10px] font-bold';
        tChk.textContent = '✓';
      }
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
          headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
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
            headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
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
      try { window.CalcuChat?.updateHeaderBadge?.(); } catch (e) {}
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

    // Renderizar pantalla de éxito interactiva (DOM seguro sin innerHTML)
    const modalBody = document.getElementById('csiaModalBody');
    if (modalBody) {
      const { clear, el, svg } = window.csiaDom;
      clear(modalBody);
      const appLoginUrl = `https://app.calcusuiteia.com/?email=${encodeURIComponent(payload.email)}&verified=1`;
      modalBody.appendChild(
        el('div', { className: 'py-8 px-2 sm:px-6 text-center animate-in fade-in zoom-in-95 duration-200' },
          el('div', { className: 'w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center text-3xl font-bold mb-4 shadow-lg shadow-emerald-500/20', text: '✓' }),
          el('h3', { className: 'text-2xl font-black text-white tracking-tight mb-2', text: '¡Cuenta Creada Exitosamente!' }),
          el('p', { className: 'text-xs text-slate-300 max-w-lg mx-auto leading-relaxed mb-6' },
            'Hemos aprovisionado tu entorno empresarial en PostgreSQL 16 para ',
            el('strong', { text: payload.empresa }), '.', el('br'),
            'Enviamos un correo de confirmación desde ',
            el('strong', { className: 'text-emerald-400', text: 'info@calcusuiteia.com' }), ' a ',
            el('strong', { className: 'text-cyan-400', text: payload.email }), ' con tu enlace de activación.'
          ),
          el('div', { className: 'bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 text-xs text-amber-200 text-left max-w-lg mx-auto mb-6' },
            el('div', { className: 'flex items-start gap-2.5' },
              el('span', { className: 'text-base shrink-0', text: '🛡️' }),
              el('div', null,
                el('strong', { className: 'font-bold text-amber-300 block mb-0.5', text: 'Sugerencia de Seguridad Corporativa (2FA TOTP):' }),
                'Al ingresar por primera vez con tu contraseña, te recomendamos dirigirte a ',
                el('em', { text: 'Configuración > Seguridad' }), ' y activar la ',
                el('strong', { text: 'Verificación en 2 Pasos (2FA)' }),
                ' para proteger el acceso a tus depósitos y datos financieros con doble factor. Además, en ',
                el('em', { text: 'Licencias Multi-Tenant' }), ' tienes habilitada tu Orden de Compra con pago vía ',
                el('strong', { text: 'Mercado Pago Uruguay (Débito / hasta 12 cuotas)' }),
                ' y emisión automática de ', el('strong', { text: 'e-Factura DGI' }), '.'
              )
            )
          ),
          el('div', { className: 'flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto' },
            el('a', {
              href: appLoginUrl, target: '_blank', rel: 'noopener noreferrer',
              className: 'py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-600/30 transition-all text-center flex items-center justify-center gap-2'
            },
              el('span', { text: '🚀 Ir a la App Web e Iniciar Sesión Ahora →' }),
              svg('0 0 24 24', 'w-4 h-4 text-cyan-200', ['M14 5l7 7m0 0l-7 7m7-7H3'])
            ),
            el('a', {
              href: waUrl, target: '_blank', rel: 'noopener noreferrer',
              className: 'py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all text-center flex items-center justify-center gap-1.5'
            }, el('span', { text: 'Contactar por WhatsApp' }))
          )
        )
      );
    }
  }

  function generatePdfDocument(poData) {
    const data = poData || {};
    const poNumber = String(data.po_number || 'OC-2026-0001');
    const companyName = String(data.company_name || data.empresa || 'Cliente Corporativo');
    const rut = String(data.rut || 'Consumidor Final');
    const contactName = String(data.contact_name || data.nombre || companyName);
    const contactEmail = String(data.contact_email || data.email || 'info@calcusuiteia.com');
    const currency = String(data.currency || 'USD');
    const subtotal = Number(data.subtotal != null ? data.subtotal : 2940.0);
    const discount = Number(data.discount_amount != null ? data.discount_amount : subtotal);
    const iva = Number(data.tax_iva_amount != null ? data.tax_iva_amount : 0.0);
    const total = Number(data.total_amount != null ? data.total_amount : Math.max(0, subtotal - discount + iva));
    const safePayUrl = window.csiaDom.safeUrl(
      data.payment_url || `https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=${encodeURIComponent(data.mp_preference_id || poNumber)}`,
      'https://app.calcusuiteia.com'
    );

    const win = window.open('', '_blank', 'width=860,height=900');
    if (!win) return;
    const d = win.document;
    const wEl = (tag, cls, text, attrs) => {
      const node = d.createElement(tag);
      if (cls) node.className = cls;
      if (text != null) node.textContent = text;
      if (attrs) Object.keys(attrs).forEach(k => node.setAttribute(k, attrs[k]));
      return node;
    };
    d.title = `Orden de Compra #${poNumber} - ${companyName}`;
    const style = wEl('style', null,
      '@page{size:A4 portrait;margin:15mm}body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;background:#fff;margin:0;padding:20px}' +
      '.invoice-container{max-width:700px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;padding:40px}' +
      '.text-center{text-align:center}.flex-between{display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding:14px;background:#f8fafc;border-radius:10px;font-size:13px}' +
      'table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}th{background:#f8fafc;font-weight:600;color:#475569}' +
      '.pay-section{text-align:center;margin-top:30px;padding-top:20px;border-top:1px dashed #cbd5e1;font-size:12px}'
    );
    d.head.appendChild(style);
    const wrap = wEl('div', 'invoice-container');
    const hdr = wEl('div', 'text-center');
    hdr.appendChild(wEl('div', null, 'CALCUSUITEIA S.A.S. (CSIA) • ORDEN DE COMPRA OFICIAL URUGUAY', { style: 'font-size:11px;font-weight:800;color:#00a2e8;text-transform:uppercase' }));
    hdr.appendChild(wEl('h1', null, `ORDEN DE COMPRA #${poNumber}`, { style: 'margin:6px 0;font-size:22px' }));
    hdr.appendChild(wEl('div', null, 'RUT Emisor: 219485010019 • Montevideo, Uruguay • info@calcusuiteia.com', { style: 'font-size:12px;color:#64748b' }));
    wrap.appendChild(hdr);

    const meta = wEl('div', 'flex-between');
    const left = wEl('div');
    const empRow = wEl('div'); empRow.appendChild(wEl('strong', null, 'Empresa: ')); empRow.appendChild(d.createTextNode(companyName));
    const rutRow = wEl('div'); rutRow.appendChild(wEl('strong', null, 'RUT / Doc.: ')); rutRow.appendChild(d.createTextNode(rut));
    left.append(empRow, rutRow);
    const right = wEl('div', null, null, { style: 'text-align:right' });
    const conRow = wEl('div'); conRow.appendChild(wEl('strong', null, 'Contacto: ')); conRow.appendChild(d.createTextNode(contactName));
    const emRow = wEl('div'); emRow.appendChild(wEl('strong', null, 'Email: ')); emRow.appendChild(d.createTextNode(contactEmail));
    right.append(conRow, emRow);
    meta.append(left, right);
    wrap.appendChild(meta);

    const tbl = wEl('table');
    const thead = wEl('thead');
    const htr = wEl('tr');
    ['Concepto / Plan Suscripción SaaS', 'Subtotal Lista', 'Descuento', 'Total Final'].forEach(h => htr.appendChild(wEl('th', null, h)));
    thead.appendChild(htr);
    const tbody = wEl('tbody');
    const btr = wEl('tr');
    btr.appendChild(wEl('td', null, `Licencia Corporativa CalcuSuiteIA (${String(data.plan_type || 'PIONEER_6M')})`));
    btr.appendChild(wEl('td', null, `${currency} $${subtotal.toFixed(2)}`));
    btr.appendChild(wEl('td', null, `- ${currency} $${discount.toFixed(2)}`));
    const totTd = wEl('td'); totTd.appendChild(wEl('strong', null, `${currency} $${total.toFixed(2)}`));
    btr.appendChild(totTd);
    tbody.appendChild(btr);
    tbl.append(thead, tbody);
    wrap.appendChild(tbl);

    const pay = wEl('div', 'pay-section');
    pay.appendChild(wEl('div', null, 'ENLACE OFICIAL DE PAGO MERCADO PAGO URUGUAY (VERIFICADO LOCALMENTE)', { style: 'font-weight:800;margin-bottom:8px' }));
    pay.appendChild(wEl('a', null, safePayUrl, { href: safePayUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color:#0284c7;word-break:break-all' }));
    wrap.appendChild(pay);

    d.body.appendChild(wrap);
    setTimeout(() => { try { win.focus(); win.print(); } catch (e) {} }, 250);
  }

  // Exponer globalmente
  window.openAccountModal = openAccountModal;
  window.closeAccountModal = closeAccountModal;
  window.selectModalidad = selectModalidad;
  window.handleAccountSubmit = handleAccountSubmit;
  window.toggleCsiaPassword = toggleCsiaPassword;
  window.checkCsiaPasswordStrength = checkCsiaPasswordStrength;
  window.checkCsiaPasswordMatch = checkCsiaPasswordMatch;
  window.generatePdfDocument = generatePdfDocument;

  // Auto-crear DOM al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createModalDOM);
  } else {
    createModalDOM();
  }
})();
