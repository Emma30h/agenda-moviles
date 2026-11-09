# Preguntas para entrevistas — App Agenda de Móviles

Dudas que surgen del análisis de los Excel y que hay que aclarar con quien conozca la calle. Se agregan a medida que aparecen.

## Personal (nóminas DPCN / DPCS)

- [ ] **Filas sin datos de situación.** 137 personas en Norte y 429 en Sur no tienen `SITUACION REVISTA`, `TNO` ni `PERSONAL DE CALLE`. ¿Ya no están en la dirección, o simplemente no se cargaron?
- [ ] **TNO y personal de calle.** Casi todos los TNO figuran como `PERSONAL DE CALLE = NO`. Hay un jefe de guardia en Sur con TNO y de calle: ¿es un error de carga?
- [ ] **Retención de armamento.** El campo dice "NO" para todos los TNO y solo 3 personas tienen "SI". ¿Se usa en la práctica? ¿Cómo se sabe hoy quién tiene el arma retenida?
- [ ] **Nómina duplicada.** DPCS incluye las 503 filas de Norte y repite 555 personas. ¿Cuál es la fuente oficial por persona?

## Móviles (flotas)

- [ ] **Matrícula repetida.** La matrícula interna 1 figura en dos dominios (AF859VY en Norte y AG999CN en Sur). ¿Cuál es la correcta?
- [ ] **Móviles sin dirección o división.** 45 de Ojos en Alerta y 7 de Policiales no tienen dirección; 27 de Policiales no tienen división. ¿A quién pertenecen?
- [ ] **Trámite de baja.** Dos móviles figuran con "TRAMITE DE BAJA" en lugar de división. ¿Cuentan en la flota?
- [ ] **Dos flotas.** ¿Ojos en Alerta y Policiales se manejan como una sola flota o por separado?

## Móviles sin agendar y frecuencia

- [ ] ¿Cómo se detecta hoy que un móvil salió sin estar agendado? ¿Quién lo detecta y a quién avisa?
- [ ] ¿Hasta qué hora, respecto del inicio del turno, tiene que estar cargada la agenda?
- [ ] ¿Qué datos mínimos hacen falta para considerar agendado un móvil?
- [ ] Validar: el Administrador General supervisa y le reclama al cargador de cada dirección. ¿Quién cumple hoy esa función?
- [ ] Validar: Monitoreo verifica el móvil escuchado en frecuencia y, si no está agendado, deja una alerta. ¿Le sirve así?

## Designación radial

- [ ] ¿Quién asigna la designación radial (por ejemplo URCA10)? ¿Hay un listado fijo o se define en cada turno?
- [ ] ¿La designación corresponde a una zona, un cuadrante o una función? ¿Qué significan el nombre y el número?
- [ ] Cuando un móvil cambia por frecuencia de URCA10 a CENTENO20, ¿quién lo informa y quién lo registra?
- [ ] ¿Dos móviles pueden usar la misma designación a la vez? En el prototipo no se permite.
- [ ] ¿Un móvil puede salir sin designación asignada? En el prototipo es obligatoria, junto con el móvil y el chofer.
- [ ] DJP y UT son lo mismo. ¿Cada División Territorial corresponde a un DJP/UT con el mismo número? Las frecuencias nombran los distritos 17 y 21, y el KML llega hasta el 27, pero en las planillas no hay Divisiones 17 ni 21: ¿a quién pertenecen?
- [ ] ¿La designación radial depende del DJP/UT donde trabaja el móvil?

**Surgidas del SAE** (detalle en `Designaciones radiales SAE.md`):

