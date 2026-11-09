import Image from "next/image";

/** Marco de las pantallas de acceso: escudo, nombre del sistema y la tarjeta del formulario. */
export default function LayoutAcceso({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <div className="w-full max-w-[460px]">
        <header className="flex items-center gap-3 mb-6">
          <Image src="/img/policia-cordoba.png" alt="Policía de la Provincia de Córdoba" width={52} height={52} priority />
          <div>
            <div className="text-lg font-semibold leading-tight">Agenda de Móviles</div>
            <div className="text-[12.5px] text-tenue leading-snug">Dirección General de Policía Territorial y Proximidad</div>
          </div>
        </header>
        {children}
        <footer className="mt-6 text-center text-[12px] text-tenue">Uso exclusivo del personal autorizado. Los accesos quedan registrados.</footer>
      </div>
    </main>
  );
}
