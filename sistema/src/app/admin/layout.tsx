import type { Metadata } from "next";
import { exigirSuperadmin } from "@/lib/dal";
import { clienteAdmin } from "@/lib/supabase/admin";
import { Encabezado } from "@/components/encabezado";
import { Pestanas } from "./pestanas";

export const metadata: Metadata = { title: "Administrar usuarios" };

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const perfil = await exigirSuperadmin();
  const { count } = await clienteAdmin().from("perfil").select("id", { count: "exact", head: true }).eq("estado", "en_revision");
  return (
    <>
      <Encabezado perfil={perfil} />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Administrar usuarios</h1>
          <Pestanas pendientes={count ?? 0} />
        </div>
        {children}
      </main>
    </>
  );
}
