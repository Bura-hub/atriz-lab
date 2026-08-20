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

📌 **COMPROBADO el 2026-08-15, porque esta frase parecía contradecir a A10** —que está
cerrado— y al dato de `CLAUDE.md` «SLAM arrancado desde la web». **No hay contradicción: esta
sección tiene razón.** Las dos evidencias que sostienen aquello se midieron **con guiones de
Python**, no con un navegador: la **111** lo dice en su propia cabecera (`Guion: scratchpad
probar_boton_nav.py`) y la **80** no menciona ni una vez pantalla, navegador ni Chrome.

→ O sea: **el MECANISMO está verificado de punta a punta** (`/pedir_slam` y `/pedir_nav`
funcionan, con sus tiempos medidos por dos caminos distintos), y **la PANTALLA sigue sin verse**.
Son cosas distintas, y este proyecto tiene medido lo que cuesta confundirlas: `ping`,
`Resolve-DnsName` y `getent` dieron verde los tres mientras el navegador se colgaba.

| | qué hacer | qué debe pasar | 🔴 qué lo refuta |
|---|---|---|---|
| **1a** | entrar con sesión, `/robot/1/navegar`, pulsar «Arrancar SLAM» | el estado pasa a **arrancando** con los segundos subiendo, y a **funcionando** | que se quede en `arrancando` pasados ~60 s, o que salte a `funcionando` **sin** pasar por `arrancando` (querría decir que el latido no se está leyendo y se pinta un enlatado) |
| **1b** | mirar los segundos | suben de 1 en 1 | que salgan `0` fijos: sería `-1` mal traducido, y este proyecto usa `-1` para «no se sabe», nunca para «cero» |
| **1c** | con Nav2 **sin** mapa, pulsar «Arrancar Nav2» | el botón está **deshabilitado** y dice que falta el mapa | que se pueda pulsar: `hay_mapa` no se está leyendo |
| **1b-bis** | 🆕 mirar el texto mientras arranca | dice **«unos 30 segundos»** para Nav2 —con el desglose «28 con el barrido ya encendido, 32 si estaba apagado»— y **«unos 18»** para SLAM, **con la condición al lado** («medido en UN robot en reposo… con la batería baja o varios robots a la vez, no se sabe») | que dé un plazo a secas, o una barra, o un porcentaje: n=2 sobre un robot en reposo no habla de dieciséis con la batería baja |
| **1c-bis** | 🔁 **REESCRITA el 2026-08-14.** Enciende el barrido en Conducir, arranca Nav2, **párala**, y vuelve a mirar `/scan` | **el barrido SIGUE encendido**: la unidad lo devuelve al estado que encontró | que se apague: el robot tendría el `atriz-escaneo` viejo, y entonces el alumno se va a Conducir y «no le hace caso» sin un solo error. ⚠️ Antes aquí se exigía un **aviso** en la web; el robot lo arregló en el robot (evidencia 114) y el aviso se retiró |
| **1e** | 🆕 con la unidad **bloqueada**, leer el motivo | ofrece **las dos salidas**: esperar ~5 minutos —«se limpia solo»— **y** el `reset-failed` por SSH; y antes de las dos, «QUITA LA CAUSA» | que solo mencione el `reset-failed`: mandaría a buscar a alguien con privilegios para algo que se arregla esperando (medido: 355 s, evidencia 112) |
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

## 1bis · 🆕 El color libre de los LEDs y el resaltado del Taller

**Añadido el 2026-08-16.** Lo mecánico ya está medido y no se repite aquí: la
conversión de color tiene 20 pruebas, el tokenizador 32 —contra **las 16 prácticas
reales** del robot—, el clasificador de trazas 25, y el espejo del editor se midió
en un navegador headless (`alto 402 = 402 · ancho 394 = 394`, con un fichero cuyas
líneas ajustan). **Nada de eso necesita un robot.**

Lo que sigue es lo que **ninguna prueba puede juzgar**, porque la respuesta es
óptica o física: si se distingue, si se lee, y si el color que sale del LED se
parece al de la pantalla.

| | qué hacer | qué debe pasar | 🔴 qué lo refuta |
|---|---|---|---|
| **1bis-a** | 🎯 **la que justifica el aviso**: mandar `#FF8000` y luego `#FFB000`, mirando **el robot**, no la pantalla | que se **distingan** en el robot, o que **no** se distingan | las dos respuestas valen y cambian el texto: si se distinguen bien, la frase «dos tonos que aquí se distinguen pueden verse iguales» está de más y hay que **suavizarla**; si se ven iguales, está ganada y se queda |
| **1bis-b** | elegir un color en la rueda con el robot **desconectado** | todo el selector en gris y sin responder, como los cinco atajos | que la rueda siga moviéndose: daría a entender que la orden salió |
| **1bis-c** | bajar el brillo a **cero** y volver a subirlo | el marcador **no se mueve** de su tono, y al subir vuelve el mismo color | que el marcador salte al rojo: sería `RGB → HSV` perdiendo el tono de un negro, que es lo que el estado en HSV existe para impedir |
| **1bis-d** | mover intensidad y brillo **con el ratón**, arrastrando fuera del cuadrado y soltando | sigue el puntero hasta el borde y no se corta al salir | que no responda al ratón: es el fallo que ya ocurrió una vez y que solo delató `eslint` |
| **1bis-e** | abrir una práctica larga en el Taller —`05_sensor_color.py` sirve— y **mirar** el editor | comentarios en gris cursiva, cadenas y números en su tinta, `def`/`with`/`if` en violeta, y **el color pegado a su texto** de arriba abajo | que el color se despegue según se baja: sería el espejo desalineado, y la medida de arriba se hizo en Edge headless — no en el portátil del aula |
| **1bis-f** | en esa práctica, **arrastrar el borde inferior** del editor y escribir una línea muy larga | el color sigue cuadrando tras redimensionar y tras el ajuste de línea | que cuadre solo antes de tocar el tamaño |
| **1bis-g** | 🎯 hacer que una práctica falle (`robot.avanzar(9.9, 3)`) y **mirar la traza** | se lee como un error **sin ningún rojo**: filete al lado, marcos `File "…"` apagados y el mensaje final en negrita | que no se lea como error a simple vista. **Si hiciera falta rojo, no se añade sin más**: sería el cuarto rojo de una pantalla donde el botón de parada está a la vista, y eso ya se midió como problema en `/no-obedece` |
| **1bis-h** | con esa traza en pantalla, leer el pie de la caja | aparece la frase de que el color sale de la **forma** del texto | que salga también sin traza: un aviso permanente acaba sin leerse |
| **1bis-i** | ⚠️ **el `\r` del PTY**: copiar una línea de la salida y pegarla en un editor | no aparece ningún carácter raro al final | **NO VERIFICADO**: que nadie quita el `\r` está deducido leyendo el código de los dos lados —el PTY traduce `\n` a `\r\n` y `salida.ts` parte solo por `\n`—, **no medido contra el robot**. Los patrones lo toleran, así que el color no depende de la respuesta |
| **1bis-j** | con el terminal escupiendo a 10 Hz (seguidor de línea), pulsar **Parar** | responde igual que antes de que hubiera color | que se note pastoso: el agrupado existe para que un programa sin trazas deje el DOM como estaba, y eso solo se comprueba con salida de verdad |

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

