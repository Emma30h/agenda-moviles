"use server";

import { revalidatePath } from "next/cache";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";

export type Resultado = { ok?: string; error?: string };
type Dotacion = { dni: string; rol: string }[];

/**
 * Todas las operaciones llaman a una función de la base (rpc). La base controla
 * permisos, aptitud y que nada quede a medias; acá solo se traduce el resultado.
 */
async function llamar(fn: string, args: Record<string, unknown>, ok: string): Promise<Resultado> {
  const perfil = await exigirActivo();
  if (!perfil.rol || !["superadmin", "general", "cargador"].includes(perfil.rol)) return { error: "Tu rol solo permite consultar." };
  const supabase = await clienteSesion();
  const { error } = await supabase.rpc(fn, args);
  if (error) {
    // Los mensajes de la base ya están escritos para mostrar
    if (error.code === "P0001") return { error: error.message };
    console.error(`[agenda:${fn}]`, error);
    return { error: "No se pudo guardar. Probá de nuevo." };
  }
  revalidatePath("/agenda");
  return { ok };
}

const fechaValida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);

export async function agendar(d: { movil: string; fecha: string; turno: string; designacion: string; dotacion: Dotacion; inicio?: string; fin?: string }) {
  if (!fechaValida(d.fecha)) return { error: "Elegí la fecha." };
  return llamar("agendar", {
    p_movil: d.movil, p_fecha: d.fecha, p_turno: d.turno, p_designacion: d.designacion, p_dotacion: d.dotacion,
    p_inicio: d.inicio || null, p_fin: d.fin || null,
  }, "Móvil agendado.");
}

export async function relevar(d: { servicio: string; fecha: string; turno: string; designacion: string; dotacion: Dotacion }) {
  if (!fechaValida(d.fecha)) return { error: "Elegí la fecha del turno entrante." };
  return llamar("relevar", { p_servicio: d.servicio, p_fecha: d.fecha, p_turno: d.turno, p_designacion: d.designacion, p_dotacion: d.dotacion }, "Relevo registrado.");
}

export async function cerrar(d: { servicio: string; reserva?: { fecha: string; turno: string; motivo: string }; obs?: string }) {
  return llamar("cerrar_servicio", {
    p_servicio: d.servicio, p_reserva_fecha: d.reserva?.fecha ?? null, p_reserva_turno: d.reserva?.turno ?? null,
    p_reserva_motivo: d.reserva?.motivo ?? null, p_obs: d.obs ?? null,
  }, d.reserva ? "Servicio cerrado y móvil reservado." : "Servicio cerrado: el móvil queda disponible.");
}

export async function marcarOcupado(d: { servicio: string; motivo: string; obs: string }) {
  return llamar("marcar_ocupado", { p_servicio: d.servicio, p_motivo: d.motivo, p_obs: d.obs }, "Queda como «Sigue ocupado».");
}

export async function cambiarFin(d: { servicio: string; fin: string }) {
  if (Number.isNaN(Date.parse(d.fin))) return { error: "Escribí el nuevo horario de fin." };
  return llamar("cambiar_fin", { p_servicio: d.servicio, p_fin: d.fin }, "Horario actualizado.");
}

export async function fueraDeServicio(d: { movil: string; motivo: string; obs: string }) {
  return llamar("poner_fuera_servicio", { p_movil: d.movil, p_motivo: d.motivo, p_obs: d.obs }, "Móvil fuera de servicio.");
}

export async function volverAServicio(d: { movil: string }) {
  return llamar("volver_a_servicio", { p_movil: d.movil }, "El móvil vuelve a estar disponible.");
}

export async function reservar(d: { movil: string; fecha: string; turno: string; motivo: string; obs: string }) {
  return llamar("reservar", { p_movil: d.movil, p_fecha: d.fecha, p_turno: d.turno, p_motivo: d.motivo, p_obs: d.obs }, "Móvil reservado para esa guardia.");
}

export async function quitarReserva(d: { reserva: number }) {
  return llamar("quitar_reserva", { p_reserva: d.reserva }, "Reserva quitada.");
}

export async function cambiarDesignacion(d: { servicio: string; designacion: string }) {
  return llamar("cambiar_designacion", { p_servicio: d.servicio, p_designacion: d.designacion }, "Designación cambiada. La anterior queda registrada.");
}
