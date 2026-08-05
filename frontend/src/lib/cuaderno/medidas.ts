/**
 * EL CUADERNO DE MEDIDAS. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUÉ PROBLEMA RESUELVE
 * ═══════════════════════════════════════════════════════════════════════════
 * El alumno mide con **cinta métrica y transportador**, y hasta ahora esas
 * medidas vivían en papel. Este cuaderno guarda la pareja que importa:
 *
 *     lo que dijo el robot   ·   lo que midió la persona
 *
 * ⚠️ Y esa pareja es el corazón del laboratorio, no un adorno: la odometría de
 *    este robot está contrastada contra cinta —30 cm de cinta contra 30,2 de
 *    odometría, y 31 contra 31,3— y eso solo se sabe porque alguien anotó las
 *    dos columnas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE ESTE MÓDULO **NO** HACE
 * ═══════════════════════════════════════════════════════════════════════════
 * **No calcula si una medida está bien.** No hay tolerancia, ni semáforo, ni
 * «desviación aceptable». Decidir eso exigiría una banda que nadie ha
 * establecido para cada práctica, y ponerla inventada convertiría el cuaderno
 * en un juez que no puede juzgar.
 *
 * Lo que sí hace es la resta, que es aritmética y no una opinión.
 */

/** Una anotación. `robot` y `persona` en la MISMA unidad, siempre. */
export interface Medida {
  id: string
  /** Cuándo se anotó, en ms desde época. Lo pone quien llama. */
  cuando: number
  /** El robot al que pertenece, `rvr-01`. */
  robot: string
  /** Qué se midió: «avance», «giro», lo que escriba el alumno. */
  que: string
  /** Lo que dijo el robot. `null` si no llegó. */
  robotValor: number | null
  /** Lo que midió la persona con la cinta. `null` si aún no lo ha puesto. */
  personaValor: number | null
  unidad: string
  nota: string
}

/**
 * La diferencia, en la unidad de la medida. `null` si falta cualquiera de las
 * dos: **restar contra un hueco daría un número que parece una medida**.
 */
export function diferencia(m: Medida): number | null {
  if (m.robotValor === null || m.personaValor === null) return null
  return m.personaValor - m.robotValor
}

/**
 * 🔴 EL CUADERNO VIVE EN ESTE NAVEGADOR Y EN NINGÚN SITIO MÁS.
 *
 * No hay servidor donde guardarlo ni autenticación con la que saber de quién
 * es. Decirlo en pantalla es obligatorio: un alumno que crea que sus medidas
 * están «en la nube» las perderá al cambiar de portátil, y eso es una práctica
 * entera tirada.
 */
export const CLAVE_CUADERNO = 'atriz.cuaderno.v1'

export const AVISO_ALMACENAMIENTO =
  'Se guarda solo en este navegador. No hay servidor: si cambias de portátil o borras '
  + 'los datos del sitio, se pierde. Expórtalo antes de terminar la práctica.'

/** Lee lo guardado. Ante cualquier basura devuelve vacío: nunca lanza. */
export function leerMedidas(crudo: string | null): Medida[] {
  if (crudo === null || crudo === '') return []
  let dato: unknown
  try {
    dato = JSON.parse(crudo)
  } catch {
    return []
  }
  if (!Array.isArray(dato)) return []
  return dato.filter(esMedida)
}

function esMedida(x: unknown): x is Medida {
  if (typeof x !== 'object' || x === null) return false
  const m = x as Record<string, unknown>
  return typeof m.id === 'string'
    && typeof m.cuando === 'number'
    && typeof m.robot === 'string'
    && typeof m.que === 'string'
    && typeof m.unidad === 'string'
    && typeof m.nota === 'string'
    && (m.robotValor === null || typeof m.robotValor === 'number')
    && (m.personaValor === null || typeof m.personaValor === 'number')
}

/**
 * A CSV, que es lo que se abre en cualquier sitio y sobrevive al proyecto.
 *
 * ⚠️ Separador `;` y coma decimal: es lo que espera un Excel en español, y el
 *    destino real de esto es la hoja de cálculo de alguien.
 */
export function aCSV(medidas: readonly Medida[]): string {
  const num = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
  const txt = (s: string) => `"${s.replace(/"/g, '""')}"`
  const cab = 'fecha;robot;que;robot_valor;persona_valor;diferencia;unidad;nota'
  const filas = medidas.map((m) => [
    new Date(m.cuando).toISOString(),
    m.robot,
    txt(m.que),
    num(m.robotValor),
    num(m.personaValor),
    num(diferencia(m)),
    m.unidad,
    txt(m.nota),
  ].join(';'))
  return [cab, ...filas].join('\n')
}
