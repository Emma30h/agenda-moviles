"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Mientras se abre la página, el texto se atenúa y aparece el círculo (sin mover nada de lugar). */
function Contenido({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className={pending ? "opacity-30" : ""}>{children}</span>
      {pending && <span className="spinner pestana-spinner" aria-hidden />}
      {pending && <span className="sr-only">Cargando…</span>}
    </>
  );
}

/** Pestaña del encabezado: se resalta la de la página actual (y sus subpáginas). */
export function Pestana({ href, base, children }: { href: string; base?: string; children: ReactNode }) {
  const ruta = usePathname();
  const raiz = base ?? href;
  const actual = ruta === raiz || ruta.startsWith(raiz + "/");
  return (
    <Link className={`chip relative ${actual ? "on" : ""}`} href={href} aria-current={actual ? "page" : undefined}>
      <Contenido>{children}</Contenido>
    </Link>
  );
}
