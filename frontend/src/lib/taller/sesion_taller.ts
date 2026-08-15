/**
 * LA MAQUINA DE ESTADOS DEL TALLER. PURA — sin React, sin socket, sin reloj.
 *
 * Recibe los mensajes del agente y dice en que punto esta la pantalla. Que sea
 * pura es lo que permite recorrer aqui —sin robot y sin navegador— los estados
 * que en el aula tardan minutos en darse o no se dan a demanda: el robot
 * ocupado por otro, el reloj sin sincronizar, el programa que muere solo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LAS DOS COSAS QUE ESTA MAQUINA NO PUEDE HACER
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. **Afirmar que el robot esta parado.** Que un programa termine no dice que
 *    el robot se haya quedado quieto: lo dice `efecto`, que lo mide el agente
 *    despues. Aqui se guarda y se enseña; no se resume en «todo bien».
 * 2. **Saber si hay alguien ejecutando por SSH.** El agente solo ve lo que sale
 *    de el. Un guion lanzado a mano no aparece aqui, y la pantalla lo dice.
 */

import type {
  EfectoTrasParar, EstadoEjecucion, FicheroPractica, MensajeTaller, Ocupacion,
} from './protocolo'

export type FaseEnlace = 'CERRADO' | 'ABRIENDO' | 'ABIERTO' | 'RECHAZADO'

export interface Ejecucion {
  estado: EstadoEjecucion
  pid: number | null
  nombre: string
  /** Doce hex de lo que se lanzo. Sirve para saber si el texto cambio despues. */
  huella: string
  /** Lo manda el AGENTE. `null` = no se sabe, que no es cero. */
  restanteS: number | null
  lineasDescartadas: number
}

export interface Desenlace {
  motivo: string
  codigo: number | null
  senal: string | null
  duracionS: number
  lineasDescartadas: number
  efecto: EfectoTrasParar | null
}

export interface EstadoTaller {
  enlace: FaseEnlace
  /** Por que se cerro o se rechazo. Vacio si no aplica. Se pinta tal cual. */
  motivoEnlace: string
  robot: number | null
  /** Quien soy, segun el ROBOT. Si no coincide con la sesion web, algo va mal. */
  sujeto: string
  /** 🔴 `false` = la Pi aun no tiene la hora. No es un fallo del alumno. */
  relojFiable: boolean
  directorio: string
  ficheros: FicheroPractica[]
  /** Quien tiene la ranura, sea yo o sea otro. `null` = nadie. */
  ocupacion: Ocupacion | null
  /** Lo mio, solo si la ejecucion es mia. */
  ejecucion: Ejecucion | null
  /** Lo ultimo que termino. Se conserva tras acabar: es el resultado. */
  desenlace: Desenlace | null
  /** El ultimo rechazo. NO cierra el enlace. */
  rechazo: { codigo: string; motivo: string } | null
  avisos: readonly { nivel: 'NOTA' | 'ATENCION'; mensaje: string }[]
  /** Lo que llego y no se entendio. Se guarda para poder verlo. */
  sinEntender: readonly string[]
}

export const TALLER_INICIAL: EstadoTaller = {
  enlace: 'CERRADO',
  motivoEnlace: '',
  robot: null,
  sujeto: '',
  relojFiable: true,
  directorio: '',
  ficheros: [],
  ocupacion: null,
  ejecucion: null,
  desenlace: null,
  rechazo: null,
  avisos: [],
  sinEntender: [],
}

/** Lo mas que se guarda de lo que no se entiende. No crece sin freno. */
const TOPE_SIN_ENTENDER = 5

/**
 * El siguiente estado tras un mensaje del agente.
 *
 * 🔴 NUNCA lanza y nunca borra lo que no toca. Un mensaje que no se entiende
 *    deja el estado como estaba —mas una nota— en vez de dejar la pantalla a
 *    medias mientras un programa mueve el robot.
 */
