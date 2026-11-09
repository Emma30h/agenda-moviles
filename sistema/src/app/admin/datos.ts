import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { OpcionUnidad } from "./formularios";

export type FilaUnidad = { id: string; nombre: string; tipo: string; padre: string | null; orden: number };

/** Unidades para los selectores, agrupadas por Dirección. Solo se llama después de exigirSuperadmin(). */
export async function opcionesUnidades(): Promise<{ opciones: OpcionUnidad[]; nombre: (id: string | null) => string }> {
  const { data } = await clienteAdmin().from("unidad").select("id,nombre,tipo,padre,orden").order("orden");
  const us = (data ?? []) as FilaUnidad[];
  const porId = Object.fromEntries(us.map((u) => [u.id, u]));
  const dir = (u: FilaUnidad): string => {
    let x: FilaUnidad | undefined = u;
    while (x && x.tipo !== "direccion" && x.padre) x = porId[x.padre];
    return x?.tipo === "direccion" ? x.nombre.replace("Dirección ", "") : "General";
  };
  const opciones = us.map((u) => ({
    valor: u.id,
    texto: (u.tipo === "division" ? "— " : u.tipo === "departamento" ? "· " : "") + (u.tipo === "general" ? "Toda la Dirección General" : u.nombre),
    grupo: dir(u),
  }));
  return { opciones, nombre: (id) => (id && porId[id] ? porId[id].nombre : "—") };
}

export const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Cordoba" }) + " Hs" : "—";
