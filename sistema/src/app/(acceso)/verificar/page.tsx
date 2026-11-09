import type { Metadata } from "next";
import Link from "next/link";
import { FormVerificar } from "../formularios";

export const metadata: Metadata = { title: "Confirmar correo" };

export default async function Verificar({ searchParams }: { searchParams: Promise<{ correo?: string }> }) {
  const { correo = "" } = await searchParams;
  return (
    <section className="tarjeta p-6 grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Confirmá tu correo</h1>
        <p className="text-sm text-tenue mt-1">
          Te enviamos un código a <b className="text-texto">{correo || "tu correo"}</b>. Si no lo ves, revisá la carpeta de correo no deseado.
        </p>
      </div>
      {correo ? <FormVerificar correo={correo} /> : <div className="aviso mal">Falta el correo. Volvé a ingresar para que te enviemos el código.</div>}
      <p className="text-sm text-tenue text-center">
        <Link href="/ingresar">Volver a ingresar</Link>
      </p>
    </section>
  );
}
