/**
 * Como se lee el segmento `[id]` de `/robot/[id]`. PURO: sin React y sin red.
 *
 * 🔴 Por que hay una funcion para esto y no un `Number(params.id)`: ese segmento
 * gobierna **a que maquina abre un WebSocket el navegador del alumno**. Un
 * `Number('abc')` da `NaN`, `urlDeRobot(NaN)` da `ws://rvr-NaN.local:9090`, y el
 * sintoma seria «este robot no conecta» -que se busca en el robot, no en la
 * URL-. Aqui lo que no se entiende se rechaza, y la ruta responde 404.
 */

/** Los robots del laboratorio. No hay un robot 0 ni un robot 17. */
export const TOTAL_ROBOTS = 16

/** `[1, 2, ... 16]`, que es lo que pinta el muro del profesor. */
export const ROBOTS: readonly number[] = Array.from({ length: TOTAL_ROBOTS }, (_, i) => i + 1)

export type DestinoRobot =
  | { clase: 'NUMERO'; numero: number }
  /** El override por IP. Ver `interpretarIdRobot`. */
  | { clase: 'DIRECCION'; direccion: string }

/**
 * Un literal IPv4 y nada mas. `192.168.1.58` si; `evil.example.com` no.
 *
 * ⚠️ Es deliberadamente estrecho. El override documentado del proyecto es «la IP
 * como override» de `rvr-NN.local`, y aceptar un nombre de maquina cualquiera
 * convertiria esta ruta en un «abre un WebSocket a donde diga la URL» -no hay
 * ninguna necesidad de eso, y esta aplicacion **no tiene autenticacion** (ni
 * puede tenerla mientras hable con rosbridge 2.7.0, que no la implementa).
 */
export function esIPv4(s: string): boolean {
  const partes = s.split('.')
  if (partes.length !== 4) return false
  return partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

/**
 * `null` = el segmento no nombra ningun robot, y la ruta tiene que responder
 * 404. No se «adivina» un robot por defecto: mandar a alguien al robot 1 porque
 * escribio mal la URL es la clase de suposicion silenciosa que este proyecto
 * evita.
 */
export function interpretarIdRobot(segmento: string): DestinoRobot | null {
  if (/^\d+$/.test(segmento)) {
    const numero = Number(segmento)
    // Fuera de 1..16 no hay robot. Un `/robot/99` es un error de quien escribio
    // la URL, y decirlo (404) es mejor que abrir un socket a `rvr-99.local`.
    return numero >= 1 && numero <= TOTAL_ROBOTS ? { clase: 'NUMERO', numero } : null
  }
  return esIPv4(segmento) ? { clase: 'DIRECCION', direccion: segmento } : null
}

/** Lo que `ProveedorRobot` y `urlDeRobot()` esperan: un numero o un anfitrion. */
export function destinoParaTransporte(d: DestinoRobot): number | string {
  return d.clase === 'NUMERO' ? d.numero : d.direccion
}

/** `rvr-07` para el numero 7. Es el nombre con el que el laboratorio llama al robot. */
export function etiquetaRobot(d: DestinoRobot): string {
  return d.clase === 'NUMERO' ? `rvr-${String(d.numero).padStart(2, '0')}` : d.direccion
}

/** El segmento con el que se construyen los enlaces internos. */
export function segmentoRobot(d: DestinoRobot): string {
  return d.clase === 'NUMERO' ? String(d.numero) : d.direccion
}
