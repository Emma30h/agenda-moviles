"use server";

import { revalidatePath } from "next/cache";
import { exigirSuperadmin } from "@/lib/dal";
import { clienteAdmin } from "@/lib/supabase/admin";
import { registrar } from "@/lib/auditoria";
import { avisos } from "@/lib/correo";
import { ROLES, type EstadoFormulario, type Rol } from "@/lib/reglas";

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

type Objetivo = { id: string; correo: string; nombre: string; apellido: string; rol: Rol | null; estado: string };

/** Verifica que quien pide sea Super Admin y trae a la persona sobre la que actúa. */
async function preparar(fd: FormData) {
  const yo = await exigirSuperadmin();
  const db = clienteAdmin();
  const { data } = await db.from("perfil").select("id,correo,nombre,apellido,rol,estado").eq("id", texto(fd, "id")).maybeSingle();
  return { yo, db, objetivo: data as Objetivo | null };
}

async function unidadValida(db: ReturnType<typeof clienteAdmin>, id: string) {
  const { data } = await db.from("unidad").select("id").eq("id", id).maybeSingle();
  return !!data;
}

/** No se puede dejar el sistema sin ningún Super Admin activo. */
async function quedaOtroSuperadmin(db: ReturnType<typeof clienteAdmin>, salvo: string) {
  const { count } = await db.from("perfil").select("id", { count: "exact", head: true }).eq("rol", "superadmin").eq("estado", "activo").neq("id", salvo);
  return (count ?? 0) > 0;
}

const listo = (mensaje: string): EstadoFormulario => {
  revalidatePath("/admin", "layout");
  return { ok: mensaje };
};

export async function aprobar(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const { yo, db, objetivo } = await preparar(fd);
  if (!objetivo) return { error: "No se encontró la solicitud." };
  if (!["en_revision", "rechazado"].includes(objetivo.estado)) return { error: "Esa solicitud ya no está pendiente." };
  const rol = texto(fd, "rol") as Rol;
  const jurisdiccion = texto(fd, "jurisdiccion");
  if (!(rol in ROLES)) return { error: "Elegí un rol." };
  if (!(await unidadValida(db, jurisdiccion))) return { error: "Elegí una jurisdicción." };
  const { error } = await db
    .from("perfil")
    .update({ rol, jurisdiccion, estado: "activo", motivo: null, revisado_por: yo.id, revisado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() })
    .eq("id", objetivo.id);
  if (error) return { error: "No se pudo aprobar. Intentá de nuevo." };
  await registrar("aprobacion", { usuario: objetivo.id, actor: yo.id, detalle: `${ROLES[rol]} · ${jurisdiccion}` });
  const { data: unidad } = await db.from("unidad").select("nombre").eq("id", jurisdiccion).maybeSingle();
  await avisos.aprobada(objetivo.correo, objetivo.nombre, ROLES[rol], unidad?.nombre ?? jurisdiccion);
  return listo(`Cuenta de ${objetivo.apellido}, ${objetivo.nombre} aprobada.`);
}

export async function rechazar(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const { yo, db, objetivo } = await preparar(fd);
  if (!objetivo) return { error: "No se encontró la solicitud." };
  const motivo = texto(fd, "motivo");
  if (motivo.length < 5) return { error: "Escribí el motivo del rechazo.", errores: { motivo: "Falta el motivo" } };
  await db.from("perfil").update({ estado: "rechazado", motivo, revisado_por: yo.id, revisado_en: new Date().toISOString() }).eq("id", objetivo.id);
  await registrar("rechazo", { usuario: objetivo.id, actor: yo.id, detalle: motivo });
  await avisos.rechazada(objetivo.correo, objetivo.nombre, motivo);
  return listo("Solicitud rechazada. Se le avisó por correo.");
}

export async function cambiarAcceso(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const { yo, db, objetivo } = await preparar(fd);
  if (!objetivo) return { error: "No se encontró el usuario." };
  const rol = texto(fd, "rol") as Rol;
  const jurisdiccion = texto(fd, "jurisdiccion");
  if (!(rol in ROLES)) return { error: "Elegí un rol." };
  if (!(await unidadValida(db, jurisdiccion))) return { error: "Elegí una jurisdicción." };
  if (objetivo.rol === "superadmin" && rol !== "superadmin" && !(await quedaOtroSuperadmin(db, objetivo.id))) {
    return { error: "Es el único Super Admin. Primero aprobá o asigná otro." };
  }
  await db.from("perfil").update({ rol, jurisdiccion, actualizado_en: new Date().toISOString() }).eq("id", objetivo.id);
  await registrar("cambio_rol", { usuario: objetivo.id, actor: yo.id, detalle: `${objetivo.rol ? ROLES[objetivo.rol] : "—"} → ${ROLES[rol]} · ${jurisdiccion}` });
  return listo("Rol y jurisdicción actualizados.");
}

export async function suspender(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const { yo, db, objetivo } = await preparar(fd);
  if (!objetivo) return { error: "No se encontró el usuario." };
  if (objetivo.id === yo.id) return { error: "No podés suspender tu propia cuenta." };
  const motivo = texto(fd, "motivo");
  if (motivo.length < 5) return { error: "Escribí el motivo de la suspensión.", errores: { motivo: "Falta el motivo" } };
  if (objetivo.rol === "superadmin" && !(await quedaOtroSuperadmin(db, objetivo.id))) return { error: "Es el único Super Admin activo." };
  await db.from("perfil").update({ estado: "suspendido", motivo, revisado_por: yo.id, revisado_en: new Date().toISOString() }).eq("id", objetivo.id);
  // Bloquea la renovación del token: la sesión abierta se corta en su próximo pedido
  await db.auth.admin.updateUserById(objetivo.id, { ban_duration: "876000h" });
  await registrar("suspension", { usuario: objetivo.id, actor: yo.id, detalle: motivo });
  await avisos.suspendida(objetivo.correo, objetivo.nombre, motivo);
  return listo("Cuenta suspendida. Su sesión se corta en el próximo pedido.");
}

export async function reactivar(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const { yo, db, objetivo } = await preparar(fd);
  if (!objetivo) return { error: "No se encontró el usuario." };
  if (objetivo.estado !== "suspendido") return { error: "La cuenta no está suspendida." };
  await db.auth.admin.updateUserById(objetivo.id, { ban_duration: "none" });
  await db.from("perfil").update({ estado: "activo", motivo: null, revisado_por: yo.id, revisado_en: new Date().toISOString() }).eq("id", objetivo.id);
  await registrar("reactivacion", { usuario: objetivo.id, actor: yo.id });
  return listo("Cuenta reactivada.");
}
