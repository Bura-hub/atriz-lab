# Atriz Lab — plataforma web del laboratorio de robótica

Cliente web de 16 robots Sphero RVR sobre ROS 2 Jazzy. Habla con cada robot por
**rosbridge** (un WebSocket por robot, `ws://rvr-NN.local:9090`).

## Estado real

- ✅ Sistema visual: tokens claro/oscuro en `src/app/globals.css`.
- 🚧 Capa de datos (`src/lib/rosbridge/`): en construcción.
- ❌ Autenticación: no existe. rosbridge 2.7.0 no la tiene.
- ❌ Ejecución de código del alumno: no existe.
- **No hay cámaras** en los robots.

El plan y las mediciones que sostienen este diseño están en el repositorio
`Atriz_migracion_ros2` (privado), en `00_auditoria/planes/`.

## Desarrollo

Todo lo de abajo corre dentro de `frontend/`.

```bash
cd frontend
npm install
npm run dev     # servidor de desarrollo, http://localhost:3000
npm run build   # build de producción
npm test        # pruebas con Vitest (hoy: ninguna todavía)
```
