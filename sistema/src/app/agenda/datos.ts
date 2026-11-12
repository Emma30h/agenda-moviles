import "server-only";
import { clienteSesion } from "@/lib/supabase/servidor";
import {
  guardiaActual, type Designacion, type FueraServicio, type Motivo, type Movil, type Persona, type Reclamo, type Reserva,
  type Servicio, type Situacion, type Turno, type Unidad, type Prestamo, type PrestamoPersona, type ReporteFrecuencia,
} from "@/lib/agenda";
import { todo } from "../datos/comun";

/** Todo lo que necesitan la Agenda y el Tablero, leído con la sesión del usuario (respeta RLS). */
export async function cargarOperacion() {
  const db = await clienteSesion();
  const actual = guardiaActual();
  // Cierra solos los reclamos ya cumplidos antes de leerlos
  await db.rpc("revisar_reclamos");
  const hace24 = new Date(Date.now() - 864e5).toISOString();

  const [unidades, turnos, motivos, moviles, personal, situaciones, servicios, fuera, reservas, designaciones, reclamos, prestamos, prestamosPersonal, reportes] = await Promise.all([
    todo<Unidad>((a, b) => db.from("unidad").select("id,nombre,tipo,padre,orden").order("orden").range(a, b)),
    todo<Turno>((a, b) => db.from("turno").select("id,nombre,hora_inicio,hora_fin,unidad,orden").eq("activo", true).order("orden").range(a, b)),
    todo<Motivo>((a, b) => db.from("motivo").select("id,nombre,categoria,gravedad").order("orden").range(a, b)),
    todo<Movil>((a, b) => db.from("movil").select("id,interno,dominio,programa,tipo,marca,modelo,unidad,revisar").eq("activo", true).order("interno").range(a, b)),
    todo<Persona>((a, b) => db.from("personal").select("dni,apellido,nombre,jerarquia,tipo_personal,unidad,calle,activo").eq("activo", true).order("apellido").range(a, b)),
    todo<Situacion>((a, b) => db.from("situacion_personal").select("dni,tipo,desde,hasta").eq("anulada", false).or(`hasta.is.null,hasta.gte.${actual.fecha}`).range(a, b)),
    todo<Omit<Servicio, "dotacion"> & { dotacion: (Servicio["dotacion"][number] & { hasta: string | null })[] }>((a, b) =>
      db.from("servicio").select("id,movil,unidad,fecha,turno,designacion,inicio,fin_previsto,ocupado_motivo,ocupado_obs,ocupado_desde,relevo_de,designaciones_previas,dotacion(dni,rol,desde,hasta)").is("fin_real", null).range(a, b)),
    todo<FueraServicio>((a, b) => db.from("fuera_servicio").select("id,movil,motivo,obs,desde").is("hasta", null).range(a, b)),
    todo<Reserva>((a, b) => db.from("reserva").select("id,movil,fecha,turno,motivo,obs,creado_en").eq("anulada", false).gte("fecha", actual.fecha).range(a, b)),
    todo<Designacion>((a, b) => db.from("designacion").select("nombre,zona,unidad,alias").eq("activa", true).order("nombre").range(a, b)),
    todo<Reclamo>((a, b) => db.from("reclamo").select("id,direccion,movil,fecha,turno,total,texto,creado_en,resuelto_en,automatico").or(`resuelto_en.is.null,resuelto_en.gte.${hace24}`).order("id", { ascending: false }).range(a, b)),
    todo<Prestamo>((a, b) => db.from("prestamo").select("id,movil,origen,destino,con_dotacion,obs,desde").is("hasta", null).range(a, b)),
    todo<PrestamoPersona>((a, b) => db.from("prestamo_personal").select("id,dni,origen,destino,fecha,turno,obs").eq("anulado", false).gte("fecha", actual.fecha).range(a, b)),
    todo<ReporteFrecuencia>((a, b) => db.from("reporte_frecuencia").select("id,texto,movil,direccion,creado_en,resuelto_en,automatico").or(`resuelto_en.is.null,resuelto_en.gte.${hace24}`).order("id", { ascending: false }).range(a, b)),
  ]);

  const abiertos = servicios.map((s) => ({ ...s, dotacion: s.dotacion.filter((d) => !d.hasta).map(({ dni, rol, desde }) => ({ dni, rol, desde })) }));
  return { unidades, turnos, motivos, moviles, personal, situaciones, servicios: abiertos, fuera, reservas, designaciones, reclamos, prestamos, prestamosPersonal, reportes };
}
