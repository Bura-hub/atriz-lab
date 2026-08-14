# Lo que falta validar con el robot delante

> ## ✅ PASADA DEL 2026-08-09 CONTRA rvr-01
>
> | | resultado |
> |---|---|
> | **1a · arrancar SLAM desde la web** | ✅ `apagado` → `arrancando · 4 → 9 → 14 s` → `funcionando` en **~18 s**, botón a «Parar SLAM» |
> | **1b · los segundos suben** | ✅ 4, 9, 14 — no se quedan en 0, o sea que el `-1` se traduce bien |
> | **CIEGO** | ✅ forzado apagando el barrido con SLAM vivo: *«levantado, pero no le llega el barrido — el robot no conducirá»*, en teja, con el detalle del robot literal. **Es el estado que `is-active` llamaría *active*** |
> | **MUDO** | ✅ **apareció solo** al parar SLAM: *«la unidad dice `deactivating` pero no hay señal de que funcione»* |
> | **parar SLAM** | ✅ `funcionando` → `MUDO` → `apagado` |
> | **2a · sin modo por defecto** | ✅ ningún modo elegido, «Medir ahora» deshabilitado |
> | **2e · suelo mate en emisión** | 🔴 **DESTAPÓ UN FALLO** — ver abajo. Arreglado y re-verificado |
> | **2b · papel rojo mate, modo normal** | ✅ `R/G` = **2,96 · 2,97 · 2,94** (referencia 2,74) → «la superficie es **rojo**, medida por reflejo del LED». Dispersión del 0,9 % en tres tomas |
> | 🎯 **el 2×2 completo sobre el MISMO papel** | ✅ el mismo rojo en modo *luminosa* da **0 · 0 · 0 · 0** tres veces, dispersión 0, y la pantalla dice «no se puede decir». **Una superficie que solo refleja es invisible sin la luz**: los dos modos no son intercambiables, y eso queda demostrado sin mover el robot |
> | **2c · pantalla de móvil roja, modo luminosa** | ✅ `R/G` = **5,2 · 5,0 · 4,7** (referencia 5,12) → «la luz que sale de la superficie es **rojo**» |
> | 🎯🎯 **2d · LA MISMA pantalla, modo normal** | ✅ **`R 409 · G 721 · B 357` → `R/G = 0,57`.** La pantalla es ROJA y el sensor lee **más verde que rojo**. La interfaz **se niega a nombrarlo** y manda a cambiar de modo. Es la casilla que justifica todo el diseño |
>
> **El 2×2 sobre la MISMA pantalla roja, sin mover el robot:**
>
> ```
>                    luz APAGADA        luz ENCENDIDA
>   lectura       R 78 · G 15 · B 3   R 409 · G 721 · B 357
>   R/G                  5,0                  0,57
>   veredicto        «es rojo» ✅     «no se puede decir» ✅
> ```
>
> Un factor **9** entre los dos cocientes sobre el mismo objeto, y caen a lados
> opuestos de 1. Con la regla ingenua —`R/G > 1` → rojo, si no, verde por
> descarte— la casilla de la derecha habría dicho **«verde» sobre una pantalla
> roja**. Eso es lo que evita la banda plana.
> | **el socket por nombre** | ✅ **2736 ms en frío, 16-25 ms en caliente** desde el navegador, muy dentro del plazo de 10 s |
>
> 🔴 **El fallo que encontró la pasada:** con el robot sobre suelo mate en modo
> emisión, el sensor devolvió `R=0 G=1 B=0` —ruido— y la pantalla afirmó **«la luz
> que sale de la superficie es verde»**. Verde era el caso *por descarte* y una
> sola cuenta se coló por el borde de una guarda que comprobaba `verde === 0`.
> Arreglado con `VERDE_MINIMO_PARA_DECIDIR`, y re-medido en el robot.
>
> 🔴 **Y dos defectos del acuse de petición**, vistos al parar SLAM: seguía
> diciendo *«no dirá "funcionando" hasta que lo esté»* **un minuto después** de
> estar funcionando, y ese mismo texto salía tras pulsar PARAR, donde es un
> sinsentido. Los dos arreglados.
>
> 🔴🔴 **2f · EL APAGADO AUTOMATICO DE LA LUZ NO SALTO.** Cerrada la pestaña tras
> la última lectura (19:47:23), la luz siguió encendida **14 min 38 s** —visto en
> el robot, no solo en `color_activo`— y se apagó porque **la apagué a mano**. El
> apagado por inactividad son 120 s y pasaron 878.
>
> ⚠️ **El tope duro queda SIN MEDIR, y por mi culpa:** lo apagué a menos de dos
> segundos de cuando habría vencido, así que no distingo «saltó» de «lo apagué
> yo». Repetirlo exige no tocar nada durante 20 min.
>
> 📌 **Hipótesis, no medida:** el driver cuenta como actividad que alguien esté
> suscrito a `/color`, y rosbridge puede conservar la suscripción cuando la
> pestaña se cierra de golpe. Se cierra con `ros2 topic info /color` **en el
> robot**, mirando el número de suscriptores con la web cerrada.
>
> → Consecuencia: la pantalla **ya no promete** que la luz se apague sola. Dice
> que la apagues tú, con la medida al lado.
>
> ⏳ **Lo que queda sin ver, y por qué se dejó así:**
>
> - **`BLOQUEADO`** — 🔴 **no es un hueco: es inalcanzable a propósito.** Ver la
>   corrección en la sección 1.
> - **`NO_SE_SABE`** — exige parar el supervisor por SSH. Sin hacer.
> - **1c · el botón de Nav2 sin mapa** — 👤 **decisión de no hacerlo hoy.** Media
>   comprobación ya está: se midió `hay_mapa: true` llegando del robot y el botón
>   salió habilitado en consecuencia, así que **el campo viaja y la pantalla lo
>   lee**. La otra mitad es una rama booleana (`false` → `disabled` + motivo) con
>   prueba unitaria y sin nada del hardware que pueda sorprender. El coste —mover
>   el mapa recién hecho y devolverlo— no lo justifica.
>
> ### 🔴 DOS COSAS PARA EL ROBOT, encontradas de rebote
>
> **1 · `ATRIZ_MAPA` apunta fuera de la ruta por defecto.** El supervisor usa
> `os.environ.get('ATRIZ_MAPA') or ~/atriz_ws/src/Atriz_rvr/atriz_rvr_bringup/maps/aula.yaml`,
> y en rvr-01 **ese directorio está vacío** mientras `hay_mapa` dice `true`. O sea
> que la variable está puesta y el mapa vive en otro sitio. No es un fallo, pero
> **no está escrito en ningún documento del PC**, y quien lea el código deducirá
> la ruta equivocada — me pasó a mí, y mandé un comando que no podía funcionar.
> 📌 Se cierra con `systemctl show atriz-robot -p Environment | grep MAPA`.
>
> **2 · `rosapi/get_param` revienta.** Preguntando por `/supervisor_navegacion/mapa`
> desde rosbridge:
>
> ```
> result=true  ·  successful=false
> reason: "cannot access local variable 'node_name' where it is not associated with a value"
> ```
>
> Es un error **interno de rosapi**, no una respuesta a la pregunta. ⚠️ Y fíjate
> en la forma: `result=true` —rosbridge pudo llamar— con `successful=false`
> dentro. Es exactamente la distinción `result`/`success` que el robot documentó
> el 2026-08-08, apareciendo sola en el primer sitio donde se usó `rosapi`.
> 📌 Lo que importa decidir: **si `rosapi` no sirve para leer parámetros, la web
> no puede preguntarle al robot por su configuración** y todo lo que quiera saber
> tiene que venir por topic o por servicio propio — que es lo que ya hace
> `/estado_navegacion`. Puede que sea la respuesta correcta y no haya nada que
> arreglar; pero conviene saberlo antes de diseñar algo que dependa de `rosapi`.

