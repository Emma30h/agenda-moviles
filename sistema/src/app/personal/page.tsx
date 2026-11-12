import type { Metadata } from "next";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/encabezado";
import type { Unidad } from "@/lib/agenda";
import { alcance, todo } from "../datos/comun";
import { VistaPersonal, type FichaPersona, type SituacionFicha } from "./vista";

export const metadata: Metadata = { title: "Personal" };

export default async function Personal() {
  const perfil = await exigirActivo();
  const db = await clienteSesion();
  const [unidades, personal, situaciones, dotaciones] = await Promise.all([
    todo<Unidad>((a, b) => db.from("unidad").select("id,nombre,tipo,padre,orden").order("orden").range(a, b)),
    todo<FichaPersona>((a, b) => db.from("personal").select("dni,apellido,nombre,jerarquia,tipo_personal,unidad,funcion,calle,guardia,horario,revista,activo,baja_motivo,baja_fecha,baja_obs").order("apellido").range(a, b)),
    todo<SituacionFicha>((a, b) => db.from("situacion_personal").select("id,dni,tipo,detalle,desde,hasta,origen").eq("anulada", false).order("desde", { ascending: false }).range(a, b)),
    todo<{ dni: string; servicio: { designacion: string | null; movil: { interno: number | null; dominio: string } | null } | null }>((a, b) =>
      db.from("dotacion").select("dni,servicio(designacion,movil(interno,dominio))").is("hasta", null).range(a, b).overrideTypes<{ dni: string; servicio: { designacion: string | null; movil: { interno: number | null; dominio: string } | null } | null }[], { merge: false }>()),
  ]);
  const { raiz, raizEdita } = alcance(perfil);
  const enMovil = Object.fromEntries(dotaciones.map((d) => [d.dni,
    `${d.servicio?.designacion ? d.servicio.designacion + " · " : ""}${d.servicio?.movil ? (d.servicio.movil.interno != null ? "Int. " + d.servicio.movil.interno + " · " : "") + d.servicio.movil.dominio : ""}`]));
  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <VistaPersonal unidades={unidades} personal={personal} situaciones={situaciones} enMovil={enMovil} raiz={raiz} raizEdita={raizEdita} />
      </main>
    </>
  );
}
