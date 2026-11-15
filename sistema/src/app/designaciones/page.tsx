import type { Metadata } from "next";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/encabezado";
import type { Unidad } from "@/lib/agenda";
import { haceDias, todo } from "../datos/comun";
import { Catalogo, type DesignacionFila, type Excepcion } from "./catalogo";

export const metadata: Metadata = { title: "Designaciones" };

export default async function Designaciones() {
  const perfil = await exigirActivo();
  const db = await clienteSesion();
  const hace30 = haceDias(30);
  const [unidades, designaciones, excepciones] = await Promise.all([
    todo<Unidad>((a, b) => db.from("unidad").select("id,nombre,tipo,padre,orden").order("orden").range(a, b)),
    todo<DesignacionFila>((a, b) => db.from("designacion").select("nombre,tipo,zona,unidad,distritos,alias,usos,activa,origen").order("nombre").range(a, b)),
    todo<Excepcion>((a, b) => db.from("designacion_excepcion").select("id,nombre,ejemplo,usos,ultima_vez,movil,unidad,creado_en,estado,resuelta_como,resuelto_en,movil_ref:movil(interno,dominio)")
      .or(`estado.eq.pendiente,resuelto_en.gte.${hace30}`).order("ultima_vez", { ascending: false }).range(a, b)
      .overrideTypes<Excepcion[], { merge: false }>()),
  ]);
  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <Catalogo unidades={unidades} designaciones={designaciones} excepciones={excepciones}
          edita={perfil.rol === "superadmin" || perfil.rol === "general"} />
      </main>
    </>
  );
}