Todo lo de aquí estaba **construido, con pruebas en verde, y sin comprobar contra
rvr-01**. Se escribió entre el 2026-08-07 y el 08 con el robot apagado, contra
`herramientas/rosbridge_de_mentira.mjs`.

> 🔴 **Un doble prueba que el código no revienta, no que el robot haga eso.** Este
> mismo fichero existe porque el doble ya mintió una vez: tenía mal los nombres de
> campo de `/encoders` y `/motor_status`, la telemetría pintaba `—` con datos
> llegando, y **parecía un fallo de la web**.

Cada comprobación lleva **qué la refutaría**. Sin esa línea, una pasada verde no
distingue «funciona» de «no llegué a probarlo» — que es el error que en este
proyecto bloqueó el sensor de color durante seis días.

---

## 1 · Arrancar SLAM y Nav2 — `ControlNavegacion`

Es lo más grande sin verificar. El **supervisor sí corre** desde el 2026-08-07 y
los dos servicios contestan; lo que nadie ha visto es **esta pantalla contra él**.

| | qué hacer | qué debe pasar | 🔴 qué lo refuta |
|---|---|---|---|
| **1a** | entrar con sesión, `/robot/1/navegar`, pulsar «Arrancar SLAM» | el estado pasa a **arrancando** con los segundos subiendo, y a **funcionando** | que se quede en `arrancando` pasados ~60 s, o que salte a `funcionando` **sin** pasar por `arrancando` (querría decir que el latido no se está leyendo y se pinta un enlatado) |
| **1b** | mirar los segundos | suben de 1 en 1 | que salgan `0` fijos: sería `-1` mal traducido, y este proyecto usa `-1` para «no se sabe», nunca para «cero» |
| **1c** | con Nav2 **sin** mapa, pulsar «Arrancar Nav2» | el botón está **deshabilitado** y dice que falta el mapa | que se pueda pulsar: `hay_mapa` no se está leyendo |
| **1b-bis** | 🆕 mirar el texto mientras arranca | dice **«unos 28 segundos»** para Nav2 y **«unos 18»** para SLAM, **con la condición al lado** («medido en UN robot en reposo… con la batería baja o varios robots a la vez, no se sabe») | que dé un plazo a secas, o una barra, o un porcentaje: n=2 sobre un robot en reposo no habla de dieciséis con la batería baja |
| **1c-bis** | 🆕 pulsar **Parar Nav2** y leer la confirmación | avisa de que **el barrido del LIDAR queda apagado** y de que sin él el robot no conduce | que no lo diga: el alumno se va a Conducir y el robot «no le hace caso» sin un solo error — es el `collision_monitor` bloqueando por falta de `/scan` |
| **1d** | parar el supervisor en el robot (`systemctl stop`) y esperar 5 s | los dos sistemas pasan a **«no se sabe»**, no se congelan en el último valor | que sigan diciendo `funcionando`: la guardia del latido no corre. **Es el fallo que la pantalla existe para no cometer** |

