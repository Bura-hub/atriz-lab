# Atriz Lab — la interfaz del laboratorio de robótica

Cliente web de 16 robots Sphero RVR sobre ROS 2 Jazzy. Habla con cada robot por
**rosbridge** (un WebSocket por robot, `ws://rvr-NN.local:9090`).

**No es un panel de administración ni un laboratorio remoto: es un instrumento.**
Los alumnos están en la misma sala que el robot, midiendo con cinta métrica y
transportador. El administrador mira los 16 desde el otro lado del aula.

## Estado real

| | |
|---|---|
| ✅ **Capa de datos** (`src/lib/rosbridge/`) | Verificada contra el hardware: ha movido un RVR, ha disparado su parada de emergencia con el robot en marcha, y su odometría coincide con la cinta (30 cm contra 30,2) |
| ✅ **CONDUCIR DESDE EL NAVEGADOR, DE PUNTA A PUNTA** | 2026-08-06, rvr-01. Manteniendo pulsado «Adelante» en `/conducir` **con el ratón** —no publicando por detrás—: 3 s a 0,100 m/s → `/odom` **29,7 cm** y la **cinta 30,0 cm**, o sea **0,3 cm (1,0 %)** de error. Rumbo: −0,13°. El camino entero queda cerrado: React → hook → bucle de 10 Hz → `/cmd_vel_raw` → rosbridge → driver → 30 cm de suelo. Y el barrido se encendió **desde la pantalla**, que lo dio por bueno solo al llegar un `/scan` real (99 en 10 s), no con el `result:true` del servicio |
| ✅ **La lista blanca DENIEGA, y en silencio** | 2026-08-06, medido con **control positivo** —sin él, «no contestó» no distingue denegado de socket roto—: `/stop_scan` contesta `result=true`, mientras `/raw_motors` (a 80), `/move_timed` y `/move_to_pose` **no contestan nada** y publicar en `/cmd_vel` a 0,15 m/s da **0,00 cm** de desplazamiento. rosbridge manda **0** mensajes `op=status`: la denegación es muda, así que un cliente no puede distinguirla de un fallo |
| ✅ **Telemetría, flota, LIDAR, conducir, diagnóstico** | Cinco rutas construidas, y **miradas renderizadas contra el robot vivo** — no solo con `curl`. El LIDAR dibuja geometría real (224 de 260 puntos, lo más cercano a 0,30 m) |
| ✅ **El muro encuentra a los robots por su nombre** | `ws://rvr-01.local:9090` abre en el navegador: 4339 ms con la caché mDNS fría, 2331 caliente. Estuvo roto hasta el 2026-08-04 —el nombre resolvía a cuatro direcciones y el navegador se colgaba en las dos primeras, **sin dar error**— y se arregló en el robot, no aquí. Queda un campo para apuntar a una IP como camino de escape. ✅ **Y el aula ya NO está sin probar** (corregido el 2026-08-14): el robot llevó rvr-01 al laboratorio el 2026-08-12 y `05-atriz-lab.network` **casó a la primera** —`Atriz-server`, `10.14.7.7`, `routable`, con salida a NTP—, que era el perfil que nunca había emparejado con nada. ⏳ n=1: faltan rvr-02 y la imagen dorada |
| ✅ **Sistema visual** | Tokens claro **y oscuro** en `src/app/globals.css`, tipografía del sistema, rejilla de 1 px |
| ✅ **Arrancar y parar SLAM desde la web** | **Validado contra rvr-01 el 2026-08-09**: `apagado → arrancando · 4 · 9 · 14 s → funcionando` en **~18 s**, y el botón cambia a «Parar SLAM». **Seis estados, no un interruptor**, y los dos del medio se vieron de verdad: `CIEGO` forzado apagando el barrido con SLAM vivo —*«levantado, pero no le llega el barrido»*, que es exactamente lo que `systemctl is-active` llamaría `active`— y `MUDO` **apareció solo** al parar. 🔴 Esta fila llegó a decir que los servicios «no existen en el robot»: **era falso al escribirse**, y la lección se quedó — el repositorio dice qué existe, **solo el robot dice qué está corriendo** |
| ✅ **Y el desenlace de Nav2 no se cree, en NINGUNA dirección** | `SUCCEEDED` puede estar equivocado en **41 cm**; y desde el 2026-08-08 se sabe que `ABORTED` puede ser **un robot que llegó** —`bt_navigator` daba 20 ms al controlador para acusar recibo y se rendía mientras conducía; el robot recorrió 67 cm y llegó **diez segundos después**—. Así que la pantalla habla de la **acción**, nunca del robot, y muestra el **desplazamiento por `/odom`**, que es la fuente que acierta a 0,3-4,2 cm. Sobre mapa fresco, n=3: **6,1 · 11,8 · 11,3 cm**, dos de tres fuera de la tolerancia de 10 |
| ✅ **El sensor de color mide sus DOS modos** | 2026-08-08, siguiendo el contrato que escribió el robot. *Reflejo* (luz encendida) para suelo, cinta y papel; *emisión* (luz **apagada**) para una pantalla o una baldosa LED. 🔴 Y no es un matiz de precisión: sobre una superficie que emite, medir con el LED encendido da el resultado **invertido** — una pantalla roja a tope sale con `R/G = 0,66`, menos roja que verde. La pantalla se niega a nombrar un color dentro de esa banda y dice qué hacer |
| ✅ **La capa de seguridad deja de ser invisible** | 2026-08-08. El robot midió que `avanzar(0.20, 3)` da **26,4 cm** con algo cerca y **59,5** despejado — la misma orden—, porque el polígono `Precaucion` mide 60 × **40 cm** y cualquier cosa a menos de ~9 cm de un **costado** frena al 40 %, aunque el robot se aleje de ella. El journal lo registraba y **el alumno no veía nada**. Ahora sale en vivo en Conducir, pegado a los números, y es una causa más en «por qué no obedece» |
| 🔴 **Y «te está frenando» era FALSO en el peor caso: el robot no se mueve, y no puede salir** | 2026-08-09, con 24 estaciones a mano en las cuatro direcciones (evidencias 93-95). Con algo dentro del círculo de **15 cm**, `approach` multiplica el mando **entero** —giro incluido— por el tiempo hasta colisión, y ese factor es **cero**: `AVANZAR alejándose 0,0 cm · GIRAR 0,0° · RETROCEDER 0,0 cm`. **24 de 24 todo-o-nada.** Esta app metía la acción 3 en el saco de «va más despacio» —con una razón escrita al lado: *«para quien mira la pantalla son lo mismo»*— y le contestaba **«y el robot SÍ obedece»** a quien tenía delante un robot muerto, en LA pantalla del «no obedece». Peor: el remedio mandaba a **probar marcha atrás**, que está medido que da cero igual. Ahora la acción 3 va sola, dice que **no se puede desbloquear desde la web**, y distingue «recortado» de «congelado» **mirando `/odom`** en vez de deducirlo del código. 📝 La lección: *agrupar dos códigos porque «para el usuario son lo mismo» es una hipótesis sobre el efecto, y hay que medirla* |
| ✅ **Un `.msg` ya no puede cambiar sin que nadie se entere** | `comprobar_contrato.mjs` miraba que el `.msg` **existiera** y nunca lo que hay dentro. El 2026-08-08 el robot añadió dos campos y avisó de que *«el contrato estará en rojo hasta que alinees»*: **no lo estuvo**, y fiarse de ese rojo habría dejado los dos campos sin llegar a la pantalla **con todo en verde** — justo los campos que avisan del fallo de los 41,3 cm. Cerrado con una instantánea versionada (`herramientas/campos_msg.json`, **36 campos en 5 `.msg`**) que se pone en rojo ante cualquier cambio hasta que alguien la acepte a mano. Lo propuso el robot. ✅ Verificado por efecto **en las dos direcciones**: añadiendo un campo al `.msg` real sale código 1 nombrándolo, y restaurándolo vuelve a 0 |
| ✅ **Validado contra rvr-01 el 2026-08-09** | Los **seis estados** de SLAM vistos de verdad —incluidos `CIEGO` (apagando el barrido con SLAM vivo) y `MUDO` (apareció solo al parar)—, y las **cuatro casillas** del 2×2 del sensor de color. 🎯 La que lo justifica todo: la **misma pantalla roja** da `R/G = 5,0` con la luz apagada («es rojo») y `R/G = 0,57` con ella encendida («no se puede decir»), porque el sensor lee **más verde que rojo** sobre una superficie roja. Detalle y lo que quedó sin medir en [`VALIDAR_CON_EL_ROBOT.md`](VALIDAR_CON_EL_ROBOT.md) |
| ✅ **La pantalla dice QUÉ mapa y DE CUÁNDO** | El robot añadió `mapa_nombre` y `mapa_edad_s` **para esta pantalla**, porque `hay_mapa` a solas no defiende del peor fallo medido: un mapa que no es del sitio hace que Nav2 dé el objetivo por cumplido **a 41,3 cm**, con `SUCCEEDED` y sin una línea de error. 🔴 **Y no hay semáforo, a propósito:** la edad no mide lo que falla, y `mapa_edad_s` es el `mtime` —copiar un mapa viejo lo rejuvenece—, así que un umbral daría verde justo en el caso peor. La pantalla enseña los dos datos y **pregunta**. Verificado contra rvr-01: «cuarto3.yaml · guardado hace 1 día» |
| 🔁 **Y el robot revisó ESTE repositorio, y corrigió un texto mío que él mismo me había dictado** | 2026-08-09, `ac3c3ae`. En Navegar yo había escrito «por debajo de ~50 cm Nav2 no se cuela, los **RODEA**», con el engorde del mapa como mecanismo — tal cual me lo pasaron. **Era falso en dos sentidos**: el rodeo no lo causaba el ancho sino **un mapa de SLAM hecho con 160 cm de recorrido** (4 nodos, 49 celdas), y por debajo del umbral no rodea — **no hay ruta** y el planificador se niega, que es un desenlace distinto y se explica distinto. La curva buena, con cinco anchos y el robot cruzando **de verdad**: `<45 cm` no cruza · `47-55` cruza pero hasta 5× de desvío y 2,7× de tiempo · `>55` limpio en ~8 s. ⚠️ El régimen del medio **no se pinta como fallo**: el robot llega. 📝 Lo corrigió en mi repo porque el error era suyo, avisando de que **no pudo pasar las pruebas** (no hay `node` en la Pi) — pasadas aquí: 615 en verde |
| ✅ **Un mapa recién hecho puede ser inservible, y la fecha engaña al revés** | La tarjeta ya avisaba de que una fecha **vieja** puede mentir (el `mtime` rejuvenece un mapa copiado). El robot midió el otro extremo, que es peor porque «guardado hace 2 minutos» se lee como buena noticia: **160 cm** de recorrido dan 4 nodos y 89 % sin explorar —y Nav2 no encuentra ruta por un hueco que sí cabe—; **781 cm** dan plan recto por el mismo hueco. **Mapear no es instantáneo: son metros.** 🔴 Y **sigue sin haber semáforo, ahora por los dos extremos**: el robot no publica ni nodos ni cobertura, así que la web **no puede** medir la calidad, y «demasiado nuevo» sería falso. Dos pruebas lo impiden |
| 🔴 **«No se puede verificar» también es una afirmación — y la mía era falsa** | Escribí en tres sitios que las tarjetas de `APROXIMACION` y del mapa **no se podían comprobar aquí**, «porque son de cliente y ninguna prueba las mira». Lo segundo era cierto; lo primero, no: **el conductor de navegador headless ya estaba en el repositorio**, dentro de `pantallas_reales.test.ts`, y lo había usado esa misma noche. Extraído a `navegador_cdp.ts` y usado por `tarjetas_vivas.test.ts` (**5 de 5**, sin robot): levanta el doble él mismo y mira lo que el navegador **acaba pintando**. 📌 Con su control —misma acción 3 con `/odom` vivo, el mensaje **tiene que cambiar**—, que es lo que la hace prueba y no foto. ⚠️ Y con **dos falsos positivos míos** documentados dentro: buscar «40 %» en la página entera acusaba a un bloque legítimo, y prohibir la palabra «viejo» saltaba sobre un aviso que otra prueba exige. **Se busca el veredicto, no la palabra; y se mira la tarjeta, no lo que hay alrededor** |
| ✅ **EL ROBOT NAVEGÓ DESDE LA WEB, y esta vez `SUCCEEDED` era cierto** | 2026-08-10, cadena entera por rosbridge sin tocar SSH. Objetivo de **80 cm**: **71,5 de cinta** y **71,5 de `/odom`** —dos vías independientes, y coinciden—, o sea **8,5 cm corto** con la tolerancia en 10: **dentro**. 14,6 s. 🔴 **Y me equivoqué en directo**: escribí «dijo ÉXITO creyéndose a 15,6 cm» usando el último `/amcl_pose`, que estaba **rancio** —AMCL solo publica cada 15 cm de movimiento y el controlador va por la TF viva—. Quien mentía era AMCL, no el desenlace. Con n=4, lo honesto sigue siendo «el desenlace **no informa**», que no es lo mismo que «miente siempre». ⏳ `/initialpose` sigue sin ejercerse: A5 no está entero |
| ✅ **Nav2 arrancado y leído POR LA WEB** | 2026-08-10, contra rvr-01 y por rosbridge, no por SSH. `/pedir_nav` responde *«petición ACEPTADA, no arrancado todavía»* y el testigo es el topic: `APAGADO → ARRANCANDO 1…21 s → FUNCIONANDO` en **21 s**, y al parar `FUNCIONANDO → MUDO → APAGADO`. 🔴 Y se comprobó **que llega el dato**, no solo que el servidor de acción conteste — Nav2 puede arrancar mal sin decirlo: `/map` 79×86 celdas a 5 cm, `/amcl_pose`, `/tf`, `/scan`, `/odom`. ⚠️ **No se mandó ningún objetivo**: eso mueve el robot y el mapa era de hace 2 días, o sea el caso del `SUCCEEDED` a 41 cm |
| 🔴 **La pantalla pintaba «−0,000 m/s» con el robot parado** | Visto en una **captura** de Conducir, no por una prueba. `(-0.0004).toFixed(3)` es `"-0.000"` y `numero()` no lo normalizaba; tenía **30 casos y ninguno entre −0,0005 y 0** — la banda intermedia otra vez. No es cosmético: aquí el signo de una velocidad es **la dirección de la marcha**, y `/odom` trae negativos de verdad, así que «menos cero» obliga a decidir si el robot retrocede despacio o está quieto. La guarda protege el **cero**, no el signo — `−0,001` conserva el suyo, y una prueba impide ensancharla |
| 🔴 **El muro enseñaba un caudal que no sumaba lo que gasta** | Encontrado el 2026-08-14 al integrar el IR. `TOPICS_MURO` declaraba **dos** topics mientras la baldosa se suscribía a **tres**: `/estado_robot` entró en la baldosa el 2026-08-04 y nunca entró en el presupuesto. Y el número que circulaba por el código —«~0,03 kB/s»— **no está medido**: es el de `/battery_state`, que publica **cada 30 s** contra **1 Hz** de éste, o sea la trampa de *«una cifra correcta en su contexto se vuelve falsa al mudarla de sitio»*. No se estimó —el módulo se niega a sumar lo que nadie midió— y la pantalla pasó a enseñar **«≥»** diciendo qué faltaba. ✅ **Cerrado el mismo día, en seis horas**: el robot lo midió con controles (348 B/msg, n=2, evidencia 110) y son **0,35 kB/s**, o sea **doce veces** el 0,03. El muro dice ahora **13,28 kB/s** con los dieciséis, y el «≥» desapareció solo. La prueba que anunciaba *«el día que llegue el número, esto caerá — y caer es lo correcto»* cayó, y está **invertida, no borrada** |
| 🆕 **Dos números del laboratorio, y un aviso que evita un diagnóstico falso** | 2026-08-13, medidos por el robot con el aula delante. **Arrancar Nav2 son ~28 s** hasta que acepta objetivos (27,80 y 27,84, n=2) — ahora en pantalla **con su condición**, porque una prueba mía prohibía la palabra «segundos» ahí y confundía *prometer* con *informar*: se sigue prohibiendo la forma de promesa (cuánto falta, %, barra) y se exige el «medido en UN robot en reposo… con varios a la vez, no se sabe». Y **al parar la navegación el barrido del LIDAR quedaba apagado**, así que se avisó en la confirmación de la parada. 🔴 **Ese aviso duró un día y está RETIRADO**: el robot lo arregló donde tocaba —`on-recordando`/`off-si-sobra` devuelven el barrido al estado que la unidad encontró, verificado en las dos direcciones—, y un aviso rancio manda a encender lo que ya está encendido. 📝 La lección: **avisar de un defecto es apostar a que no se va a arreglar**; hay que volver a mirarlo |
| 🔴 **Y BLOQUEADO mandaba a SSH sin hacer falta** | El texto decía que hace falta `systemctl reset-failed` «con privilegios que el navegador no tiene», y punto. **El latch no es permanente**: `StartLimitIntervalSec=300`. El robot esperó los cinco minutos mirando (evidencia 112) y midió que a los **355 s** del último arranque `systemctl start` vuelve a entrar y `NRestarts` cae a 0. O sea que había una salida que **no exige a nadie**: esperar. Ahora ofrece las dos, y sigue poniendo primero «QUITA LA CAUSA», porque reintentar sin arreglarla vuelve a bloquear a los tres intentos |
| 🔴 **«sin señal de vida» apuntaba al sitio equivocado** | Lo dijo el robot, y tenía razón: las tres causas que daba la baldosa —cargando, dormido, driver caído— señalan al RVR o al proceso, y el fallo medido **dos veces** no era ninguna. El driver estaba vivo leyendo **8,37 V**, el WiFi a −46 dBm con **cero desconexiones**, y lo que no cruzaba era **DDS dentro de la propia Pi** — ni un suscriptor local recibía nada, ni de un topic `TRANSIENT_LOCAL`. Añadida la cuarta causa, con lo que la distingue: **no es la red**, y **se cura sola una vez por arranque** (`atriz-vigia-dds`, 90 s), así que el texto manda esperar un par de minutos antes de cruzar el edificio |
| ✅ **Pruebas** | **665** en la suite normal · **+49 con navegador** (42 de pantallas reales y 7 de tarjetas vivas), que corren **sin robot** contra el doble · y **4 que sí lo necesitan**: barrido real, dos de acciones y la parada en marcha |
| 🆕 **Los infrarrojos, y la brújula que NO se pintó** | 2026-08-11, integrando lo que el robot rehízo. `conduciendo_por_ir` es **lo único que delata a un robot que cruza el aula solo** —el robot lo puso primero en `/estado_ir` y el mismo día lo duplicó en `/estado_robot`, el canal barato, así que la web lo lee de ahí y **no se suscribe a `/estado_ir` en ninguna pantalla**; con eso el aviso entra también en el muro—: `following` y `evading` son modos del firmware, no pasan por `cmd_vel`, así que ni el vigilante ni la capa de seguridad los ven. 🔴 **Y lo que el robot midió con los DOS robots es que sus cuatro sensores no son cuatro direcciones**: DELANTE y DERECHA dan el mismo patrón y `sensor_0` no lleva datos nunca — discrimina **tres** zonas. Una brújula de cuadrantes habría mentido **con datos reales**. `infrarrojos.ts` sólo sabe decir las tres medidas, y su rama por descarte dice «hay alguien, no sé dónde» en vez de repartir al más parecido —que es el fallo del clasificador de color de este mismo repositorio—. La prueba barre **las 64 entradas posibles**; mutada en dos direcciones, cae en las dos. ⏳ **Sin ver un `/estado_ir` de verdad**: es la primera pantalla que exige dos robots |
| 📋 **[`VALIDAR_CON_EL_ROBOT.md`](VALIDAR_CON_EL_ROBOT.md)** | Lo construido contra el doble, con **qué lo refutaría** en cada punto. Sin esa línea una pasada verde no distingue «funciona» de «no llegué a probarlo» |
| ✅ **Dos guardias que miran lo que se VE** | Añadidas el 2026-08-07 tras encontrar sus dos fallos en producción. *Markdown sin renderizar*: los backticks de un texto plano salen como caracteres — encontró **once** casos, todos anteriores, en «por qué no obedece» (la pantalla que lee un alumno atascado) y en diagnóstico. *Tokens que no pintan*: `--estado-bien` no existe y los tokens son tripletes RGB que hay que envolver en `rgb()` — las dos formas son CSS válido que no pinta nada. Ninguna de las 538 pruebas de entonces miraba la pantalla |
| ❌ **El terminal** | El producto, y lo único que falta. Bloqueado — ver `/robot/[id]`, que lo explica en pantalla |
| ⚠️ **Sesión** | Existe desde el 2026-08-06 y **protege la interfaz, no el robot**: contraseña con `scrypt`, cookie `httpOnly` firmada con HMAC, bloqueo por intentos en el **servidor** (no en `localStorage`), cero dependencias nuevas. Sirve para que liberar una parada de emergencia tenga un nombre detrás. **No** cierra el camino directo: el navegador habla con el rosbridge de cada robot sin pasar por este servidor, y rosbridge 2.7.0 no tiene autenticación —cualquiera en la red sigue pudiendo hablar con cualquier robot—. Eso es la Fase B, en el robot, y no está construida |
| ✅ **Liberar la parada, CON TESTIGO DEL ROBOT** | 2026-08-06, verificado contra rvr-01 de punta a punta. Se pulsó la parada por el camino de la web (`latido` 291 → la bandera sube en el 292) y se liberó **desde el navegador**, con la interfaz real: la pantalla dijo «Liberada» y el robot lo confirmó (`parada_emergencia: false`). 🔴 La respuesta del servicio **no prueba nada** —`std_srvs/srv/Empty`—, y `/estado_robot` va `TRANSIENT_LOCAL`, así que el primer mensaje que llega puede ser un enlatado **anterior** con la bandera ya abajo: por eso el primer mensaje solo sirve de **referencia** y hace falta uno con `latido` estrictamente mayor. Cuatro resultados distintos, y `SIGUE_PUESTA` (negativa con evidencia) no se confunde con los tres «no se sabe» |
| ✅ **La luz del sensor de color se enciende desde la web** | 2026-08-06. El robot expone `/enable_color` (`std_srvs/SetBool`) y publica `color_activo` en `/estado_robot`; la web lo **lee**, no lo recuerda, porque la luz **se apaga sola** (120 s de inactividad, 900 s de tope duro). 🔴 Y esta interfaz llegó a afirmar que ese botón **no podía existir**, citando un «🔴 MEDIDO» del driver: aquella medida estaba mal hecha —el servicio bajo prueba se apagaba a sí mismo dentro de la misma llamada—. Verificado por rosbridge y por el navegador: `color_activo` false → true → false |
| — | **No hay cámaras** en los robots |

