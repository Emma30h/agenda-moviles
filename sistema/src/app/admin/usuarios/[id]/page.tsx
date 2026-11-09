import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSuperadmin } from "@/lib/dal";
import { clienteAdmin } from "@/lib/supabase/admin";
import { ESTADOS, ROLES, type Estado, type Rol } from "@/lib/reglas";
import { fecha, opcionesUnidades } from "../../datos";
import { FormAcceso, FormAprobar, FormReactivar, FormRechazar, FormSuspender } from "../../formularios";
import { NOMBRE_EVENTO } from "../../eventos";

type Detalle = {
  id: string; dni: string; apellido: string; nombre: string; jerarquia: string; telefono: string | null; correo: string; dependencia: string;
  rol: Rol | null; rol_pedido: Rol; jurisdiccion: string | null; jurisdiccion_pedida: string | null; estado: Estado; motivo: string | null;
  revisado_en: string | null; creado_en: string;
};

export default async function Usuario({ params }: { params: Promise<{ id: string }> }) {
  const yo = await exigirSuperadmin();
  const { id } = await params;
  const db = clienteAdmin();
  const [{ data }, { data: eventos }, u] = await Promise.all([
    db.from("perfil").select("*").eq("id", id).maybeSingle(),
    db.from("auditoria_acceso").select("id,evento,detalle,ip,creado_en").eq("usuario", id).order("creado_en", { ascending: false }).limit(30),
    opcionesUnidades(),
  ]);
  if (!data) notFound();
  const p = data as Detalle;

  return (
    <section className="grid gap-4">
      <Link href="/admin/usuarios" className="text-sm">← Volver a usuarios</Link>
      <article className="tarjeta p-5 grid gap-4">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="text-lg font-semibold">{p.jerarquia} {p.apellido}, {p.nombre}</h2>
          <span className="etiqueta self-start">{ESTADOS[p.estado]}</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-tenue">DNI</dt><dd>{p.dni}</dd>
          <dt className="text-tenue">Correo</dt><dd className="break-all">{p.correo}</dd>
          <dt className="text-tenue">Teléfono</dt><dd>{p.telefono || "—"}</dd>
          <dt className="text-tenue">Dependencia</dt><dd>{u.nombre(p.dependencia)}</dd>
          <dt className="text-tenue">Rol</dt><dd>{p.rol ? ROLES[p.rol] : "—"} <span className="text-tenue">(pidió {ROLES[p.rol_pedido]})</span></dd>
          <dt className="text-tenue">Jurisdicción</dt><dd>{u.nombre(p.jurisdiccion)}</dd>
          <dt className="text-tenue">Pidió la cuenta</dt><dd>{fecha(p.creado_en)}</dd>
          <dt className="text-tenue">Última revisión</dt><dd>{fecha(p.revisado_en)}</dd>
        </dl>
        {p.motivo && <div className="aviso atento">Motivo: {p.motivo}</div>}
      </article>

      {(p.estado === "en_revision" || p.estado === "rechazado") && (
        <article className="tarjeta p-5 grid md:grid-cols-[1fr_minmax(0,320px)] gap-5">
          <FormAprobar id={p.id} rol={p.rol_pedido} jurisdiccion={p.jurisdiccion_pedida ?? ""} unidades={u.opciones} />
          {p.estado === "en_revision" && <FormRechazar id={p.id} />}
        </article>
      )}
      {p.estado === "activo" && (
        <article className="tarjeta p-5 grid md:grid-cols-[1fr_minmax(0,320px)] gap-5">
          <FormAcceso id={p.id} rol={p.rol} jurisdiccion={p.jurisdiccion} unidades={u.opciones} />
          {p.id !== yo.id ? <FormSuspender id={p.id} /> : <p className="text-sm text-tenue">No podés suspender tu propia cuenta.</p>}
        </article>
      )}
      {p.estado === "suspendido" && (
        <article className="tarjeta p-5">
          <FormReactivar id={p.id} />
        </article>
      )}
      {p.estado === "verificando" && <div className="aviso atento">Esta persona todavía no confirmó su correo.</div>}

      <article className="tarjeta overflow-x-auto">
        <h3 className="font-semibold p-4 pb-0">Últimos accesos y cambios</h3>
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th><th>IP</th></tr></thead>
          <tbody>
            {(eventos ?? []).map((e) => (
              <tr key={e.id}><td className="whitespace-nowrap">{fecha(e.creado_en)}</td><td>{NOMBRE_EVENTO[e.evento] ?? e.evento}</td><td>{e.detalle ?? ""}</td><td className="text-tenue">{e.ip ?? ""}</td></tr>
            ))}
            {!eventos?.length && <tr><td colSpan={4} className="text-tenue">Sin registros.</td></tr>}
          </tbody>
        </table>
      </article>
    </section>
  );
}
