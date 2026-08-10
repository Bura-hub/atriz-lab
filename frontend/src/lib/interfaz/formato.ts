/**
 * Como se escribe un numero en esta interfaz. PURO: sin React y sin red.
 *
 * 🔴 LA REGLA QUE MANDA AQUI: **la ausencia de un dato tiene su propio texto**,
 * y ese texto NO es «0», ni «--», ni una casilla vacia. Un cero es una medida;
 * un hueco no lo es. Este proyecto ya pago la diferencia dos veces -`percentage`
 * leido como 0-100 hizo que un robot al 34 % pareciera estar al 0 %, y
 * `nivelBateria(NaN)` devolvia `OK`-, asi que aqui «no se sabe» se escribe con
 * todas las letras.
 *
 * ⚠️ Y por que TODAS las funciones aceptan `undefined`: el `as` de `useTopic` es
 * una ASERCION, no una validacion. Un mensaje del robot con otra forma no lo
 * detiene nada, asi que cualquier campo puede llegar `undefined` en ejecucion
 * aunque su tipo diga que es un `number`. Formatear eso sin comprobarlo daria
 * «undefined V» en la pantalla.
 */

import { Frescura } from '../rosbridge/contrato'

/** El texto exacto de «no hay dato». Uno solo, para que se lea igual en todas partes. */
export const SIN_DATO = 'no se sabe'

/** Coma decimal: es una interfaz en español. */
export function numero(n: number | null | undefined, decimales: number): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return SIN_DATO
  const t = n.toFixed(decimales)
  /*
   * 🔴 EL CERO NEGATIVO. `(-0.0004).toFixed(3)` es `"-0.000"`, y la pantalla
   * pintaba **«−0,000 m/s»** con el robot parado — visto en Conducir contra
   * rvr-01 el 2026-08-10.
   *
   * No es cosmético: en este proyecto un signo delante de una velocidad
   * significa **la dirección de la marcha**, y aquí no hay ninguna. Un alumno
   * que lee «menos cero» tiene que pararse a decidir si el robot va marcha
   * atrás muy despacio o si está quieto — y `/odom` **sí trae valores
   * negativos de verdad**, así que no puede descartarlo de un vistazo.
   *
   * 📝 Lo destapó una captura de pantalla, no una prueba: `numero()` tiene 30
   *    casos y ninguno pasaba un valor entre −0,0005 y 0. Es la banda
   *    intermedia otra vez.
   */
  const limpio = /^-0(?:[.,]0*)?$/.test(t) ? t.slice(1) : t
  return limpio.replace('.', ',')
}

/**
 * 🔴 VOLTIOS, que es la señal autoritativa de la bateria. El `percentage` del
 * firmware marco **100 % con la bateria a 8,29 V**, a 1,29 V del umbral de
 * «baja». Nunca se pinta un porcentaje como dato principal.
 */
export function voltios(v: number | null | undefined): string {
  const t = numero(v, 2)
  return t === SIN_DATO ? SIN_DATO : `${t} V`
}

export function celsius(c: number | null | undefined): string {
  const t = numero(c, 1)
  return t === SIN_DATO ? SIN_DATO : `${t} °C`
}

export function metros(m: number | null | undefined): string {
  const t = numero(m, 3)
  return t === SIN_DATO ? SIN_DATO : `${t} m`
}

export function metrosPorSegundo(v: number | null | undefined): string {
  const t = numero(v, 3)
  return t === SIN_DATO ? SIN_DATO : `${t} m/s`
}

export function radianesPorSegundo(w: number | null | undefined): string {
  const t = numero(w, 3)
  return t === SIN_DATO ? SIN_DATO : `${t} rad/s`
}

/**
 * Aceleración. **Dos decimales y no tres**, al contrario que las velocidades.
 *
 * 📝 El acelerómetro de este RVR está descalibrado —`|g|` sale un 4 % corto,
 *    medido— así que la tercera cifra no significa nada: escribirla daría a un
 *    número inexacto el aspecto de uno preciso, que es la forma de mentir que
 *    esta interfaz más persigue.
 */
