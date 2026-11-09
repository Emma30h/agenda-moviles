import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que se pueden ver sin sesión
const PUBLICAS = ["/ingresar", "/solicitar-cuenta", "/verificar", "/recuperar"];

/**
 * Renueva el token de sesión antes de que venza y saca a quien no inició sesión.
 * Es un primer filtro: cada página y cada acción vuelve a verificar permisos en el servidor (lib/dal.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publica = PUBLICAS.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url.startsWith("https://") || key.length < 20) {
    // Sin Supabase configurado solo se muestran las pantallas públicas
    return publica ? NextResponse.next() : NextResponse.redirect(new URL("/ingresar", request.url));
  }

  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Las Server Actions se validan solas; redirigirlas acá rompe su respuesta
  if (request.headers.get("next-action")) return respuesta;

  if (!user && !publica) {
    const destino = new URL("/ingresar", request.url);
    if (pathname !== "/") destino.searchParams.set("volver", pathname);
    return NextResponse.redirect(destino);
  }
  if (user && (pathname === "/ingresar" || pathname === "/solicitar-cuenta")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
