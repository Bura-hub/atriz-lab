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
| ✅ **El muro encuentra a los robots por su nombre** | `ws://rvr-01.local:9090` abre en el navegador: 4339 ms con la caché mDNS fría, 2331 caliente. Estuvo roto hasta el 2026-08-04 —el nombre resolvía a cuatro direcciones y el navegador se colgaba en las dos primeras, **sin dar error**— y se arregló en el robot, no aquí. Queda un campo para apuntar a una IP, porque el aula sigue sin probarse |
| ✅ **Sistema visual** | Tokens claro **y oscuro** en `src/app/globals.css`, tipografía del sistema, rejilla de 1 px |
| ⏳ **Arrancar SLAM y Nav2 desde la web** | Construido el 2026-08-07. 🔴 Esta fila decía que los servicios «no existen en el robot»: **era falso al escribirse** — el supervisor lleva corriendo desde el 07 y esa tarde `/pedir_slam` mapeó un cuarto y `/pedir_nav` levantó Nav2, que navegó. Este cliente dedujo el estado del robot de cuándo se había subido el código; **el repositorio dice qué existe, solo el robot dice qué está corriendo**. Lo que sigue sin verificar es esta PANTALLA contra el supervisor real. Seis estados, no un interruptor: `systemctl is-active` dice `active` sobre un `slam_toolbox` que sobrevivió a un reinicio del driver y **deja el mapa idéntico celda a celda tras mover el robot 80 cm**, así que «levantado» y «funcionando» tienen casillas distintas. Hasta que el supervisor esté instalado en el robot, `/pedir_slam` y `/pedir_nav` **no existen ahí** y la llamada agota el plazo — la pantalla lo dice nombrando el servicio, para que no se busque una avería |
| ✅ **El sensor de color mide sus DOS modos** | 2026-08-08, siguiendo el contrato que escribió el robot. *Reflejo* (luz encendida) para suelo, cinta y papel; *emisión* (luz **apagada**) para una pantalla o una baldosa LED. 🔴 Y no es un matiz de precisión: sobre una superficie que emite, medir con el LED encendido da el resultado **invertido** — una pantalla roja a tope sale con `R/G = 0,66`, menos roja que verde. La pantalla se niega a nombrar un color dentro de esa banda y dice qué hacer |
| ✅ **La capa de seguridad deja de ser invisible** | 2026-08-08. El robot midió que `avanzar(0.20, 3)` da **26,4 cm** con algo cerca y **59,5** despejado — la misma orden—, porque el polígono `Precaucion` mide 60 × **40 cm** y cualquier cosa a menos de ~9 cm de un **costado** frena al 40 %, aunque el robot se aleje de ella. El journal lo registraba y **el alumno no veía nada**. Ahora sale en vivo en Conducir, pegado a los números, y es una causa más en «por qué no obedece» |
| ✅ **Validado contra rvr-01 el 2026-08-09** | Los **seis estados** de SLAM vistos de verdad —incluidos `CIEGO` (apagando el barrido con SLAM vivo) y `MUDO` (apareció solo al parar)—, y las **cuatro casillas** del 2×2 del sensor de color. 🎯 La que lo justifica todo: la **misma pantalla roja** da `R/G = 5,0` con la luz apagada («es rojo») y `R/G = 0,57` con ella encendida («no se puede decir»), porque el sensor lee **más verde que rojo** sobre una superficie roja. Detalle y lo que quedó sin medir en [`VALIDAR_CON_EL_ROBOT.md`](VALIDAR_CON_EL_ROBOT.md) |
| ✅ **Pruebas** | **579**, más 46 que se saltan porque necesitan el robot |
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