### Los tres estados que hay que provocar a mano

Ninguno aparece solo, y son la razón de que haya seis estados y no un interruptor.

- **`CIEGO`** — con SLAM funcionando, apagar el barrido (`atriz-escaneo off`, o el
  botón de la pestaña Conducir). Debe aparecer en 1-2 s como *«levantado, pero no
  le llega el barrido — el robot no conducirá»*, **en rojo**.
  🔴 Refuta: que se quede en `funcionando`, o que salga en ámbar — sin barrido el
  robot no conduce (0,0 cm contra 9,9), y eso no es un aviso, es un impedimento.
- **`MUDO`** — reiniciar el driver **por debajo** de un `slam_toolbox` ya
  arrancado. Es el caso medido: el búfer TF se rompe y el mapa deja de crecer.
  🔴 Refuta: que la pantalla siga diciendo `funcionando`, que es justo lo que dice
  `systemctl is-active` y el motivo de que no baste.
- 🔴 **`BLOQUEADO` — ESTE PUNTO ESTABA MAL, corregido el 2026-08-09 leyendo el
  supervisor.** Decía: *«pedir Nav2 sin mapa tres veces seguidas: `StartLimitBurst=3`
  agota el presupuesto»*. **No ocurre.** El supervisor comprueba el mapa **antes**
  de llamar a `systemctl` y devuelve un rechazo limpio:

  ```python
  if cual == 'nav':
      if not self._hay_mapa():
          motivos.append(f'no hay mapa legible en {self._mapa}')
  if motivos:
      resp.success = False          # ← y NUNCA llama a systemctl
  ```

  Su propia cabecera lo dice: *«por eso este nodo se NIEGA antes de llamar a
  systemctl. Un `isfile` de coste cero evita **el único estado del que la web no
  puede salir sola**»*. **`BLOQUEADO` es deliberadamente inalcanzable desde la
  web**, y esa es una propiedad del diseño, no un hueco de la validación.

  📝 El punto salió de un comentario del `.msg` que describe lo que pasa al
  hacer `systemctl start` **a mano**, o sea la situación de antes de que el
  supervisor existiera. Copié la consecuencia sin comprobar si el camino seguía
  abierto.

  → Producirlo de verdad exige entrar al robot y hacer `systemctl start
  atriz-nav` **saltándose el supervisor**, y deja la unidad en un estado que
  solo se deshace con `sudo systemctl reset-failed`. **No se hace por
  curiosidad**: se hará el día que alguien tenga que reproducir un incidente.

