import type { Metadata } from "next";
import Link from "next/link";
import { FormRecuperar } from "../formularios";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function Recuperar() {
  return (
    <section className="tarjeta p-6 grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
        <p className="text-sm text-tenue mt-1">Escribí tu correo o tu DNI. Te enviamos un código al correo de tu cuenta, que vence a los 15 minutos.</p>
      </div>
      <FormRecuperar />
      <p className="text-sm text-tenue text-center">
        <Link href="/ingresar">Volver a ingresar</Link>
      </p>
    </section>
  );
}
