'use client'

/**
 * ACCIONES SOBRE EL ROBOT — lo único de la aplicación que SALE hacia él sin ser
 * conducir.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ ESTO ES UNA PANTALLA Y NO EL FINAL DE OTRA
 * ═══════════════════════════════════════════════════════════════════════════
 * Estas tres piezas vivían al final de Telemetría, bajo el rótulo «Salidas
 * directas», con un comentario que ya tenía el diagnóstico escrito: *«la tercera
 * banda no es una medida: es lo único de esta pantalla que SALE hacia el robot;
 * separarla con su rótulo dice de un vistazo que ahí se pulsa, no se lee»*.
 *
 * La separación era correcta y **el sitio no**: quedaban tras un scroll de
 * veinticinco datos, en la pantalla más larga de la aplicación. Una zona bien
 * rotulada a la que no se llega es una zona que no existe.
 *
 * 👤 Decisión del usuario, 2026-08-16: pestaña propia. Y encaja con la
 *    dirección — en un frontal de instrumento de banco las **salidas** van en
 *    su propia zona serigrafiada, nunca entre los indicadores.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LAS TRES GASTAN BATERÍA DEL RVR, Y ESO SE DICE ARRIBA
 * ═══════════════════════════════════════════════════════════════════════════
 * La Raspberry Pi se alimenta del USB del RVR, así que **todo lo de esta
 * pantalla sale de la misma batería que mueve el robot** — y la autonomía
 * (~2 h) ya no cubre una clase de tres. Un LED encendido «para ver si funciona»
 * y olvidado se queda encendido toda la sesión: medido, la luz del sensor
 * aguantó **14 min 38 s** sin que nadie leyera.
 *
 * 🔴 Y NO SE PROMETE QUE SE APAGUEN SOLAS. `atriz-lab` dejó de prometerlo el
 *    2026-08-09 y no vuelve: rosbridge conserva la suscripción cuando una
 *    pestaña se cierra de golpe, así que el apagado por inactividad del driver
 *    —120 s— no llega a vencer. Lo único que acota la exposición es el tope duro
 *    de 900 s del firmware.
 */

import { Grupo } from '@/componentes/ui/Grupo'
import { Aviso } from '@/componentes/ui/Aviso'
import { PanelLeds } from './PanelLeds'
import { PanelOrigenOdometria } from './PanelOrigenOdometria'

export function PanelAcciones() {
  return (
    <div className="escalonado space-y-8">
      <div className="space-y-4">
        {/*
          🔴 EL AVISO VA ARRIBA Y NO SE PUEDE CERRAR. Es la única pantalla cuyo
             contenido tiene consecuencia física, y el coste —batería del RVR—
             no es evidente desde el navegador: quien pulsa está a un metro del
             robot y no ve el consumo. Ponerlo al pie lo dejaría después de los
             botones, o sea después de la decisión.
        */}
        <Aviso nivel="ATENCION" titulo="Aquí no se lee: sale">
          Todo lo de esta pantalla <strong>enciende o mueve algo de verdad</strong> en el robot que
          tienes delante, y sale de <strong>la misma batería</strong> que lo mueve — la Raspberry
          Pi se alimenta del USB del RVR. Una luz encendida y olvidada se queda encendida toda la
          clase: medido, <strong>14 min 38 s</strong> con nadie leyendo.{' '}
          <strong>Apágala tú</strong>: no se apaga sola mientras esta pestaña siga abierta.
        </Aviso>

        <Grupo
          titulo="Luces"
          fuente="/set_leds · acción física: se ven en el aula"
        >
          {/*
            📝 Los LEDs y el origen de la odometría van en tarjetas separadas
               porque **prometen cosas distintas**, y eso ya estaba escrito donde
               vivían: los LEDs no se pueden comprobar desde aquí —`success` y el
               efecto se midieron separándose— y el origen SÍ, porque `/odom` lo
               publica. Lo que cambia es que ahora tienen sitio para respirar en
               vez de compartir una rejilla de dos columnas al final de un scroll.
          */}
          <PanelLeds />
        </Grupo>

        <Grupo
          titulo="Origen de la odometría"
          fuente="/set_pos_and_yaw · y se puede comprobar: /odom lo publica"
        >
          <PanelOrigenOdometria />
        </Grupo>
      </div>
    </div>
  )
}