- ✅ **Lo que SÍ hay que validar del mapa es el punto 1c** —el botón
  deshabilitado— porque recorre exactamente la misma comprobación `hay_mapa` y
  es el estado que un alumno sí puede encontrarse.

⚠️ **Y hay un número que la pantalla NO promete y conviene medir igual:** cuánto
tarda hasta `funcionando`. Hay dos cifras y son de hitos distintos — **24,3 s**
hasta que Nav2 acepta objetivos y **30,2 s** hasta que el supervisor lo declara,
las dos con n≤2. La pantalla enseña segundos transcurridos y ninguna barra de
progreso justamente por eso.

---

## 2 · El sensor de color y sus dos modos — `MedirColor`

Construido contra el contrato de `SENSOR_COLOR.md`, medido en el robot pero
**nunca ejercitado desde esta interfaz**.

| | qué hacer | qué debe pasar | 🔴 qué lo refuta |
|---|---|---|---|
| **2a** | abrir la pestaña Telemetría | **ningún modo** seleccionado, «Medir ahora» deshabilitado | que arranque con uno puesto: elegir por el alumno lo que hay debajo del robot es justo lo que produce la medida invertida |
| **2b** | poner el robot sobre **papel rojo mate**, modo *superficie normal*, medir | dice **rojo** (referencia medida: `R/G = 2,74`) | que diga «no se puede decir»: el umbral de reflejo estaría mal puesto |
| **2c** | poner el robot sobre una **pantalla de móvil roja a tope**, modo *superficie luminosa*, medir | dice **rojo** (`R/G ≈ 5,12`) | que diga verde o «no se puede decir» |
| **2d** | 🎯 **la casilla que lo prueba todo**: la misma pantalla roja, modo *superficie normal* | **«no se puede decir»**, con el motivo y la salida a modo emisión | que diga **rojo**: sería un acierto por casualidad sobre `R/G = 0,66`, que es *menos rojo que verde*. Y peor, que diga **verde** sin avisar |
| **2e** | robot sobre papel mate, modo *superficie luminosa* | los cuatro canales a **cero**, y la pantalla **no** lo trata como avería | que diga «el sensor no contestó»: `claro = 0` con `success=true` son doce lecturas válidas medidas, no una ausencia |
| **2f** | dejar el modo *normal* quieto 15 min | el robot apaga la luz solo, y la línea de estado pasa a **«la luz está al revés de lo que pide este modo»** | que siga diciendo que concuerda: se estaría recordando en vez de leyendo `color_activo` |

---

## 2bis · 🔴 El robot bloqueado a 15 cm — `PanelConducir` y «por qué no obedece»

