import Link from "next/link";
import { exigirActivo } from "@/lib/dal";
import { clienteSesion } from "@/lib/supabase/servidor";
import { Encabezado } from "@/components/encabezado";
import { ROLES } from "@/lib/reglas";

export default async function Inicio({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  const perfil = await exigirActivo();
  const { clave } = await searchParams;
  const supabase = await clienteSesion();
  const { data: unidad } = perfil.jurisdiccion
    ? await supabase.from("unidad").select("nombre").eq("id", perfil.jurisdiccion).maybeSingle()
    : { data: null };

  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-8 grid gap-6">
        {clave === "ok" && <div className="aviso ok">Tu contraseña se cambió. Cerramos las sesiones abiertas en otras computadoras.</div>}
        <section className="tarjeta p-6">
          <h1 className="text-xl font-semibold">Hola, {perfil.nombre}</h1>
          <p className="text-tenue mt-1">
            Ingresaste como <b className="text-texto">{perfil.rol ? ROLES[perfil.rol] : "—"}</b>
            {unidad ? <> · Jurisdicción: <b className="text-texto">{unidad.nombre}</b></> : null}.
          </p>
        </section>
        <section className="tarjeta p-6 grid gap-2">
          <h2 className="font-semibold">Agenda</h2>
          <p className="text-sm text-tenue">
            Qué móviles están en la calle en esta guardia, con su designación y su dotación, en tiempo real.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link className="boton primario" href="/agenda">Abrir la agenda</Link>
            {perfil.rol === "superadmin" && <Link className="boton" href="/admin/solicitudes">Administrar usuarios</Link>}
          </div>
        </section>
      </main>
    </>
  );
}
