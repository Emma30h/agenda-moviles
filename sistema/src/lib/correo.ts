import "server-only";

const APP = "Agenda de Móviles · Dirección General de Policía Territorial y Proximidad";

/**
 * Avisos propios (aprobación, rechazo, suspensión) por la API de Brevo.
 * Los correos de confirmación y de recuperación los manda Supabase con el SMTP de Brevo.
 * Si Brevo todavía no está configurado, no falla: solo deja constancia en el registro del servidor.
 */
async function enviar(para: string, asunto: string, cuerpo: string) {
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
      htmlContent: plantilla(asunto, cuerpo),
    }),
  });
  if (!r.ok) console.error("[correo] Brevo respondió", r.status, await r.text());
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function plantilla(titulo: string, cuerpo: string) {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#1f2937">
  <div style="font-size:12px;color:#6b7280;margin-bottom:16px">${APP}</div>
  <h2 style="margin:0 0 12px;font-size:20px">${esc(titulo)}</h2>
  ${cuerpo}
  ${sitio ? `<p style="margin-top:24px"><a href="${sitio}/ingresar" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Ir a la Agenda</a></p>` : ""}
  <p style="margin-top:28px;font-size:12px;color:#9ca3af">Mensaje automático. No lo respondas.</p></div>`;
}

export const avisos = {
  aprobada: (para: string, nombre: string, rol: string) =>
    enviar(para, "Tu cuenta fue aprobada", `<p>Hola ${esc(nombre)}, ya podés ingresar a la Agenda de Móviles con el rol <b>${esc(rol)}</b>.</p>`),
  rechazada: (para: string, nombre: string, motivo: string) =>
    enviar(para, "Tu solicitud de cuenta no fue aprobada", `<p>Hola ${esc(nombre)}, tu solicitud no fue aprobada.</p><p><b>Motivo:</b> ${esc(motivo)}</p>`),
  suspendida: (para: string, nombre: string, motivo: string) =>
    enviar(para, "Tu cuenta fue suspendida", `<p>Hola ${esc(nombre)}, tu cuenta fue suspendida.</p><p><b>Motivo:</b> ${esc(motivo)}</p><p>Consultá con el Super Admin.</p>`),
};
