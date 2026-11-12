"use server";

import { revalidatePath } from "next/cache";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";

export type Respuesta =
  | { tipo: "vacio" }
  | { tipo: "error"; error: string }
  | {
      tipo: "agendado"; previa: string | null; parecido: string | null; designacion: string | null; movil: string; programa: "ojos_en_alerta" | "policial";
      unidad: string; inicio: string; fin: string; ocupado: boolean; dotacion: { dni: string; rol: string; nombre: string }[];
    }
  | { tipo: "no_agendado"; movil: string; programa: "ojos_en_alerta" | "policial"; vehiculo: string; unidad: string; fuera: boolean; nuevo: boolean }
  | { tipo: "desconocido"; texto: string; nuevo: boolean }
  | { tipo: "varios"; opciones: string[] };

const compacto = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** «ALBERDI 020» → ALBERDI y 20 */
function partes(s: string) {
  const k = compacto(s);
  const m = k.match(/^(.*?)(\d+)$/);
  return m ? { nombre: m[1], numero: String(Number(m[2])) } : { nombre: k, numero: "" };
}
/** Cuántos cambios de letra separan dos palabras (para errores de tipeo) */
function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const PALABRAS_INTERNO = new Set(["", "INT", "INTERNO", "MOVIL", "MOV", "M"]);
const texto = (m: { interno: number | null; dominio: string }) => `${m.interno != null ? "Int. " + m.interno + " · " : ""}${m.dominio}`;

/**
 * Consulta lo que se escuchó contra la base en este momento (no contra lo que la pantalla tenía cargado).
 * Si el móvil no está agendado, deja el reporte para su Dirección.
 */
