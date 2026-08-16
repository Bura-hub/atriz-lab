/**
 * LA GEOMETRÍA DEL SELECTOR DE COLOR. PURO: sin React y sin DOM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 ESTE FICHERO EXISTE PORQUE `src/componentes/` NO SE PRUEBA. NUNCA.
 * ═══════════════════════════════════════════════════════════════════════════
 * `vitest.config.ts` fija `include: ['src/lib/**', 'src/hooks/**']` y
 * `environment: 'node'`: **ninguna prueba renderiza un componente y ninguna mira
 * `src/componentes/`**. Así que toda lógica que se quede dentro de un `.tsx` es,
 * por construcción, invisible — y este proyecto ya pagó por eso dos veces en el
 * MISMO componente:
 *
 *   · el plano de intensidad **solo respondía al teclado**: con el ratón no se
 *     podía elegir ni saturación ni brillo. Lo delató `eslint` («'svDesdePuntero'
 *     is assigned a value but never used»), no `tsc` ni el navegador.
 *   · la rueda **descartaba el radio**: `Math.hypot` no aparecía en el fichero,
 *     así que la mitad del disco que la CSS dibuja como rampa de saturación no
 *     se podía seleccionar. Y este segundo no podía delatarlo `eslint`, porque
 *     **el radio ni siquiera se calculaba**: no había variable sin usar.
 *
 * El componente hermano ya tenía el patrón bueno a un fichero de distancia:
 * `MandoPalanca` deja su geometría en `lib/interfaz/palanca.ts`, con pruebas.
 * Esto es lo mismo para el color.
 */

import { HSV, RGB } from '../robot/color_led'

/** Una caja en coordenadas de pantalla. Lo que da `getBoundingClientRect`. */
export interface Caja { left: number; top: number; width: number; height: number }

const pinza = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/**
 * Del puntero sobre el plano a saturación y brillo.
 *
 * El eje X es la saturación —izquierda gris, derecha color puro— y el Y el
 * brillo, invertido porque el DOM crece hacia abajo.
 *
 * 🔴 Devuelve valores RECORTADOS a 0..1 aunque el puntero salga de la caja, y
 *    hace falta: con `setPointerCapture` el arrastre sigue fuera del cuadro —que
 *    es lo que se quiere, para no cortar el gesto al buscar el borde— así que
 *    llegan coordenadas de fuera constantemente.
 *
 * ⚠️ Una caja de ancho o alto cero devolvería `Infinity` o `NaN` en la división.
 *    Puede pasar de verdad: un `getBoundingClientRect` sobre un elemento aún sin
 *    maquetar da ceros. Se contesta el centro, que es inocuo.
 */
export function svDesdePlano(x: number, y: number, caja: Caja): { saturacion: number; valor: number } {
  if (!(caja.width > 0) || !(caja.height > 0)) return { saturacion: 0.5, valor: 0.5 }
  return {
    saturacion: pinza((x - caja.left) / caja.width, 0, 1),
    valor: pinza(1 - (y - caja.top) / caja.height, 0, 1),
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LA MEMORIA DEL SELECTOR: `RGB -> HSV` NO ES INYECTIVA
 * ═══════════════════════════════════════════════════════════════════════════
 * Un gris **no tiene tono** —no hay ángulo que lo describa— y `aHSV` devuelve 0,
 * que es rojo. Un negro **no tiene ni tono ni saturación**. Así que el marcador
 * no se puede calcular siempre desde el color entrante: se movería solo.
 *
 * El componente ya protegía el TONO. **No protegía la saturación**, y eso es un
 * defecto reproducido:
 *
 *     1. el alumno elige un cian saturado      marcador: izquierda 100 %
 *     2. pulsa «Apagar» (manda 0,0,0)          marcador: izquierda 0 %   ← SALTÓ SOLO
 *     3. sube el brillo con el teclado          sale GRIS, no su cian
 *
 * O sea el mismo fallo que la cabecera del componente dice existir para evitar
 * —«bajar el brillo hasta el negro lo mandaría de golpe al rojo»— cometido en el
 * otro eje. Y después de «Apagar» o «Blanco», el plano solo producía grises con
 * el teclado hasta que alguien tocara el eje X.
 *
 * → Las dos componentes se recuerdan con la MISMA regla: si el color entrante no
 *   puede expresarla, se conserva la que había.
 *
 * 📝 Es memoria de la INTERFAZ, no del color: no cambia lo que se manda al robot,
 *    solo dónde se dibujan los marcadores.
 */
export function conMemoria(anterior: HSV, entrante: HSV): HSV {
  return {
    // Sin saturación no hay tono que leer: un gris es gris a cualquier ángulo.
    tono: entrante.saturacion === 0 ? anterior.tono : entrante.tono,
    // Y sin brillo no hay saturación que leer: el negro es negro a cualquiera.
    saturacion: entrante.valor === 0 ? anterior.saturacion : entrante.saturacion,
    valor: entrante.valor,
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA PALETA DE IDENTIFICACIÓN — para distinguir un robot entre dieciséis
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA ANTERIOR ERA UNA PALETA DE PANTALLA USADA COMO PALETA DE EMISOR. Eran
 *    los ocho tonos de sección de la aplicación, elegidos y validados como
 *    **tinta sobre papel claro**, y como luz fallaban en tres cosas medibles:
 *
 *      · cinco de los ocho por debajo de `valor` 0,67 —Ciruela a 0,51, Teal a
 *        0,55—. Un LED a la mitad de brillo es la mitad de visible desde el otro
 *        lado del aula;
 *      · Coral y Ámbar a **16° de tono**: como luz son el mismo naranja;
 *      · un agujero de **118°** entre Lima y Teal, o sea **sin verde**, que es
 *        uno de los tonos más separables que existen.
 *
 *    Es la misma familia que el sensor de color de este proyecto: **reflejar y
 *    emitir no son lo mismo.**
 *
 * → Ocho tonos repartidos a 45°, todos a saturación y brillo máximos, más el
 *   blanco. Nueve identidades, que es más de las que hacen falta para dieciséis
 *   robots trabajando por parejas.
 *
 * ⚠️ Y sigue valiendo el aviso del componente: en el robot se distinguen MENOS
 *    colores de los que sugiere la pantalla —van bajo plástico de colores, sobre
 *    chasis blanco y con la luz que haya en la sala—. Razón de más para no
 *    partir de colores apagados.
 */
export const PALETA_IDENTIFICACION: readonly { nombre: string; rgb: RGB }[] = [
  { nombre: 'Rojo', rgb: { rojo: 255, verde: 0, azul: 0 } },
  { nombre: 'Naranja', rgb: { rojo: 255, verde: 191, azul: 0 } },
  { nombre: 'Verde', rgb: { rojo: 128, verde: 255, azul: 0 } },
  { nombre: 'Esmeralda', rgb: { rojo: 0, verde: 255, azul: 64 } },
  { nombre: 'Cian', rgb: { rojo: 0, verde: 255, azul: 255 } },
  { nombre: 'Azul', rgb: { rojo: 0, verde: 64, azul: 255 } },
  { nombre: 'Violeta', rgb: { rojo: 128, verde: 0, azul: 255 } },
  { nombre: 'Magenta', rgb: { rojo: 255, verde: 0, azul: 191 } },
  { nombre: 'Blanco', rgb: { rojo: 255, verde: 255, azul: 255 } },
]

/** Paso del teclado sobre la tira de tono y el plano. */
export const PASO = 1
export const PASO_GRANDE = 10