export function metrosPorSegundoCuadrado(a: number | null | undefined): string {
  const t = numero(a, 2)
  return t === SIN_DATO ? SIN_DATO : `${t} m/s²`
}

export function grados(g: number | null | undefined): string {
  const t = numero(g, 1)
  return t === SIN_DATO ? SIN_DATO : `${t}°`
}

export function segundos(s: number | null | undefined): string {
  const t = numero(s, 1)
  return t === SIN_DATO ? SIN_DATO : `${t} s`
}

/**
 * Milisegundos como texto legible. Por encima del segundo pasa a segundos: un
 * «43128 ms» no se lee de un vistazo, y el muro del administrador se mira de lejos.
 */
export function milisegundos(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return SIN_DATO
  if (ms < 1000) return `${Math.round(ms)} ms`
  return segundos(ms / 1000)
}

/**
 * La antiguedad de un dato, con «no se sabe» cuando `Frescura` dice que no se
 * sabe.
 *
 * 🔴 `interpretarAntiguedad(-1)` da `{ conocido: false }`, y eso NO es «hace
 * cero segundos»: es «nunca se ha sabido nada de eso». En `/motor_status` el
 * -1.0 aparece mientras no haya habido ningun atasco desde que arranco el
 * driver. Pintarlo como 0 s seria afirmar una comprobacion que no se hizo.
 */
export function antiguedad(f: Frescura): string {
  return f.conocido ? `hace ${segundos(f.antiguedadS)}` : SIN_DATO
}

/**
 * El yaw (rumbo) de un cuaternion, en radianes.
 *
 * ⚠️ Solo vale para un robot que se mueve en el plano, que es este caso: el
 * driver publica la orientacion PLANA a proposito (`publicar_inclinacion:
 * false`), porque los 6,9° de inclinacion que reporta el RVR son un artefacto
 * de su acelerometro descalibrado -suelo plano medido con nivel y error fijo en
 * el marco del robot-, no una inclinacion real.
 */
export function yawDeCuaternion(q: {
  x?: number; y?: number; z?: number; w?: number
} | null | undefined): number | null {
  if (q === null || q === undefined) return null
  const { x, y, z, w } = q
  if (![x, y, z, w].every((c) => typeof c === 'number' && Number.isFinite(c))) return null
  // Repetido con `as number` no: se estrecha con una guarda explicita para no
  // usar `!` ni `any`. Los cuatro ya estan comprobados justo arriba.
  const qx = x ?? 0, qy = y ?? 0, qz = z ?? 0, qw = w ?? 0
  return Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))
}

export const aGrados = (rad: number): number => (rad * 180) / Math.PI

/** La hora local, para poner al lado de «orden enviada» y que se sepa CUANDO. */
export function horaCorta(t: number): string {
  const d = new Date(t)
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${dd(d.getHours())}:${dd(d.getMinutes())}:${dd(d.getSeconds())}`
}


/**
 * Parte «8,23 V» en el numero y su unidad.
 *
 * 🔴 POR QUE ESTO ES INFORMACION Y NO ADORNO: en un instrumento **el numero es
 * el dato y la unidad es su contexto**. Pintados al mismo tamaño y peso compiten,
 * y el ojo tiene que separar «8,23» de «V» cada vez que lee. Un multimetro, una
 * bascula o un osciloscopio no lo hacen: el numero manda y la unidad acompaña.
 *
 * Es ademas la unica forma de que una columna de medidas se lea de un vistazo —
 * los numeros alineados, las unidades fuera del camino.
 *
 * ⚠️ Separa por el ULTIMO espacio, asi que «0,000 m/s» da («0,000», «m/s») y
 *    «3 ticks» da («3», «ticks»). Lo que no lleva espacio —«−0,5°», «100 %» sin
 *    separar— se devuelve entero y sin unidad, que es lo correcto: partir por
 *    donde no hay junta produciria basura.
 */
export function partirUnidad(valor: string): { numero: string; unidad: string | null } {
  const i = valor.lastIndexOf(' ')
  if (i <= 0 || i === valor.length - 1) return { numero: valor, unidad: null }
  return { numero: valor.slice(0, i), unidad: valor.slice(i + 1) }
}
