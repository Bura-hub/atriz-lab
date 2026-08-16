/**
 * EL CONTRASTE, EJECUTABLE — WCAG 2.1 sobre los tokens de `globals.css`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTO TIENE QUE EXISTIR ANTES DE TOCAR LA PALETA
 * ═══════════════════════════════════════════════════════════════════════════
 * `globals.css` esta lleno de cifras de contraste escritas a mano —«6,53:1 sobre
 * `--muted`», «11,4:1 con blanco», «10,93:1»— y son correctas. El problema no es
 * que esten mal: es que **son comentarios**, y un comentario no falla cuando
 * alguien cambia el valor de al lado.
 *
 * Este proyecto ya sabe como acaba eso, y lo tiene escrito en la propia hoja
 * (`globals.css:139-155`): nacieron dos tokens de identidad **con un comentario
 * que decia «comprobado contra los ocho tonos de arriba»**, y esa comprobacion
 * **no se habia hecho**. Los dos chocaban. Es el motivo literal de que exista la
 * guardia de colisiones:
 *
 *     «la afirmacion la sostiene el ejecutor, no la buena intencion de quien
 *      escribe»
 *
 * El redisenio cambia **los veintiun valores de color a la vez**. Sin un
 * ejecutor, «se rediseña la paleta conservando los contrastes» es exactamente
 * «alguien vuelve a escribir *comprobado* sin comprobar», con veintiuna
 * oportunidades en vez de dos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LO QUE ESTO **NO** MIDE, Y HAY QUE DECIRLO
 * ═══════════════════════════════════════════════════════════════════════════
 * WCAG 2.1 mide una relacion de luminancias entre dos colores planos. **No mide**
 * si algo se lee a tres metros en un proyector que lava los negros, ni si dos
 * tonos se distinguen entre si, ni si el texto es demasiado pequeño. El criterio
 * del muro sigue siendo **una persona a tres metros**, y esta prueba no lo
 * sustituye: le quita de encima el trabajo mecanico para que mire lo que solo
 * puede mirar un ojo.
 */

/** Un color como los declara `globals.css`: tres enteros 0-255. */
export type Triplete = readonly [number, number, number]

/**
 * La luminancia relativa de WCAG 2.1.
 *
 * 📝 El umbral es `0.03928` y el exponente `2.4`: son los de la norma, no los de
 *    sRGB «de libro» (`0.04045`). Se usa el de la norma a proposito, porque lo
 *    que aqui se afirma es conformidad con ella.
 */
export function luminanciaRelativa([r, g, b]: Triplete): number {
  const canal = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** La relacion de contraste entre dos colores. Va de 1 a 21. */
export function contraste(a: Triplete, b: Triplete): number {
  const [claro, oscuro] = [luminanciaRelativa(a), luminanciaRelativa(b)]
    .sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

/**
 * Un color pintado ENCIMA de otro con alfa, resuelto a plano.
 *
 * 🔴 Hace falta porque varias superficies de esta interfaz son translucidas: el
 *    fondo del editor es `--card` con `rgb(var(--vidrio)/0.03)` encima, y la
 *    capucha de las tarjetas es el tono de seccion al 5,5 %. Medir el contraste
 *    contra el token de abajo **sin resolver la mezcla** da un numero que no es
 *    el que ve nadie.
 */
export function mezclar(fondo: Triplete, encima: Triplete, alfa: number): Triplete {
  return [0, 1, 2].map((i) => fondo[i] * (1 - alfa) + encima[i] * alfa) as unknown as Triplete
}

/** `"21 122 61"` -> `[21, 122, 61]`. `null` si no es un triplete. */
export function tripleteDe(valor: string | undefined): Triplete | null {
  if (valor === undefined) return null
  const p = valor.trim().split(/\s+/)
  if (p.length !== 3) return null
  const n = p.map(Number)
  if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null
  return n as unknown as Triplete
}

/**
 * Un par que hay que medir, con su minimo y **por que**.
 *
 * 🔴 El `porque` no es adorno: un minimo sin motivo es un numero que el siguiente
 *    baja «porque no llegaba». Aqui cada uno dice contra que escena se puso.
 */
export interface ParMedido {
  /** Token de la tinta, o `'blanco'` / `'negro'`. */
  tinta: string
  /** Token del fondo. */
  sobre: string
  minimo: number
  porque: string
  /** Si el fondo lleva algo encima con alfa (superficies translucidas). */
  encima?: { token: string; alfa: number }
}

/**
 * 🔴 4,5 ES EL SUELO, Y 7 ES EL DEL MURO.
 *
 * WCAG AA pide 4,5:1 para texto normal. Pero el criterio de aceptacion del muro
 * de flota, escrito nueve veces en `PLATAFORMA_STITCH.md`, es **una persona a
 * tres metros** — y un proyector **lava los negros**, asi que el contraste real
 * cae por debajo del calculado. Por eso todo lo que vive en `.proyeccion` se
 * exige a **7:1**: no es celo, es compensar una perdida medida.
 */
export const AA = 4.5
export const AA_PROYECCION = 7