### ✅ Y la casilla del muro, CERRADA el mismo día

Estuvo abierta seis horas: **nadie había medido el caudal de `/estado_robot`** y el
muro se suscribía a él por los dieciséis. El robot lo midió con controles
(evidencia 110): **0,35 kB/s**, 348 B/msg — **doce veces** el «~0,03» que
circulaba, que era el de `/battery_state` (cada 30 s) copiado.

El muro dice ahora **13,28 kB/s** con los dieciséis, sin «≥». Lo que queda vivo es
el mecanismo: si alguien añade un topic al muro sin caudal medido,
`caudalDeFlota` lanza y una prueba exige que `presupuestoMuro` y `TOPICS_MURO`
sumen exactamente lo mismo.

---

## 5 · 🆕 `/initialpose` — decirle al robot dónde está

Construido el 2026-08-15 (evidencia 121 en `atriz_migracion`), porque estaba **declarado y sin
construir**: en el contrato, tipado, con su helper de cuaternión y permitido por la lista blanca
del robot — y nadie publicaba ahí.

| | qué hacer | qué debe pasar | quién lo vio | 🔴 qué lo refuta |
|---|---|---|---|---|
| **5-1** | pulsar «Decirle al robot dónde está» y **arrastrar** sobre el mapa | `map → odom` salta: sólo lo mueve AMCL, así que el salto **es** la aceptación | ✅ **el navegador**, n=5 (31-36 cm de salto) | que no se mueva: el sello iría con `now()` y AMCL lo descarta en silencio, que es lo que pasó en las 10 tandas históricas |
| **5-2** | 🔴 el MISMO gesto, mirando si manda un objetivo | **NO** manda ninguno | ✅ **el navegador**, `¿mandó objetivo? → NO` | que lo mande: es lo que pasó la primera vez y **el robot se enredó con unos cables**. Un arrastre dispara también un `click`, y la guarda se desactivaba a sí misma |
| **5-3** | un **clic sin arrastrar** | se niega y dice que falta el rumbo | ✅ 10 pruebas puras, mutadas | que suponga rumbo 0: con 180° de error AMCL **no converge nunca**, y desde fuera parece que la navegación no funciona |
| **5-4** | mover el robot ~30 cm tras fijar la pose | **`/amcl_pose` empieza a publicar** | ✅ odometría 28,1 cm · v máx 0,216 (sin frenado de seguridad) · 2 mensajes de AMCL | que no publique: no habría localizado |
| **5-5** | ⏳ que la pose fijada sea **correcta** | el mapa cuadra con la sala | ⏳ **nadie** — y la pantalla lo dice ella misma en vez de afirmarlo | — |

⚠️ **Y una comparación que NO se hace**: los 9,6 cm entre las dos muestras de AMCL **no son un
error** contra los 28,1 de odometría. AMCL publica cada `update_min_d` = 15 cm, así que su primera
muestra sale después del primer tramo. Restarlos y llamarlo error sería la clase de conclusión que
este proyecto ha tenido que retirar tres veces.

📌 **`/global_costmap/costmap` no está en la lista blanca**, así que la web **no puede** comprobar
si el costmap está poblado — que es la señal documentada de un Nav2 mal arrancado (evidencia 97:
con el costmap VACÍO, `compute_path_to_pose` devuelve la **recta perfecta** y se estuvo a punto de
escribirla como resultado). Sin decidir.

⚠️ **Y desde la Fase B (2026-08-15) el argumento cambia de lado.** Abrir un topic de LECTURA a la
web ya no es «que cualquiera en el aula lo lea»: hay que traer un testigo firmado para ESE robot.
Lo que queda por decidir es el **coste**: `/global_costmap/costmap` es una rejilla entera, y este
proyecto tiene medido que `/scan` era el 83 % de los 80,7 kB/s. Habría que medirlo antes, no
suponerlo — y mirar si `costmap_updates` basta.

---

## 4 · ✅ EL TALLER — el terminal. **LAS 16 CASILLAS, CERRADAS**

Construido el 2026-08-14. ~~«Nada de esto ha tocado un robot».~~ **Falso desde la
madrugada del 2026-08-15**: la Pi lo auditó y lo validó en vivo sobre rvr-01
(evidencia 117) — 19 casillas en verde, **cinco fallos cazados** en la mitad del
robot (dos de ellos solo visibles con una práctica de verdad corriendo), y
`05_sensor_color.py` de punta a punta por el terminal.

🔴 **Pero hay una frontera que no se puede difuminar, y es lo que deja abierta la
mayoría de las casillas de abajo: aquello se midió DESDE LA PI, con un arnés
Python y una clave Ed25519 DE PRUEBA. Ni un navegador.** Que el agente conteste
bien a un cliente escrito para probarlo no dice que el navegador lo pinte —es la
distinción de siempre en este proyecto entre el emisor y el testigo válido, la
misma que hizo que `ping`, `Resolve-DnsName` y `getent` dieran verde con el
navegador colgado.

