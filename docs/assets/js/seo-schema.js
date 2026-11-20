/* CalcuSuiteIA — External JSON-LD Structured Data Loader (seo-schema.js) */
(function () {
  if (typeof document === 'undefined') return;
  var routeFile = document.documentElement.getAttribute('data-route') || 'index.html';
  var routes = {"index.html":{"title":"CalcuSuiteIA","description":"CRM Omnicanal, Gemelo Digital 3D, Suite 3PL, Contabilidad DGI, Mesa Broker e IA Learning en planes claros desde USD 79/mes.","canonicalUrl":"https://calcusuiteia.com/"},"documentacion.html":{"title":"Documentación & Manuales 2026","description":"Explorador de 29 capítulos operativos, guía por roles Tenant vs SuperAdmin, App Android APK y PDF completo descargable.","canonicalUrl":"https://calcusuiteia.com/documentacion.html"},"tutoriales.html":{"title":"Tutoriales & Guías Interactivas","description":"Guías paso a paso de operación omnicanal, Gemelo 3D, e-Factura DGI y Mesa Broker.","canonicalUrl":"https://calcusuiteia.com/documentacion.html"},"modulo-chat-omnicanal.html":{"title":"Chat Omnicanal & Copiloto IA","description":"Bandeja unificada WhatsApp, Mail B2B y Pipeline Kanban con IA.","canonicalUrl":"https://calcusuiteia.com/modulo-chat-omnicanal.html"},"crm-omnicanal-ia.html":{"title":"CRM Omnicanal IA","description":"Bandeja unificada WhatsApp, Mail B2B y Pipeline Kanban con IA.","canonicalUrl":"https://calcusuiteia.com/modulo-chat-omnicanal.html"},"modulo-gemelo-digital-3d.html":{"title":"Gemelo Digital 3D WMS","description":"Visualización 3D AABB en tiempo real para depósitos y racks.","canonicalUrl":"https://calcusuiteia.com/modulo-gemelo-digital-3d.html"},"gemelo-digital-3d.html":{"title":"Gemelo Digital 3D","description":"Visualización 3D AABB en tiempo real para depósitos y racks.","canonicalUrl":"https://calcusuiteia.com/modulo-gemelo-digital-3d.html"},"modulo-control-room.html":{"title":"Control Room & Supply Chain ROP","description":"Control de inventario multinivel, DOH y reposición asistida.","canonicalUrl":"https://calcusuiteia.com/modulo-control-room.html"},"modulo-logistica-3pl.html":{"title":"Suite Logística 3PL Completa","description":"Flota GPS, WMS multi-cliente, remitos QR y rentabilidad 3PL.","canonicalUrl":"https://calcusuiteia.com/modulo-logistica-3pl.html"},"logistica-3pl.html":{"title":"Logística 3PL","description":"Flota GPS, WMS multi-cliente, remitos QR y rentabilidad 3PL.","canonicalUrl":"https://calcusuiteia.com/modulo-logistica-3pl.html"},"modulo-facturacion-cfe.html":{"title":"e-Factura DGI & Cobranzas","description":"Comprobantes CFE DGI, libro diario e intimaciones automáticas.","canonicalUrl":"https://calcusuiteia.com/modulo-facturacion-cfe.html"},"modulo-cobranzas-finanzas.html":{"title":"Contabilidad DGI & Conciliación IA","description":"Partida doble, libro mayor y conciliación fiscal IA.","canonicalUrl":"https://calcusuiteia.com/modulo-cobranzas-finanzas.html"},"contabilidad-efactura.html":{"title":"Contabilidad & e-Factura","description":"Comprobantes CFE DGI, libro diario y conciliación fiscal IA.","canonicalUrl":"https://calcusuiteia.com/modulo-facturacion-cfe.html"},"modulo-licitaciones-radar.html":{"title":"Licitaciones ARCE / SICE","description":"Radar automático de licitaciones estatales y cotizador histórico.","canonicalUrl":"https://calcusuiteia.com/modulo-licitaciones-radar.html"},"licitaciones-arce-sice.html":{"title":"Radar Licitaciones ARCE/SICE","description":"Monitoreo automático de compras públicas estatales.","canonicalUrl":"https://calcusuiteia.com/modulo-licitaciones-radar.html"},"modulo-mercadolibre.html":{"title":"Mercado Libre Uruguay OAuth2","description":"Publicación masiva y prevención anti-penalizaciones IA.","canonicalUrl":"https://calcusuiteia.com/modulo-mercadolibre.html"},"modulo-integraciones-hub.html":{"title":"Hub de Integraciones Transversal","description":"Conectores WhatsApp, Meta, Google, WeTrade, TradingView y DGI.","canonicalUrl":"https://calcusuiteia.com/modulo-integraciones-hub.html"},"hub-integraciones-ia.html":{"title":"Hub Integraciones IA","description":"Marketplace de conectores multicanal con bóveda cifrada 256-bit.","canonicalUrl":"https://calcusuiteia.com/modulo-integraciones-hub.html"},"modulo-difusion-campanas.html":{"title":"Campañas B2B & Redactor IA","description":"Segmentación por etiquetas y envíos masivos trazables.","canonicalUrl":"https://calcusuiteia.com/modulo-difusion-campanas.html"},"modulo-mesa-dinero-broker.html":{"title":"Mesa Broker OTC, FX & Quant ATR","description":"8 estaciones de trading con aislamiento Chinese Wall por tenant.","canonicalUrl":"https://calcusuiteia.com/modulo-mesa-dinero-broker.html"},"mesa-broker-trading-ia.html":{"title":"Mesa Broker & Trading IA","description":"8 estaciones de trading con aislamiento Chinese Wall por tenant.","canonicalUrl":"https://calcusuiteia.com/modulo-mesa-dinero-broker.html"},"seguridad.html":{"title":"Seguridad Técnica, FORCE RLS & Cifrado","description":"Arquitectura Multi-Tenant PostgreSQL 16 FORCE RLS, bóveda 256-bit Encrypt-then-MAC, JWT JTI, soporte JIT 60m y controles alineados a ISO/IEC 27001.","canonicalUrl":"https://calcusuiteia.com/seguridad.html"},"nosotros.html":{"title":"Nosotros & Programa Pioneros","description":"Plataforma pensada para proveedores del Estado (RUPE), importadoras, 3PL y escritorios financieros en Uruguay y LATAM.","canonicalUrl":"https://calcusuiteia.com/nosotros.html"},"blog.html":{"title":"Novedades Producto 2026","description":"Lanzamiento de planes modulares 2A/2B, Créditos IA, endurecimiento HMAC/SSRF y UX Light-First.","canonicalUrl":"https://calcusuiteia.com/blog.html"},"terminos.html":{"title":"Términos de Servicio, Ley 18.331 & Seguridad de Datos","description":"Condiciones comerciales, protección de datos personales Ley N° 18.331 Uruguay, portabilidad, retención y alcance de fuentes públicas RUPE/ARCE.","canonicalUrl":"https://calcusuiteia.com/terminos.html"},"privacidad.html":{"title":"Política de Privacidad (Ley N° 18.331)","description":"Política de privacidad, derechos ARCO Ley N° 18.331 Uruguay, cifrado DH-2048/256-bit y aislamiento PostgreSQL FORCE RLS.","canonicalUrl":"https://calcusuiteia.com/privacidad.html"}};
  var faq = [{"q":"¿Cómo funciona la elección entre las 2 opciones del Plan 2 (USD 190/mes)?","a":"Al activar el Plan 2 Pro Especializado eliges la vertical principal de tu empresa: Opción 2A (Trading & Fintech Broker) con las 8 estaciones financieras y conectores WeTrade/TradingView/Wallets, u Opción 2B (Suite 3PL Completa) con gestión multi-dador de carga, Flota GPS y App Android para entregas. Ambas opciones incluyen el 100% del Plan 1 Starter y 5.000 Créditos IA/mes. Si en el futuro necesitas ambas verticales juntas más Licitaciones ARCE y Mercado Libre, pasas al Plan 3 Enterprise 360° conservando todos tus datos."},{"q":"¿Qué incluyen los Créditos IA mensuales y cuánto rinden en la operación diaria?","a":"Cada plan incluye una bolsa mensual renovable: 1.000 créditos en Plan 1 Starter (~45 acciones IA por día hábil), 5.000 créditos en Plan 2 Pro y 25.000 créditos en Plan 3 Enterprise. 1 crédito equivale a generar 3 borradores contextuales en el Copiloto Omnicanal, 1 diagnóstico completo del Coach IA en cualquiera de los 4 Kanbans o 1 conciliación contable/fiscal IA. El consumo es 100% visible en tu cabecera y puedes ampliar paquetes bajo demanda."},{"q":"¿El cliente final ve configuraciones técnicas de servidores o modelos internos?","a":"No. Separamos estrictamente la consola de Gobierno SaaS (exclusiva del SuperAdmin UID-0001) del espacio operativo de cada empresa. Cada Tenant administra únicamente su equipo, sus clientes, sus integraciones, sus autorizaciones de soporte temporal JIT (5 a 60 minutos) y sus créditos IA en una interfaz limpia y enfocada en el negocio."},{"q":"¿Los proveedores de RUPE y llamados ARCE/SICE son información pública?","a":"Sí. El módulo de Licitaciones y Compras Estatales (incluido en Plan 3 Enterprise) consulta únicamente datos abiertos publicados oficialmente por RUPE (Registro Único de Proveedores del Estado) y ARCE / SICE en Uruguay, que constituyen registros de información pública estatal y nunca involucran bases privadas de otros clientes."},{"q":"¿Cuál es la diferencia entre la Demo Guiada de 14 Días y el Programa Pioneros (20 Cupos)?","a":"Toda empresa puede activar la Demo Guiada de 14 Días sin costo y sin tarjeta de crédito con aprovisionamiento instantáneo en PostgreSQL 16 (FORCE RLS). El Programa Pioneros está reservado para los primeros 20 clientes estratégicos y suma a los 14 días de prueba gratuita: Onboarding asistido sin cargo + 50% de bonificación durante los primeros 6 meses en el plan elegido."}];
  var meta = routes[routeFile] || routes['index.html'];

  function injectJsonLd(obj) {
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  injectJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CalcuSuiteIA',
    url: 'https://calcusuiteia.com/',
    logo: 'https://calcusuiteia.com/screenshots/Imagenes%20web/calcuwebprincipal.webp',
    email: 'contacto@calcusuiteia.com',
    areaServed: ['UY', 'LATAM']
  });

  if (meta) {
    injectJsonLd({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: meta.title,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android',
      url: meta.canonicalUrl,
      description: meta.description,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '79',
        highPrice: '490'
      }
    });
  }

  if (routeFile === 'index.html' && Array.isArray(faq) && faq.length > 0) {
    injectJsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(function (f) {
        return {
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.a
          }
        };
      })
    });
  }
})();