- [ ] ¿Existe un listado oficial de designaciones? En el SAE aparecen unas 160 (URCA, YOFRE, QUEBRADA…), con varias formas de escribirlas.
- [ ] ¿Qué indica el número? Este usa 20, 21 y 22; las demás zonas usan 10, 11, 12 y 13.
- [ ] ¿Qué diferencia hay entre 10, 11, 12 y 13 dentro de una misma zona?
- [ ] ¿Hay números que nunca deberían usarse, o un rango permitido? En el prototipo el número es libre.
- [ ] ¿Quién autoriza una designación nueva? En el prototipo el cargador la usa como excepción y solo el Administrador General la suma a la lista.
- [ ] ¿El cargador puede usar una designación de otra Dirección como excepción, o debería bloquearse? Hoy se permite y queda registrada.
- [ ] ¿Los números 01 y 02 son jefes de división o de sector? ¿Quiénes usan 03 a 07 (por ejemplo CABRERA07, YOFRE03, QUEBRADA04)?
- [ ] ¿AQUILES, EROS y ARES son los supervisores de Este, Sur y Norte? ¿Qué designación tienen Centro y Oeste?
- [ ] ¿Qué son MILOS, TANGO, AGUILA, IGUANA, ANDU y HALCON?
- [ ] ¿Supervisores y jefes se agendan en esta app como un móvil más?
- [ ] ¿Por qué un móvil usa varias designaciones? ¿Cambia por turno, por necesidad o por el personal que lleva?
- [ ] ¿Un móvil trabaja en la división que figura en la flota? En el SAE, entre septiembre de 2025 y abril de 2026, solo el 7% de los registros coincide con el distrito de su designación.
- [ ] ¿El número de `Ojos Alerta` que mostraba el SAE es la matrícula interna del móvil?
- [ ] ¿Por qué desde abril de 2026 el campo Recurso del SAE dejó de mostrar el interno? ¿Se puede saber qué móvil es por el número de equipo (IMEI)?
- [ ] ¿Los móviles policiales usan las mismas designaciones que los de Ojos en Alerta?

## Alta, baja y pases

- [ ] ¿Quién da de alta y de baja personal? En el prototipo lo hacen el cargador de cada Dirección y el General.
- [ ] Una exoneración o cesantía, ¿debería cargarla solo el General o alguien de Personal?
- [ ] ¿Qué motivos de baja de personal se usan? En el prototipo: pase a otra dependencia, exoneración, cesantía, retiro, renuncia, fallecimiento y otro.
- [ ] ¿Quién da de alta y de baja un móvil? ¿Qué motivos se usan?
- [ ] Un pase, ¿se carga cuando se resuelve o desde la fecha en que rige? En el prototipo vale desde que se carga.
- [ ] ¿Quién carga las licencias, TNO y suspensiones, y de dónde sale ese dato?
- [ ] ¿Qué tipos de licencia usan y cuáles impiden salir en móvil? En el prototipo todas lo impiden.
- [ ] ¿Quién puede ver una situación como TNO? En el prototipo la ve quien puede ver a esa persona; la observación, solo quien puede editarla.
- [ ] ¿La nómina va a actualizarse a mano o desde una fuente oficial?

## Móviles reservados

- [ ] ¿Cómo se llama en la práctica a un móvil que no sale en la guardia sin tener novedad? En el prototipo, "Reservado".
- [ ] ¿Qué motivos se usan? En el prototipo: sin novedad, falta de personal, rotación del vehículo, a disposición de la superioridad y otro.
- [ ] ¿Quién puede reservar un móvil: el cargador o solo el General?
- [ ] ¿La reserva vale solo para esa guardia o puede durar varios días?

## Roles y acceso

- [ ] Validar roles: Administrador General, cargador Norte, cargador Sur y Monitoreo. ¿Falta alguno?
- [ ] ¿Cuántas personas cargan por dirección y por turno? ¿Desde qué equipos?
- [ ] ¿Los jefes de división o departamento deberían ver o cargar la agenda?

## Estructura orgánica

- [ ] Además de Norte, Sur y Monitoreo, ¿qué otras direcciones tiene la Dirección General? ¿Logística, Socioeducativo, EPAT 360 y la Subdirección General tienen estatus de dirección?

## Préstamo de móviles (Norte ↔ Sur)

- [ ] ¿Quién decide el préstamo? Entendemos que lo determina el administrador de móviles según falte o sobre en cada zona. ¿Es una sola persona o hay una por dirección?
- [ ] ¿Se presta por turno, por día o por tiempo indefinido? ¿Cómo y cuándo se marca la devolución?
- [ ] Mientras está prestado, ¿a qué dirección cuenta para el recuento: a la que es dueña o a la que lo usa?
- [ ] ¿Se presta también con su dotación, o solo el móvil?
- [ ] ¿Hay préstamos entre departamentos de la misma dirección (por ejemplo, de Norte a Este)?