→ **Los dos pasos de 4a siguen siendo lo primero, y ahora bloquean de verdad**:
sin la clave REAL publicada, un navegador no abre nada.

### 4a · Antes de nada, dos pasos que no son de medir

| | | estado |
|---|---|---|
| 🔴 **Quitar `~/.git-credentials` de los 16** | El código del alumno corre como `sphero` y puede leerlo: es el PAT de GitHub del proyecto. Los repositorios ya son públicos, así que clonar no lo necesita | ⏳ **abierto, y es 👤 decisión del usuario**: quitarlo deja a esa Pi sin poder hacer `push`. Anotado, no olvidado |
| ✅ **Repartir la clave pública REAL** | `node herramientas/publicar_clave.mjs` en el PC → `/etc/atriz/testigo.pub` en cada robot. La privada vive **solo** en el `.env.local` del portátil que sirve la web | ✅ **HECHO en rvr-01 el 2026-08-15, y MEDIDO sin querer**: el navegador abrió rosbridge con un testigo firmado por ese `.env.local` (`7,95 V` en pantalla), y eso **solo puede pasar si la clave del robot es la pareja de la privada del PC**. 🔴 **Y desde la Fase B esa clave ya no es solo del Taller**: sin ella rosbridge falla cerrado y el robot queda invisible para la web. Va **dentro de la imagen dorada**; `fase_6` aborta si falta. ⏳ Quedan los 15 robots |
| ✅ **Instalar la unidad** | ~~`sudo cp` a mano~~ | ✅ **`fase_7` instala y habilita `atriz-agente`** desde el 2026-08-15, avisa si falta `testigo.pub`, y el MANIFIESTO lo vigila |

🔴🔴 **LA PAREJA DE CLAVES SE CAMBIÓ EL 2026-08-18, Y ESO INVALIDA LA FILA DE ARRIBA
PARA QUINCE ROBOTS.** `generar_clave.mjs` ya avisa de que cambiarla «no es una
operación de clase»; aquí está lo que dejó:

| | qué pasó | quién lo vio |
|---|---|---|
| **rvr-01** | ✅ lleva la clave **nueva**. Comprobado el **2026-08-20 con control negativo**: `diagnosticar_enlace.mjs` abre **con** testigo firmado por este PC, y **sin** testigo devuelve **4401**. Si la clave no casara, sería 4403 | el diagnóstico, desde el PC |
| **los otros 15 y la IMAGEN DORADA** | 🔴 **llevan la clave VIEJA, que ya no firma nadie.** Su privada se sustituyó en `.env.local` y **no se puede recuperar** | ⏳ **nadie: no se ha medido.** El 2026-08-20 ninguno de los quince respondía al `ping`, así que aquí no se afirma en qué estado están — solo que la mitad privada de su pareja ya no existe |
| **qué se verá cuando se enciendan** | cierre **4403** («la firma no es válida») y el robot **invisible en Flota**, no un error a la vista | — |
| **qué hay que hacer** | volver a repartir la pública con `publicar_clave.mjs` a los quince **y regenerar la imagen dorada**: un robot reinstalado desde la imagen de hoy nace roto | ⏳ pendiente |

⚠️ **Y una trampa que costó un diagnóstico entero el mismo día:** instalar
`/etc/atriz/testigo.pub` **no basta**. El servicio lee la clave **al arrancar** y se
la queda en memoria, así que un robot que ya estaba corriendo sigue rechazando con
**4403** con la clave buena en el disco. Hace falta
`sudo systemctl restart atriz-robot.service`. El síntoma —4403 con el fichero
correcto delante— se lee como «la clave está mal» y no lo está: está **vieja en RAM**.

📌 Por qué se cambió: el 2026-08-18 rvr-01 no aparecía en Flota. La cadena de red
estaba entera (mDNS, `ping`, 9090 y 22 en verde) y el robot cerraba con **4401** — no
llegaba testigo. Se generó otra pareja porque **la vieja no se podía recuperar**: el
respaldo de `.env.local` de ese día —`.env.local.respaldo-20260818-092529`, que sigue
al lado— **no contiene ninguna `ATRIZ_CLAVE`**, comprobado el 2026-08-20. O sea que
la privada del 2026-08-15 no vivía ya en este PC, y `generar_clave.mjs` no guarda
copia por diseño.

🔑 **Para saber cuál está puesta sin destapar nada**, la huella SHA-256 de la pública
**nueva** —la que casa con la privada de este PC— es:

```
bwU1sHB0DMEAUPIrKC/g3ltf7QRzihqGoLaCVzFalcQ=
```

y se saca del robot **sin `node`**, con lo que ya lleva dentro (comprobado el
2026-08-20: da exactamente esa cadena):

```bash
# en el robot
openssl pkey -pubin -in /etc/atriz/testigo.pub -outform DER | openssl dgst -sha256 -binary | base64
```

Un robot cuyo `testigo.pub` no dé esa huella lleva la vieja y responderá **4403**. Es
un hash de la mitad **pública**: no compromete nada, y evita adivinar por el número de
cierre cuál de las dos parejas hay delante.

### 4b · ✅ CERRADO: lo que se hace en cualquier Linux, sin RVR

Los requisitos 1 y 2 del taller —PTY y `stdin`— no necesitan robot, solo un
Linux. **En este PC (Windows) las pruebas del PTY salen `skipped`, y eso no
es que pasen.** Corridas en la Pi el 2026-08-15: **17/17 en verde** —la Pi
corrigió el recuento con `pytest --collect-only`; aquí ponía 13, que era el
número de antes de la barrida— más 36/36 del núcleo y 5/5 del cruzado. La suite creció a **50** con los cinco fallos que
la auditoría encontró, cada uno con su prueba escrita ANTES del arreglo.

```bash
# en la Pi, en WSL, o en un contenedor
cd ~/atriz_ws/src/Atriz_rvr && python3 -m pytest scripts/agente/pruebas/ -q
```

