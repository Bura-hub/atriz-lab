/**
 * EL SERVIDOR DE DESARROLLO **SIN** LA EXIGENCIA DE TESTIGO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE HACE FALTA, Y NO ES UNA COMODIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * `tarjetas_vivas.test.ts` comprueba lo que el navegador pinta **despues** de
 * recibir por WebSocket, y para eso levanta un rosbridge de mentira en
 * `127.0.0.1`. O sea que habla con el robot **por IP**.
 *
 * Desde la Fase B (2026-08-15) el testigo lleva dentro el numero del robot, y
 * una direccion no tiene numero que firmar: `proveedorDeTestigo` devuelve `null`
 * a proposito y **el socket no se abre**. Con `NEXT_PUBLIC_ATRIZ_TESTIGO=1` esa
 * prueba no puede pasar — no porque algo este roto, sino porque el despliegue
 * de verdad prohibe exactamente lo que ella necesita.
 *
 * 🔴 Y estuvo asi **sin que nadie lo notara desde el 2026-08-15**, porque se
 *    salta sin `ATRIZ_VIVAS=1` y en la salida de vitest `skipped` se lee igual
 *    que `passed`. Es la doceava vez que este proyecto paga la misma forma: una
 *    comprobacion que se salta en silencio.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMO SE USA
 * ═══════════════════════════════════════════════════════════════════════════
 *     cd frontend && npm run dev:sin-testigo        # en otra terminal
 *     ATRIZ_VIVAS=1 npx vitest run src/lib/interfaz/tarjetas_vivas.test.ts
 *
 * ⚠️ **NO lo uses para mirar la aplicacion.** Sin testigo, el navegador abre el
 *    socket contra el robot y es el ROBOT quien cierra con `4401`: lo que veas
 *    no es lo que ve un alumno. Es un banco de pruebas, no un modo de trabajo.
 *
 * 📝 Funciona porque Next **no pisa** una variable que ya este en el entorno:
 *    `.env.local` solo rellena lo que falta. Poniendola a cadena vacia aqui,
 *    `=== '1'` da falso y `TESTIGO_EXIGIDO` queda en `false`.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

process.env.NEXT_PUBLIC_ATRIZ_TESTIGO = ''

console.log('⚠️  servidor de desarrollo SIN exigencia de testigo (solo para tarjetas_vivas)')

/*
 * 🔴 SE LLAMA AL BINARIO DE NEXT CON `node`, NO A `npx`. En Windows, Node 22 se
 *    niega a `spawn` de un `.cmd` sin `shell: true` —`EINVAL`, medido aqui—, y
 *    `shell: true` metería el interprete de por medio con sus reglas de
 *    entrecomillado. Esta ruta no depende ni del shell ni del sistema.
 */
const AQUI = dirname(fileURLToPath(import.meta.url))
const NEXT = join(AQUI, '..', 'node_modules', 'next', 'dist', 'bin', 'next')

const hijo = spawn(process.execPath, [NEXT, 'dev', '--turbopack'],
  { stdio: 'inherit', env: process.env })

hijo.on('exit', (codigo) => { process.exit(codigo ?? 0) })
