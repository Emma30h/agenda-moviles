import type { Metadata } from "next";
import { exigirActivo } from "@/lib/dal";
import { Encabezado } from "@/components/encabezado";
import { guardiaActual } from "@/lib/agenda";
import { alcance } from "../datos/comun";
import { cargarOperacion } from "../agenda/datos";
import { Panel } from "./panel";

export const metadata: Metadata = { title: "Tablero" };

export default async function Tablero() {
  const perfil = await exigirActivo();
  const datos = await cargarOperacion();
  const { raiz } = alcance(perfil);
  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <Panel
          datos={datos}
          guardia={guardiaActual()}
          raiz={raiz}
          reclama={perfil.rol === "superadmin" || perfil.rol === "general"}
          edita={!!perfil.rol && ["superadmin", "general", "cargador"].includes(perfil.rol)}
        />
      </main>
    </>
  );
}