⚠️ El aviso se conserva porque **vuelve cada vez que alguien mire la suite desde
Windows**: `skipped` no es `passed`, y cada una de esas 13 lleva su **control
contra una tubería** — sin el control, «funciona con PTY» no distingue que el PTY
lo arregle de que funcionara igual.

📌 Y la del cruzado ya **no se salta en la Pi**: el `testigo_ejemplo.json` está
versionado también en `atriz_migracion/scripts/pruebas/`, y si falta la prueba
**falla** en vez de saltarse.

### 4c · Lo que exige el robot, y no tiene atajo

🔴 **Lee la columna «quién lo vio» antes de dar una fila por cerrada.** «La Pi»
significa que lo comprobó su arnés Python contra el agente; **«el navegador»
significa que alguien lo vio en la pantalla**, y hoy eso no lo ha visto nadie.
Las dos cosas se pueden romper por separado: es la misma frontera que dejó
`ping` y `getent` en verde con el navegador colgado.


| | qué hacer | qué debe pasar | quién lo vio | 🔴 qué lo refuta |
|---|---|---|---|---|
| **4-1** | abrir `/robot/7` con el agente parado | dice que **no llega al agente**, y que eso es **otro enlace** que el de la franja de arriba | ✅ **el navegador, con `atriz-agente` PARADO de verdad** (2026-08-15). La franja: *«7,23 V · ENLACE en línea · socket abierto»*. El terminal, al lado: *«La conexión se cortó sin decir por qué. Suele ser que el agente del robot no está corriendo…»* y *«Esto es OTRO enlace que el de la franja de arriba»*. La insignia dice **«sin enlace»** —esta misma mañana decía «listo» aquí— y Ejecutar: *«No hay enlace con el agente de este robot»* | que diga «en línea» a secas: son dos sockets a dos puertos, y uno vivo no dice nada del otro |
| **4-2** | abrirlo **sin haber entrado** | pide iniciar sesión | ✅ **el navegador** (2026-08-15): «hay que iniciar sesión para abrir el terminal: es lo único de esta aplicación que ejecuta código en el robot» | que abra: el terminal es lo único de esta web que ejecuta código, y sin sesión no debe |
| **4-3** | arrancar el agente y abrir de nuevo | lista las prácticas **del robot**, y son **15** | ✅ **el navegador** (2026-08-15): las 15, con sus nombres reales y el directorio `/home/sphero/atriz_ws/.../estudiantes` debajo | que liste diez, o nombres que no existen: la lista la da el agente leyendo el directorio, no una tabla de la web |
| **4-4** | abrir `01_avanzar.py` y ejecutarlo, **con cinta** | ~58-59 cm, lo mismo que por SSH (evidencia 108) | ✅ **el navegador y la cinta** (2026-08-15): **60,0 cm de cinta contra 60,3 de odometría**. Y la odometría dijo además que la medida era válida — velocidad máxima **0,218 m/s**, o sea que la capa de seguridad NO intervino; si lo hubiera hecho saldría ~0,08 y estaríamos en los 26,4 cm de la evidencia 85 sin saberlo | que recorra otra distancia: el `PYTHONPATH` o el entorno no serían los del SSH. 📌 Y esta casilla ya cazó uno: `entorno_de_ejecucion` pisaba `PYTHONPATH` entero y la 05 moría en `import rclpy` — **ninguna prueba pura podía verlo** |
| **4-5** | 🔴 ejecutar `05_sensor_color.py` | una fila **cada 0,5 s en vivo** | ✅ **el navegador** (2026-08-15): una línea nueva cada **~510 ms**, muestreado cada 500 ms durante 20 s — de 23 a 61 líneas, monótono. **No es un bloque al final**: el requisito del PTY, medido desde la pantalla | que salga a bloques al final: sería una tubería y no un PTY — el requisito 1 entero |
| **4-6** | 🔴 ejecutar `04_giro_preciso.py` | los **cuatro** `input()` se contestan desde el navegador, con transportador en la mano | ✅ **el navegador y el transportador** (2026-08-15, evidencia 118). Lo que cierra la casilla **no son los grados: es que el programa ESPERÓ**. Robot 89,5° / 89,9°; transportador **90° y 90°**; giró sobre su eje (0,2 cm de desplazamiento en 180 s). ⚠️ El transportador no distingue 89,5 de 89,9 —0,4° está bajo su resolución—; lo que descarta es que el yaw mienta a lo grande | que el programa no espere: sin terminal `input()` no bloquea y **se salta la pausa sin avisar** |
| **4-7** | 🔴 Parar a mitad de un avance, **midiendo con cinta** | el robot para, y lo que recorre después es comparable al ~1 cm medido por SSH | ✅ **MEDIDA POR PRIMERA VEZ** (2026-08-15, evidencia 118): **1,9 cm de mediana, n=5** (rango 1,7-3,1), contados **desde el CLIC del navegador** — incluye WiFi, agente, `killpg`, el manejador de Python y la deceleración. ⚠️ Por SSH está en ~1 cm: mismo orden, y la diferencia es *compatible* con el tramo de red que el SSH no tiene, pero **no se ha aislado**. ⚠️ Y el 3,1 no se interpreta: `/odom` a 60 ms son ±0,6 cm de cuantización, del orden de la dispersión | que recorra mucho más: el `SIGINT` no estaría llegando al grupo, o `atriz.py` no lo captura por el PTY. **Sigue sin medirlo nadie por PTY** |
| **4-8** | 🔴 `SIGKILL` desde el desplegable de señales | el barrido **queda encendido**, y la pantalla **lo dice** | ✅ **el navegador** (2026-08-15): `/scan` a **12,00 Hz antes** y **11,83 Hz después** del `SIGKILL` — sin limpieza, el barrido sigue. Y la tarjeta «Cómo terminó» dice *«Barrido del LIDAR: no se comprobó · Movimiento después: no se midió»*: **no afirma que se apagara**, que es lo que `comprobar_efecto()` no puede saber todavía | que la pantalla diga que se apagó: `comprobar_efecto()` devuelve hoy «no lo sé» en varios campos a propósito, y afirmar sería inventar |
| **4-9** | arrancar SLAM y matar un guion encima | el barrido **NO se apaga** | 🔴 **FALLÓ, y encontró un fallo serio en `atriz.py`** (2026-08-15, evidencia 119): con el barrido encendido por otro, **3 de 5 corridas lo apagaron** al cerrar, sin imprimir su propio aviso. Causa: `_encender_barrido()` daba 1,0 s al primer `/scan` y el descubrimiento de DDS tarda más la mitad de las veces (medido: 40 · 1282 · 16 · 1677 · 28 · 964 ms). ✅ Arreglado separando descubrimiento de dato; **3 de 3 después**, con el control del caso normal. ⚠️ n=3: la batería estaba a 7,26 V. 📌 Probado encendiendo el barrido con `/start_scan`, no con SLAM — el mecanismo no depende de QUIÉN lo encendió | que se apague: dejaría ciega a la navegación en curso, que es por lo que `atriz.py` no apaga lo que no encendió |
| **4-10** | dos pestañas, dos usuarios, mismo robot | el segundo ve **quién** lo tiene y desde cuándo, y **no** puede quitárselo | ✅ **el navegador** (2026-08-15), tras arreglar el agente y reiniciarlo. Falló la primera vez —la pantalla del segundo decía «Ya tienes un programa corriendo» sobre el programa ajeno, con su PID— y se cerró midiendo **en el cable, no en la pantalla**: con dos arreglos para un mismo síntoma, la pantalla no distingue cuál funciona. Sobre **la misma ejecución y con segundos de diferencia**: `bura_hub` → `soy_el_dueno: true`, `ana` → `false`. Y la pantalla de Ana: *«Lo tiene bura_hub con 05_sensor_color.py (PID 72612), desde hace 1 min […] Desde aquí no se le puede quitar — habla con quien lo tiene»* | un «ocupado» sin nombre: con dos robots por mesa, el nombre es la diferencia entre esperar y preguntar |
| **4-11** | recargar la página con un programa corriendo | **se reengancha**: sigue viendo su PID y puede pararlo | ✅ **el navegador** (2026-08-15), y salió sin buscarlo: un navegador **nuevo** —el anterior se cerró con la 05 en marcha— recogió la ejecución viva, siguió recibiendo filas y la paró. «Ejecutar» salía deshabilitado, que es lo correcto | que lo trate como «robot ocupado»: un F5 convertido en diez minutos de espera contra el propio robot |
| **4-12** | `systemctl stop atriz-agente` y mirar `/run/atriz` | **sobrevive**, con la marca del vigía de DDS dentro | ✅ la Pi, **por efecto** (marca + stop + sigue) | que desaparezca: falta `RuntimeDirectoryPreserve=yes`, y el robot se reiniciaría solo más de una vez por arranque |
| **4-7b** | 🆕 parar la 05 desde «Parar el programa» | el `SIGINT` llega al proceso y `atriz.py` lo dice | ✅ **el navegador** (2026-08-15): en la caja de salida aparece **«SIGINT: parando el robot y apagando el barrido…»**, y el efecto se comprobó en el robot — `color_activo=false`, el LED del sensor quedó apagado | que no salga esa línea: el SIGINT no habría llegado al grupo por el PTY. ⚠️ **No sustituye a 4-7**: aquí el robot estaba quieto, y lo que 4-7 mide es cuánto recorre DESPUÉS de la señal |
| **4-4b** | 🆕 escribir un guion **propio** en el editor y ejecutarlo | corre y su salida llega | ✅ **el navegador** (2026-08-15). Es el otro camino de ejecución —frente a «abrir una práctica»— y no lo había probado nadie. Con él volvió el robot al punto de partida entre las cinco corridas de la 4-7 | que solo funcionen las prácticas: `atriz_exec` lleva SIEMPRE el código, así que si este camino falla es que el editor no llega al agente |
| **4-13** | 🆕 el diluvio: ejecutar algo que escupa sin parar | la pantalla **dice cuántas líneas descartó**, y no se atasca | ✅ la Pi: **2 097 152 bytes exactos**, 42 267 líneas contadas · ⏳ el navegador | un recorte silencioso: el alumno leería una salida incompleta creyéndola entera |
| **4-14** | 🆕 los tres cierres con motivo (4401 · 4403 · 4404) | cada uno llega **con su frase**, no un código a secas | ✅ la Pi · ⏳ el navegador | un cierre mudo: el navegador lo convierte en 1006 sin motivo, y se busca en el robot |
| **4-15** | 🆕 ejecutar **durante** un `restart` del agente | rechazo `AGENTE_PARANDO` y la frase «reintenta en unos segundos» | ✅ la Pi · ⏳ el navegador | que acepte la ejecución: moriría a los pocos segundos con un `SIGINT` que el alumno no pidió |

