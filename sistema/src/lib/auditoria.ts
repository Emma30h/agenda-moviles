import "server-only";
import { headers } from "next/headers";
import { clienteAdmin } from "@/lib/supabase/admin";

export async function datosPedido() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const navegador = (h.get("user-agent") ?? "").slice(0, 200);
  return { ip, navegador };
}

/** Deja constancia de un evento de seguridad. Nunca guarda contraseñas ni códigos. */
export async function registrar(evento: string, datos: { usuario?: string | null; identificador?: string; detalle?: string; actor?: string | null } = {}) {
  try {
    const { ip, navegador } = await datosPedido();
    await clienteAdmin().from("auditoria_acceso").insert({
      evento,
      usuario: datos.usuario ?? null,
      identificador: datos.identificador ?? null,
      detalle: datos.detalle ?? null,
      actor: datos.actor ?? null,
      ip,
      navegador,
    });
  } catch (e) {
    console.error("[auditoria]", e);
  }
}

const VENTANA_MIN = 15;
const MAX_INTENTOS = 5;

/** true si ese correo/DNI (o esa IP) superó los intentos permitidos en los últimos 15 minutos. */
export async function bloqueado(identificador: string): Promise<boolean> {
  const { ip } = await datosPedido();
  const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();
  const db = clienteAdmin();
  const [porId, porIp] = await Promise.all([
    db.from("intento_ingreso").select("id", { count: "exact", head: true }).eq("identificador", identificador).gte("creado_en", desde),
    ip ? db.from("intento_ingreso").select("id", { count: "exact", head: true }).eq("ip", ip).gte("creado_en", desde) : Promise.resolve({ count: 0 }),
  ]);
  return (porId.count ?? 0) >= MAX_INTENTOS || (porIp.count ?? 0) >= MAX_INTENTOS * 4;
}

export async function sumarIntento(identificador: string) {
  const { ip } = await datosPedido();
  await clienteAdmin().from("intento_ingreso").insert({ identificador, ip });
}

export async function limpiarIntentos(identificador: string) {
  await clienteAdmin().from("intento_ingreso").delete().eq("identificador", identificador);
}
