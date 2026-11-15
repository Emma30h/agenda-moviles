"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Pestaña del encabezado: se resalta la de la página actual (y sus subpáginas). */
export function Pestana({ href, base, children }: { href: string; base?: string; children: ReactNode }) {
  const ruta = usePathname();
  const raiz = base ?? href;
  const actual = ruta === raiz || ruta.startsWith(raiz + "/");
  return (
    <Link className={`chip ${actual ? "on" : ""}`} href={href} aria-current={actual ? "page" : undefined}>
      {children}
    </Link>
  );
}