🔴 **Antes de tocar nada, lee [`CLAUDE.md`](CLAUDE.md).** Contiene la regla que
gobierna toda la interfaz —*la pantalla nunca puede afirmar lo que no sabe*— y la
tabla de precedencia frente a las 20 skills de diseño instaladas, doce de las
cuales están escritas para *landing pages* y chocan de frente con esto.

El plan y las mediciones que sostienen el diseño están en el repositorio
`Atriz_migracion_ros2` (privado), en `00_auditoria/planes/`.

## Desarrollo

Todo lo de abajo corre dentro de `frontend/`.

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000 — y ENTRA en las rutas: compilar no es pintar
npm test           # 508 pruebas, en Node
npm run contrato   # compara la lista blanca de la web con robot.launch.py DEL ROBOT
npm run build
```

### Sin robot: un rosbridge de mentira

```bash
node herramientas/rosbridge_de_mentira.mjs                       # cicla los estados
node herramientas/rosbridge_de_mentira.mjs --slam ciego --sin-mapa
```

Sirve para conducir la interfaz por estados que el robot tarda minutos en producir
—o que no produce a demanda, como `ciego`, `mudo` o la unidad latcheada por
systemd—. Se apunta a él poniendo la IP como id: `/robot/127.0.0.1/navegar`.

🔴 **Lo que se vea contra él queda NO VERIFICADO.** Es lo que *yo* creo que manda
el robot: si me equivoco al escribirlo, la pantalla se verá perfecta y estará
mal. Prueba que el código no revienta, no que el robot haga eso.

⚠️ **`npm run build` con `npm run dev` corriendo rompe el caché `.next`** y las
rutas empiezan a dar HTTP 500 con un error que no menciona tu fichero. Uno u
otro, nunca los dos a la vez.

⚠️ **`npm run contrato` lee el árbol de `../Atriz_rvr`**, así que su veredicto
depende de en qué rama esté *ese* repositorio. Lo dice en su primera línea: si no
pone `rama ros2`, míralo antes de tocar `contrato.ts`.

### Contra el robot

**Cuatro** ficheros solo corren con `ATRIZ_ROBOT=1`. Aparecen como `skipped`, no
como aprobados: un guion que mueve un robot no se ejecuta por accidente al pasar
la batería.

```bash
# ⚠️ MUEVE EL ROBOT
ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/parada_en_marcha.test.ts   # lo deja parado

