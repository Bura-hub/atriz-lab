'use client'

/**
 * Una baldosa CON su conexion. Un `ProveedorRobot` por baldosa, y eso son
 * **16 WebSockets** en el muro del profesor.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 ESTA BALDOSA SOLO PAGA DOS TOPICS, Y ES LA DECISION QUE SOSTIENE EL MURO
 * ═══════════════════════════════════════════════════════════════════════════
 *   /battery_state + /motor_status   0,48 kB/s por robot ·  7,7 kB/s los 16  ✅
 *   + /odom                         13,5 kB/s por robot ·  1,7 Mbit/s los 16 ⚠️
 *   + /scan                            81 kB/s por robot · 10,3 Mbit/s los 16 🔴
 *
 * 🔴 Y NO se arregla con `throttle_rate`. Verificado en el fuente de rosbridge:
 * `subscribe.py:225` hace `self.throttle_rate = min(...)` sobre TODOS los
 * clientes suscritos a ese topic, y rosbridge mantiene UNA sola suscripcion ROS
 * por topic, compartida. **Gana el cliente mas rapido, y su ritmo se impone a
 * todos los demas.** Un profesor que pida 1 Hz recibira a 16,5 en cuanto un
 * alumno abra una pestaña sobre ese robot sin limite -y sin ningun aviso, porque
 * rosbridge no manda `status` por el socket. Lo unico que sostiene un presupuesto
 * es NO SUSCRIBIRSE.
 *
 * 🔴 EL LATIDO DEL MURO ES `/motor_status`, y por eso `resumirBaldosa()` usa
 * `UMBRAL_LATIDO_MURO_MS` (5000) y **no** `evaluarSalud()`. Aquel umbral son
 * 3000 ms calibrados contra `/odom` a 16,5 Hz -unos 50 mensajes perdidos-; sobre
 * un topic de 1 Hz serian TRES, y un hipo de WiFi pintaria «sin señal de vida» en
 * las 16 baldosas a la vez. Hay una prueba en `resumen.ts` que impide unificarlos.
 */

import { useRef } from 'react'
import { ProveedorRobot, useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import { resumirBaldosa } from '@/lib/flota/resumen'
import { entradaDeBaldosa } from '@/lib/interfaz/lecturas'
import { BaldosaRobot } from './BaldosaRobot'

/** El topic del que sale `msDesdeUltimoLatido`. Ver la cabecera: no es intercambiable. */
const TOPIC_LATIDO_MURO = '/motor_status'

function Contenido({ id }: { id: number }) {
  const { transporte, conectado } = useRobot()
  const bateria = useTopic(transporte, '/battery_state')
  const motores = useTopic(transporte, TOPIC_LATIDO_MURO)
  // 🔴 `/estado_robot`, 1 Hz, ~0,03 kB/s. Es lo que le da al muro TRES cosas que
  //    antes no podia saber: si la parada esta puesta, si el RVR contesta, y
  //    —la que mas— si `/odom` esta muerto con el enlace vivo, que es el caso en
  //    el que la baldosa saldria VERDE con la odometria parada.
  const estado = useTopic(transporte, '/estado_robot')
  // La antiguedad envejece sin que llegue nada: sin este muestreo, una baldosa
  // muda se quedaria en «en linea» para siempre.
  useLatido()

  // 🔴 La lectura ANTERIOR del contador. `/estado_robot` va `TRANSIENT_LOCAL`,
  //    asi que un suscriptor nuevo puede recibir el ultimo valor latcheado de un
  //    nodo ya muerto: «llego un mensaje» no prueba que haya nadie detras. Lo
  //    unico que lo prueba es que el numero se mueva, y para eso hacen falta dos.
  const latidoPrevio = useRef<number | null>(null)
  const latidoAnterior = latidoPrevio.current
  if (estado !== null && estado.latido !== latidoPrevio.current) {
    latidoPrevio.current = estado.latido
  }

  const baldosa = resumirBaldosa(
    entradaDeBaldosa({
      id,
      conectado,
      bateria,
      motores,
      msDesdeUltimoMotorStatus: transporte.msDesdeUltimo(TOPIC_LATIDO_MURO),
      estado,
      latidoPrevio: latidoAnterior,
    }),
  )

  return (
    <BaldosaRobot
      baldosa={baldosa}
      href={`/robot/${id}/telemetria`}
      etiqueta={`rvr-${String(id).padStart(2, '0')}`}
    />
  )
}

export function BaldosaConectada({ id }: { id: number }) {
  return (
    <ProveedorRobot robot={id}>
      <Contenido id={id} />
    </ProveedorRobot>
  )
}
