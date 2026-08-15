/**
 * EL PROTOCOLO DEL TALLER: lo que el navegador y el agente de sesion se dicen.
 * PURO — sin React, sin WebSocket y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE ESTE MODULO EXISTE APARTE DEL CLIENTE
 * ═══════════════════════════════════════════════════════════════════════════
 * Porque el otro extremo esta escrito **en otro lenguaje y en otro
 * repositorio** (`Atriz_rvr/scripts/agente/agente_nucleo.py`). Un contrato entre
 * dos lenguajes se rompe callando: cada lado sigue coherente consigo mismo y el
 * fallo aparece en el aula.
 *
 * Aqui viven los nombres y las formas, en un solo sitio, para que cambiarlos sea
 * un acto deliberado y no un descuido en medio de un componente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y POR QUE `leerMensaje` NO LANZA
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que llega viene de fuera. Un mensaje raro es un camino NORMAL, no una
 * excepcion — y con `throw` bastaria con olvidar un `try` para que un JSON tonto
 * tumbara la pantalla **mientras un programa mueve el robot**. Misma decision
 * que `abrir()` en `sesion/testigo.ts` y que `interpretar()` en el agente.
 */

/** Los estados de la ranura. Uno por robot, no uno por pestaña. */
export type EstadoEjecucion =
  | 'LIBRE' | 'ARRANCANDO' | 'CORRIENDO' | 'PARANDO' | 'TERMINADO'

/**
 * Las cinco señales, y estan las cinco a proposito.
 *
 * 🔴 Son el OBJETO DE ESTUDIO de la practica 99 —SIGINT repetido, SIGQUIT,
 *    SIGTERM, SIGHUP, y su ejercicio 5 pide `kill -9`—. Recortar la lista a «las
 *    seguras» dejaria la practica sin instrumento.
 */
export const SENALES = ['SIGINT', 'SIGQUIT', 'SIGTERM', 'SIGHUP', 'SIGKILL'] as const
export type Senal = (typeof SENALES)[number]

/** 64 KiB, el mismo tope que el agente. Si divergen, el agente manda. */
export const TOPE_CODIGO_BYTES = 64 * 1024

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * Navegador → agente
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface OpTaller { op: string; [clave: string]: unknown }

export const opAdjuntar = (): OpTaller => ({ op: 'atriz_adjuntar' })
export const opListar = (): OpTaller => ({ op: 'atriz_listar' })
export const opLeer = (fichero: string): OpTaller => ({ op: 'atriz_leer', fichero })

/**
 * 🔴 `atriz_exec` LLEVA SIEMPRE EL CODIGO, nunca «ejecuta el fichero N».
 *
 * Abrir una practica es leerla al editor y ejecutar **lo que hay en el editor**.
 * Tres consecuencias, y las tres importan:
 *
 *   1. Hay **un solo camino de ejecucion** que probar, no dos.
 *   2. El alumno puede modificar una practica y correrla, que es como se
 *      aprende — y `90_template.py` existe justo para eso.
 *   3. La pantalla puede afirmar **sin adivinar** que lo que corre es lo que se
 *      ve: el agente devuelve la huella de lo que lanzo, y si el texto cambia
 *      despues, la pantalla lo dice en vez de dejar creer.
 */
export const opEjecutar = (
  codigo: string, nombre: string, topePared?: number,
): OpTaller => ({
  op: 'atriz_exec',
  codigo,
  nombre,
  ...(topePared !== undefined ? { tope_pared_s: topePared } : {}),
})

export const opEntrada = (texto: string): OpTaller => ({ op: 'atriz_stdin', texto })
export const opSenal = (senal: Senal): OpTaller => ({ op: 'atriz_signal', senal })
export const opParar = (): OpTaller => ({ op: 'atriz_parar' })

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * Agente → navegador
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Quien tiene el robot, y desde cuando. `null` = nadie. */
export interface Ocupacion {
  sujeto: string
  estado: EstadoEjecucion
  pid: number | null
  nombre: string
  /** Segundos desde que arranco. Lo cuenta el AGENTE — ver `restanteS`. */
  desdeS: number
}

