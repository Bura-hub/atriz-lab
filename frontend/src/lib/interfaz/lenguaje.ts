/**
 * LO QUE ESTA INTERFAZ PUEDE DECIR, Y LO QUE NO. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTE FICHERO EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 * La peor familia de fallos de este proyecto son **interfaces que parecen sanas
 * sobre sistemas rotos**, y la lista es larga y toda medida:
 *
 *   · `systemctl is-active` decia **active** con el driver muerto cuatro minutos
 *   · `undercarriage_white` devuelve **success=true** y NO enciende el LED
 *   · `colcon build` dice **«finished»** sin instalar nada
 *   · `chmod` sobre /boot/firmware devuelve **0** y no cambia ningun permiso
 *   · el topic **registrado y mudo**, identico a un robot sano
 *   · el log escribiendo **«streaming reanudado»** con el robot APAGADO
 *
 * Todas comparten la forma: **un codigo de salida 0 no prueba que algo pasara**.
 * Una pantalla que dice «LED encendido» porque un servicio devolvio `true` es
 * otra entrada de esa lista, y este fichero existe para que no se añada.
 *
 * → Las frases honestas viven aqui, en constantes, para que se lean igual en
 *   todas las pantallas y para que cambiarlas sea un acto deliberado.
 * → Y `FRASES_PROHIBIDAS` no es documentacion: hay una prueba que **recorre los
 *   componentes** y falla si alguna aparece en texto visible.
 */

import { ConfirmacionServicio, confirmaEfecto } from '../rosbridge/contrato'

// ═══════════════════════════════════════════════════════════════════════════
// Lo que se dice al mandar una orden
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔴 «orden enviada», NUNCA «hecho», «confirmado» ni «encendido». Lo unico que
 * sabe el navegador es que el mensaje salio por el WebSocket.
 */
export const ORDEN_ENVIADA = 'orden enviada'

/**
 * 🔴 «parada enviada», NUNCA «parada activa». El driver **no publica su bandera
 * de parada** -tiene 7 publicadores y ninguno es ese-, asi que el cliente no
 * tiene ningun dato del robot con el que afirmar que la parada este puesta.
 * Decirlo seria adivinar sobre el unico control que no puede fallar en silencio.
 */
export const PARADA_ENVIADA = 'parada enviada'

/** Cuando `publicar()` lanza: el mensaje NO salio, y hay que decirlo asi de claro. */
export const PARADA_NO_ENVIADA = 'LA PARADA NO SE HA ENVIADO'

/**
 * Lo que significa la respuesta de un servicio, segun lo que ese servicio pueda
 * dar. La decision de que categoria es cada uno la toma `confirmaEfecto()` en
 * `contrato.ts`; aqui solo se pone en palabras.
 *
 * 🔴 Ninguna de las dos ramas dice «confirmado», porque **ninguno de los ocho
 * servicios confirma un efecto fisico**. `ConfirmacionServicio` no tiene un
 * tercer valor a proposito.
 */
export function textoDeConfirmacion(servicio: string): string {
  const c: ConfirmacionServicio = confirmaEfecto(servicio)
  return c === 'NINGUNA'
    ? 'este servicio responde vacío: no llega ni un bit que diga qué pasó en el robot.'
    : 'el robot respondió que la llamada al SDK no lanzó. Eso no dice que el efecto físico ' +
        'ocurriera: hay un caso medido, «undercarriage_white», que responde igual y deja el LED apagado.'
}

/** El robot dijo que la llamada fallo. Aqui si hay un dato, y es negativo. */
export const SERVICIO_FALLO = 'el robot respondió que la llamada falló'

// ═══════════════════════════════════════════════════════════════════════════
// Lo que se dice de los estados
// ═══════════════════════════════════════════════════════════════════════════

export const TITULO_SIN_CONEXION = 'no llego al robot'
export const TITULO_EN_LINEA = 'en línea'
export const TITULO_SIN_DATOS = 'el enlace va y el robot no manda telemetría'

/**
 * 🔴 El texto que acompaña a `SIN_DATOS`, y es AMBAR, nunca rojo. Las tres
 * causas se listan **sin elegir entre ellas**, porque desde el navegador son
 * indistinguibles -y la primera, «el robot está cargando», es el estado
 * COTIDIANO del laboratorio: el RVR apagado con la Raspberry Pi viva. Con 16
 * robots, adivinar pinta la flota entera en rojo, y un muro siempre rojo se
 * ignora.
 */
export const NOTA_SIN_DATOS =
  'Esto no es una avería, y el navegador no puede saber cuál de las causas es. ' +
  'La única que se distinguiría sería «excepción en un manejador», y solo si alguien ' +
  'mantuviera la suscripción a /scan — que es el 83 % del tráfico de un robot.'

