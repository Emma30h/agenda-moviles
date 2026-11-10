import "server-only";

/**
 * Avisos propios (aprobación, rechazo, suspensión) por la API de Brevo.
 * Los correos de confirmación y de recuperación los manda Supabase con el SMTP de Brevo
 * (plantillas en supabase/plantillas/). Este diseño es el mismo que el de esas plantillas.
 * Si Brevo todavía no está configurado, no falla: solo deja constancia en el registro del servidor.
 */
async function enviar(para: string, asunto: string, html: string) {
  const key = process.env.BREVO_API_KEY;
  const remitente = process.env.BREVO_FROM_EMAIL;
  if (!key || !remitente) {
    console.warn(`[correo] Brevo sin configurar: no se envió "${asunto}"`);
    return;
  }
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "api-key": key },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_FROM_NAME ?? "Agenda de Móviles", email: remitente },
      to: [{ email: para }],
      subject: asunto,
      htmlContent: html,
    }),
  });
  if (!r.ok) console.error("[correo] Brevo respondió", r.status, await r.text());
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const TONOS = {
  ok: { texto: "#1e7a4c", fondo: "#e8f6ee", borde: "#3fb97f" },
  mal: { texto: "#a3352b", fondo: "#fdeeec", borde: "#e0645a" },
  alerta: { texto: "#7a5a00", fondo: "#fdf8ec", borde: "#d99a00" },
};

type Aviso = {
  asunto: string;
  estado: string;
  tono: keyof typeof TONOS;
  titulo: string;
  texto: string;
  filas: [string, string][];
  nota: string;
  boton?: string;
};

/** Mismo diseño que las plantillas de Supabase: encabezado institucional, cuerpo blanco y pie. */
export function plantillaAviso(a: Aviso) {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const logos = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/publico/correo`;
  const t = TONOS[a.tono];
  const filas = a.filas
    .map(([k, v], i) => {
      const linea = i ? "border-top:1px solid #e5e9ef;" : "";
      return `<tr><td style="padding:10px 0;color:#5b6472;width:120px;vertical-align:top;${linea}">${esc(k)}</td><td style="padding:10px 0;color:#1f2937;${linea}">${esc(v)}</td></tr>`;
    })
    .join("");
  const boton =
    a.boton && sitio
      ? `<tr><td align="center" style="background:#ffffff;padding:0 36px 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0c1e35;border-radius:6px;"><a href="${sitio}/ingresar" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">${esc(a.boton)}</a></td></tr></table></td></tr>`
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f5;font-family:Arial,Helvetica,sans-serif;">
<tr><td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
  <tr><td style="background:#0c1e35;border-radius:6px 6px 0 0;padding:20px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:12px;"><img src="${logos}/policia-cordoba.png" alt="Policía de la Provincia de Córdoba" width="50" height="50" style="display:block;border:0;"></td>
      <td style="padding-right:16px;"><img src="${logos}/ojos-en-alerta.png" alt="Cordobeses en Alerta" width="50" height="37" style="display:block;border:0;"></td>
      <td style="border-left:1px solid #2c4566;padding-left:16px;">
        <div style="color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:.3px;">POLICÍA DE LA PROVINCIA DE CÓRDOBA</div>
        <div style="color:#9fb3cc;font-size:12px;margin-top:3px;">Dirección Monitoreo Cordobeses en Alerta</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#29a3dd;height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="background:#ffffff;padding:36px 36px 8px;">
    <div style="color:#5b6472;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Agenda de Móviles</div>
    <div style="color:#0c1e35;font-size:22px;font-weight:bold;margin-top:6px;">${esc(a.titulo)}</div>
    <div style="margin-top:12px;"><span style="display:inline-block;background:${t.fondo};color:${t.texto};border:1px solid ${t.borde};border-radius:999px;padding:4px 12px;font-size:12px;font-weight:bold;">${esc(a.estado)}</span></div>
    <p style="color:#1f2937;font-size:15px;line-height:1.6;margin:18px 0 0;">${a.texto}</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:22px 36px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e5e9ef;border-bottom:1px solid #e5e9ef;font-size:13px;">${filas}</table>
  </td></tr>
  ${boton}
  <tr><td style="background:#ffffff;padding:0 36px 34px;border-radius:0 0 6px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:#f5f8fb;border-left:3px solid #29a3dd;padding:12px 16px;color:#5b6472;font-size:12.5px;line-height:1.55;">${a.nota}</td>
    </tr></table>
  </td></tr>
  <tr><td align="center" style="padding:22px 20px 0;color:#7a8494;font-size:11px;line-height:1.6;">
    Dirección General de Policía Territorial y Proximidad<br>
    Dirección Monitoreo Cordobeses en Alerta · D.M.C.A<br>
    Mensaje automático. Por favor, no lo respondas.
  </td></tr>
</table>
</td></tr>
</table>`;
}

const fecha = () =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba", dateStyle: "short", timeStyle: "short" }).format(new Date()) + " Hs";

export const avisos = {
  aprobada: (para: string, nombre: string, rol: string, jurisdiccion: string) => {
    const a: Aviso = {
      asunto: "Agenda de Móviles · Tu cuenta fue aprobada",
      estado: "Cuenta activa",
      tono: "ok",
      titulo: "Cuenta aprobada",
      texto: `Hola ${esc(nombre)}. Tu solicitud fue revisada y aprobada: ya podés ingresar a la Agenda de Móviles con tu correo o tu DNI y tu contraseña.`,
      filas: [["Cuenta", para], ["Rol", rol], ["Jurisdicción", jurisdiccion], ["Aprobada", fecha()]],
      boton: "Ingresar a la Agenda",
      nota: "Tu usuario es personal: no compartas tu contraseña. Cada ingreso y cada carga quedan registrados.",
    };
    return enviar(para, a.asunto, plantillaAviso(a));
  },
  rechazada: (para: string, nombre: string, motivo: string) => {
    const a: Aviso = {
      asunto: "Agenda de Móviles · Tu solicitud de cuenta no fue aprobada",
      estado: "Solicitud no aprobada",
      tono: "mal",
      titulo: "Solicitud no aprobada",
      texto: `Hola ${esc(nombre)}. Revisamos tu solicitud de cuenta y no fue aprobada.`,
      filas: [["Cuenta", para], ["Motivo", motivo], ["Revisada", fecha()]],
      nota: "Si creés que es un error, consultá con tu superior o con la Dirección Monitoreo Cordobeses en Alerta.",
    };
    return enviar(para, a.asunto, plantillaAviso(a));
  },
  suspendida: (para: string, nombre: string, motivo: string) => {
    const a: Aviso = {
      asunto: "Agenda de Móviles · Tu cuenta fue suspendida",
      estado: "Cuenta suspendida",
      tono: "alerta",
      titulo: "Cuenta suspendida",
      texto: `Hola ${esc(nombre)}. Tu cuenta de la Agenda de Móviles fue suspendida y por ahora no vas a poder ingresar.`,
      filas: [["Cuenta", para], ["Motivo", motivo], ["Desde", fecha()]],
      nota: "Para volver a tener acceso, consultá con el administrador del sistema.",
    };
    return enviar(para, a.asunto, plantillaAviso(a));
  },
};