**Añadido el 2026-08-09**, y es el punto más fácil de comprobar de toda la lista:
no hace falta ningún montaje, solo **una pared y una cinta métrica**.

Lo que el robot midió con 24 estaciones a mano (evidencias 93, 94 y 95): con algo
dentro del círculo de 15 cm el robot **no se mueve en ninguna dirección**, ni
siquiera alejándose. Hasta hoy esta app lo llamaba «va más despacio».

| paso | qué hacer | qué tiene que salir |
|---|---|---|
| **a** | Pon el robot con la **pared detrás a ~17 cm** (medido con cinta desde el chasis) y el barrido encendido | — |
| **b** | Manda **avanzar** (alejándose de la pared) desde Conducir | La tarjeta pasa a **ERROR** y dice «El robot está BLOQUEADO y no puede salir solo». El robot **no se mueve** |
| **c** | Manda **girar** | Lo mismo. 🔴 Es lo más contraintuitivo: girar no acerca a nada |
| **d** | Abre «por qué no obedece» | Causa `frenado` **CONFIRMADA**, titular con **BLOQUEADO**, y el remedio dice **«con la mano»** |
| **e** | Aparta el robot a **~25 cm** y repite (b) | Se mueve. La tarjeta baja a ATENCIÓN o desaparece |

🔴 **QUÉ LO REFUTARÍA, que es la parte que importa:**

- **Que el robot SÍ se mueva a 17 cm.** Entonces el radio del robot no es 0.15 —
  es lo que `verificar_robot.sh` marca como **FALLO**, no aviso: significa que a
  ese robot no le llegó el fichero nuevo. Compruébalo en el robot antes de tocar
  la web: el defecto estaría allí.
- **Que la tarjeta diga «te está frenando» en vez de «BLOQUEADO».** Sería que la
  acción 3 volvió a caer en la rama de `RALENTIZAR`.
- **Que diga «BLOQUEADO» pero el robot se mueva.** Sería `seMueve()` leyendo mal
  `/odom`, y afirmaría un congelamiento que no hay — el error simétrico y
  igual de malo.

⚠️ **Y lo que este punto NO puede comprobar:** el **~1 cm ciego** pegado al
chasis. El LIDAR no da nada por debajo de `range_min` (10 cm), así que un
obstáculo ahí no produce ningún mensaje que mirar. La app lo **dice** en los
avisos del taller; que sea cierto lo sostiene la medida del robot, no esta lista.

### ✅ Y esto YA NO hace falta hacerlo a mano: hay prueba, y no necesita robot

🔴 **Aquí decía que estas dos tarjetas «no se podían verificar» porque son de
cliente. Era falso, y el error es mío:** el conductor de navegador headless
**ya estaba en el repositorio**, dentro de `pantallas_reales.test.ts`, y lo había
usado esa misma noche sin reparar en lo que permitía. *«No se puede verificar» es
una afirmación, y necesita la misma comprobación que cualquier otra.*

Extraído a `src/lib/interfaz/navegador_cdp.ts` y usado por
`tarjetas_vivas.test.ts`, que **levanta el doble él mismo** —uno por caso, porque
las banderas se leen al arrancar— y mira lo que el navegador acaba pintando:

```bash
cd frontend && npm run dev                        # en otra terminal
ATRIZ_VIVAS=1 ATRIZ_HOST=127.0.0.1 \
  npx vitest run src/lib/interfaz/tarjetas_vivas.test.ts
```

🔴 **`ATRIZ_HOST=127.0.0.1` NO es opcional, y es el segundo error que tenía este
apartado.** Decía «abre `/robot/1/conducir`», y ese segmento hace que la app
conecte a **`rvr-01.local`**, no al doble: con el robot apagado la página sale
vacía y las comprobaciones de ausencia **pasan todas**. La ruta acepta una IPv4
literal, así que `/robot/127.0.0.1/conducir` es lo que habla con el doble.

**Lo que cubre, 5 de 5 en verde:**

