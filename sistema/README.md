# Agenda de Móviles · sistema real

Next.js 16 + Supabase + Brevo, publicado en Vercel. El diseño está en `../Sistema real - Acceso y roles.md`.

Hoy incluye: solicitud de cuenta con confirmación de correo, ingreso con correo o DNI, bloqueo por intentos, recuperación de contraseña con código, estado de la cuenta y el panel del Super Admin (solicitudes, usuarios y auditoría). La agenda se pasa del prototipo en la próxima etapa.

## Conectar Supabase (una sola vez)

1. **Crear las tablas.** En Supabase: **SQL Editor → New query**, pegá todo el archivo `supabase/migraciones/0001_acceso.sql` y tocá **Run**. Después hacé lo mismo con `0002_tipo_personal.sql` (y con cada migración nueva, en orden).
2. **Configurar el acceso** en **Authentication**:
   - **Sign In / Providers → Email:** activado, con **Confirm email** activado.
   - **Sign In / Providers → Email OTP Length:** 6. **Email OTP Expiration:** 900 segundos (15 minutos).
   - **Policies → Passwords:** mínimo 10 caracteres y **Lowercase, uppercase letters, digits and symbols**. La app pide lo mismo.
   - **URL Configuration → Site URL:** `http://localhost:3002` por ahora (después, el dominio de Vercel).
   - **Sessions:** dejá el token de acceso en 3600 segundos y la rotación de tokens de renovación activada (vienen así).
3. **Plantillas de correo** en **Authentication → Emails** (Templates). Recién se pueden editar después de conectar Brevo (paso de abajo). Pegá el contenido de `supabase/plantillas/` (desde `<table` hasta el final):
   - **Confirm signup:** asunto `Agenda de Móviles · Código de confirmación de cuenta`, cuerpo `confirmar-cuenta.html`.
   - **Reset password:** asunto `Agenda de Móviles · Código para cambiar la contraseña`, cuerpo `cambiar-clave.html`.
   - Los logos se cargan desde el bucket público `publico` del Storage de Supabase (carpeta `correo/`).
4. **Variables.** Copiá `.env.example` como `.env.local` y completalo con los datos de **Project Settings → API**. La clave **service_role** pegala vos directo en el archivo: nunca en el chat ni en otro lado.

> Hasta configurar Brevo, Supabase manda los correos con su servicio de prueba: unos pocos por hora y solo a correos del equipo del proyecto. Alcanza para probar con tu propio correo.

## Crear el primer Super Admin

1. Levantá el sitio y entrá a **Solicitar cuenta** con tus datos.
2. Confirmá el correo con el código.
3. En **SQL Editor** corré (con tu correo):
   ```sql
   update public.perfil set rol = 'superadmin', jurisdiccion = 'G', estado = 'activo', revisado_en = now()
   where correo = 'tu-correo@ejemplo.com';
   ```
4. Ingresá de nuevo: vas a ver **Administrar usuarios**. Desde ahí se aprueban todas las demás cuentas.

## Brevo (correos)

1. Creá la cuenta en Brevo y verificá el **remitente** (mejor, un correo o dominio institucional).
2. **SMTP & API → SMTP:** copiá servidor `smtp-relay.brevo.com`, puerto `587`, usuario y **clave SMTP**.
3. En Supabase, **Authentication → Emails → SMTP Settings:** activá *Custom SMTP* y cargá esos datos. Desde ahí, los códigos los manda Brevo.
4. **SMTP & API → API Keys:** generá una clave y cargala en `BREVO_API_KEY` junto con `BREVO_FROM_EMAIL`. Se usa para los avisos de cuenta aprobada, rechazada o suspendida.

## Publicar en Vercel

1. En Vercel: **Add New → Project**, importar `agenda-moviles` desde GitHub.
2. **Settings → Build and Deployment → Root Directory:** `sistema`.
3. **Environment Variables:** las mismas de `.env.local`, con `NEXT_PUBLIC_SITE_URL` = la dirección pública (por ejemplo `https://agenda-moviles.vercel.app`).
4. Cada cambio que llega a la rama `main` se publica solo.
5. En Supabase, **Authentication → URL Configuration:** **Site URL** = la dirección pública y agregarla también en **Redirect URLs**.

## Levantar el sitio en esta PC

La carpeta del proyecto tiene un `&` en el nombre y eso rompe `npm run dev` en Windows. Se levanta con:

```bash
node node_modules/next/dist/bin/next dev -p 3002
```

y se abre http://localhost:3002. Para compilar: `node node_modules/next/dist/bin/next build`. En Vercel no pasa, porque compila en Linux.

## Seguridad: qué hace cada parte

| Archivo | Para qué |
|---|---|
| `src/proxy.ts` | Renueva la sesión y saca a quien no ingresó. Es un primer filtro. |
| `src/lib/dal.ts` | Cada página y acción vuelve a verificar la sesión y el estado de la cuenta en el servidor. |
| `src/lib/supabase/admin.ts` | Cliente con service_role. Solo en el servidor y siempre después de verificar permisos. |
| `src/lib/auditoria.ts` | Registro de accesos y bloqueo después de 5 intentos fallidos en 15 minutos. |
| `supabase/migraciones/0001_acceso.sql` | Tablas y reglas de seguridad (RLS): cada usuario solo lee lo que le corresponde. |