export type MensajeTaller =
  | {
    clase: 'BIENVENIDA'
    robot: number
    sujeto: string
    /** 🔴 `false` = la Pi aun no tiene la hora. Ver `EstadoEjecucion`. */
    relojFiable: boolean
    directorio: string
    ocupacion: Ocupacion | null
  }
  | {
    clase: 'ESTADO'
    estado: EstadoEjecucion
    pid: number | null
    sujeto: string
    soyElDueno: boolean
    nombre: string
    huella: string
    /**
     * 🔴 LO MANDA EL AGENTE, y no se calcula aqui con `Date.now()`.
     *
     * La Pi **no tiene RTC**: arranca con el reloj hasta 19,5 h en el pasado y
     * NTP lo salta ~18 s despues. Restar un instante del robot de uno del
     * navegador daria una cuenta atras absurda —o negativa— sin que nada
     * pareciera roto. El navegador solo interpola entre tics.
     */
    restanteS: number | null
    lineasDescartadas: number
  }
  | { clase: 'SALIDA'; texto: string }
  | {
    clase: 'RECORTE'
    lineasDescartadas: number
    bytesDescartados: number
  }
  | {
    clase: 'FIN'
    motivo: string
    codigo: number | null
    senal: string | null
    duracionS: number
    lineasDescartadas: number
    /** Lo que el agente comprobo DESPUES. Cada campo puede ser «no lo se». */
    efecto: EfectoTrasParar | null
  }
  | { clase: 'RECHAZO'; codigo: string; motivo: string }
  | { clase: 'LISTADO'; directorio: string; ficheros: FicheroPractica[] }
  | { clase: 'FICHERO'; nombre: string; texto: string }
  | { clase: 'AVISO'; nivel: 'NOTA' | 'ATENCION'; mensaje: string }
  /** Lo que no se reconoce. NO se descarta en silencio: se puede pintar. */
  | { clase: 'DESCONOCIDO'; crudo: string }

export interface FicheroPractica { nombre: string; bytes: number }

/**
 * La comprobacion de despues de parar.
 *
 * 🔴 CADA CAMPO PUEDE SER `null`, Y ESO ES UN VALOR: significa «no lo se». Un
 *    `false` diria «he mirado y no pasa», que es una afirmacion distinta. Este
 *    proyecto tiene medido lo que cuesta confundirlas.
 */
export interface EfectoTrasParar {
  /** ¿Seguia llegando `/scan` cuando el programa acabo? */
  scanLlegaba: boolean | null
  /** ¿Habia una navegacion en marcha? Si la hay, el barrido NO se apaga. */
  navegacionEnMarcha: boolean | null
  /** ¿Se llamo a `/stop_scan`? */
  stopScanLlamado: boolean
  /** Maximo de `|linear.x|` visto en `/odom` despues. `null` = no se miro. */
  odomMaxLineal: number | null
  odomMaxAngular: number | null
}

const cadena = (v: unknown, porDefecto = ''): string => (typeof v === 'string' ? v : porDefecto)
const numero = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null)
const entero = (v: unknown, porDefecto = 0): number => numero(v) ?? porDefecto
const booleano = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

function leerOcupacion(v: unknown): Ocupacion | null {
  if (v === null || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.sujeto !== 'string') return null
  return {
    sujeto: o.sujeto,
    estado: (cadena(o.estado, 'CORRIENDO') as EstadoEjecucion),
    pid: numero(o.pid),
    nombre: cadena(o.nombre),
    desdeS: entero(o.desde_s),
  }
}