### 4d · Y lo que no se puede medir con uno solo

Las prácticas **20 a 24 son de infrarrojos y necesitan dos robots**. Las dos
últimas se mueven **por firmware, sin capa de seguridad** — el mismo caso que
`conduciendo_por_ir`. Antes de ponerlas en clase, alguien tiene que verlas.

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

---

## 6 · Lo que el rediseño de agosto dejó SIN VERIFICAR contra el robot

> Escrito el 2026-08-16 y ampliado la misma noche con F5 (§6d-6h). Cada línea dice
> **qué se vería si fuera falso** — sin eso no es una casilla, es un deseo.

### 6a · 🔴 Conducir con el teclado — **YA SE PROBÓ EN UNO, y salió un defecto que SIGUE ABIERTO**

Flechas y WASD conducen desde `/robot/NN/conducir` (mantener pulsado, soltar para).
Lo que hay detrás: **15 pruebas** de la lógica pura (`lib/interfaz/teclado.ts`),
`tsc` y `eslint` limpios, y la pantalla renderiza. ~~Lo que **no** hay: un robot
moviéndose.~~ **Falso desde el 2026-08-18**: lo condujo el usuario sobre rvr-01, y
el paso 2 de la receta de abajo **movió el robot**.

⚠️ ~~**No se probó a propósito**: mover un robot sin nadie delante es una acción
física, y la regla del proyecto es avisar antes, no pedir perdón después.~~ Se probó
cuando hubo alguien delante — que era la condición, no una excusa para no probarlo.

