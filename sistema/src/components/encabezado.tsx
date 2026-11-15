import Image from "next/image";
import Link from "next/link";
import { salir } from "@/app/(acceso)/acciones";
import { ROLES, nombreCompleto } from "@/lib/reglas";
import type { Perfil } from "@/lib/dal";
import { Pestana } from "./pestana";

export function Encabezado({ perfil }: { perfil: Perfil }) {
  return (
    <header className="border-b border-linea bg-panel">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
        <Link href="/" className="flex items-center gap-3 text-texto hover:no-underline">
          <Image src="/img/policia-cordoba.png" alt="" width={36} height={36} />
          <div>
            <div className="font-semibold leading-tight">Agenda de Móviles</div>
            <div className="text-[12px] text-tenue">Dirección General de Policía Territorial y Proximidad</div>
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Pestana href="/tablero">Tablero</Pestana>
          <Pestana href="/agenda">Agenda</Pestana>
          <Pestana href="/frecuencia">Frecuencia</Pestana>
          <Pestana href="/moviles">Móviles</Pestana>
          <Pestana href="/personal">Personal</Pestana>
          {(perfil.rol === "superadmin" || perfil.rol === "general") && <Pestana href="/designaciones">Designaciones</Pestana>}
          {perfil.rol === "superadmin" && <Pestana href="/admin/solicitudes" base="/admin">Administrar usuarios</Pestana>}
          <div className="text-right leading-tight">
            <div>
              {nombreCompleto(perfil)}
            </div>
            <div className="text-[12px] text-tenue">{perfil.rol ? ROLES[perfil.rol] : ""}</div>
          </div>
          <form action={salir}>
            <button className="boton" type="submit">Salir</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
