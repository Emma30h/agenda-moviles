"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Pestanas({ pendientes }: { pendientes: number }) {
  const ruta = usePathname();
  const items = [
    { href: "/admin/solicitudes", texto: `Solicitudes${pendientes ? ` (${pendientes})` : ""}` },
    { href: "/admin/usuarios", texto: "Usuarios" },
    { href: "/admin/auditoria", texto: "Auditoría de accesos" },
  ];
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Administración">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`chip ${ruta.startsWith(i.href) ? "on" : ""}`} aria-current={ruta.startsWith(i.href) ? "page" : undefined}>
          {i.texto}
        </Link>
      ))}
    </nav>
  );
}
