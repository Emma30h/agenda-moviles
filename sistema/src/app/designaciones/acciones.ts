"use server";

import { revalidatePath } from "next/cache";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";

export type Resultado = { ok?: string; error?: string };

async function llamar(fn: string, args: Record<string, unknown>, ok: string): Promise<Resultado> {
  const perfil = await exigirActivo();
  if (perfil.rol !== "superadmin" && perfil.rol !== "general") return { error: "Solo el General edita el catálogo." };
  const db = await clienteSesion();
  const { error } = await db.rpc(fn, args);
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    console.error(`[designaciones:${fn}]`, error);
    return { error: "No se pudo guardar. Probá de nuevo." };
  }
  revalidatePath("/designaciones");
  revalidatePath("/agenda");
  return { ok };
}

export type DatosDesignacion = { nombre: string; zona: string; unidad: string; alias: string[]; activa: boolean };

export const guardarDesignacion = async (d: DatosDesignacion, original: string | null) =>
  llamar("guardar_designacion", { p_nombre: d.nombre, p_zona: d.zona, p_unidad: d.unidad, p_alias: d.alias, p_activa: d.activa, p_original: original },
    original ? "Cambios guardados." : "Designación agregada al catálogo.");

export const agregarExcepcion = async (id: number, nombre: string, zona: string, unidad: string) =>
  llamar("resolver_excepcion", { p_id: id, p_accion: "agregar", p_designacion: nombre, p_zona: zona, p_unidad: unidad }, "Agregada al catálogo.");
export const aliasExcepcion = async (id: number, designacion: string) =>
  llamar("resolver_excepcion", { p_id: id, p_accion: "alias", p_designacion: designacion }, `Guardada como otra forma de escribir ${designacion}.`);
export const descartarExcepcion = async (id: number) =>
  llamar("resolver_excepcion", { p_id: id, p_accion: "descartar" }, "Excepción descartada.");