## Móvil ocupado fuera del horario (procedimientos)

- [ ] Cuando un móvil queda retenido por un procedimiento (por ejemplo, entrega de aprehendido pasado el cambio de turno, a las 7 o a las 14), ¿cuánto suele demorar? ¿Hay un tope?
- [ ] ¿Quién avisa al administrador, y por qué medio?
- [ ] ¿Qué otros motivos tienen los móviles para faltar al recuento además del procedimiento (traslado de detenido, comisión, otra tarea)?
- [ ] ¿Cómo se maneja la dotación de relevo cuando el turno entrante se queda sin ese móvil?
- [ ] ¿Qué se anota del motivo y qué datos hacen falta: número de procedimiento, comisaría o destino, hora de inicio?

## Préstamo de personal (Norte ↔ Sur)

- [ ] Por pases o excepciones, en el prototipo un cargador puede agendar personal de otra Dirección sin préstamo del General: solo muestra un aviso y queda en el Historial. ¿Es correcto o alguien debería autorizarlo?
- [ ] Un efectivo de Norte puede ser prestado a Sur por una guardia. ¿Quién lo decide y quién lo autoriza?
- [ ] ¿El préstamo es siempre por una guardia, o puede ser por varios días?
- [ ] Al terminar la guardia, ¿vuelve solo a su dirección o alguien tiene que marcar la devolución?
- [ ] ¿Se presta también entre divisiones de la misma dirección? ¿Se registra?
- [ ] ¿A qué dirección cuenta para la dotación del día: a la suya o a la que lo recibe?

## Asignación de móviles a divisiones

- [ ] Cada móvil figura asignado a una división en las planillas de flota. ¿En la práctica cada división usa solo sus móviles, o el departamento los reparte según la necesidad del día?
- [ ] Una división o UT puede prestarle un móvil a otra según necesidad (por ejemplo la 15 a la 24 BIS, 14 o 23). En el prototipo lo hace el cargador dentro de su dirección y hacia otra dirección solo el General. ¿Es así? ¿Es préstamo (vuelve) o reasignación (queda)?
- [ ] ¿Cada cuánto cambia la asignación de móviles a divisiones?
- [ ] Cuando un móvil se presta a otra división o UT, ¿qué pasa con su dotación? ¿Va con su gente o la pone la división que lo recibe?
- [ ] Si un móvil ya está en servicio con su dotación y lo mandan a otra división en plena guardia, ¿cómo se resuelve? ¿Sigue la misma gente y horario? ¿Cambia la designación radial? ¿Quién lo registra? (Hoy el prototipo obliga a terminar el servicio y volver a cargarlo; la idea es una opción "Pasar a otra división".)
- [ ] En el relevo, si el mismo móvil sigue en la calle pero entra otra dotación, ¿cómo se hace y se registra?

## Dotación

- [ ] Usualmente son 2 personas, pero se vio móviles saliendo con una sola. ¿Está permitido salir solo? ¿En qué casos? ¿Hay un máximo de integrantes?
- [ ] ¿Hace falta siempre un chofer y un jefe de coche, o con un chofer alcanza?
- [ ] En el prototipo se puso un cupo por móvil: 1 chofer, 1 jefe de coche y hasta 2 acompañantes. ¿Es correcto? ¿Cambia según el vehículo (sedán, pick-up, camioneta)?
- [ ] ¿Los horarios de turno (por ejemplo 07–14, 14–07, 07–23) son iguales para toda la dirección, o cada departamento o división tiene los suyos?

## Funcionamiento en la calle (pendiente de contar)

- [ ] ¿Cómo se presta un móvil de Norte a Sur y cómo se registra?
- [ ] ¿Quién carga la agenda, y cuándo?
- [ ] ¿Qué estados de móvil y qué motivos de fuera de servicio usan en la práctica?
- [ ] ¿Cómo se cuenta la dotación de cada móvil?
- [ ] ¿Hay móviles que no están en ninguna de las dos flotas?
