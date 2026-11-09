import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { clienteSesion, supabaseConfigurado } from "@/lib/supabase/servidor";
import { FormSolicitud, type Unidad } from "../formularios";

export const metadata: Metadata = { title: "Solicitar cuenta" };

export default async function SolicitarCuenta() {
  await connection(); // la lista de dependencias se lee en cada pedido
  let unidades: Unidad[] = [];
  if (supabaseConfigurado()) {
    const supabase = await clienteSesion();
    const { data } = await supabase.from("unidad").select("id,nombre,tipo,padre,orden").order("orden");
    unidades = (data ?? []) as Unidad[];
  }
  return (
    <section className="tarjeta p-6 grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Solicitar cuenta</h1>
        <p className="text-sm text-tenue mt-1">
          Completá tus datos. Después confirmás tu correo y el Super Admin revisa la solicitud. Te avisamos por correo cuando esté aprobada.
        </p>
      </div>
      {!unidades.length && (
        <div className="aviso atento">Todavía no se pueden cargar las dependencias: el sistema no está conectado a Supabase.</div>
      )}
      <FormSolicitud unidades={unidades} />
      <p className="text-sm text-tenue text-center">
        ¿Ya tenés cuenta? <Link href="/ingresar">Ingresar</Link>
      </p>
    </section>
  );
}