export function tras(previo: EstadoTaller, m: MensajeTaller): EstadoTaller {
  switch (m.clase) {
    case 'BIENVENIDA':
      return {
        ...previo,
        enlace: 'ABIERTO',
        motivoEnlace: '',
        robot: m.robot,
        sujeto: m.sujeto,
        relojFiable: m.relojFiable,
        directorio: m.directorio,
        ocupacion: m.ocupacion,
        /*
         * 🔴 SI LA EJECUCION EN MARCHA ES MIA, ESTO ES UN REENGANCHE.
         *
         * Pasa al recargar la pagina o al volver de una caida de red: el hijo
         * vive en su propia sesion y sobrevive al socket. Tratarlo como «robot
         * ocupado» convertiria un F5 en diez minutos de espera contra el propio
         * robot, y el alumno no tendria forma de parar su propio programa.
         */
        ejecucion: m.ocupacion !== null && m.ocupacion.sujeto === m.sujeto
          ? {
            estado: m.ocupacion.estado,
            pid: m.ocupacion.pid,
            nombre: m.ocupacion.nombre,
            huella: '',
            restanteS: null,
            lineasDescartadas: 0,
          }
          : null,
      }

    case 'ESTADO': {
      /*
       * ═══════════════════════════════════════════════════════════════════
       * 🔴🔴 NO SE USA `soy_el_dueno` A SOLAS: SE COMPARAN LOS NOMBRES
       * ═══════════════════════════════════════════════════════════════════
       * Medido contra rvr-01 el 2026-08-15 con dos alumnos y un solo robot:
       * la pantalla del SEGUNDO decia **«Ya tienes un programa corriendo.
       * Párralo antes.»** sobre el programa del PRIMERO, con su PID delante.
       *
       * La causa esta en el agente y es de una familia conocida aqui:
       * `agente_sesion.py` hace `difundir(estado_actual(actual['sujeto']))`
       * — **el mismo mensaje a todos los clientes**, con un `soy_el_dueno`
       * calculado para UNO. Es lo mismo que rosbridge compartiendo una sola
       * suscripcion entre clientes: *lo que vale para uno se manda a todos*.
       *
       * ✅ Y no hace falta esperar al robot para dejar de creerselo: el propio
       *    mensaje trae `sujeto`, que es **quien tiene la ranura**, y la
       *    bienvenida trajo el mio. Comparar dos nombres no depende de que
       *    nadie calcule bien un booleano por destinatario.
       *
       * Se exigen las DOS cosas: que los nombres casen y que el agente lo
       * confirme. Asi, el dia que el agente lo arregle, siguen de acuerdo; y
       * mientras tanto, un `true` difundido de mas no se cuela.
       */
      const mia = previo.sujeto !== '' && m.sujeto === previo.sujeto && m.soyElDueno
      return {
        ...previo,
        ocupacion: m.estado === 'LIBRE' ? null : {
          sujeto: m.sujeto,
          estado: m.estado,
          pid: m.pid,
          nombre: m.nombre,
          desdeS: previo.ocupacion?.desdeS ?? 0,
        },
        ejecucion: mia && m.estado !== 'LIBRE'
          ? {
            estado: m.estado,
            pid: m.pid,
            nombre: m.nombre,
            huella: m.huella,
            restanteS: m.restanteS,
            lineasDescartadas: m.lineasDescartadas,
          }
          : null,
      }
    }

    case 'FIN':
      return {
        ...previo,
        ejecucion: null,
        ocupacion: null,
        desenlace: {
          motivo: m.motivo,
          codigo: m.codigo,
          senal: m.senal,
          duracionS: m.duracionS,
          lineasDescartadas: m.lineasDescartadas,
          efecto: m.efecto,
        },
      }

    case 'RECHAZO':
      /*
       * 🔴 UN RECHAZO NO CIERRA EL ENLACE, y «ocupado» menos que ninguno.
       *
       * Cerrar dejaria al segundo alumno sin ver de quien es el robot — que es
       * justo lo que hay que enseñarle. Se guarda y se pinta.
       */
      return { ...previo, rechazo: { codigo: m.codigo, motivo: m.motivo } }

    case 'LISTADO':
      return { ...previo, directorio: m.directorio || previo.directorio, ficheros: m.ficheros }

    case 'RECORTE':
      return previo.ejecucion === null ? previo : {
        ...previo,
        ejecucion: { ...previo.ejecucion, lineasDescartadas: m.lineasDescartadas },
      }

    case 'AVISO':
      return { ...previo, avisos: [...previo.avisos, { nivel: m.nivel, mensaje: m.mensaje }] }

    case 'DESCONOCIDO':
      return {
        ...previo,
        sinEntender: [...previo.sinEntender, m.crudo].slice(-TOPE_SIN_ENTENDER),
      }

    // La salida y el contenido de un fichero no viven en este estado: los lleva
    // el bufer de `salida.ts` y el editor. Aqui no cambian nada.
    case 'SALIDA':
    case 'FICHERO':
      return previo
  }
}