🔴🔴 **Y lo que encontró no lo habría visto ninguna prueba pura: VA A TIRONES.** No
lo trajo esta casilla; lo trajo el usuario conduciendo («*va a tirones con el
teclado, con el joystick no*»), y por eso la casilla se queda **abierta con un
defecto dentro** en vez de cerrarse en verde.

Medido el 2026-08-18 **dentro de rvr-01** —no por rosbridge, ver el 📌 de abajo— con
la tecla mantenida:

```
 896 ms : v=0.100     <- avanzando
 994 ms : v=0.000     <- CERO
1023 ms : v=0.100     <- rearranca 29 ms después
```

**6 frenazos en 6,4 s, con una cadencia clavada en ~500 ms** — dos ceros por segundo,
de 18-30 ms cada uno. La causa está en `CLAUDE.md` («un objeto nuevo en cada render,
más un latido de 500 ms»): el efecto del teclado se remonta a 2 Hz y su limpieza
llama a `parar()`. El joystick se libraba **por casualidad**, porque esa limpieza sale
antes si no hay ninguna tecla pulsada.

| | |
|---|---|
| **quién lo vio** | el usuario conduciendo, y un medidor **dentro del robot** suscrito a `/cmd_vel_raw` y `/cmd_vel` |
| **qué descarta al `collision_monitor`** | los **mismos 6 frenazos** en los dos topics: los ceros ya salen de la web |
| **estado** | 🔴 **ABIERTO. El defecto está en el árbol hoy.** Hubo un arreglo el mismo día, se midió, y **se revirtió a petición del usuario** |
| **qué se midió del arreglo** | los primeros 2,9 s pasaron de ceros en 994 · 1496 · 1994 · 2451 ms a **29 mensajes seguidos a `v=0.100` sin un solo cero**: la cadencia de 2 Hz desapareció |
| ⚠️ **qué NO se midió del arreglo** | **una pulsación continua sin soltar.** El resumen seguía marcando 6 frenazos, compatibles con las sueltas reales del usuario —se le pidieron tramos de 2-3 s— pero **eso no se aisló**. Con una sola tecla mantenida 12 s lo correcto son **0**, y nadie lo ha visto |

📌 **El instrumento mintió antes que el código, otra vez.** La primera sonda escuchaba
`/cmd_vel_raw` **por rosbridge desde el PC** y no recibió **nada** con el robot
moviéndose a la vista. En vez de dar por buena la hipótesis (la lista blanca de
suscripciones), la medición se mudó dentro del robot. Una sonda muda y un robot
quieto se parecen demasiado como para distinguirlos por lo que **no** llega.

**Cómo comprobarlo, y son 30 segundos** (con el robot en el suelo y espacio libre):

```
1 · /robot/1/conducir  →  «Arrancar barrido»   (sin /scan NO se mueve, y es correcto)
2 · pulsa ↑ y mantén    →  el robot avanza; al soltar, para
3 · pulsa ← sin soltar ↑ →  gira; al soltar ←, vuelve a avanzar
4 · pulsa ↑ y cambia de ventana con Alt+Tab  →  el robot PARA
5 · pon el foco en un campo de texto y escribe «wasd» →  el robot NO se mueve
```

🔴 **Si fuera falso se vería así:** en 2, nada se mueve → el listener no está
enganchado o el barrido está apagado. En 3, sigue recto → gana la primera tecla en
vez de la última. En 4, **el robot sigue andando ~0,3 s hasta que el watchdog del
driver corta** → el `blur` no llegó. En 5, el robot gira mientras escribes → la
guarda de `escribiendo()` no está mirando el objetivo del evento.

📌 El 5 es el que más importa, y tiene precedente: el gesto del mapa disparaba
además un `click` que mandaba al robot a navegar, y **se enredó con unos cables**.
Un gesto que significa dos cosas, y la que mueve el robot gana.

### 6b · La escala impresa y la barra de batería

La regla, sus umbrales y el relleno se ven contra rvr-01 a 7,79 V (medido en un
primer plano). **Lo que no está medido**: que a 6,4 V —o sea por debajo de «baja»—
el cursor caiga donde debe y el rótulo `BAJA` quede a su derecha. Exige una batería
descargada, así que sale cuando salga.

### 6c · 🔴 El tercer código, a TRES METROS

La leyenda del muro distingue los tres bloques en escala de grises **en una
captura**. A tres metros y proyectado, **no está comprobado** — y los alfas de la
trama en modo proyección (0,26 y 0,34) salen de mi ojo mirando esa captura, no de
una pared.

**Si «mirar» y «hay que ir» se siguen pareciendo desde el fondo del aula, se
suben.** Es un número, no un rediseño.

---

### 6d · 🆕🔴 LA VELOCIDAD ABIERTA — 2,0 rad/s de giro y 0,40 m/s con pestillo

Lo más físico que dejó la sesión del 2026-08-16, y lo único cuya respuesta correcta
**no la puede dar una medida**: es un juicio de quien tiene el aula.

Lo que hay detrás: la franja está **medida** —lineal 0,20→0,199 y 0,40→0,401 al
100 %; angular 0,5-2,0 al 99-102 %—, hay 22 pruebas puras que barren **más de
15 000 puntos** del espacio de ajustes, y el hueco al parar del `collision_monitor`
sube solo de **6,3 a 7,4 cm** al doblar la velocidad. Lo que **no** hay: nadie ha
conducido así.

```
1 · /robot/1/conducir → «Arrancar barrido» → sube «giro máximo» a 2,0
2 · gira sobre el eje con la palanca al tope lateral
    ¿se puede parar donde quieres, mirando la pantalla a un metro del robot?
3 · marca «Dejar llegar hasta 0,40 m/s» y sube el deslizador al tope
4 · avanza en línea recta por un pasillo despejado y suelta a media distancia
5 · recarga la página  →  el pestillo tiene que estar ECHADO otra vez (0,20)
6 · desenchufa el WiFi del robot un momento →  el pestillo se echa solo
```

