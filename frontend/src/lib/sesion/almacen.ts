/**
 * EL ÚNICO FICHERO DE LA SESIÓN QUE TOCA DISCO Y VARIABLES DE ENTORNO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ POR QUÉ NO LLEVA `import 'server-only'`, QUE ES LO HABITUAL
 * ═══════════════════════════════════════════════════════════════════════════
 * Porque es un paquete, y este repositorio tiene cinco dependencias y eso es un
 * valor suyo. La garantía que da ese paquete —que la compilación falle si
 * alguien importa esto desde un componente de cliente— **ya existe aquí y es
 * gratis**, por dos vías que se comprueban solas:
 *
 *   · `node:fs/promises`. Importarlo desde un componente de cliente **rompe la
 *     compilación de Next**: no hay `fs` en el navegador. El propio import es la
 *     guardia, y falla al construir, no en ejecución.
 *   · `process.env.ATRIZ_SECRETO`. Next solo inyecta al paquete del navegador
 *     las variables con prefijo `NEXT_PUBLIC_`. Sin él, en cliente vale
 *     `undefined`: el secreto no puede viajar aunque alguien lo intente.
 *
 * 📝 Si algún día esto deja de importar `fs` —por ejemplo al mudar las cuentas a
 *    una base de datos—, esa garantía desaparece y **entonces sí** hace falta
 *    `server-only`. Queda escrito para que el cambio no pase inadvertido.
 *
 * 🔴 Y por eso el resto de `lib/sesion/` es PURO: `testigo`, `credenciales` y
 *    `bloqueo` no saben qué es un fichero ni una variable de entorno, así que
 *    vitest los recoge en Node sin montar nada. Aquí queda solo lo que tiene
 *    efectos, y es lo más corto que se ha podido.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Cuenta } from './reglas'
import { Intentos, SIN_INTENTOS } from './bloqueo'

/** Junto al `package.json` del frontend, fuera de `src/`. */
const RUTA = join(process.cwd(), 'usuarios.json')

/**
 * El secreto con el que se firman los testigos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 SI FALTA, ESTO FALLA. NO SE INVENTA UNO.
 * ═══════════════════════════════════════════════════════════════════════════
 * La tentación es `?? randomBytes(32).toString('hex')`, y sería peor de dos
 * maneras a la vez:
 *
 *   · **Cada arranque cerraría todas las sesiones.** En desarrollo, con Next
 *     recompilando, la sesión se caería cada pocos minutos sin motivo aparente.
 *   · Y sobre todo: **escondería el fallo de configuración detrás de un síntoma
 *     raro.** Quien despliegue sin `ATRIZ_SECRETO` vería «me echa cada rato» en
 *     vez de «falta una variable», que es la novena vez que este proyecto se
 *     tropieza con algo que funciona a medias en vez de fallar.
 *
 * Devuelve `null` en vez de lanzar para que la ruta pueda responder un 500 con
 * una frase que diga qué falta, en vez de una traza.
 */
export function secreto(): string | null {
  const s = process.env.ATRIZ_SECRETO
  return s !== undefined && s.length >= 16 ? s : null
}

interface Fichero {
  cuentas: Cuenta[]
}

/**
 * Lee las cuentas. Un fichero que no existe son CERO cuentas, no un error:
 * es el estado normal de una instalación recién puesta.
 */
export async function leerCuentas(): Promise<Cuenta[]> {
  let crudo: string
  try {
    crudo = await readFile(RUTA, 'utf8')
  } catch {
    return []
  }
  try {
    const f = JSON.parse(crudo) as Fichero
    return Array.isArray(f.cuentas) ? f.cuentas : []
  } catch {
    /*
     * 🔴 UN FICHERO CORRUPTO SON CERO CUENTAS, Y ESO CIERRA LA PUERTA.
     *    La alternativa —ignorar el error y seguir— dejaría entrar a nadie; la
     *    otra —lanzar— tumbaría la aplicación entera. Con cero cuentas nadie
     *    entra y la pantalla lo dice, que es el lado seguro de los dos.
     */
    return []
  }
}

export async function guardarCuentas(cuentas: Cuenta[]): Promise<void> {
  await mkdir(dirname(RUTA), { recursive: true })
  await writeFile(RUTA, `${JSON.stringify({ cuentas }, null, 2)}\n`, 'utf8')
}

/**
 * ── LOS INTENTOS FALLIDOS ────────────────────────────────────────────────────
 * En memoria del proceso, a propósito: se pierden al reiniciar y no hacen falta
 * entre instancias porque esto corre en un portátil del aula, no en un clúster.
 *
 * ⚠️ La consecuencia hay que saberla: **reiniciar el servidor borra los
 *    bloqueos.** Para quien ataca eso no sirve de nada —no puede reiniciarlo—, y
 *    para quien administra es lo cómodo. Si algún día esto corre replicado,
 *    aquí es donde hay que cambiar de sitio el contador.
 */
const intentos = new Map<string, Intentos>()

export function intentosDe(usuario: string): Intentos {
  return intentos.get(usuario) ?? SIN_INTENTOS
}

export function anotarIntentos(usuario: string, i: Intentos): void {
  if (i.fallos === 0) intentos.delete(usuario)
  else intentos.set(usuario, i)
}
