"use server";

import { revalidatePath } from "next/cache";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";

export type Resultado = { ok?: string; error?: string };

async function llamar(fn: string, args: Record<string, unknown>, ok: string): Promise<Resultado> {
  await exigirActivo();
  const db = await clienteSesion();
  const { error } = await db.rpc(fn, args);
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    console.error(`[tablero:${fn}]`, error);
    return { error: "No se pudo guardar. Probá de nuevo." };
  }
  revalidatePath("/tablero");
  revalidatePath("/agenda");
  return { ok };
}

export const reclamarDireccion = async (direccion: string, fecha: string, turno: string) =>
  llamar("reclamar_direccion", { p_dir: direccion, p_fecha: fecha, p_turno: turno }, "Reclamo enviado. Le aparece al cargador en la Agenda.");
export const reclamarMovil = async (movil: string, fecha: string, turno: string) =>
  llamar("reclamar_movil", { p_movil: movil, p_fecha: fecha, p_turno: turno }, "Reclamo enviado por ese móvil.");
export const resolverReclamo = async (id: number) => llamar("resolver_reclamo", { p_id: id }, "Reclamo marcado como resuelto.");
