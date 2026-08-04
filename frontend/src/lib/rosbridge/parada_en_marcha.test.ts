/**
 * 🔴🔴 LA PARADA DE EMERGENCIA, DESDE EL NAVEGADOR, CON EL ROBOT EN MARCHA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUE EJERCE ESTO QUE NO EJERCIO NADA ANTES
 * ═══════════════════════════════════════════════════════════════════════════
 * La parada de emergencia ha fallado CINCO veces en este proyecto, y cuatro de
 * ellas devolviendo exito con CERO efecto: nombre de topic (ROS 1), namespace
 * (`/rvr/` colado al portar), QoS incompatible, y la cuarta al SOLTARLA -el
 * robot arranco solo, 34,7 cm-. El manual lo dice sin rodeos: **el namespace
 * resuelto y el QoS solo aparecen publicando de verdad**; leer el codigo da el
 * nombre y nada mas.
 *
 * Y la pata del NAVEGADOR nunca se ha ejercido. El navegador no publica con
 * `rclpy`: manda `advertise` + `publish` por WebSocket y es **rosbridge**, ya
 * dentro del robot, quien resuelve el nombre y elige el QoS. Esa resolucion es
 * codigo distinto del que se probo desde la Pi.
 *
 * Desde la Pi ya se cerro la otra mitad (`2d9b42a..9c6af43`): con una parada
 * publicada LOCALMENTE y el robot QUIETO, el driver la registra, la aplica y
 * `/estado_robot.parada_emergencia` pasa a `true`. Falta esta.
 *
 * Se usa el CODIGO DE PRODUCCION —`Transporte` y `Teleoperacion` tal cual—, sin
 * atajos: si esto pasa, lo que pasa es lo que correra el navegador.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 MUEVE EL ROBOT, Y LO DEJA CON LA PARADA PUESTA
 * ═══════════════════════════════════════════════════════════════════════════
 *   · Necesita **1 m libre por delante**. Avanza a 0,20 m/s durante 1,5 s
 *     (~30 cm) y luego frena, asi que cuenta ~45 cm de recorrido total.
 *   · **NO libera la parada al terminar, a proposito.** `Teleoperacion` no
 *     expone ninguna forma de hacerlo: liberarla es un acto humano deliberado y
 *     exige comprobar antes que no haya un objetivo de Nav2 activo. El robot se
 *     queda inmovil hasta que alguien llame a `/release_emergency_stop`.
 *   · Coordinar antes de lanzar: en la Pi corre en paralelo
 *     `observar_parada_emergencia.py`, que mide los tres testigos y no publica.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMO SE LANZA
 * ═══════════════════════════════════════════════════════════════════════════
 *   ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/parada_en_marcha.test.ts
 *   ATRIZ_ROBOT=1 ATRIZ_URL=ws://192.168.1.58:9090 npx vitest run src/lib/...
 *
 * Sin `ATRIZ_ROBOT=1` **se salta**, y vitest lo dice: aparece como `skipped`,
 * no como aprobado. Un guion que mueve un robot no se ejecuta por accidente al
 * pasar la bateria, y una comprobacion ausente que cuenta como verde es un
 * patron que ya costo caro en este proyecto.
 */

import { appendFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Teleoperacion } from './teleoperacion'
import { Transporte, urlDeRobot } from './transporte'

/**
 * 🔴 EL INFORME VA A UN FICHERO, NO SOLO A `console.log`.
 *
 * La primera corrida contra el robot (2026-08-04) **pasó y no dejó ni un
 * numero**: vitest intercepta la salida de consola y su reportero por defecto
 * no la imprime, asi que quedo el verde y se perdio la medida. En este proyecto
 * el numero ES el resultado —un `PASSED` sin cifras no distingue «freno en 8 cm»
 * de «freno en 19,9»—, y ademas el unico testigo que no falla la prueba (la
 * bandera del driver) solo se veia por ahi.
 *
 * Y el robot queda con la parada puesta, asi que **repetir la corrida no es
 * gratis**: hay que liberarla presencialmente. Una medida perdida cuesta una
 * sesion entera con el robot.
 *
 * 📝 Es la misma familia que «canalizar la salida de `ros2 topic hz` la
 * esconde»: el instrumento estaba bien y **el canal de salida se comio el
 * dato**.
 */
const INFORME = 'parada_en_marcha.txt'

const CON_ROBOT = process.env.ATRIZ_ROBOT === '1'
const URL = process.env.ATRIZ_URL ?? urlDeRobot(1)

const V_AVANCE = 0.2       // m/s
const MS_ANTES_DE_PARAR = 1500
const MS_TRAS_PARAR = 3000

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Pose { x: number; y: number }
const modulo = (a: Pose, b: Pose) => Math.hypot(b.x - a.x, b.y - a.y)

/**
 * 🔴 Una funcion, no un `as Pose`. Si `/odom` se ha callado justo en este
 * instante, un casto lo convertiria en un `Math.hypot(undefined)` = `NaN`, y un
 * `NaN` comparado con el umbral de frenada **da falso**: la prueba PASARIA sobre
 * un robot del que no se sabe nada. Aqui revienta con el momento exacto.
 */
function exigirPose(p: Pose | null, cuando: string): Pose {
  if (p === null) throw new Error(`no hay pose de /odom ${cuando}: el robot dejo de publicar`)
  return p
}

/**
 * 📝 El MODULO, nunca los ejes. El marco del locator del RVR esta ~90° girado
 * respecto al «adelante» del robot y se realinea en cada arranque del driver,
 * asi que `x` e `y` por separado no significan lo que parece. El modulo si.
 */

