import type { Metadata } from "next";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/encabezado";
import type { Prestamo, Unidad } from "@/lib/agenda";
import { alcance, todo } from "../datos/comun";
import { VistaMoviles, type MovilFicha } from "./vista";

export const metadata: Metadata = { title: "Móviles" };

export default async function Moviles() {
  const perfil = await exigirActivo();
  const db = await clienteSesion();
  const [unidades, moviles, servicios, fuera, prestamos] = await Promise.all([
    todo<Unidad>((a, b) => db.from("unidad").select("id,nombre,tipo,padre,orden").order("orden").range(a, b)),
    todo<MovilFicha>((a, b) => db.from("movil").select("id,interno,dominio,programa,tipo,marca,modelo,unidad,revisar,activo,baja_motivo,baja_fecha,baja_obs").order("interno").range(a, b)),
    todo<{ movil: string; designacion: string | null }>((a, b) => db.from("servicio").select("movil,designacion").is("fin_real", null).range(a, b)),
    todo<{ movil: string }>((a, b) => db.from("fuera_servicio").select("movil").is("hasta", null).range(a, b)),
    todo<Prestamo>((a, b) => db.from("prestamo").select("id,movil,origen,destino,con_dotacion,obs,desde").is("hasta", null).range(a, b)),
  ]);
  const { raiz, raizEdita } = alcance(perfil);
  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <VistaMoviles
          unidades={unidades} moviles={moviles} raiz={raiz} raizEdita={raizEdita}
          enServicio={Object.fromEntries(servicios.map((s) => [s.movil, s.designacion ?? "En servicio"]))}
          fuera={fuera.map((f) => f.movil)}
          prestamos={prestamos}
          esGeneral={perfil.rol === "superadmin" || perfil.rol === "general"}
        />
      </main>
    </>
  );
}
