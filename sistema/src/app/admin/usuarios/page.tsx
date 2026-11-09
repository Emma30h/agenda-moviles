import Link from "next/link";
import { exigirSuperadmin } from "@/lib/dal";
import { clienteAdmin } from "@/lib/supabase/admin";
import { ESTADOS, ROLES, type Estado, type Rol } from "@/lib/reglas";
import { opcionesUnidades } from "../datos";
import { FiltroChips, leerLista } from "../filtros";

type Fila = { id: string; dni: string; apellido: string; nombre: string; jerarquia: string; correo: string; rol: Rol | null; rol_pedido: Rol; jurisdiccion: string | null; estado: Estado };
const CLASE: Record<Estado, string> = { activo: "ok", en_revision: "atento", verificando: "", rechazado: "mal", suspendido: "mal" };

export default async function Usuarios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirSuperadmin();
  const params = await searchParams;
  const estados = leerLista(params.estado), roles = leerLista(params.rol);
  const q = String(params.q ?? "").trim().toLowerCase();
  const [{ data }, u] = await Promise.all([
    clienteAdmin().from("perfil").select("id,dni,apellido,nombre,jerarquia,correo,rol,rol_pedido,jurisdiccion,estado").order("apellido"),
    opcionesUnidades(),
  ]);
  const todos = (data ?? []) as Fila[];
  const rolDe = (f: Fila) => f.rol ?? f.rol_pedido;
  const coincide = (f: Fila) => !q || `${f.apellido} ${f.nombre} ${f.dni} ${f.correo}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const lista = todos.filter((f) => (!estados.length || estados.includes(f.estado)) && (!roles.length || roles.includes(rolDe(f))) && coincide(f));

  return (
    <section className="grid gap-4">
      <div className="tarjeta p-4 grid gap-3">
        <FiltroChips ruta="/admin/usuarios" clave="estado" params={params} opciones={Object.entries(ESTADOS).map(([v, t]) => ({ valor: v, texto: t, cantidad: todos.filter((f) => f.estado === v).length }))} />
        <FiltroChips ruta="/admin/usuarios" clave="rol" params={params} opciones={Object.entries(ROLES).map(([v, t]) => ({ valor: v, texto: t, cantidad: todos.filter((f) => rolDe(f) === v).length }))} />
        <form className="flex gap-2" action="/admin/usuarios">
          {estados.length > 0 && <input type="hidden" name="estado" value={estados.join(",")} />}
          {roles.length > 0 && <input type="hidden" name="rol" value={roles.join(",")} />}
          <input className="entrada max-w-sm" type="search" name="q" defaultValue={q} placeholder="Apellido, nombre, DNI o correo" />
          <button className="boton" type="submit">Buscar</button>
        </form>
      </div>
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr><th>Usuario</th><th>DNI</th><th>Rol</th><th>Jurisdicción</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td>{f.jerarquia} {f.apellido}, {f.nombre}<div className="text-[12.5px] text-tenue break-all">{f.correo}</div></td>
                <td>{f.dni}</td>
                <td>{f.rol ? ROLES[f.rol] : <span className="text-tenue">Pide: {ROLES[f.rol_pedido]}</span>}</td>
                <td>{u.nombre(f.jurisdiccion)}</td>
                <td><span className={`etiqueta ${CLASE[f.estado]}`}>{ESTADOS[f.estado]}</span></td>
                <td><Link className="boton" href={`/admin/usuarios/${f.id}`}>Ver</Link></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={6} className="text-tenue">No hay usuarios con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
