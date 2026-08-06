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
| ✅ **Pruebas** | **467**, más 31 que se saltan porque necesitan el robot |
| ❌ **El terminal** | El producto, y lo único que falta. Bloqueado — ver `/robot/[id]`, que lo explica en pantalla |
| ⚠️ **Sesión** | Existe desde el 2026-08-06 y **protege la interfaz, no el robot**: contraseña con `scrypt`, cookie `httpOnly` firmada con HMAC, bloqueo por intentos en el **servidor** (no en `localStorage`), cero dependencias nuevas. Sirve para que liberar una parada de emergencia tenga un nombre detrás. **No** cierra el camino directo: el navegador habla con el rosbridge de cada robot sin pasar por este servidor, y rosbridge 2.7.0 no tiene autenticación —cualquiera en la red sigue pudiendo hablar con cualquier robot—. Eso es la Fase B, en el robot, y no está construida |
| ✅ **Liberar la parada, CON TESTIGO DEL ROBOT** | 2026-08-06, verificado contra rvr-01 de punta a punta. Se pulsó la parada por el camino de la web (`latido` 291 → la bandera sube en el 292) y se liberó **desde el navegador**, con la interfaz real: la pantalla dijo «Liberada» y el robot lo confirmó (`parada_emergencia: false`). 🔴 La respuesta del servicio **no prueba nada** —`std_srvs/srv/Empty`—, y `/estado_robot` va `TRANSIENT_LOCAL`, así que el primer mensaje que llega puede ser un enlatado **anterior** con la bandera ya abajo: por eso el primer mensaje solo sirve de **referencia** y hace falta uno con `latido` estrictamente mayor. Cuatro resultados distintos, y `SIGUE_PUESTA` (negativa con evidencia) no se confunde con los tres «no se sabe» |
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
npm test           # 467 pruebas, en Node
npm run contrato   # compara la lista blanca de la web con robot.launch.py DEL ROBOT
npm run build
```

⚠️ **`npm run build` con `npm run dev` corriendo rompe el caché `.next`** y las
rutas empiezan a dar HTTP 500 con un error que no menciona tu fichero. Uno u
otro, nunca los dos a la vez.

⚠️ **`npm run contrato` lee el árbol de `../Atriz_rvr`**, así que su veredicto
depende de en qué rama esté *ese* repositorio. Lo dice en su primera línea: si no
pone `rama ros2`, míralo antes de tocar `contrato.ts`.

### Contra el robot

Dos pruebas se saltan por defecto y **mueven el robot**:

```bash
ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/parada_en_marcha.test.ts   # ⚠️ lo deja parado
ATRIZ_ROBOT=1 npx vitest run src/lib/interfaz/barrido_real.test.ts        # solo enciende el LIDAR

Y una tercera que **no toca el robot** —solo abre las seis rutas en un navegador y mira lo que
pintan—, pero necesita el robot encendido y `next dev` corriendo:

```bash
ATRIZ_ROBOT=1 npx vitest run src/lib/interfaz/pantallas_reales.test.ts   # 19 comprobaciones, ~56 s
```
```

Aparecen como `skipped`, no como aprobadas: un guion que mueve un robot no se
ejecuta por accidente al pasar la batería.
