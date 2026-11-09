# Designaciones radiales en el SAE

Análisis del CSV del SAE (18/09/2025 al 15/10/2026, 80.580 sucesos). Son hipótesis para confirmar en la entrevista, no reglas oficiales.

El listado completo está en `Recursos/Designaciones radiales SAE.csv` y se regenera con `Recursos/extraer_designaciones_sae.py`. Esa carpeta no se versiona.

## Dónde están los datos

- **Relato:** es la fuente de las designaciones. Es texto libre, sin un campo propio.
- **Recurso:** no trae designaciones. Hasta marzo de 2026 traía el interno (`Ojos Alerta 151`). Desde abril de 2026 trae otros identificadores, en buena parte números largos de equipo (IMEI).
- **ALFA + número:** son ambulancias, por eso quedaron afuera.

## Qué se encontró

Quedaron 160 nombres y 776 combinaciones de nombre y número, después de unificar variantes de escritura (por ejemplo GRALPAZ, GENERALPAZ y PAZ).

| Zona | Nombres | Ejemplos |
|---|---:|---|
| Norte | 39 | URCA, CABRERA, TEJEDA, BELGRANO, GRANJA, CENTENO |
| Este | 29 | YOFRE, GENERAL PAZ, ALTA CORDOBA, PUEYRREDON, SAN MARTIN |
| Sur | 33 | SAN VICENTE, COLON, CRISOL, JARDIN, EMPALME |
| Centro | 20 | QUEBRADA, FELS, SAN SALVADOR, CASEROS, ALBERDI |
| Oeste | 30 | OLIVOS, TAFI, SAN FRANCISCO, FRIULI, BAIGORRIA |
| Varios distritos | 9 | AQUILES, EROS, ARES, MILOS, TANGO, AGUILA, IGUANA, ANDU, HALCON |

Las zonas salen del distrito donde más aparece cada nombre, con la agrupación por frecuencia.

### Lo que parece firme

- **El nombre pertenece a un sector.** Cada nombre se concentra en un distrito o en una misma zona. URCA aparece un 94% en Norte, YOFRE casi siempre en Este.
- **La decena del número cambia por zona.** Este usa 20, 21 y 22. Norte, Sur, Centro y Oeste usan 10, 11, 12 y 13.
- **Supervisión.** AQUILES02 (Este), EROS02 (Sur) y ARES03 (Norte) cubren varios distritos de su zona, y los relatos los asocian a oficiales y subcomisarios.
- **Los números 01 y 02 parecen ser jefes.** El 61% de las menciones tiene un grado cerca, contra casi 0% en los 1x y 2x. Además se concentran entre las 7 y las 20 Hs.
- **La designación no pertenece al móvil.** Un relato dice que una unidad está "operando como CLARET 10". Cada designación fue usada en promedio por 6 internos distintos.

### Lo que todavía no se puede afirmar

- **Números 03 a 07:** no son jefes (solo un 5% tiene un grado cerca) y tampoco los explica el tipo de vehículo. Aparecen más de tarde y de noche.
- **Diferencia entre 10, 11, 12 y 13:** los números altos (13, 14) se concentran de tarde, pero no alcanza para explicarlos.
- **MILOS, TANGO, AGUILA, IGUANA, ANDU y HALCON:** cubren varios distritos, pero no se confirmó qué función tienen.

## Cruce con la flota

Se compararon 6.596 registros de internos de Ojos en Alerta, solo de septiembre de 2025 a abril de 2026, contra la división que figura en la flota actualizada.

| Coincidencia con la División de la flota | Registros |
|---|---:|
| Mismo número de distrito | 7% |
| Misma zona | 23% |
| Misma dirección (Norte o Sur) | 46% |

Ejemplo: el interno 99 figura en División 15 y aparece sobre todo como GENERAL PAZ20 (Distrito 6).

Esto **no prueba** que los móviles trabajen fuera de su división. Hay tres explicaciones posibles:

1. Los móviles cambiaron de división después de abril de 2026.
2. Los móviles de Ojos en Alerta se reparten por necesidad, sin relación con la división que figura en la flota.
3. El número de `Ojos Alerta` en el SAE no es la matrícula interna.

## Otros números útiles

- 225 de 272 internos con datos suficientes usaron 2 o más designaciones.
- En el 9% de los días con registro (631 de 7.137), un interno aparece con dos designaciones. Puede ser un cambio real o un relato que nombra a otro móvil.

## Límites del análisis

- El relato es texto libre: se cuentan menciones, no servicios ni móviles reales.
- La unificación de variantes es criterio propio. Algunos casos pueden ser dudosos, como ITALIA, CHATO o AVENIDA.
- El SAE muestra la operación de Ojos en Alerta. Puede no reflejar todas las designaciones de los móviles policiales.

## Qué ya está en el prototipo

- La designación se carga en dos partes: **nombre** y **número**.
- El nombre se escribe y el campo va mostrando opciones, con tolerancia a errores de tipeo. Las opciones son solo de la Dirección donde trabaja el móvil: primero su división, después su zona y al final las otras zonas de esa Dirección. Un móvil prestado usa la lista de la Dirección que lo recibe.
- Si el nombre no existe, el cargador puede usarlo **como excepción**. Queda en el Historial y pendiente para el Administrador General.
- El Administrador General, desde la pestaña **Designaciones**, suma esos nombres a la lista, los descarta o agrega otros a mano. Quitar un nombre no cambia los servicios en curso.
- El número se escribe libre, solo con dígitos, por si cambian las circunstancias. Con un dígito se completa: 7 se guarda como 07.
- Mientras se carga, el sistema muestra si esa combinación está libre y qué números de ese nombre están en uso.
- Si la combinación ya está en uso, bloquea. Si el nombre es de otra zona, avisa pero deja seguir.
- Supervisión (AQUILES, EROS, ARES y similares) no está en la lista de nombres.

## Qué falta definir

- Reemplazar el catálogo por el listado oficial, si existe.
- Definir si supervisión y jefes se agendan en la app.
- Si la app reemplaza al relato libre, sumaría el dato que hoy falta en el SAE: qué móvil usó cada designación en cada turno.
