import type { Metadata } from "next";
import { exigirActivo } from "@/lib/dal";
import { Encabezado } from "@/components/encabezado";
import { guardiaActual } from "@/lib/agenda";
import { alcance } from "../datos/comun";
import { cargarOperacion } from "./datos";
import { Tablero } from "./tablero";

export const metadata: Metadata = { title: "Agenda" };

export default async function Agenda({ searchParams }: { searchParams: Promise<{ fecha?: string; turno?: string }> }) {
  const perfil = await exigirActivo();
  const sp = await searchParams;
  const actual = guardiaActual();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? "") ? sp.fecha! : actual.fecha;
  const datos = await cargarOperacion();
  const turno = datos.turnos.some((t) => t.id === sp.turno) ? sp.turno! : actual.turno;
  // General, Super Admin y Monitoreo ven todo; el resto, su jurisdicción
  const { raiz } = alcance(perfil);
  const edita = !!perfil.rol && ["superadmin", "general", "cargador"].includes(perfil.rol);

  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <Tablero datos={datos} guardia={{ fecha, turno }} raiz={raiz} edita={edita} esCargador={perfil.rol === "cargador"} />
      </main>
    </>
  );
}