export async function consultarFrecuencia(entrada: string): Promise<Respuesta> {
  await exigirActivo();
  const k = compacto(entrada);
  if (!k) return { tipo: "vacio" };
  const db = await clienteSesion();
  const { data: servicios, error } = await db
    .from("servicio")
    .select("id,movil,unidad,designacion,designaciones_previas,inicio,fin_previsto,ocupado_motivo,dotacion(dni,rol,hasta,personal(apellido,nombre,jerarquia)),movil_ref:movil(interno,dominio,programa)")
    .is("fin_real", null)
    .overrideTypes<{
      id: string; movil: string; unidad: string; designacion: string | null; designaciones_previas: string[]; inicio: string; fin_previsto: string; ocupado_motivo: string | null;
      dotacion: { dni: string; rol: string; hasta: string | null; personal: { apellido: string; nombre: string; jerarquia: string | null } | null }[];
      movil_ref: { interno: number | null; dominio: string; programa: "ojos_en_alerta" | "policial" } | null;
    }[], { merge: false }>();
  if (error) return { tipo: "error", error: "No se pudo consultar. Probá de nuevo." };

  const agendado = (s: (typeof servicios)[number], previa: string | null, parecido: string | null = null): Respuesta => ({
    tipo: "agendado", previa, parecido, designacion: s.designacion, movil: s.movil_ref ? texto(s.movil_ref) : "", programa: s.movil_ref?.programa ?? "policial",
    unidad: s.unidad, inicio: s.inicio, fin: s.fin_previsto, ocupado: !!s.ocupado_motivo,
    dotacion: s.dotacion.filter((d) => !d.hasta).map((d) => ({ dni: d.dni, rol: d.rol, nombre: d.personal ? `${d.personal.jerarquia ? d.personal.jerarquia + " " : ""}${d.personal.apellido}, ${d.personal.nombre}` : d.dni })),
  });

  // Formas de escribir cada designación según el SAE (ej. GRALPAZ → GENERAL PAZ)
  const { data: catalogo } = await db.from("designacion").select("nombre,alias");
  const canon = new Map<string, string>();
  for (const d of catalogo ?? []) {
    const n = compacto(d.nombre);
    canon.set(n, n);
    for (const a of d.alias ?? []) if (!canon.has(compacto(a))) canon.set(compacto(a), n);
  }
  const normal = (s: string) => { const p = partes(s); return { nombre: canon.get(p.nombre) ?? p.nombre, numero: p.numero }; };
  const q = normal(entrada);
  const igual = (d: string | null) => { if (!d) return false; const p = normal(d); return p.nombre === q.nombre && p.numero === q.numero; };

  // 1) designación actual (sin importar mayúsculas, espacios, ceros adelante ni la forma de escribirla)
  const porDesignacion = servicios.find((s) => igual(s.designacion));
  if (porDesignacion) return agendado(porDesignacion, null);
  // 2) interno («361», «int 361») o patente
  const esInterno = PALABRAS_INTERNO.has(partes(entrada).nombre) && partes(entrada).numero !== "";
  const { data: m } = esInterno
    ? await db.from("movil").select("id,interno,dominio,programa,marca,modelo,unidad").eq("activo", true).eq("interno", Number(partes(entrada).numero)).maybeSingle()
    : await db.from("movil").select("id,interno,dominio,programa,marca,modelo,unidad").eq("activo", true).eq("dominio", k).maybeSingle();
  if (m) {
    const s = servicios.find((x) => x.movil === m.id);
    if (s) return agendado(s, null);
  }
  // 3) una designación que tuvo antes en este servicio
  const previa = servicios.find((s) => s.designaciones_previas.some(igual));
  if (previa) return agendado(previa, entrada.trim().toUpperCase());
  // 4) escrita con algún error (ALVERDI 20 → ALBERDI 20): mismo número y nombre casi igual
  if (!m && q.numero && q.nombre.length >= 4) {
    const tope = q.nombre.length >= 7 ? 2 : 1;
    const candidatos = servicios.flatMap((s) => [s.designacion, ...s.designaciones_previas].filter(Boolean).map((d) => ({ s, d: d!, p: normal(d!) })))
      .filter((c) => c.p.numero === q.numero && distancia(c.p.nombre, q.nombre) <= tope)
      .map((c) => ({ ...c, dist: distancia(c.p.nombre, q.nombre) }))
      .sort((a, b) => a.dist - b.dist);
    const mejores = candidatos.filter((c) => c.dist === candidatos[0]?.dist);
    const distintos = [...new Set(mejores.map((c) => c.s.id))];
    if (distintos.length === 1) {
      const c = mejores[0];
      return agendado(c.s, c.d === c.s.designacion ? null : c.d, c.d);
    }
    if (distintos.length > 1) return { tipo: "varios", opciones: [...new Set(mejores.map((c) => c.d))] };
  }

  // No está agendado: reporte para su Dirección (o para revisar)
  const r = await reportar(entrada, m?.id ?? null);
  if (r.error) return { tipo: "error", error: r.error };
  if (!m) return { tipo: "desconocido", texto: entrada.trim().toUpperCase(), nuevo: !!r.nuevo };
  const [{ data: fs }, { data: pr }] = await Promise.all([
    db.from("fuera_servicio").select("id").eq("movil", m.id).is("hasta", null).maybeSingle(),
    db.from("prestamo").select("destino").eq("movil", m.id).is("hasta", null).maybeSingle(),
  ]);
  return { tipo: "no_agendado", movil: texto(m), programa: m.programa, vehiculo: [m.marca, m.modelo].filter(Boolean).join(" "), unidad: pr?.destino ?? m.unidad, fuera: !!fs, nuevo: !!r.nuevo };
}

/** Deja un reporte para la Dirección del móvil (o para revisar, si no figura en la flota). */
export async function reportar(texto: string, movil: string | null): Promise<{ error?: string; nuevo?: boolean }> {
  await exigirActivo();
  const db = await clienteSesion();
  const t = texto.trim().toUpperCase();
  // ¿Ya había uno abierto? Así la tarjeta lo dice
  const previo = movil
    ? await db.from("reporte_frecuencia").select("id").is("resuelto_en", null).eq("movil", movil).maybeSingle()
    : await db.from("reporte_frecuencia").select("id").is("resuelto_en", null).is("movil", null).eq("texto", t).maybeSingle();
  const { error } = await db.rpc("reportar_frecuencia", { p_texto: t, p_movil: movil });
  if (error) return { error: error.code === "P0001" ? error.message : "No se pudo guardar el reporte. Probá de nuevo." };
  revalidatePath("/frecuencia");
  revalidatePath("/agenda");
  revalidatePath("/tablero");
  return { nuevo: !previo.data };
}

export async function resolverReporte(id: number): Promise<{ error?: string; ok?: string }> {
  await exigirActivo();
  const db = await clienteSesion();
  const { error } = await db.rpc("resolver_reporte", { p_id: id });
  if (error) return { error: error.code === "P0001" ? error.message : "No se pudo guardar. Probá de nuevo." };
  revalidatePath("/frecuencia");
  revalidatePath("/agenda");
  revalidatePath("/tablero");
  return { ok: "Reporte resuelto." };
}
