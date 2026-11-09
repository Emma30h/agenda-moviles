import { exigirSuperadmin } from "@/lib/dal";
import { clienteAdmin } from "@/lib/supabase/admin";
import { ROLES, type Rol } from "@/lib/reglas";
import { fecha, opcionesUnidades } from "../datos";
import { FormAprobar, FormRechazar } from "../formularios";

type Solicitud = {
  id: string; dni: string; apellido: string; nombre: string; jerarquia: string; telefono: string | null; correo: string;
  dependencia: string; rol_pedido: Rol; jurisdiccion_pedida: string | null; estado: string; creado_en: string;
};

export default async function Solicitudes() {
  await exigirSuperadmin();
  const db = clienteAdmin();
  const [{ data: pendientes }, { count: sinConfirmar }, u] = await Promise.all([
    db.from("perfil").select("id,dni,apellido,nombre,jerarquia,telefono,correo,dependencia,rol_pedido,jurisdiccion_pedida,estado,creado_en").eq("estado", "en_revision").order("creado_en"),
    db.from("perfil").select("id", { count: "exact", head: true }).eq("estado", "verificando"),
    opcionesUnidades(),
  ]);
  const lista = (pendientes ?? []) as Solicitud[];

  return (
    <section className="grid gap-4">
      <p className="text-sm text-tenue">
        Solicitudes con el correo ya confirmado, de la más vieja a la más nueva. Al aprobar podés corregir el rol y la jurisdicción.
        {sinConfirmar ? ` Hay ${sinConfirmar} solicitud(es) más esperando que la persona confirme su correo.` : ""}
      </p>
      {!lista.length && <div className="tarjeta p-6 text-tenue">No hay solicitudes pendientes.</div>}
      {lista.map((s) => (
        <article key={s.id} className="tarjeta p-5 grid gap-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <h2 className="font-semibold">{s.jerarquia} {s.apellido}, {s.nombre}</h2>
              <div className="text-[13px] text-tenue">Pidió la cuenta el {fecha(s.creado_en)}</div>
            </div>
            <span className="etiqueta atento self-start">En revisión</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-tenue">DNI</dt><dd>{s.dni}</dd>
            <dt className="text-tenue">Correo</dt><dd className="break-all">{s.correo}</dd>
            <dt className="text-tenue">Teléfono</dt><dd>{s.telefono || "—"}</dd>
            <dt className="text-tenue">Dependencia</dt><dd>{u.nombre(s.dependencia)}</dd>
            <dt className="text-tenue">Rol pedido</dt><dd>{ROLES[s.rol_pedido]}</dd>
            <dt className="text-tenue">Jurisdicción pedida</dt><dd>{u.nombre(s.jurisdiccion_pedida)}</dd>
          </dl>
          <div className="grid md:grid-cols-[1fr_minmax(0,320px)] gap-5 border-t border-linea pt-4">
            <FormAprobar id={s.id} rol={s.rol_pedido} jurisdiccion={s.jurisdiccion_pedida ?? ""} unidades={u.opciones} />
            <FormRechazar id={s.id} />
          </div>
        </article>
      ))}
    </section>
  );
}
