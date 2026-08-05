# Atriz Lab — la interfaz del laboratorio de robótica

Cliente web de 16 robots Sphero RVR sobre ROS 2 Jazzy. Habla con cada robot por
**rosbridge** (un WebSocket por robot, `ws://rvr-NN.local:9090`).

**No es un panel de administración ni un laboratorio remoto: es un instrumento.**
Los alumnos están en la misma sala que el robot, midiendo con cinta métrica y
transportador. El profesor mira los 16 desde el otro lado del aula.

## Estado real

| | |
|---|---|
| ✅ **Capa de datos** (`src/lib/rosbridge/`) | Verificada contra el hardware: ha movido un RVR, ha disparado su parada de emergencia con el robot en marcha, y su odometría coincide con la cinta (30 cm contra 30,2) |
| ✅ **Telemetría, flota, LIDAR, conducir, diagnóstico** | Cinco rutas construidas, y **miradas renderizadas contra el robot vivo** — no solo con `curl`. El LIDAR dibuja geometría real (224 de 260 puntos, lo más cercano a 0,30 m) |
| ✅ **El muro encuentra a los robots por su nombre** | `ws://rvr-01.local:9090` abre en el navegador: 4339 ms con la caché mDNS fría, 2331 caliente. Estuvo roto hasta el 2026-08-04 —el nombre resolvía a cuatro direcciones y el navegador se colgaba en las dos primeras, **sin dar error**— y se arregló en el robot, no aquí. Queda un campo para apuntar a una IP, porque el aula sigue sin probarse |
| ✅ **Sistema visual** | Tokens claro **y oscuro** en `src/app/globals.css`, tipografía del sistema, rejilla de 1 px |
| ✅ **Pruebas** | **358**, más 2 que se saltan porque necesitan el robot |
| ❌ **El terminal** | El producto, y lo único que falta. Bloqueado — ver `/robot/[id]`, que lo explica en pantalla |
| ❌ **Autenticación** | No existe. rosbridge 2.7.0 no la tiene: cualquiera en la red puede hablar con cualquier robot |
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
npm test           # 358 pruebas, en Node
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
```

Aparecen como `skipped`, no como aprobadas: un guion que mueve un robot no se
ejecuta por accidente al pasar la batería.
