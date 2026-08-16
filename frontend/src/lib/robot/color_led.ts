/**
 * EL COLOR QUE SE LE MANDA A LOS LEDS: conversiones, y nada mas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 SE LLAMA `color_led` Y NO `color` A PROPOSITO
 * ═══════════════════════════════════════════════════════════════════════════
 * `lib/robot/color.ts` ya existe y es **el clasificador del SENSOR**: mira lo
 * que el robot ve. Esto es lo contrario — lo que el robot **emite**. Meterlos
 * en el mismo fichero seria juntar una lectura con una orden porque las dos
 * llevan la palabra «color».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LOS CANALES SON ENTEROS, Y NO ES UN DETALLE DE ESTILO
 * ═══════════════════════════════════════════════════════════════════════════
 * El driver comprueba `isinstance(v, int)` (`rvr_driver_node.py:919-922`). Un
 * `255.0` de JavaScript no es un entero, y una rueda de color produce flotantes
 * todo el rato. Por eso `limitar()` redondea **y** recorta, y todo lo que sale
 * de aqui hacia el robot pasa por ahi.
 *
 * ⚠️ Y lo que este modulo NO puede saber: si el color que elijas se parecera al
 *    que emite el LED. Es un diodo fisico sobre un chasis, visto en una sala
 *    iluminada. La conversion es exacta; el parecido no lo es, y quien lo
 *    afirme estara adivinando.
 */

/** Un color tal y como viaja a `/set_led_rgb`: tres enteros de 0 a 255. */
export interface RGB {
  rojo: number
  verde: number
  azul: number
}

/**
 * El mismo color en coordenadas de rueda.
 *
 * `tono` en grados 0..360, `saturacion` y `valor` en 0..1. Es lo que una rueda
 * necesita: mover el tono sin tocar el brillo es imposible en RGB y trivial
 * aqui.
 */
export interface HSV {
  tono: number
  saturacion: number
  valor: number
}

/**
 * Redondea y recorta a 0..255.
 *
 * 🔴 UN `NaN` SALE COMO 0, Y ESO ES UN SUELO, NO UNA RESPUESTA. Pintaria negro
 *    y el usuario creeria haber pedido negro. Hay que mandar algo, asi que sale
 *    0 — pero **quien llame tiene que haber validado antes**, y por eso
 *    `desdeHex` devuelve `null` en vez de un color inventado.
 *
 * 📝 Los infinitos SI tienen respuesta correcta y no se meten en el mismo saco:
 *    `Infinity` recorta a 255 y `-Infinity` a 0, que es lo que significan. La
 *    primera version los trataba como `NaN` —un `Number.isFinite` de mas— y una
 *    prueba lo caz+o.
 */
export function limitar(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(255, Math.max(0, Math.round(n)))
}

/** Los tres canales pasados por `limitar`. Es lo unico que se manda al robot. */
export function enteros(c: RGB): RGB {
  return { rojo: limitar(c.rojo), verde: limitar(c.verde), azul: limitar(c.azul) }
}

/**
 * De RGB a la rueda.
 *
 * 📝 Con un gris (los tres canales iguales) el tono **no esta definido**: no hay
 *    ningun angulo que lo describa. Se devuelve 0 por convencion, y por eso
 *    `aHSV` no es inyectiva — la ida y vuelta conserva el COLOR, no el objeto.
 *    Las pruebas comparan colores, no estructuras.
 */
export function aHSV(c: RGB): HSV {
  const r = limitar(c.rojo) / 255
  const g = limitar(c.verde) / 255
  const b = limitar(c.azul) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let tono = 0
  if (d !== 0) {
    if (max === r) tono = 60 * (((g - b) / d) % 6)
    else if (max === g) tono = 60 * ((b - r) / d + 2)
    else tono = 60 * ((r - g) / d + 4)
  }
  if (tono < 0) tono += 360

  return { tono, saturacion: max === 0 ? 0 : d / max, valor: max }
}

/** De la rueda a RGB, ya en enteros listos para el robot. */
export function aRGB(h: HSV): RGB {
  const tono = ((h.tono % 360) + 360) % 360
  const s = Math.min(1, Math.max(0, h.saturacion))
  const v = Math.min(1, Math.max(0, h.valor))

  const c = v * s
  const x = c * (1 - Math.abs(((tono / 60) % 2) - 1))
  const m = v - c

  let r = 0
  let g = 0
  let b = 0
  if (tono < 60) { r = c; g = x } else if (tono < 120) { r = x; g = c } else if (tono < 180) { g = c; b = x } else if (tono < 240) { g = x; b = c } else if (tono < 300) { r = x; b = c } else { r = c; b = x }

  return enteros({ rojo: (r + m) * 255, verde: (g + m) * 255, azul: (b + m) * 255 })
}

/**
 * Lee un hexadecimal escrito a mano.
 *
 * 🔴 DEVUELVE `null`, NO LANZA, y no es defensivo porque si: el usuario escribe
 *    `#`, luego `#f`, luego `#ff`… y cada tecla pasa por aqui. Una excepcion en
 *    la tercera pulsacion seria una pantalla rota mientras alguien teclea bien.
 *
 * Acepta con y sin `#`, tres digitos o seis, y en cualquier caja. No acepta
 * ocho (con alfa): al LED no se le manda transparencia, y aceptarlo callado
 * dejaria que alguien creyera haberla mandado.
 */
export function desdeHex(texto: string): RGB | null {
  const t = texto.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]+$/.test(t)) return null

  if (t.length === 3) {
    return {
      rojo: parseInt(t[0] + t[0], 16),
      verde: parseInt(t[1] + t[1], 16),
      azul: parseInt(t[2] + t[2], 16),
    }
  }
  if (t.length === 6) {
    return {
      rojo: parseInt(t.slice(0, 2), 16),
      verde: parseInt(t.slice(2, 4), 16),
      azul: parseInt(t.slice(4, 6), 16),
    }
  }
  return null
}

/** Siempre seis digitos y siempre con `#`: es lo que se pega en otro sitio. */
export function aHex(c: RGB): string {
  const dos = (n: number) => limitar(n).toString(16).padStart(2, '0')
  return `#${dos(c.rojo)}${dos(c.verde)}${dos(c.azul)}`
}

/**
 * Como se llama, mas o menos, para poder DECIRLO.
 *
 * 🔴 Existe por accesibilidad, no por adorno: un lienzo no dice nada a un lector
 *    de pantalla, y «#FF6B35» tampoco. Hace falta una palabra.
 *
 * ⚠️ Y es APROXIMADO por construccion: nombrar colores es convencion, no
 *    medida. Quien lo use tiene que escribir «un rojo anaranjado», nunca «el
 *    color es rojo anaranjado». La diferencia importa en un proyecto que se
 *    prohibe afirmar lo que no mide.
 */
export function nombreAproximado(c: RGB): string {
  const { tono, saturacion, valor } = aHSV(c)

  if (valor <= 0.06) return 'negro'
  if (saturacion <= 0.10) {
    if (valor >= 0.92) return 'blanco'
    return valor >= 0.5 ? 'gris claro' : 'gris oscuro'
  }

  const nombres: readonly [number, string][] = [
    [15, 'rojo'], [45, 'naranja'], [70, 'amarillo'], [160, 'verde'],
    [200, 'cian'], [260, 'azul'], [290, 'violeta'], [330, 'magenta'], [360, 'rojo'],
  ]
  const base = nombres.find(([hasta]) => tono < hasta)?.[1] ?? 'rojo'

  if (valor <= 0.35) return `${base} oscuro`
  if (saturacion <= 0.35) return `${base} apagado`
  return base
}