🔴 **Si fuera falso se vería así:** en 2, el robot da la vuelta antes de que
reacciones → 2,0 es demasiado para esta pantalla y hay que bajar `W_MAX`. En 4, la
distancia de parada te sorprende → recuerda que **el LIDAR barre a 15,5 cm del
suelo y por debajo no ve nada**, y ahí la energía va con v². En 5 o 6 el deslizador
sigue en 0,40 → el pestillo no se está echando, y eso es lo único que separa este
mando del Taller.

⚠️ **Y la pregunta que no es técnica:** ¿0,40 m/s en un pasillo con dieciséis
robots y alumnos alrededor te parece bien? Eso lo decide quien da la clase, no una
medida. Si la respuesta es no, `V_MAX_DURO` en `lib/interfaz/palanca.ts` es una
línea.

---

### 6e · 🆕 LOS COLORES DE LED, que solo se juzgan MIRANDO el robot

La paleta cambió: eran los ocho tonos de sección de la aplicación —validados como
**tinta sobre papel**— y ahora son ocho a 45° con saturación y brillo máximos. Las
pruebas garantizan la geometría del color; **ninguna puede decir si se distinguen
en un RVR**, que lleva los LEDs bajo plástico de colores, sobre chasis blanco y con
la luz que haya en la sala.

```
1 · /robot/1/acciones → deja los diez grupos marcados → prueba los nueve colores
2 · ponte al otro lado del aula y mira: ¿cuáles se confunden entre sí?
3 · marca SOLO «Faros» y manda un color → ¿se encienden solo los faros?
4 · marca «Freno» → ¿los de detrás?
5 · «Apagar todo» con solo dos grupos marcados → tienen que apagarse LOS DIEZ
```

🔴 **Si fuera falso se vería así:** en 3 o 4 se enciende todo → `peticionPara()`
está colapsando a `all_lights` cuando no debe. En 5 quedan luces encendidas → el
atajo está respetando la selección, y su caso de uso es justo el contrario:
**apagar de golpe un robot que estorba**.

📌 El resultado de 2 es un dato que hoy no existe: **cuántos colores se distinguen
de verdad en un RVR**. Si son menos de nueve, la paleta debería encogerse — y esa
es la clase de medida que solo se toma una vez.

---

### 6f · 🆕 EL POLÍGONO DE SEGURIDAD DIBUJADO — comprobar que el dibujo dice la verdad

`/robot/NN/lo-que-ve` dibuja ahora las dos zonas del `collision_monitor` y una
lectura de lo que está haciendo. **Es una deducción del barrido**, no una medida:
lo que de verdad hace lo publica `/collision_monitor_state`.

```
1 · barrido encendido, robot despejado  →  «Capa de seguridad: sin recorte»
2 · acerca una caja a ~30 cm del frente →  «frena al 40 %»
3 · acércala a ~12 cm                   →  «no se mueve»
4 · con la caja a 12 cm, intenta conducir ALEJÁNDOTE  →  0,0 cm, y la pantalla
    ya lo dice: «ni siquiera para alejarse»
```

🔴 **Si fuera falso se vería así:** en 2 dice «no se mueve» → los `min_points`
están mal (son **2** para el círculo y **4** para el rectángulo, y este módulo nació
con uno solo). En 3 dice «frena» → el círculo se dibuja o se cuenta con el radio
equivocado; tiene que ser **0,15**, no 0,18.

---

### 6g · 🆕 LOS INFRARROJOS — **exigen DOS robots**, y ya hay pantalla

Ver §2ter, que ya estaba escrito. Lo que cambia el 2026-08-16 es que **ahora hay
dónde mirarlo**: `/robot/NN/acciones` enseña la zona, el modo, el último código con
su antigüedad y los tres sensores, y deja emitir un código 0-7.

⚠️ Y lo que la pantalla **no puede** confirmar, por diseño: que se emitió. El
infrarrojo es invisible y este robot no se escucha a sí mismo. **El único testigo
es el «último código» del OTRO robot.**

---

### 6h · 🆕 EL TALLER OSCURO — lo único que necesita robot es el enlace

La consola, los seis colores de sintaxis y el modo expandido se vieron en un
navegador contra el doble. Contra el robot solo queda comprobar que **la salida de
un programa real se lee bien sobre el fondo oscuro**, que es lo que ningún doble
puede decir:

```
1 · /robot/1 → abre una práctica y ejecútala
2 · provoca un error (una línea con `1/0`)  →  la traza tiene que leerse:
    filete lateral visible, `File "..."` en tinta apagada, el mensaje final en
    tinta plena
3 · pulsa «Expandir el terminal»  →  la PARADA DE EMERGENCIA tiene que seguir
    visible y pulsable en el raíl
```

🔴 **El 3 es el que importa** y no es cosmético: hoy **tapar la parada deja las
1210 pruebas en verde**, porque la única guardia comprueba contención en el DOM y
no visibilidad. Si en pantalla expandida no ves el botón rojo, **eso es un fallo de
seguridad**, no de maqueta.

---

### 6i · no existe — y se deja el hueco a propósito

📝 La numeración salta de **6h a 6j**. Se llegó a renumerar para cerrarlo y **se deshizo**:
estos números son anclas que citan `TRASPASO.md` y `ESTADO_ACTUAL.md` del repositorio de
migración, y también mensajes de commit **ya subidos**, que no se pueden corregir. Un hueco
es cosmético; una cita rota manda a alguien a leer la sección equivocada.

---

### 6j · 🆕 LO QUE EL RENDIMIENTO DEJÓ PARA MIRAR A OJO (2026-08-17)

Dos cambios que **ninguna prueba de este repositorio puede ver**, porque aquí no se renderiza
ningún componente. Los números de abajo están medidos; lo que falta es que una persona lo mire.

```
1 · entra a /robot/1  ->  las tarjetas tienen que entrar EN CASCADA, una vez
2 · cambia de pestaña ->  NO tiene que volver a haber cascada: aparecen y ya
3 · vuelve a entrar al robot desde el muro  ->  cascada otra vez (es por robot)
4 · con «reducir movimiento» activado en el sistema, repite 1
```