# Toca el robot pero no lo mueve
ATRIZ_ROBOT=1 npx vitest run src/lib/interfaz/barrido_real.test.ts        # enciende el LIDAR
ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/accion_real.test.ts        # manda un objetivo de acción

# No toca el robot: abre las rutas en un navegador y mira lo que pintan.
# 🔴 NECESITA `next dev` CORRIENDO, y por defecto lo busca en el puerto 3118.
ATRIZ_ROBOT=1 ATRIZ_WEB=http://localhost:3000 \
  npx vitest run src/lib/interfaz/pantallas_reales.test.ts
```

🔴 **Ese `ATRIZ_WEB` no es opcional si sirves en otro puerto, y equivocarlo no da
un error claro:** el navegador abre la página de «no se puede conectar» de Edge y
**27 de las 29 comprobaciones pasan igual**, porque son de AUSENCIA —sin
repeticiones, sin frases prohibidas, sin huecos afirmados— y una página vacía las
cumple todas. Es la misma trampa que el propio fichero documenta (18 de 19
pasando sobre seis páginas 404) y ha vuelto a morder. Si pasa demasiado rápido y
demasiado limpio, comprueba el puerto.

🔴 **`accion_real.test.ts` comprueba que Nav2 está PARADO antes de mandar nada**
—mira si llegan `/amcl_pose` o `/map`—, porque su objetivo movería el robot si
estuviera corriendo. `atriz-nav.service` está instalado y **no** habilitado, así
que normalmente no lo está; «normalmente» no es una garantía.
