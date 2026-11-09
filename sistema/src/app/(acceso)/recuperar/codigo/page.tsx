import type { Metadata } from "next";
import Link from "next/link";
import { FormRestablecer } from "../../formularios";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function Codigo({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id = "" } = await searchParams;
  return (
    <section className="tarjeta p-6 grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Nueva contraseña</h1>
        <p className="text-sm text-tenue mt-1">
          Si los datos corresponden a una cuenta, te llegó un código al correo. Cargalo junto con tu contraseña nueva. Al cambiarla se cierran las sesiones abiertas en otras computadoras.
        </p>
      </div>
      {id ? <FormRestablecer identificador={id} /> : <div className="aviso mal">Volvé a empezar desde «Olvidé mi contraseña».</div>}
      <p className="text-sm text-tenue text-center">
        <Link href="/recuperar">Pedir otro código</Link>
      </p>
    </section>
  );
}
