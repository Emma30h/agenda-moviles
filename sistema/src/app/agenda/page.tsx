import type { Metadata } from "next";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/encabezado";
import { guardiaActual, type Designacion, type FueraServicio, type Motivo, type Movil, type Persona, type Reserva, type Servicio, type Situacion, type Turno, type Unidad } from "@/lib/agenda";
import { Tablero } from "./tablero";

export const metadata: Metadata = { title: "Agenda" };

/** Supabase devuelve como máximo 1000 filas por pedido: se piden por tandas. */
async function todo<T>(pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const salida: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await pedir(i, i + 999);
    if (error) throw error;
    salida.push(...(data ?? []));
    if (!data || data.length < 1000) return salida;
  }
}

export default async function Agenda({ searchParams }: { searchParams: Promise<{ fecha?: string; turno?: string }> }) {
  const perfil = await exigirActivo();
  const sp = await searchParams;
  const actual = guardiaActual();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? "") ? sp.fecha! : actual.fecha;
  const db = await clienteSesion();

  const [unidades, turnos, motivos, moviles, personal, situaciones, servicios, fuera, reservas, designaciones] = await Promise.all([
    todo<Unidad>((a, b) => db.from("unidad").select("id,nombre,tipo,padre,orden").order("orden").range(a, b)),
    todo<Turno>((a, b) => db.from("turno").select("id,nombre,hora_inicio,hora_fin,unidad,orden").eq("activo", true).order("orden").range(a, b)),
    todo<Motivo>((a, b) => db.from("motivo").select("id,nombre,categoria,gravedad").order("orden").range(a, b)),
    todo<Movil>((a, b) => db.from("movil").select("id,interno,dominio,programa,tipo,marca,modelo,unidad,revisar").eq("activo", true).order("interno").range(a, b)),
    todo<Persona>((a, b) => db.from("personal").select("dni,apellido,nombre,jerarquia,tipo_personal,unidad,calle,activo").eq("activo", true).order("apellido").range(a, b)),
    todo<Situacion>((a, b) => db.from("situacion_personal").select("dni,tipo,desde,hasta").or(`hasta.is.null,hasta.gte.${actual.fecha}`).range(a, b)),
    todo<Omit<Servicio, "dotacion"> & { dotacion: (Servicio["dotacion"][number] & { hasta: string | null })[] }>((a, b) =>
      db.from("servicio").select("id,movil,unidad,fecha,turno,designacion,inicio,fin_previsto,ocupado_motivo,ocupado_obs,ocupado_desde,relevo_de,dotacion(dni,rol,desde,hasta)").is("fin_real", null).range(a, b)),
    todo<FueraServicio>((a, b) => db.from("fuera_servicio").select("id,movil,motivo,obs,desde").is("hasta", null).range(a, b)),
    todo<Reserva>((a, b) => db.from("reserva").select("id,movil,fecha,turno,motivo,obs,creado_en").eq("anulada", false).gte("fecha", actual.fecha).range(a, b)),
    todo<Designacion>((a, b) => db.from("designacion").select("nombre,zona,unidad,alias").eq("activa", true).order("nombre").range(a, b)),
  ]);

  const abiertos = servicios.map((s) => ({ ...s, dotacion: s.dotacion.filter((d) => !d.hasta).map(({ dni, rol, desde }) => ({ dni, rol, desde })) }));
  const turno = turnos.some((t) => t.id === sp.turno) ? sp.turno! : actual.turno;
  // Quién ve qué: General, Super Admin y Monitoreo ven todo; el resto, su jurisdicción
  const raiz = perfil.rol && ["superadmin", "general", "monitoreo"].includes(perfil.rol) ? "G" : (perfil.jurisdiccion ?? "G");
  const edita = !!perfil.rol && ["superadmin", "general", "cargador"].includes(perfil.rol);

  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <Tablero
          datos={{ unidades, turnos, motivos, moviles, personal, situaciones, servicios: abiertos, fuera, reservas, designaciones }}
          guardia={{ fecha, turno }}
          raiz={raiz}
          edita={edita}
          esCargador={perfil.rol === "cargador"}
        />
      </main>
    </>
  );
}
