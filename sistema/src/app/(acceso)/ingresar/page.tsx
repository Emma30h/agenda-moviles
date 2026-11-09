import type { Metadata } from "next";
import Link from "next/link";
import { FormIngresar } from "../formularios";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const { volver = "/" } = await searchParams;
  return (
    <section className="tarjeta p-6 grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Ingresar</h1>
        <p className="text-sm text-tenue mt-1">Usá tu correo o tu DNI y tu contraseña.</p>
      </div>
      <FormIngresar volver={volver} />
      <p className="text-sm text-tenue text-center">
        ¿No tenés cuenta? <Link href="/solicitar-cuenta">Solicitar cuenta</Link>
      </p>
    </section>
  );
}
