/**
 * Calcu Suite — Micro-Servidor Local WhatsApp Multi-Device (@whiskeysockets/baileys)
 * ===================================================================================
 * Escucha en http://127.0.0.1:3010 y mantiene un socket real contra WhatsApp Web:
 *   - GET  /status  -> Devuelve el QR oficial de WhatsApp listo para escanear desde
 *                      WhatsApp > Dispositivos vinculados > Vincular un dispositivo,
 *                      o el estado "open" con el número vinculado.
 *   - POST /send    -> Envía un mensaje real por WhatsApp desde el Chat Omnicanal,
 *                      resolviendo automáticamente mapeos @lid <-> @s.whatsapp.net.
 *   - POST /logout  -> Cierra la sesión actual y genera un nuevo código QR.
 */

const http = require("http");
const path = require("path");
const fs = require("fs");

// Resolver paquetes desde scripts/wa_bridge/node_modules
const bridgeNodeModules = path.join(__dirname, "wa_bridge", "node_modules");
module.paths.unshift(bridgeNodeModules);

const PORT = parseInt(process.env.WA_BRIDGE_PORT || "3010", 10);
const CALCU_BASE_URL = process.env.CALCU_BASE_URL || "http://127.0.0.1:8000";
const AUTH_DIR = path.join(__dirname, "..", "tenants_data", "wa_qr_auth_info");
const MEDIA_DIR = path.join(__dirname, "..", "app", "static", "uploads", "omnichannel_media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });

let currentState = {
  bridge_online: true,
  connection: "initializing", // initializing | qr_ready | open | close
  qr_raw: null,
  qr_svg: null,
  linked_phone: null,
  device_label: null,
  updated_at: new Date().toISOString(),
  last_error: null,
};

let activeSock = null;
let isStarting = false;
let reconnectTimer = null;

// Mapa en memoria de LID <-> Teléfono real y último JID activo por contacto
const lidToPhoneMap = new Map();
const phoneToLidMap = new Map();
const lastActiveJidByPhone = new Map();

function formatPhoneDisplay(digits) {
  const clean = String(digits || "").replace(/\D/g, "");
  if (!clean) return "";
  // Formato amigable para Uruguay (+598 XX XXX XXX)
  if (clean.startsWith("598") && clean.length === 11) {
    return `+598 ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  return `+${clean}`;
}

/**
 * Resuelve un identificador (LID o número) usando los archivos lid-mapping-* de Baileys
 * en tenants_data/wa_qr_auth_info/ y el mapa en memoria.
 */
function resolveIdentity(rawInput, msgKey = null) {
  const rawStr = String(rawInput || "");
  const cleanDigits = rawStr.split(":")[0].replace(/@.*$/, "").replace(/\D/g, "");

  // 1. Verificar si msgKey trae senderPn o remoteJidAlt explícito con @s.whatsapp.net
  const altCandidates = [
    msgKey?.senderPn,
    msgKey?.remoteJidAlt,
    msgKey?.participantAlt,
  ].filter(Boolean);

  for (const alt of altCandidates) {
    if (String(alt).endsWith("@s.whatsapp.net")) {
      const pnDigits = String(alt).split(":")[0].replace(/@.*$/, "").replace(/\D/g, "");
      if (pnDigits) {
        if (rawStr.endsWith("@lid") && cleanDigits) {
          lidToPhoneMap.set(cleanDigits, pnDigits);
          phoneToLidMap.set(pnDigits, cleanDigits);
        }
        return {
          phoneDigits: pnDigits,
          phoneDisplay: formatPhoneDisplay(pnDigits),
          lidDigits: rawStr.endsWith("@lid") ? cleanDigits : phoneToLidMap.get(pnDigits) || null,
          preferredJid: rawStr.endsWith("@lid") ? `${cleanDigits}@lid` : `${pnDigits}@s.whatsapp.net`,
        };
      }
    }
  }

  // 2. Consultar archivos lid-mapping-{lid}_reverse.json (cuando cleanDigits es un LID como 72284484202515)
  try {
    const revFile = path.join(AUTH_DIR, `lid-mapping-${cleanDigits}_reverse.json`);
    if (fs.existsSync(revFile)) {
      const mappedPn = JSON.parse(fs.readFileSync(revFile, "utf-8"));
      const pnDigits = String(mappedPn || "").replace(/\D/g, "");
      if (pnDigits) {
        lidToPhoneMap.set(cleanDigits, pnDigits);
        phoneToLidMap.set(pnDigits, cleanDigits);
        return {
          phoneDigits: pnDigits,
          phoneDisplay: formatPhoneDisplay(pnDigits),
          lidDigits: cleanDigits,
          preferredJid: `${cleanDigits}@lid`,
        };
      }
    }
  } catch {}

  // 3. Consultar archivos lid-mapping-{phone}.json (cuando cleanDigits ya es el teléfono real como 59895272502)
  try {
    const fwdFile = path.join(AUTH_DIR, `lid-mapping-${cleanDigits}.json`);
    if (fs.existsSync(fwdFile)) {
      const mappedLid = JSON.parse(fs.readFileSync(fwdFile, "utf-8"));
      const lidDigits = String(mappedLid || "").replace(/\D/g, "");
      if (lidDigits) {
        lidToPhoneMap.set(lidDigits, cleanDigits);
        phoneToLidMap.set(cleanDigits, lidDigits);
        const hasLidSession =
          fs.existsSync(path.join(AUTH_DIR, `session-${lidDigits}_1.0.json`)) ||
          fs.existsSync(path.join(AUTH_DIR, `tctoken-${lidDigits}@lid.json`));
        return {
          phoneDigits: cleanDigits,
          phoneDisplay: formatPhoneDisplay(cleanDigits),
          lidDigits,
          preferredJid: hasLidSession ? `${lidDigits}@lid` : `${cleanDigits}@s.whatsapp.net`,
        };
      }
    }
  } catch {}

  // 4. Consultar memoria si ya fue resuelto previamente
  if (lidToPhoneMap.has(cleanDigits)) {
    const pnDigits = lidToPhoneMap.get(cleanDigits);
    return {
      phoneDigits: pnDigits,
      phoneDisplay: formatPhoneDisplay(pnDigits),
      lidDigits: cleanDigits,
      preferredJid: `${cleanDigits}@lid`,
    };
  }
  if (phoneToLidMap.has(cleanDigits)) {
    const lidDigits = phoneToLidMap.get(cleanDigits);
    return {
      phoneDigits: cleanDigits,
      phoneDisplay: formatPhoneDisplay(cleanDigits),
      lidDigits,
      preferredJid: lastActiveJidByPhone.get(cleanDigits) || `${lidDigits}@lid`,
    };
  }

  return {
    phoneDigits: cleanDigits,
    phoneDisplay: formatPhoneDisplay(cleanDigits),
    lidDigits: rawStr.endsWith("@lid") ? cleanDigits : null,
    preferredJid: rawStr.endsWith("@lid") ? `${cleanDigits}@lid` : `${cleanDigits}@s.whatsapp.net`,
  };
}

async function notifyBackendSync(statusPayload) {
  try {
    await fetch(`${CALCU_BASE_URL}/api/v1/integrations/whatsapp-qr/bridge-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(statusPayload),
    });
  } catch {
    // FastAPI puede no estar listo aún
  }
}