function leerEfecto(v: unknown): EfectoTrasParar | null {
  if (v === null || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  return {
    scanLlegaba: booleano(o.scan_llegaba),
    navegacionEnMarcha: booleano(o.navegacion_en_marcha),
    stopScanLlamado: o.stop_scan_llamado === true,
    odomMaxLineal: numero(o.odom_max_lineal),
    odomMaxAngular: numero(o.odom_max_angular),
  }
}

/**
 * Lee lo que llega por el socket. **Nunca lanza.**
 *
 * Lo que no se reconoce sale como `DESCONOCIDO` con su texto crudo, y no se tira:
 * un mensaje nuevo del agente contra una web vieja tiene que poder VERSE, o el
 * sintoma es «la pantalla no hace nada» sin ninguna pista.
 */
export function leerMensaje(crudo: string): MensajeTaller {
  let m: Record<string, unknown>
  try {
    const v = JSON.parse(crudo)
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      return { clase: 'DESCONOCIDO', crudo }
    }
    m = v as Record<string, unknown>
  } catch {
    return { clase: 'DESCONOCIDO', crudo }
  }

  switch (m.op) {
    case 'atriz_bienvenida':
      return {
        clase: 'BIENVENIDA',
        robot: entero(m.robot, -1),
        sujeto: cadena(m.sujeto),
        relojFiable: m.reloj_fiable === true,
        directorio: cadena(m.directorio),
        ocupacion: leerOcupacion(m.sesion),
      }
    case 'atriz_estado':
      return {
        clase: 'ESTADO',
        estado: (cadena(m.estado, 'LIBRE') as EstadoEjecucion),
        pid: numero(m.pid),
        sujeto: cadena(m.sujeto),
        soyElDueno: m.soy_el_dueno === true,
        nombre: cadena(m.nombre),
        huella: cadena(m.huella),
        restanteS: numero(m.restante_s),
        lineasDescartadas: entero(m.lineas_descartadas),
      }
    case 'atriz_salida':
      return { clase: 'SALIDA', texto: cadena(m.texto) }
    case 'atriz_recorte':
      return {
        clase: 'RECORTE',
        lineasDescartadas: entero(m.lineas_descartadas),
        bytesDescartados: entero(m.bytes_descartados),
      }
    case 'atriz_fin':
      return {
        clase: 'FIN',
        motivo: cadena(m.motivo, 'SALIDA_NORMAL'),
        codigo: numero(m.codigo),
        senal: typeof m.senal === 'string' ? m.senal : null,
        duracionS: entero(m.duracion_s),
        lineasDescartadas: entero(m.lineas_descartadas),
        efecto: leerEfecto(m.efecto),
      }
    case 'atriz_rechazo':
      return {
        clase: 'RECHAZO',
        codigo: cadena(m.codigo, 'DESCONOCIDO'),
        motivo: cadena(m.motivo),
      }
    case 'atriz_listado': {
      const crudos = Array.isArray(m.ficheros) ? m.ficheros : []
      const ficheros: FicheroPractica[] = []
      for (const f of crudos) {
        if (f !== null && typeof f === 'object') {
          const o = f as Record<string, unknown>
          if (typeof o.nombre === 'string') {
            ficheros.push({ nombre: o.nombre, bytes: entero(o.bytes) })
          }
        }
      }
      return { clase: 'LISTADO', directorio: cadena(m.directorio), ficheros }
    }
    case 'atriz_fichero':
      return { clase: 'FICHERO', nombre: cadena(m.nombre), texto: cadena(m.texto) }
    case 'atriz_aviso':
      return {
        clase: 'AVISO',
        nivel: m.nivel === 'ATENCION' ? 'ATENCION' : 'NOTA',
        mensaje: cadena(m.mensaje),
      }
    default:
      return { clase: 'DESCONOCIDO', crudo }
  }
}

/**
 * Los codigos con los que el agente cierra la conexion, traducidos.
 *
 * 🔴 Los cuatro primeros son de `atriz_testigo.py:44-47` y **no se inventan
 *    aqui**: si divergen, el navegador diria una cosa y el robot habria hecho
 *    otra. El 4409 es del agente.
 *
 * ⚠️ El 1013 no es un fallo del alumno ni de la web: la Pi **no tiene RTC** y
 *    arranca con el reloj en el pasado hasta que NTP contesta, ~18 s despues.
 *    Decir «no autorizado» ahi mandaria a buscar a un profesor por algo que se
 *    arregla esperando.
 */
export function motivoDeCierre(codigo: number): string {
  switch (codigo) {
    case 1013:
      return 'El robot todavía no tiene la hora: acaba de arrancar y aún no ha '
        + 'preguntado a la red. Espera unos segundos y vuelve a intentarlo.'
    case 4401:
      return 'El robot no ha recibido ninguna credencial. Vuelve a entrar.'
    case 4403:
      return 'El robot no acepta tu credencial. Puede que este servidor y ese robot '
        + 'tengan claves distintas: es cosa de quien montó el laboratorio, no tuya.'
    case 4404:
      return 'Esa credencial es para otro robot. Abre el terminal desde la página de este.'
    case 4409:
      return 'Ese robot ya tiene un programa corriendo.'
    case 1006:
      return 'La conexión se cortó sin decir por qué. Suele ser que el agente del robot '
        + 'no está corriendo, o que no se llega a él por la red.'
    default:
      return ''
  }
}