| | |
|---|---|
| tarjeta de `APROXIMACION` | titular «BLOQUEADO… no puede salir solo», los tres ceros, y «con la mano» |
| lo que **no** debe decir | ni «te está frenando ahora mismo» ni «al 40 %» **dentro de la tarjeta** |
| **el control** | con `--moviendose` —misma acción 3, `/odom` vivo— el mensaje **cambia** a «puede quedar bloqueado» |
| tarjeta del mapa | los **tres** avisos: de este sitio · el `mtime` rejuvenece · los **metros** (160 cm → sin ruta; 781 → plan recto) |
| y ningún veredicto | nada de «caducado», «vigente» ni «al día» sobre la edad |

📌 **El control es lo que la hace una prueba y no una foto.** Mismo `action_type`
en los dos casos: si el mensaje no cambiara, la pantalla estaría **afirmando** un
congelamiento que no ha visto — el error simétrico, y igual de malo.

⚠️ **Dos falsos positivos MÍOS al escribirla**, y quedan documentados dentro
porque son la misma forma de siempre: comprobar «la tarjeta no dice 40 %» sobre
**la página entera** acusaba a un bloque permanente que explica el 40 % de
`Precaucion` y es correcto; y prohibir la palabra «viejo» saltaba sobre el aviso
«copiar un mapa viejo lo rejuvenece», que **otra prueba del mismo fichero
exige**. Se busca el **veredicto**, no la palabra, y se mira **la tarjeta**, no
lo que hay alrededor.

⚠️ **Lo que sigue exigiendo una persona:** que la tarjeta roja *se vea* como
urgente. Esto lee texto, no diseño.

---

## 2ter · 🆕 Los infrarrojos — `/estado_ir` · **exige DOS robots**

Integrado el **2026-08-11**, cuando el robot rehízo el sistema entero. Todo lo de
abajo está **SIN VERIFICAR contra hardware desde la web**: lo que hay es el doble
(`--conduciendo-ir`), y un doble sólo prueba que la pantalla sabe pintar lo que se
le da, no que el robot lo mande así.

🔴 **Y es la primera pantalla que necesita DOS robots encendidos**, porque el
único emisor de infrarrojos posible es otro RVR. Con rvr-02 ya aprovisionado, deja
de ser imposible.

📌 **El campo se lee de `/estado_robot`, NO de `/estado_ir`.** El robot lo duplicó
el 2026-08-11 en el canal barato precisamente para que el muro pudiera verlo, así
que la web no se suscribe a `/estado_ir` en ninguna pantalla.

| | qué hacer | qué debe pasar | 🔴 qué lo refuta |
|---|---|---|---|
| **3a** | abrir `/robot/1/no-obedece` y `/flota` con el robot **normal** | **no** aparece nada de infrarrojos en ninguna de las dos | que aparezca: se estaría pintando siempre, y entonces el 3b no prueba nada |
| **3b** | poner rvr-01 en modo `following` **en el robot** (`set_ir_mode`, por SSH: desde la web está cerrado a propósito) con rvr-02 emitiendo | en «por qué no obedece»: «El robot se está moviendo SOLO, por infrarrojos», etiquetada **«puede ser»**, y el titular pasa a «Ninguna confirmada, pero hay una que mirar» | que no salga con el robot moviéndose: `conduciendo_por_ir` no se está leyendo, y es **el único campo que delata ese movimiento** |
| **3c** | 🆕 mirar **el muro de flota** a la vez | la baldosa de rvr-01 pasa a **ámbar** con la etiqueta «conduce por IR» | que siga verde: el muro estaría pintando «parado» un robot que cruza el aula, que es justo para lo que el robot duplicó el campo |
| **3d** | mirar el remedio | dice que se para **en el robot**, y **no** ofrece ningún botón | que ofrezca uno: `/set_ir_mode` no está en la lista blanca, así que el botón no podría funcionar |
| **3e** | arrancar el driver con `ir_sondeo_hz:=0.0` | `zonaDelEmisor()` da `SIN_SONDEO` y no se interpreta ningún sensor. ⚠️ `conduciendo_por_ir` **no depende del sondeo**: sigue siendo válido | que la pantalla deje de avisar del movimiento: son dos cosas distintas y se leen de sitios distintos |
| **3f** | 🆕 con la navegación **bloqueada por el IR**, mirar el botón de Nav2 | el motivo dice **«primero QUITA LA CAUSA»** y luego el `reset-failed`, en ese orden | que solo diga `reset-failed`: está medido que la unidad se vuelve a bloquear a los tres intentos si el IR sigue encendido, o sea dos viajes al laboratorio |

