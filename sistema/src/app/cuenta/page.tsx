import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { leerSesion } from "@/lib/dal";
import { salir } from "@/app/(acceso)/acciones";
import { ROLES } from "@/lib/reglas";

export const metadata: Metadata = { title: "Estado de la cuenta" };

/** Lo que ve alguien que inició sesión pero todavía no tiene la cuenta aprobada. */
export default async function Cuenta() {
  const { perfil } = await leerSesion();
  if (!perfil) redirect("/ingresar");
  if (perfil.estado === "activo") redirect("/");

  const textos = {
    verificando: { clase: "atento", titulo: "Falta confirmar tu correo", cuerpo: "Cargá el código que te enviamos para que tu solicitud pase a revisión." },
    en_revision: { clase: "atento", titulo: "Tu solicitud está en revisión", cuerpo: "El Super Admin tiene que aprobarla. Te vamos a avisar por correo cuando esté lista." },
    rechazado: { clase: "mal", titulo: "Tu solicitud no fue aprobada", cuerpo: perfil.motivo ? `Motivo: ${perfil.motivo}` : "Consultá con el Super Admin." },
    suspendido: { clase: "mal", titulo: "Tu cuenta está suspendida", cuerpo: perfil.motivo ? `Motivo: ${perfil.motivo}` : "Consultá con el Super Admin." },
  } as const;
  const t = textos[perfil.estado as keyof typeof textos];

  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <section className="tarjeta p-6 w-full max-w-[460px] grid gap-4">
        <div className="flex items-center gap-3">
          <Image src="/img/policia-cordoba.png" alt="" width={44} height={44} />
          <div className="font-semibold">Agenda de Móviles</div>
        </div>
        <div className={`aviso ${t.clase}`}>
          <b>{t.titulo}</b>
          <div className="mt-1 text-[14px]">{t.cuerpo}</div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-tenue">Nombre</dt>
          <dd>{perfil.jerarquia} {perfil.apellido}, {perfil.nombre}</dd>
          <dt className="text-tenue">Correo</dt>
          <dd>{perfil.correo}</dd>
          <dt className="text-tenue">Rol pedido</dt>
          <dd>{ROLES[perfil.rol_pedido]}</dd>
        </dl>
        {perfil.estado === "verificando" && (
          <Link className="boton primario ancho" href={`/verificar?correo=${encodeURIComponent(perfil.correo)}`}>
            Confirmar mi correo
          </Link>
        )}
        <form action={salir}>
          <button className="boton ancho" type="submit">Salir</button>
        </form>
      </section>
    </main>
  );
}
