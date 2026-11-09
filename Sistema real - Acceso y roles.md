# Sistema real: acceso, roles y usuarios

Diseño para pasar la Agenda de Móviles del prototipo a un sistema con usuarios reales. Todavía no hay código: primero se acuerda esto.

## Herramientas

| Pieza | Para qué |
|---|---|
| **Next.js 16** | La aplicación web. Es la misma versión que usa Perfiles DMCA. |
| **Vercel** | Publica el sitio con HTTPS y lo actualiza con cada cambio guardado en GitHub. |
| **Supabase** | Usuarios, contraseñas, sesiones y la base de datos compartida, con actualización en tiempo real entre computadoras. |
| **Brevo** | Envía los correos: confirmar la cuenta, recuperar la contraseña y avisar si la solicitud se aprobó o se rechazó. |

El código va en una carpeta nueva, `sistema/`, dentro de este proyecto. El prototipo queda como referencia de pantallas y reglas.

## Roles

| Rol | Qué hace |
|---|---|
| **Super Admin** | Aprueba o rechaza cuentas, asigna roles y jurisdicciones, suspende usuarios y ve la auditoría de accesos. |
| **Administrador General** | Lo mismo que el General del prototipo: ve todo, reclama, presta y administra las designaciones. |
| **Cargador** | Carga la agenda y el personal de su Dirección (Norte o Sur). |
| **Supervisor** | Ve los móviles agendados en su jurisdicción. |
| **Jefe de calle** | Ve los móviles agendados en su jurisdicción. |
| **Monitoreo** | Consulta y verifica móviles escuchados en frecuencia. |

Cada usuario tiene un rol y una **jurisdicción**: Dirección, departamento o división. Lo que ve cada uno lo controla la base de datos, no solo la pantalla. Así, aunque alguien manipule la página, no puede leer datos de otra jurisdicción.

## Cómo pide una cuenta

1. Entra a **Solicitar cuenta** y completa: apellido, nombre, DNI, jerarquía, dependencia, correo, teléfono (opcional), rol que pide, jurisdicción y contraseña.
2. Recibe un **código de 6 números** en su correo y lo carga para confirmar que el correo es suyo.
3. La solicitud queda **en revisión**. Si inicia sesión, solo ve un aviso que dice que su cuenta está pendiente.
4. El **Super Admin** la aprueba (y puede corregir el rol o la jurisdicción) o la rechaza con un motivo.
5. Le llega un correo con el resultado. Si se aprobó, ya puede usar el sistema.

El DNI y el correo no se pueden repetir. Si el DNI ya tiene una cuenta, se le indica que hable con el Super Admin.

## Cómo ingresa

- Un solo campo: **"Correo o DNI"**, y la contraseña.
- Si escribe un DNI, el servidor busca el correo de esa cuenta y valida la contraseña. El correo nunca se muestra ni viaja a la pantalla.
- Ante un error, el mensaje es siempre el mismo ("Correo, DNI o contraseña incorrectos"). Así no se puede averiguar si un DNI tiene cuenta.
- Después de **5 intentos fallidos** en 15 minutos, esa cuenta queda bloqueada por un rato y el intento se registra.

## Recuperar la contraseña

1. **"Olvidé mi contraseña"**: se ingresa el correo o el DNI.
2. Llega un **código de 6 números** al correo, que vence a los 15 minutos y sirve una sola vez.
3. Se carga el código y la contraseña nueva.
4. Se cierran las sesiones abiertas en otras computadoras.

El código lo genera y lo guarda Supabase, cifrado. Es una mejora respecto de Perfiles DMCA, donde el código se generaba con una función no segura y se guardaba sin cifrar.

## Tokens y sesiones

- Al ingresar, Supabase entrega un **token de acceso** que vence en 1 hora y un **token de renovación** que se reemplaza cada vez que se usa. La sesión se renueva sola mientras la persona trabaja.
- Los tokens viajan en cookies protegidas: el código de la página no puede leerlas.
- Cada pedido al servidor verifica el token. Si el usuario está **suspendido**, se lo saca en el próximo pedido, aunque tenga la sesión abierta.
- Al suspender un usuario o cambiar su contraseña, se cierran todas sus sesiones.
- **Código de dos pasos** con una app como Google Authenticator: recomendado como obligatorio para el Super Admin y el General, y opcional para el resto.

## Panel del Super Admin

- **Solicitudes:** pendientes, con todos los datos. Aprobar (con rol y jurisdicción) o rechazar (con motivo).
- **Usuarios:** buscar con filtros múltiples, cambiar rol o jurisdicción, suspender, reactivar y cerrar sus sesiones.
- **Auditoría de accesos:** ingresos, intentos fallidos, cambios de contraseña y cambios de rol, con fecha y hora.

El primer Super Admin se crea a mano en Supabase. Después todo se maneja desde el panel.

## Tablas nuevas

| Tabla | Campos | Para qué |
|---|---|---|
| `perfil` | id de Supabase, DNI (único), apellido, nombre, jerarquía, teléfono, dependencia, rol pedido, rol asignado, jurisdicción, estado (en revisión / activo / rechazado / suspendido), motivo, quién aprobó y cuándo | Los datos de cada usuario. La contraseña no está acá: la guarda Supabase cifrada. |
| `auditoria_acceso` | usuario, evento, resultado, dirección IP, navegador, fecha | Registro de ingresos y cambios de seguridad. |
| `intento_ingreso` | correo o DNI, IP, fecha | Cuenta intentos fallidos para el bloqueo temporal. |

## Claves y datos sensibles

- **Clave pública (anon):** puede ir en la página. Sola no da acceso a nada, porque la base exige un usuario con permiso.
- **Clave service_role:** acceso total. Solo va en el servidor, como variable privada en Vercel. Nunca en el código, en el chat ni en una variable `NEXT_PUBLIC_`.
- **Clave de Brevo:** también privada, solo en Supabase y Vercel.
- El DNI y el teléfono de los usuarios solo los ve el Super Admin.

## Lo que tenés que hacer vos

1. **Supabase:** ya está creado. Más adelante vas a copiar la URL y la clave anon en un archivo `.env.local`, y la service_role directo en ese archivo, sin pasarla por el chat.
2. **Brevo:** crear la cuenta, verificar el correo o dominio remitente y generar una **clave SMTP**. Conviene un remitente institucional.
3. **GitHub:** un repositorio **privado** para el proyecto. Vercel publica desde ahí.
4. **Vercel:** importar el repositorio y cargar las variables privadas.

Te voy a guiar paso a paso en cada uno.

## Orden de trabajo

1. **Base:** proyecto Next.js, tablas de usuarios con permisos, registro, ingreso con correo o DNI, recuperación de contraseña y panel del Super Admin.
2. **Agenda:** pasar las tablas del modelo de datos y las pantallas del prototipo.
3. **Tiempo real:** que los cambios se vean al instante en todas las computadoras.
4. **Publicación:** Vercel, dominio y correos con Brevo.

## Decisiones pendientes

- [ ] ¿Qué es la jurisdicción de un Supervisor y de un Jefe de calle: Dirección, departamento, división o zona de frecuencia?
- [ ] ¿Código de dos pasos obligatorio para el Super Admin y el General?
- [ ] ¿Desde qué correo salen los mensajes? ¿Hay uno institucional?
- [ ] ¿La dependencia se elige de una lista (recomendado) o se escribe a mano?