🔴 **Si fuera falso se vería así:** en 2 vuelve la cascada → el plazo de `CASCADA_COMPLETA_MS` no
casa con la hoja, y `cascada.test.ts` debería estar en rojo. En 4 desaparece todo movimiento →
mal: la regla del proyecto es que reducir movimiento **conserva color y opacidad a 200 ms**, no que
lo mate; matarlo devuelve el estroboscopio a quien pidió menos.

```
5 · /robot/1/medidas  ->  espera a que aparezca el voltaje de la batería
6 · vete a Conducir, vuelve a Medidas
    el voltaje tiene que seguir ahí AL INSTANTE, y con su antigüedad al lado
7 · apaga el robot (o el WiFi) y vuelve a entrar en Medidas
    tiene que decir «todavía no ha llegado ningún /battery_state», NO el voltaje viejo
```

🔴 **El 7 es el que importa y no es cosmético.** El valor prestado **muere con el enlace** a
propósito: si un robot caído siguiera enseñando su último voltaje, sería el modo de fallo que este
proyecto persigue en todas partes — el RVR dormido con el nodo vivo, el nodo muerto con systemd en
verde. Está cubierto por dos pruebas del transporte, pero **verlo en pantalla es otra cosa**.

⚠️ Y comprobado por instrumento el 2026-08-17: al volver a Medidas, **410 ms** después del clic la
tarjeta ya daba `8,32 V · hace 2,1 s`. Como `/battery_state` publica cada 30,0 s, en 410 ms no pudo
llegar por el socket. Lo que falta es el ojo, sobre todo para el paso 7.

---

### 6k · 🆕 LA BALIZA IR — **exige DOS robots**, como el resto de infrarrojos (2026-08-17)

`/robot/NN/acciones` gana «Baliza continua»: deja el robot emitiendo **hasta que alguien lo
apague**, con dos códigos (lejos y cerca) de 0 a 7. Servicio `/set_ir_baliza`, desplegado en rvr-01
el mismo día.

```
1 · robot A · Acciones → códigos 3 y 5 → «Encender baliza»
    la tarjeta de arriba tiene que pasar a modo «emitiendo» (broadcasting)
2 · robot B · Acciones → mira «último código»: tiene que aparecer el 3 o el 5
3 · robot A · «Apagar» → el modo vuelve a «apagado» en A
4 · robot A · pon un código 9 y pulsa «Encender»  →  tiene que NEGARSE sin enviar nada
5 · robot A · con el 9 puesto, pulsa «Apagar»  →  tiene que FUNCIONAR igual
```

🔴 **El 5 es el que importa y no es cosmético.** Apagar no puede quedarse bloqueado porque haya un
valor raro en otro control: un mando que apaga algo tiene que apagar siempre. Está cubierto por una
prueba pura, pero verlo es otra cosa.

🔴 **Y el 2 es la única confirmación que existe.** La pantalla puede decir que el robot **dice**
estar emitiendo —`modo` viene en `/estado_ir`—, pero **no** que la luz infrarroja salga: es
invisible y el robot no se escucha a sí mismo. El testigo es el otro robot, y por eso esto no se
puede cerrar con rvr-01 solo.

⚠️ **Apagar apaga TRES cosas** —baliza, seguimiento y evasión—, que es la semántica del driver. La
pantalla lo dice; comprueba que se entiende antes de dárselo a un alumno.

---

### 6l · 🆕🔴 SEGUIR Y HUIR — el único mando que mueve el robot SIN capa de seguridad (2026-08-17)

`/robot/NN/acciones` gana «Seguir o huir de otro robot». Servicio `/set_ir_conduccion`, verificado
por el robot (evidencia 128). **Exige DOS robots** y espacio despejado.

⚠️ **Antes de empezar, dos cosas que no son formalidad:** deja **medio metro libre alrededor** —el
`collision_monitor` NO interviene aquí, así que el robot puede llegar a la pared— y ten la mano
cerca del botón del RVR.

```
1 · robot B · baliza encendida (códigos 3 y 5)
2 · robot A · «seguir», 5 s → «Empezar»
    · el robot A tiene que MOVERSE hacia B
    · «modo» pasa a «siguiendo a otro robot» y `conduciendo_por_ir` a sí
    · a los ~5 s se para SOLO, sin que nadie mande nada        ← lo que importa
3 · repite con 5 s y pulsa «Empezar» otra vez a los 3 s
    · tiene que apagarse a los ~5 s de la SEGUNDA, no a los 10 (rearma, no suma)
4 · «huir» 5 s → el robot A tiene que ALEJARSE de B
5 · con un seguimiento en marcha, pulsa la PARADA DE EMERGENCIA
    · tiene que pararse, y «modo» volver a «apagado»
6 · pon el plazo en 40 y pulsa «Empezar» → tiene que NEGARSE sin enviar nada
```

🔴 **El 2 es la razón de ser del diseño.** Si no se apaga solo, el plazo no está funcionando y
entonces esto es exactamente lo que no queríamos: un robot conduciendo indefinidamente con la capa
de seguridad fuera. Si eso pasa, **pulsa la parada** y dilo antes de seguir probando.

🔴 **El 5 comprueba lo que la web afirma.** Hasta el 2026-08-17 la pantalla decía lo contrario —«no
se puede parar desde aquí»— y era falso desde el 2026-08-01. Ahora lo dice bien; falta verlo.

⚠️ **Y hay un modo de fallo observado UNA VEZ (evidencia 129):** al apagar un `seguir` activo, el
RVR dejó de mandar telemetría pero **siguió contestando** a las órdenes de infrarrojos. En pantalla
se ve como **medidas viejas con el robot aparentemente conectado**. Ocurrió una vez, no se sabe qué
lo dispara, y **se arregla apagando y encendiendo el RVR con su botón** — la Pi se recupera sola
(medido: volvió sin tocar nada). La pantalla lo avisa; comprueba que se entiende.
