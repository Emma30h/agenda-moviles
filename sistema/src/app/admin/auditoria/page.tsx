import { exigirSuperadmin } from "@/lib/dal";
import { clienteAdmin } from "@/lib/supabase/admin";
import { fecha } from "../datos";
import { CLASE_EVENTO, NOMBRE_EVENTO } from "../eventos";
import { FiltroChips, leerLista } from "../filtros";

type Evento = { id: number; evento: string; identificador: string | null; detalle: string | null; ip: string | null; creado_en: string; usuario: string | null; actor: string | null };

export default async function Auditoria({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirSuperadmin();
  const params = await searchParams;
  const tipos = leerLista(params.evento);
  const db = clienteAdmin();
  let consulta = db.from("auditoria_acceso").select("id,evento,identificador,detalle,ip,creado_en,usuario,actor").order("creado_en", { ascending: false }).limit(300);
  if (tipos.length) consulta = consulta.in("evento", tipos);
  const { data } = await consulta;
  const eventos = (data ?? []) as Evento[];
  const ids = [...new Set(eventos.flatMap((e) => [e.usuario, e.actor]).filter(Boolean))] as string[];
  const { data: personas } = ids.length ? await db.from("perfil").select("id,apellido,nombre").in("id", ids) : { data: [] };
  const nombre = Object.fromEntries((personas ?? []).map((p) => [p.id, `${p.apellido}, ${p.nombre}`]));

  return (
    <section className="grid gap-4">
      <div className="tarjeta p-4">
        <FiltroChips ruta="/admin/auditoria" clave="evento" params={params} opciones={Object.entries(NOMBRE_EVENTO).map(([v, t]) => ({ valor: v, texto: t }))} />
      </div>
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Evento</th><th>Usuario</th><th>Detalle</th><th>Por</th><th>IP</th></tr></thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap">{fecha(e.creado_en)}</td>
                <td><span className={`etiqueta ${CLASE_EVENTO[e.evento] ?? ""}`}>{NOMBRE_EVENTO[e.evento] ?? e.evento}</span></td>
                <td>{e.usuario ? nombre[e.usuario] ?? "—" : <span className="text-tenue">{e.identificador ?? "—"}</span>}</td>
                <td>{e.detalle ?? ""}</td>
                <td className="text-tenue">{e.actor ? nombre[e.actor] ?? "" : ""}</td>
                <td className="text-tenue">{e.ip ?? ""}</td>
              </tr>
            ))}
            {!eventos.length && <tr><td colSpan={6} className="text-tenue">Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-tenue">Se muestran los últimos 300 eventos. Nunca se guardan contraseñas ni códigos.</p>
    </section>
  );
}