async function startWhatsAppSocket(forceNew = false) {
  if (isStarting) return;
  if (!forceNew && activeSock && currentState.connection === "open") {
    return;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  isStarting = true;

  try {
    if (activeSock) {
      const oldSock = activeSock;
      activeSock = null;
      try {
        oldSock.ev.removeAllListeners("connection.update");
        oldSock.ev.removeAllListeners("messages.upsert");
        oldSock.ev.removeAllListeners("creds.update");
        oldSock.end(undefined);
      } catch {}
    }

    const baileys = await import("./wa_bridge/node_modules/@whiskeysockets/baileys/lib/index.js");
    const QRCode = require("qrcode");
    const pino = require("pino");

    const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = baileys;

    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version = [2, 3000, 1015901307];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) version = latest.version;
    } catch {
      // usar versión estable por defecto
    }

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Calcu Enterprise CRM", "Chrome", "122.0.0"],
      syncFullHistory: false,
    });

    activeSock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      if (sock !== activeSock) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const svgStr = await QRCode.toString(qr, {
            type: "svg",
            margin: 2,
            width: 260,
            errorCorrectionLevel: "M",
            color: { dark: "#0f172a", light: "#ffffff" },
          });
          const svgB64 =
            "data:image/svg+xml;base64," + Buffer.from(svgStr, "utf-8").toString("base64");
          const wasAlreadyQrReady = currentState.connection === "qr_ready";
          currentState = {
            ...currentState,
            connection: "qr_ready",
            qr_raw: qr,
            qr_svg: svgB64,
            updated_at: new Date().toISOString(),
          };
          if (!wasAlreadyQrReady) {
            console.log("[WA-QR Bridge] Servicio WhatsApp QR activo en http://127.0.0.1:3010");
          }
        } catch (err) {
          console.error("[WA-QR Bridge] Error renderizando SVG QR:", err.message);
        }
      }

      if (connection === "open") {
        const rawId = sock.user?.id || "";
        const cleanDigits = rawId.split(":")[0].split("@")[0];
        const cleanNumber = formatPhoneDisplay(cleanDigits) || `+${cleanDigits}`;
        const pushName = sock.user?.name || "WhatsApp Corporativo";
        currentState = {
          bridge_online: true,
          connection: "open",
          qr_raw: null,
          qr_svg: null,
          linked_phone: cleanNumber,
          device_label: `${pushName} (WhatsApp Multi-Dispositivo)`,
          updated_at: new Date().toISOString(),
          last_error: null,
        };
        console.log(`[WA-QR Bridge] ¡CONECTADO ESTABLE! Línea vinculada: ${cleanNumber} (${pushName})`);
        await notifyBackendSync({
          connected: true,
          linked_phone: cleanNumber,
          device_label: currentState.device_label,
        });
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch {}
          currentState = {
            bridge_online: true,
            connection: "initializing",
            qr_raw: null,
            qr_svg: null,
            linked_phone: null,
            device_label: null,
            updated_at: new Date().toISOString(),
            last_error: null,
          };
          await notifyBackendSync({ connected: false });
        }

        if (sock === activeSock) {
          activeSock = null;
          isStarting = false;
          const delayMs = statusCode === 440 ? 5000 : 2000;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => startWhatsAppSocket(true), delayMs);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        const remoteJid = msg.key.remoteJid || "";
        if (remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") continue;

        const resolved = resolveIdentity(remoteJid, msg.key);
        if (resolved.phoneDigits) {
          lastActiveJidByPhone.set(resolved.phoneDigits, remoteJid);
        }

        const phoneToReport = resolved.phoneDisplay || `+${resolved.phoneDigits}`;
        const pushName = msg.pushName || `Contacto WhatsApp ${phoneToReport}`;

        let mediaUrl = null;
        let mediaType = null;
        let durationSeconds = 0;

        const isImage = !!(msg.message.imageMessage);
        const isAudio = !!(msg.message.audioMessage);
        const isVideo = !!(msg.message.videoMessage);

        if (isImage) {
          try {
            const buffer = await downloadMediaMessage(
              msg,
              "buffer",
              {},
              { reuploadRequest: sock.updateMediaMessage }
            );
            const mime = msg.message.imageMessage?.mimetype || "image/jpeg";
            let ext = ".jpg";
            if (mime.includes("png")) ext = ".png";
            else if (mime.includes("webp")) ext = ".webp";
            const filename = `wa_img_${Date.now()}_${msg.key.id}${ext}`;
            fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
            mediaUrl = `/static/uploads/omnichannel_media/${filename}`;
            mediaType = "IMAGE";
          } catch (err) {
            console.error("[WA-QR] Error descargando imagen:", err.message);
          }
        } else if (isAudio) {
          try {
            durationSeconds = msg.message.audioMessage?.seconds || 0;
            const buffer = await downloadMediaMessage(
              msg,
              "buffer",
              {},
              { reuploadRequest: sock.updateMediaMessage }
            );
            const mime = msg.message.audioMessage?.mimetype || "audio/ogg";
            let ext = ".oga";
            if (mime.includes("mp4") || mime.includes("m4a")) ext = ".m4a";
            else if (mime.includes("mpeg") || mime.includes("mp3")) ext = ".mp3";
            const filename = `wa_audio_${Date.now()}_${msg.key.id}${ext}`;
            fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
            mediaUrl = `/static/uploads/omnichannel_media/${filename}`;
            mediaType = "AUDIO";
          } catch (err) {
            console.error("[WA-QR] Error descargando audio:", err.message);
          }
        } else if (isVideo) {
          try {
            durationSeconds = msg.message.videoMessage?.seconds || 0;
            const buffer = await downloadMediaMessage(
              msg,
              "buffer",
              {},
              { reuploadRequest: sock.updateMediaMessage }
            );
            const mime = msg.message.videoMessage?.mimetype || "video/mp4";
            let ext = ".mp4";
            if (mime.includes("webm")) ext = ".webm";
            else if (mime.includes("quicktime")) ext = ".mov";
            const filename = `wa_vid_${Date.now()}_${msg.key.id}${ext}`;
            fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
            mediaUrl = `/static/uploads/omnichannel_media/${filename}`;
            mediaType = "VIDEO";
          } catch (err) {
            console.error("[WA-QR] Error descargando video:", err.message);
          }
        }

        let text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption;

        if (!text) {
          if (isVideo) {
            text = `🎬 Video recibido (${durationSeconds ? durationSeconds + "s" : "archivo de video"})`;
          } else if (isAudio) {
            text = `🎙️ Nota de voz recibida (${durationSeconds || "audio"}s)`;
          } else if (isImage) {
            text = "📷 Imagen adjunta recibida";
          } else {
            text = "Mensaje recibido por WhatsApp Directo (QR)";
          }
        }

        try {
          await fetch(`${CALCU_BASE_URL}/api/v1/integrations/webhooks/WHATSAPP_QR`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre_contacto: pushName,
              empresa: pushName,
              telefono: phoneToReport,
              proyecto_o_interes: `WhatsApp Directo (${pushName})`,
              mensaje_inicial: text,
              monto_estimado_usd: 0,
              utm_source: "whatsapp_qr",
              utm_medium: "qr_multidevice",
              utm_campaign: "WhatsApp_Directo_QR",
              external_lead_id: `waqr_${msg.key.id}`,
              media_url: mediaUrl,
              media_type: mediaType,
              duration_seconds: durationSeconds,
            }),
          });
          console.log(
            `[WA-QR -> Calcu] Mensaje entrante de ${pushName} (Tel Real: ${phoneToReport} | Media: ${mediaType || 'Texto'}): ${text}`
          );
        } catch (err) {
          console.error("[WA-QR] Error enviando webhook a Calcu:", err.message);
        }
      }
    });
  } catch (err) {
    currentState.last_error = err.message;
    console.error("[WA-QR Bridge] Error inicializando socket:", err.message);
  } finally {
    isStarting = false;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(currentState));
  }

  if (req.method === "POST" && req.url === "/restart") {
    try {
      isStarting = false;
      await startWhatsAppSocket(true);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "restarting", state: currentState }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  if (req.method === "POST" && req.url === "/logout") {
    try {
      if (activeSock) {
        const s = activeSock;
        activeSock = null;
        try {
          await s.logout();
        } catch {}
      }
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch {}
    currentState = {
      bridge_online: true,
      connection: "initializing",
      qr_raw: null,
      qr_svg: null,
      linked_phone: null,
      device_label: null,
      updated_at: new Date().toISOString(),
      last_error: null,
    };
    isStarting = false;
    setTimeout(() => startWhatsAppSocket(true), 800);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "logged_out" }));
  }

  if (req.method === "POST" && req.url === "/send") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        if (currentState.connection !== "open" || !activeSock) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ sent: false, reason: "bridge_not_connected" }));
        }
        const rawPhone = String(data.phone || "").trim();
        const digits = rawPhone.replace(/\D/g, "");
        if (!digits) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ sent: false, reason: "invalid_phone" }));
        }

        const resolved = resolveIdentity(digits);
        const textToSend = String(data.message || "");
        const reqMediaType = data.media_type ? String(data.media_type).toUpperCase() : null;
        const reqMediaUrl = data.media_url ? String(data.media_url) : null;

        let msgPayload = null;

        if (reqMediaType === "IMAGE" && reqMediaUrl) {
          let imgBuf = null;
          if (reqMediaUrl.startsWith("data:image")) {
            const b64 = reqMediaUrl.split(",")[1];
            imgBuf = Buffer.from(b64, "base64");
          } else {
            const cleanRelative = reqMediaUrl.replace(/^\/+/, "");
            const localPath = path.join(__dirname, "..", "app", cleanRelative);
            if (fs.existsSync(localPath)) {
              imgBuf = fs.readFileSync(localPath);
            }
          }
          if (imgBuf) {
            msgPayload = {
              image: imgBuf,
              caption: textToSend || undefined,
            };
          }
        } else if (reqMediaType === "AUDIO" && reqMediaUrl) {
          let audBuf = null;
          let mimetype = "audio/ogg; codecs=opus";
          if (reqMediaUrl.startsWith("data:audio")) {
            const parts = reqMediaUrl.split(",");
            if (parts[0].includes("ogg") || parts[0].includes("opus") || parts[0].includes("oga")) {
              mimetype = "audio/ogg; codecs=opus";
            } else if (parts[0].includes("mpeg") || parts[0].includes("mp3")) {
              mimetype = "audio/mpeg";
            } else if (parts[0].includes("mp4") || parts[0].includes("m4a")) {
              mimetype = "audio/mp4";
            }
            audBuf = Buffer.from(parts[1], "base64");
          } else {
            const cleanRelative = reqMediaUrl.replace(/^\/+/, "");
            const localPath = path.join(__dirname, "..", "app", cleanRelative);
            if (fs.existsSync(localPath)) {
              audBuf = fs.readFileSync(localPath);
              if (localPath.endsWith(".oga") || localPath.endsWith(".ogg") || localPath.endsWith(".weba")) {
                mimetype = "audio/ogg; codecs=opus";
              } else if (localPath.endsWith(".mp3")) {
                mimetype = "audio/mpeg";
              } else if (localPath.endsWith(".m4a")) {
                mimetype = "audio/mp4";
              }
            }
          }
          if (audBuf) {
            msgPayload = {
              audio: audBuf,
              mimetype: mimetype,
              ptt: true, // Renderizar como nota de voz oficial en WhatsApp
            };
          }
        } else if (reqMediaType === "VIDEO" && reqMediaUrl) {
          let vidBuf = null;
          let mimetype = "video/mp4";
          if (reqMediaUrl.startsWith("data:video")) {
            const parts = reqMediaUrl.split(",");
            if (parts[0].includes("webm")) mimetype = "video/webm";
            else if (parts[0].includes("quicktime")) mimetype = "video/quicktime";
            vidBuf = Buffer.from(parts[1], "base64");
          } else {
            const cleanRelative = reqMediaUrl.replace(/^\/+/, "");
            const localPath = path.join(__dirname, "..", "app", cleanRelative);
            if (fs.existsSync(localPath)) {
              vidBuf = fs.readFileSync(localPath);
              if (localPath.endsWith(".webm")) mimetype = "video/webm";
              else if (localPath.endsWith(".mov")) mimetype = "video/quicktime";
            }
          }
          if (vidBuf) {
            msgPayload = {
              video: vidBuf,
              caption: textToSend || undefined,
              mimetype: mimetype,
            };
          }
        }

        if (!msgPayload) {
          msgPayload = { text: textToSend };
        }

        // Intentar enviar primero al JID preferido (LID si tiene sesión activa o @s.whatsapp.net)
        let targetJid = resolved.preferredJid;
        try {
          await activeSock.sendMessage(targetJid, msgPayload);
        } catch (firstErr) {
          // Fallback: si falló por @lid, intentar por @s.whatsapp.net con el número real (o viceversa)
          const fallbackJid = targetJid.endsWith("@lid")
            ? `${resolved.phoneDigits}@s.whatsapp.net`
            : resolved.lidDigits
            ? `${resolved.lidDigits}@lid`
            : `${ resolved.phoneDigits }@s.whatsapp.net`;
          if (fallbackJid !== targetJid) {
            targetJid = fallbackJid;
            await activeSock.sendMessage(targetJid, msgPayload);
          } else {
            throw firstErr;
          }
        }

        console.log(
          `[Calcu -> WA-QR] Mensaje enviado a ${resolved.phoneDisplay} (JID: ${targetJid}): ${textToSend}`
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            sent: true,
            jid: targetJid,
            resolved_phone: resolved.phoneDisplay,
          })
        );
      } catch (err) {
        console.error("[WA-QR /send] Error enviando mensaje:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ sent: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[WA-QR Bridge] Micro-servidor escuchando en http://127.0.0.1:${PORT}`);
  startWhatsAppSocket(true);
});
