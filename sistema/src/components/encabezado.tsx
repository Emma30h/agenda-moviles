import Image from "next/image";
import Link from "next/link";
import { salir } from "@/app/(acceso)/acciones";
import { ROLES, nombreCompleto } from "@/lib/reglas";
import type { Perfil } from "@/lib/dal";

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
          <Link className="chip" href="/tablero">Tablero</Link>
          <Link className="chip" href="/agenda">Agenda</Link>
          <Link className="chip" href="/frecuencia">Frecuencia</Link>
          <Link className="chip" href="/moviles">Móviles</Link>
          <Link className="chip" href="/personal">Personal</Link>
          {perfil.rol === "superadmin" && (
            <Link className="chip" href="/admin/solicitudes">
              Administrar usuarios
            </Link>
          )}
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
