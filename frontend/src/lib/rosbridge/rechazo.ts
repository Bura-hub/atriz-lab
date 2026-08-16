/**
 * QUE SIGNIFICA UN CIERRE DE rosbridge, Y SI TIENE SENTIDO REINTENTAR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE HACE FALTA: HOY `Transporte` REINTENTA CUALQUIER CIERRE, SIEMPRE
 * ═══════════════════════════════════════════════════════════════════════════
 * Y eso era correcto mientras el unico motivo de cierre fuera un corte de red o
 * un robot apagado, que se arreglan solos. Desde la Fase B (A7) hay otro: el
 * robot puede cerrar porque **no acepta tu credencial**.
 *
 * Reintentar eso es inutil y ademas DAÑINO: el alumno veria «reconectando…» en
 * bucle mientras el robot ya dijo, con todas las letras, *«esa credencial es
 * para otro robot»*. Es la firma de fallo que este proyecto persigue —un motivo
 * que existe y no llega a quien tiene que leerlo—, y encima con espera creciente
 * hasta el minuto, o sea que empeora con el tiempo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y EL 1013 NO ES UN RECHAZO AUNQUE LO PAREZCA
 * ═══════════════════════════════════════════════════════════════════════════
 * La Pi **no tiene RTC**: arranca con el reloj en el pasado y NTP lo corrige
 * ~18 s despues (evidencia 85, y el 2026-08-15 se midio arrancando en una fecha
 * de hace DOS MESES). En esa ventana el robot rechaza testigos buenos porque no
 * puede juzgar su caducidad, y lo dice con 1013.
 *
 * Eso **se arregla solo esperando**, asi que aqui SI se reintenta. Meterlo en el
 * mismo saco que el 4403 dejaria un robot recien encendido inalcanzable hasta
 * que alguien recargara la pagina — y con 16 robots arrancando a la vez al
 * empezar la clase, eso es el caso normal, no el raro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Los codigos NO se declaran aqui
 * ═══════════════════════════════════════════════════════════════════════════
 * Vienen de `motivoDeCierre()`, que a su vez los toma de `atriz_testigo.py`.
 * Este proyecto acaba de pagar (evidencia 124) lo que cuesta que dos copias de
 * una constante se separen en silencio, asi que este modulo **no repite ni un
 * numero de codigo con su texto**: solo añade la decision de reintentar.
 *
 * 📝 `motivoDeCierre` vive en `lib/taller/` porque el Taller lo necesito antes.
 *    Si aparece un tercer consumidor, muevelo a un modulo neutro; con dos, un
 *    import basta y mover ficheros tiene su propio riesgo.
 */

import { motivoDeCierre } from '@/lib/taller/protocolo'

/**
 * Los cierres que significan «tu credencial no vale», y que NO se reintentan.
 *
 * 🔴 El 1013 NO esta aqui a proposito. Ver la cabecera.
 */
export const CIERRES_DE_CREDENCIAL: readonly number[] = [4401, 4403, 4404]

export interface LecturaDelCierre {
  /** ¿Tiene sentido volver a intentarlo solo? */
  reintentar: boolean
  /** Que decirle a la persona, o `null` si no hay nada que añadir. */
  explicacion: string | null
}

/**
 * @param codigo  el `code` del evento `close`
 * @param motivoDelRobot  el `reason`, que el robot rellena con el detalle exacto
 *                        («este testigo es para el robot 2, y este es el 1»)
 */
export function leerCierre(codigo: number, motivoDelRobot = ''): LecturaDelCierre {
  if (CIERRES_DE_CREDENCIAL.includes(codigo)) {
    const detalle = motivoDelRobot.trim()
    return {
      reintentar: false,
      /*
       * Los DOS textos, y en este orden. El de la web esta escrito para el
       * alumno y dice que HACER; el del robot trae el dato exacto (que numero
       * esperaba). Quedarse solo con uno pierde una de las dos cosas.
       */
      explicacion: detalle === ''
        ? motivoDeCierre(codigo)
        : `${motivoDeCierre(codigo)} (el robot dice: «${detalle}»)`,
    }
  }

  // Se arregla solo en segundos: se reintenta Y se explica, para que la espera
  // no parezca un cuelgue.
  if (codigo === 1013) return { reintentar: true, explicacion: motivoDeCierre(1013) }

  // Corte de red, robot apagado, WiFi con hipo… lo de siempre.
  return { reintentar: true, explicacion: null }
}