/**
 * Lo que la interfaz NO puede decir hoy, con el motivo de cada una. Se PINTA en
 * la pantalla de diagnóstico: un hueco declarado es honesto; un hueco callado se
 * lee como «todo bien».
 */
export const LO_QUE_NO_SE_PUEDE_DECIR: readonly { que: string; porque: string }[] = [
  {
    que: 'si la parada de emergencia está puesta',
    porque:
      'el driver no publica su bandera de parada. La interfaz solo sabe si el mensaje salió por ' +
      'el WebSocket, y eso es lo que dice.',
  },
  {
    que: 'cuánto tarda una orden en llegar a los motores',
    porque:
      'el recorrido navegador → rosbridge → driver → motores no está medido en este proyecto. ' +
      'Cualquier cifra sería inventada.',
  },
  {
    que: 'si el robot está frenando por la capa de seguridad',
    porque:
      'saldría de /collision_monitor_state, y de ese topic este proyecto no ha caracterizado qué ' +
      'significa cada valor de action_type ni ha medido su caudal (presupuesto.ts lanza al ' +
      'encontrarlo, a propósito). Traducirlo sería inventarle un significado.',
  },
  {
    que: 'si un LED se encendió de verdad',
    porque:
      'ningún servicio del robot confirma un efecto físico. Cuatro responden vacío y los otros ' +
      'cuatro solo dicen que la corrutina del SDK no lanzó.',
  },
  {
    que: 'que un robot esté averiado',
    porque:
      'la falta de datos no es una avería: un robot cargando (RVR apagado, Raspberry Pi viva) se ' +
      've exactamente igual que uno dormido y que uno con una excepción en un manejador.',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// La guardia
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Frases que esta interfaz NO puede enseñar. Cada una viene de un fallo MEDIDO,
 * y la prueba de al lado recorre `src/componentes/` para que no reaparezcan.
 *
 * ⚠️ La comparacion es SIN acentos y en minusculas, porque «parada activa» y
 * «parada ACTIVA» son la misma mentira. Y la prueba salta las lineas de
 * comentario: en este proyecto un auditor conto como deriva una frase falsa
 * **citada precisamente para dejar constancia de que era falsa**, y ese falso
 * positivo hubo que arreglarlo. Explicar por que algo esta prohibido tiene que
 * seguir siendo posible.
 *
 * ⚠️ «latencia» va entera y no solo «X ms de latencia»: lo prohibido es dar una
 * CIFRA, pero el recorrido navegador -> motores no esta medido, asi que un
 * componente no tiene nada honesto que decir con esa palabra. La frase honesta
 * («cuanto tarda una orden en llegar a los motores no esta medido») vive aqui
 * en `LO_QUE_NO_SE_PUEDE_DECIR`, que es `lib/` y no `componentes/`.
 */
export const FRASES_PROHIBIDAS: readonly string[] = [
  'parada activa',
  'parada esta activa',
  'color cambiado',
  'led encendido',
  'robot averiado',
  'robot esta averiado',
  'efecto confirmado',
  'orden confirmada',
  'latencia',
]

/**
 * ACENTO_MIN / ACENTO_MAX son el rango de marcas combinantes de Unicode.
 * Van como NUMEROS y la funcion filtra por punto de codigo, sin expresion
 * regular: escritos como caracteres literales dentro de un /[..]/ son
 * INVISIBLES en cualquier editor, y una copia descuidada del fichero los pierde
 * sin que nadie lo note. La guardia dejaria de igualar "bateria" con la palabra
 * acentuada y dejaria de guardar, en silencio, que es como fallan las cosas en
 * este proyecto.
 */
const ACENTO_MIN = 0x0300
const ACENTO_MAX = 0x036f

/** Quita acentos y baja a minusculas, para que la comparacion no dependa de eso. */
export function normalizar(texto: string): string {
  return Array.from(texto.normalize('NFD'))
    .filter((c) => {
      const punto = c.codePointAt(0) ?? 0
      return punto < ACENTO_MIN || punto > ACENTO_MAX
    })
    .join('')
    .toLowerCase()
}

/**
 * Las lineas que son SOLO comentario. No pretende ser un analizador de
 * JavaScript: cubre las tres formas con las que se escriben los comentarios en
 * este repositorio -barra doble, apertura de bloque, y asterisco de
 * continuacion.
 */
export function esLineaDeComentario(linea: string): boolean {
  const t = linea.trim()
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')
}

/**
 * Busca frases prohibidas en un fuente, ignorando sus comentarios. Devuelve las
 * que encuentre (vacio = limpio).
 */
export function buscarFrasesProhibidas(fuente: string): string[] {
  const cuerpo = fuente
    .split('\n')
    .filter((l) => !esLineaDeComentario(l))
    .join('\n')
  const normalizado = normalizar(cuerpo)
  return FRASES_PROHIBIDAS.filter((f) => normalizado.includes(normalizar(f)))
}
