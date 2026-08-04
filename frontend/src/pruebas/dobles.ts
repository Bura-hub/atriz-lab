/**
 * Dobles de prueba. **Ningun codigo de produccion importa este fichero.**
 *
 * Vitest corre en Node: no hay `WebSocket`. Este es el MISMO patron de doble
 * que usa `src/lib/rosbridge/transporte.test.ts` -`readyState` real que
 * arranca en CONNECTING, `close()` ASINCRONO via microtarea-, y las dos
 * propiedades importan: sin ellas ninguna prueba puede distinguir el socket
 * viejo del nuevo durante un `cerrar(); conectar()`, que es justo lo que hace
 * el desmontaje y remontaje de `StrictMode`.
 *
 * Se COPIA en vez de importarse porque exportarlo desde `transporte.test.ts`
 * exigiria tocar `src/lib/rosbridge/`, que esta probado contra un robot real y
 * no se toca. Añade lo que aquel no necesitaba: el registro de TODOS los
 * sockets creados, que es lo que permite contar cuantos quedan abiertos.
 */

export class WSFalso {
  /** Todos los que se han creado desde el ultimo `reiniciar()`, en orden. */
  static creados: WSFalso[] = []

  enviados: string[] = []
  onopen?: () => void
  onmessage?: (e: { data: string }) => void
  onclose?: () => void
  /** 0 CONNECTING · 1 OPEN · 2 CLOSING · 3 CLOSED, como el real. */
  readyState = 0

  constructor(public url: string) {
    WSFalso.creados.push(this)
  }

  static reiniciar(): void {
    WSFalso.creados = []
  }

  /** El ultimo creado. Lanza si no hay ninguno: un `undefined` silencioso aqui
   *  convierte el fallo de la prueba en un error en otro sitio. */
  static get ultimo(): WSFalso {
    const w = WSFalso.creados[WSFalso.creados.length - 1]
    if (w === undefined) throw new Error('no se ha creado ningun WSFalso todavia')
    return w
  }

  /** Los que estan OPEN. Es lo que cuenta para «¿queda un solo socket?». */
  static get abiertos(): WSFalso[] {
    return WSFalso.creados.filter((w) => w.readyState === 1)
  }

  send(d: string) {
    this.enviados.push(d)
  }

  close() {
    this.readyState = 2
    queueMicrotask(() => {
      this.readyState = 3
      this.onclose?.()
    })
  }

  abrir() {
    this.readyState = 1
    this.onopen?.()
  }

  recibir(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }

  /** Las ops ya parseadas que se mandaron por este socket. */
  ops(): { op: string; topic?: string; type?: string; id?: string }[] {
    return this.enviados.map((s) => JSON.parse(s))
  }
}

/** La fabrica que se le pasa a `new Transporte(url, fabrica)`. */
export const fabricaFalsa = (u: string): WebSocket => new WSFalso(u) as unknown as WebSocket

/** Deja pasar las microtareas pendientes (el `close()` diferido del doble). */
export const dejarPasarMicrotareas = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}
