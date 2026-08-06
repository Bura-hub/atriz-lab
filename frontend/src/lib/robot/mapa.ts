/**
 * EL MAPA DE OCUPACIÓN, EN FUNCIONES PURAS. Sin canvas, sin React, sin red.
 *
 * `nav_msgs/msg/OccupancyGrid` trae los valores en un array plano de `int8`, con
 * el origen abajo a la izquierda y **la fila 0 al SUR**. Un canvas tiene el
 * origen arriba a la izquierda y la fila 0 al norte, así que pintarlo sin voltear
 * da un mapa **del revés** — y un mapa del revés no se lee como un error, se lee
 * como una habitación distinta.
 */

/** Lo que `nav_msgs/msg/OccupancyGrid` trae en `info`. */
export interface InfoMapa {
  /** Metros por celda. En este laboratorio, 0,05. */
  resolution: number
  width: number
  height: number
  origin: { position: { x: number; y: number } }
}

/**
 * Los tres estados de una celda, y **el tercero no es «libre»**.
 *
 * 🔴 `-1` significa DESCONOCIDO, y es la mayoría de un mapa recién hecho: un
 *    robot quieto produce un mapa 92,9 % desconocido, y eso **no es un fallo**.
 *    Pintarlo del mismo color que «libre» sería afirmar que se ha explorado una
 *    zona donde no ha entrado nadie — y sobre eso se planifican rutas.
 */
export type EstadoCelda = 'LIBRE' | 'OCUPADA' | 'DESCONOCIDA'

/** Por encima de esto, la celda se considera ocupada. Es el umbral de Nav2. */
export const UMBRAL_OCUPADA = 65

export function estadoDeCelda(v: number): EstadoCelda {
  if (!Number.isFinite(v) || v < 0) return 'DESCONOCIDA'
  return v >= UMBRAL_OCUPADA ? 'OCUPADA' : 'LIBRE'
}

/**
 * Convierte la rejilla a píxeles RGBA, **ya volteada** para un canvas.
 *
 * Devuelve `null` si el mensaje no cuadra consigo mismo —`data.length` distinto
 * de `width × height`—, que es la clase de incoherencia que produce un dibujo
 * plausible y equivocado en vez de un error.
 */
export function pixelesDeMapa(
  info: InfoMapa,
  data: readonly number[],
  colores: Readonly<Record<EstadoCelda, [number, number, number]>>,
  // 🔴 `<ArrayBuffer>` EXPLICITO, y no el `Uint8ClampedArray` a secas: ese
  //    incluye `SharedArrayBuffer`, que `new ImageData(...)` NO acepta. Sin
  //    fijarlo aqui, el error de tipos sale en el componente que dibuja — a dos
  //    ficheros de su causa.
): Uint8ClampedArray<ArrayBuffer> | null {
  const { width: an, height: al } = info
  if (!Number.isInteger(an) || !Number.isInteger(al) || an <= 0 || al <= 0) return null
  if (data.length !== an * al) return null

  /*
   * ⚠️ Se reserva desde un `ArrayBuffer` explicito, y no con
   *    `new Uint8ClampedArray(n)`, por una razon de tipos que parece cosmetica y
   *    no lo es: sin el buffer, TypeScript infiere `Uint8ClampedArray<ArrayBufferLike>`,
   *    que incluye `SharedArrayBuffer`, y `new ImageData(...)` **no lo acepta**.
   *    El error sale en el componente, a dos ficheros de distancia de su causa.
   */
  const px = new Uint8ClampedArray(new ArrayBuffer(an * al * 4))
  for (let fila = 0; fila < al; fila += 1) {
    // 🔴 EL VOLTEO. La fila 0 del mensaje es la de más al SUR; en el canvas la
    //    fila 0 es la de más arriba. Sin esto el mapa sale espejado en vertical.
    const filaCanvas = al - 1 - fila
    for (let col = 0; col < an; col += 1) {
      const [r, g, b] = colores[estadoDeCelda(data[fila * an + col])]
      const i = (filaCanvas * an + col) * 4
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
    }
  }
  return px
}

/**
 * De metros del marco `map` a píxel del canvas.
 *
 * ⚠️ El eje Y se invierte por la misma razón que arriba. Y el origen del mensaje
 *    es la esquina INFERIOR IZQUIERDA en metros, no el centro.
 */
export function mundoAPixel(info: InfoMapa, x: number, y: number): { px: number; py: number } {
  const ox = info.origin.position.x
  const oy = info.origin.position.y
  return {
    px: (x - ox) / info.resolution,
    py: info.height - (y - oy) / info.resolution,
  }
}

/** La inversa: de un clic en el canvas a metros del marco `map`. */
export function pixelAMundo(info: InfoMapa, px: number, py: number): { x: number; y: number } {
  return {
    x: px * info.resolution + info.origin.position.x,
    y: (info.height - py) * info.resolution + info.origin.position.y,
  }
}

/** Un cuaternión plano desde un rumbo en radianes. Es lo que pide `/initialpose`. */
export function cuaternionDeYaw(yawRad: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: 0, z: Math.sin(yawRad / 2), w: Math.cos(yawRad / 2) }
}

/**
 * Cuántas celdas de cada clase tiene el mapa.
 *
 * 📝 Sirve para poner en pantalla el porcentaje de DESCONOCIDO, que es el número
 *    que evita la conclusión falsa más común con SLAM: «el mapa está casi vacío,
 *    algo va mal». Un robot que no se ha movido produce 92,9 % desconocido y
 *    está perfectamente sano — girar sobre el eje **no** hace crecer el mapa,
 *    porque el LIDAR vuelve a ver lo mismo desde el mismo punto.
 */
export function recuentoDeCeldas(data: readonly number[]): Record<EstadoCelda, number> {
  const r: Record<EstadoCelda, number> = { LIBRE: 0, OCUPADA: 0, DESCONOCIDA: 0 }
  for (const v of data) r[estadoDeCelda(v)] += 1
  return r
}