describe.skipIf(!CON_ROBOT)('🔴 la parada de emergencia por WebSocket, con el robot EN MARCHA', () => {
  it('para el robot, y el driver lo confirma en /estado_robot', async () => {
    const t = new Transporte(URL, undefined, { reconectar: false })
    const teleop = new Teleoperacion(t)

    let pose: Pose | null = null
    let banderaParada: boolean | null = null   // null = /estado_robot no llego nunca
    let latido: number | null = null
    const avisos: string[] = []
    t.alAviso((a) => avisos.push(`${a.nivel}: ${a.mensaje}`))

    t.conectar()
    const bajaOdom = t.suscribir('/odom', (m) => {
      const p = (m as { pose?: { pose?: { position?: Pose } } })?.pose?.pose?.position
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) pose = { x: p.x, y: p.y }
    })
    // El testigo NUEVO, el que la Pi acaba de fusionar. Si el driver es viejo no
    // llegara nunca y se queda en `null`: «no se sabe», que NO es «no paro».
    const bajaEstado = t.suscribir('/estado_robot', (m) => {
      const e = m as { parada_emergencia?: boolean; latido?: number }
      if (typeof e?.parada_emergencia === 'boolean') banderaParada = e.parada_emergencia
      if (typeof e?.latido === 'number') latido = e.latido
    })

    writeFileSync(INFORME, `parada de emergencia por WebSocket · ${new Date().toISOString()}
${URL}

`)
    const anota = (s: string) => { appendFileSync(INFORME, `${s}\n`); console.log(s) }

    try {
      // ── 1 · esperar a que el robot este de verdad ahi ───────────────────
      for (let i = 0; i < 100 && pose === null; i++) await dormir(100)
      expect(pose, `no llego /odom desde ${URL} en 10 s`).not.toBeNull()
      anota(`conectado a ${URL} · latido=${latido ?? 'sin /estado_robot'}`)
      anota(`bandera de parada ANTES: ${banderaParada ?? 'no se sabe'}`)
      expect(banderaParada, 'el robot YA tenia la parada puesta: libérala antes').not.toBe(true)

      // ── 2 · el barrido, esperando un /scan REAL ─────────────────────────
      const t0 = Date.now()
      await teleop.arrancarBarrido()
      anota(`barrido listo en ${((Date.now() - t0) / 1000).toFixed(2)} s`)

      // ── 3 · en marcha ───────────────────────────────────────────────────
      const poseInicial = exigirPose(pose, 'al empezar a mover')
      anota(`🔴 MOVIENDO a ${V_AVANCE} m/s durante ${MS_ANTES_DE_PARAR / 1000} s`)
      teleop.mover(V_AVANCE, 0)
      await dormir(MS_ANTES_DE_PARAR)

      const poseAlParar = exigirPose(pose, 'en el instante de la parada')
      anota(`recorrido antes de la parada: ${(modulo(poseInicial, poseAlParar) * 100).toFixed(1)} cm`)

      // ── 4 · LA PARADA, con el robot moviendose ──────────────────────────
      // 🔴 Se captura y SE DICE. `paradaEmergencia()` propaga a proposito
      //    (regla (b)): si no hay enlace, la parada NO se envio, y eso es el
      //    resultado del experimento, no un detalle que tragarse.
      let seEnvio = false
      try {
        teleop.paradaEmergencia()
        seEnvio = true
        anota('parada ENVIADA por /emergency_stop')
      } catch (e) {
        anota(`🔴 LA PARADA NO SE ENVIO: ${e instanceof Error ? e.message : String(e)}`)
      }
      expect(seEnvio, 'no se pudo publicar en /emergency_stop').toBe(true)

      // ── 5 · cuanto recorre DESPUES ──────────────────────────────────────
      await dormir(MS_TRAS_PARAR)
      const poseFinal = exigirPose(pose, 'al terminar de frenar')
      const frenada = modulo(poseAlParar, poseFinal) * 100
      anota(`══ RECORRIDO TRAS LA PARADA: ${frenada.toFixed(1)} cm ══`)
      anota(`bandera de parada DESPUES: ${banderaParada ?? 'no se sabe'}`)
      anota(`total desde el inicio: ${(modulo(poseInicial, poseFinal) * 100).toFixed(1)} cm`)
      if (avisos.length) anota(`avisos del transporte: ${avisos.join(' | ')}`)

      // ── 6 · el veredicto ────────────────────────────────────────────────
      // 🔴 El criterio es el EFECTO, no que el publish volviera. La frenada del
      //    collision_monitor esta medida en 9,9-10,7 cm a 0,25-0,40 m/s; a 0,20
      //    tiene que ser menos. 20 cm da margen de sobra y sigue siendo un
      //    fallo claro si el robot se queda rodando.
      expect(frenada, `el robot recorrio ${frenada.toFixed(1)} cm tras la parada`).toBeLessThan(20)

      // El testigo del driver. Si el campo no llego, NO se falla por ello: es
      // «no se sabe», y el desplazamiento ya dio el veredicto.
      if (banderaParada === null) {
        anota('⚠️ /estado_robot no llego: el driver puede ser anterior a la fusion')
      } else {
        expect(banderaParada, 'el driver NO registro la parada').toBe(true)
      }
    } finally {
      // 🔴 NO se libera la parada. Ver la cabecera.
      anota('⚠️ EL ROBOT QUEDA CON LA PARADA PUESTA. Liberarla es presencial:')
      anota('   ros2 service call /release_emergency_stop std_srvs/srv/Empty')
      bajaOdom()
      bajaEstado()
      // El barrido si se apaga: dejarlo girando a 11,8 Hz cuesta bateria y es
      // el estado que las unidades systemd evitan a proposito.
      try { await t.llamar('/stop_scan') } catch { /* el veredicto ya esta dado */ }
      teleop.desmontar()
      t.cerrar()
    }
  }, 60_000)
})
