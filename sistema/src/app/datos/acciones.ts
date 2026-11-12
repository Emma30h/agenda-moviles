"use server";

import { revalidatePath } from "next/cache";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";
import type { Cambio } from "@/lib/agenda";

export type Resultado = { ok?: string; error?: string; id?: string };

/** Llama a una función de la base: ahí se controlan permisos, repetidos y reglas. */
async function llamar(fn: string, args: Record<string, unknown>, ok: string): Promise<Resultado> {
  const perfil = await exigirActivo();
  if (!perfil.rol || !["superadmin", "general", "cargador"].includes(perfil.rol)) return { error: "Tu rol solo permite consultar." };
  const db = await clienteSesion();
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    console.error(`[datos:${fn}]`, error);
    return { error: "No se pudo guardar. Probá de nuevo." };
  }
  revalidatePath("/moviles");
  revalidatePath("/personal");
  revalidatePath("/agenda");
  return { ok, id: typeof data === "string" ? data : undefined };
}

// ---------- móviles
export type DatosMovil = { interno: string; dominio: string; programa: string; tipo: string; marca: string; modelo: string; unidad: string };
export const guardarMovil = async (id: string | null, d: DatosMovil) =>
  llamar("guardar_movil", { p_id: id, p: d }, id ? "Cambios guardados." : "Móvil dado de alta.");
export const bajaMovil = async (id: string, motivo: string, obs: string) =>
  llamar("baja_movil", { p_id: id, p_motivo: motivo, p_obs: obs }, "Móvil dado de baja. Se puede reincorporar.");
export const reincorporarMovil = async (id: string) => llamar("reincorporar_movil", { p_id: id }, "Móvil reincorporado.");

// ---------- personal
export type DatosPersona = { apellido: string; nombre: string; tipo_personal: string; jerarquia: string; unidad: string; funcion: string; calle: boolean; guardia: string; horario: string };
export const guardarPersona = async (dni: string, d: DatosPersona, alta: boolean) =>
  llamar("guardar_persona", { p_dni: dni, p: d, p_alta: alta }, alta ? "Persona dada de alta." : "Cambios guardados.");
export const bajaPersona = async (dni: string, motivo: string, obs: string) =>
  llamar("baja_persona", { p_dni: dni, p_motivo: motivo, p_obs: obs }, "Persona dada de baja. Se puede reincorporar.");
export const reincorporarPersona = async (dni: string) => llamar("reincorporar_persona", { p_dni: dni }, "Persona reincorporada.");

export const cargarSituacion = async (dni: string, tipo: string, desde: string, hasta: string, obs: string) =>
  llamar("cargar_situacion", { p_dni: dni, p_tipo: tipo, p_detalle: null, p_desde: desde, p_hasta: hasta || null, p_obs: obs }, "Situación cargada.");
export const terminarSituacion = async (id: number) => llamar("terminar_situacion", { p_id: id }, "Situación terminada: desde hoy está apta.");
export const quitarSituacion = async (id: number) => llamar("quitar_situacion", { p_id: id }, "Situación quitada.");

export const deshacer = async (id: number) => llamar("deshacer", { p_cambio: id }, "Cambio deshecho.");

// ---------- préstamos
export const prestarMovil = async (id: string, destino: string, conDotacion: boolean, obs: string) =>
  llamar("prestar_movil", { p_movil: id, p_destino: destino, p_con_dotacion: conDotacion, p_obs: obs }, "Móvil prestado: ahora lo agenda la unidad que lo recibe.");
export const devolverMovil = async (id: string) => llamar("devolver_movil", { p_movil: id }, "Móvil devuelto a su unidad.");
export const prestarPersona = async (dni: string, destino: string, fecha: string, turno: string, obs: string) =>
  llamar("prestar_persona", { p_dni: dni, p_destino: destino, p_fecha: fecha, p_turno: turno, p_obs: obs }, "Préstamo cargado para esa guardia.");
export const quitarPrestamoPersona = async (id: number) => llamar("quitar_prestamo_persona", { p_id: id }, "Préstamo anulado.");

/** Historial de un móvil o una persona: ediciones (con quién) y operaciones de la agenda. */
export async function historialDe(tabla: "movil" | "personal", registro: string) {
  await exigirActivo();
  const db = await clienteSesion();
  const [cambios, operaciones] = await Promise.all([
    db.from("cambio").select("id,accion,antes,despues,creado_en,deshecho,revierte,usuario").eq("tabla", tabla).eq("registro", registro).order("id", { ascending: false }).limit(50),
    db.from("historial").select("id,tipo,detalle,creado_en,usuario").eq(tabla === "movil" ? "movil" : "dni", registro).order("id", { ascending: false }).limit(50),
  ]);
  const ids = [...new Set([...(cambios.data ?? []), ...(operaciones.data ?? [])].map((x) => x.usuario).filter(Boolean))] as string[];
  // Nombres de quién hizo cada cosa (el Super Admin y el General pueden leer perfiles; si no, queda vacío)
  const { data: perfiles } = ids.length ? await db.from("perfil").select("id,apellido,nombre").in("id", ids) : { data: [] };
  const nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, `${p.apellido}, ${p.nombre}`]));
  return {
    cambios: (cambios.data ?? []) as Cambio[],
    operaciones: (operaciones.data ?? []) as { id: number; tipo: string; detalle: string | null; creado_en: string; usuario: string | null }[],
    nombres: nombres as Record<string, string>,
  };
}

/** Observaciones de situaciones: solo las devuelve a quien puede editar a la persona (lo controla la base). */
export async function notasDe(ids: number[]) {
  await exigirActivo();
  if (!ids.length) return {} as Record<number, string>;
  const db = await clienteSesion();
  const { data } = await db.from("situacion_nota").select("situacion,obs").in("situacion", ids);
  return Object.fromEntries((data ?? []).map((n) => [n.situacion, n.obs])) as Record<number, string>;
}