### 🔴 Lo que hay que mirar aunque no se esté probando

**Que a nadie se le ocurra pintar una brújula de cuatro cuadrantes.** Está medido
con los dos robots (evidencia 100) que **no se puede**: DELANTE y DERECHA dan
exactamente el mismo patrón de sensores, y `sensor_0` no lleva datos nunca. El
sistema discrimina **tres** zonas. `infrarrojos.ts` lo impide con una prueba que
barre las 64 entradas posibles, pero la prueba protege el módulo, no una pantalla
nueva que decida leer los campos por su cuenta.

### ⏳ Y una casilla que sigue abierta, ahora en el muro

**Nadie ha medido el caudal de `/estado_robot`**, y el muro se suscribe a él por
los dieciséis. La evidencia 68 midió seis topics y ése no existía todavía; el
«~0,03 kB/s» que circulaba por el código era el de `/battery_state`, que publica
**cada 30 s** contra **1 Hz** de éste.

Mientras tanto la pantalla del muro enseña su caudal con un **«≥»** y dice qué no
ha podido sumar. En cuanto llegue el número medido, entra en `CAUDAL_KBS`, se
vacía `MURO_SIN_CAUDAL_MEDIDO` y el «≥» desaparece solo — hay una prueba que
obliga a hacer las tres cosas a la vez.

---

## 3 · Lo que ya se validó y solo hay que no romper

No hay que repetirlo, pero si algo de esto falla, **es una regresión**:

- conducir desde el navegador: 3 s a 0,100 m/s → **30,0 cm de cinta** contra 29,7 de `/odom`
- la parada de emergencia, pulsada y **liberada** desde la web con testigo del robot
- la lista blanca **deniega en silencio**: `raw_motors` al 30 % → **0,00 cm**
- `ws://rvr-01.local:9090` **abre** en el navegador, por nombre

---

## 4 · Cómo correrlo

```bash
cd frontend
npm run contrato        # antes que nada: el robot manda sobre la lista blanca

# Con el robot encendido y en la misma red:
ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/accion_real.test.ts
ATRIZ_ROBOT=1 npx vitest run src/lib/interfaz/barrido_real.test.ts

# ⚠️ MUEVE EL ROBOT — lo deja parado al terminar:
ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/parada_en_marcha.test.ts

# Y las DIEZ pantallas del laboratorio, con datos reales. Son 12 rutas en total:
# `/entrar` y `/usuarios` quedan fuera a propósito — no hablan con el robot.
# 🔴 El puerto NO es opcional:
ATRIZ_ROBOT=1 ATRIZ_WEB=http://localhost:3000 ATRIZ_HOST=1 \
  npx vitest run src/lib/interfaz/pantallas_reales.test.ts
```

🔴 **Si `pantallas_reales` pasa demasiado rápido y demasiado limpio, comprueba el
puerto.** 27 de sus 29 comprobaciones son de AUSENCIA, y una página de error del
navegador las cumple todas. Ya ha mordido dos veces.

---

## 5 · Y lo que este fichero no puede hacer

**Decidir si una afirmación es verdad.** Solo dice qué mirar. Las dos cosas que la
web tuvo que retirar el 2026-08-08 —«los servicios no existen en el robot» y «el
error al llegar es de 6 cm»— **habrían pasado cualquier lista de comprobación**:
la primera porque nadie preguntó al robot, la segunda porque una tanda salió bien.

→ Antes de anotar «verificado», escribe **qué habrías visto si fuera falso**. Si no
hay respuesta, no es una medida.
