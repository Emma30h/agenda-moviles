import type { Metadata } from "next";
import { exigirActivo } from "@/lib/dal";
import { Encabezado } from "@/components/encabezado";
import { guardiaActual } from "@/lib/agenda";
import { alcance } from "../datos/comun";
import { cargarOperacion } from "../agenda/datos";
import { Consulta } from "./consulta";

export const metadata: Metadata = { title: "Frecuencia" };

export default async function Frecuencia() {
  const perfil = await exigirActivo();
  const datos = await cargarOperacion();
  const { raiz } = alcance(perfil);
  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <Consulta datos={datos} guardia={guardiaActual()} raiz={raiz}
          puedeResolver={!!perfil.rol && ["superadmin", "general", "monitoreo", "cargador"].includes(perfil.rol)} />
      </main>
    </>
  );
}