/** El enlace se cerro. `codigo` y `motivo` se pintan tal cual. */
export function trasCerrar(previo: EstadoTaller, motivo: string): EstadoTaller {
  return {
    ...previo,
    enlace: motivo === '' ? 'CERRADO' : 'RECHAZADO',
    motivoEnlace: motivo,
    // 🔴 La ejecucion NO se borra al perder el socket: el proceso sigue vivo en
    //    el robot. Borrarla haria creer que el programa paro, que es la mentira
    //    mas cara que puede decir esta pantalla.
  }
}

export function trasAbrir(previo: EstadoTaller): EstadoTaller {
  return { ...previo, enlace: 'ABRIENDO', motivoEnlace: '', rechazo: null }
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo derivado — para que la pantalla no razone
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** ¿Se puede pulsar Ejecutar? Y si no, por que. */
export function puedeEjecutar(e: EstadoTaller): { puede: boolean; motivo: string } {
  if (e.enlace !== 'ABIERTO') {
    return { puede: false, motivo: 'No hay enlace con el agente de este robot.' }
  }
  if (e.ejecucion !== null) {
    return { puede: false, motivo: 'Ya tienes un programa corriendo. Párralo antes.' }
  }
  if (e.ocupacion !== null) {
    return {
      puede: false,
      motivo: `Lo tiene ${e.ocupacion.sujeto}${
        e.ocupacion.nombre !== '' ? ` con «${e.ocupacion.nombre}»` : ''}. `
        + 'Un robot solo puede correr un programa a la vez.',
    }
  }
  return { puede: true, motivo: '' }
}

/**
 * ¿Esta la linea de entrada viva? Solo mientras algo mio corre.
 *
 * 🔴 El motivo de cuando NO lo esta ha cambiado, y es la mitad del arreglo: la
 *    pantalla decia «no hay nada al otro lado», que era cierto y ya no lo es.
 *    Ahora dice «no hay ningun programa corriendo», que es lo que pasa.
 */
export function entradaViva(e: EstadoTaller): { viva: boolean; motivo: string } {
  if (e.ejecucion === null) {
    return { viva: false, motivo: 'No hay ningún programa corriendo que pueda leerla.' }
  }
  if (e.ejecucion.estado === 'PARANDO') {
    return { viva: false, motivo: 'El programa se está parando.' }
  }
  return { viva: true, motivo: '' }
}

/**
 * ¿El texto del editor sigue siendo el que se lanzo?
 *
 * 🔴 Sin esto la pantalla dejaria creer que lo que corre es lo que se ve, que es
 *    falso en cuanto el alumno toca una tecla. Con la huella se puede decir.
 */
export function textoCambiadoDesdeElLanzamiento(
  e: EstadoTaller, huellaActual: string,
): boolean {
  return e.ejecucion !== null && e.ejecucion.huella !== ''
    && e.ejecucion.huella !== huellaActual
}

/**
 * La insignia de la cabecera del terminal.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ERA BINARIA, Y POR ESO AFIRMABA «listo» SIN SABERLO
 * ═══════════════════════════════════════════════════════════════════════════
 * Estaba escrita dentro del JSX como `corriendo ? 'corriendo' : 'listo'`. Con
 * eso, **un terminal que no ha podido abrir el enlace decia «listo»** — visto en
 * el navegador el 2026-08-15, entrando sin sesion: el aviso de arriba explicaba
 * que hay que iniciar sesion y la insignia de al lado ponia «listo».
 *
 * `listo` significa «puedes ejecutar». Sin enlace no puedes, asi que era una
 * afirmacion que la pantalla no podia hacer — la regla que gobierna toda esta
 * interfaz. Misma familia que `ros2 topic list` incluyendo topics de nodos
 * muertos, o que el clasificador de color diciendo «verde» por descarte: **un
 * binario convierte «no lo se» en una afirmacion**.
 *
 * Ahora son tres, y el tercero se llama por su nombre.
 */
export function insigniaDelTerminal(
  e: EstadoTaller,
): { texto: string; tono: 'NEUTRO' | 'BIEN' | 'ATENCION' | 'GRAVE' } {
  if (e.ejecucion !== null) return { texto: 'corriendo', tono: 'ATENCION' }
  if (e.enlace === 'ABIERTO') return { texto: 'listo', tono: 'NEUTRO' }
  if (e.enlace === 'ABRIENDO') return { texto: 'conectando', tono: 'NEUTRO' }
  // CERRADO y RECHAZADO: no se sabe si se podria ejecutar, asi que no se dice.
  return { texto: 'sin enlace', tono: 'ATENCION' }
}
