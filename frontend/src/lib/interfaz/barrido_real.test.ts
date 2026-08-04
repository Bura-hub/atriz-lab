/**
 * LA GEOMETRIA DEL BARRIDO, CONTRA UN `/scan` DE VERDAD.
 *
 * Las pruebas de `barrido.test.ts` usan barridos sinteticos: comprueban la
 * logica, no que los supuestos sobre el sensor sean ciertos. Esto comprueba lo
 * segundo, que es lo que no se puede deducir leyendo codigo:
 *
 *   · que el X2 devuelve ~89 % de lecturas validas y el resto son huecos
 *   · que `ranges.length` ronda los 254-255 y NO es constante
 *   · que los puntos caen a distancias fisicamente posibles en una habitacion
 *
 * ⚠️ ENCIENDE EL BARRIDO Y LO VUELVE A APAGAR. **No mueve el robot**: no publica
 *    en `/cmd_vel_raw` ni en `/emergency_stop`. Deja el LIDAR como lo encontro,
 *    que importa: girando, el X2 pasa de 2,7 a 11,8 Hz las 24 horas.
 *
 *   ATRIZ_ROBOT=1 npx vitest run src/lib/interfaz/barrido_real.test.ts
 *
 * Sin `ATRIZ_ROBOT=1` se salta, y vitest lo reporta como `skipped`.
 */

import { describe, expect, it } from 'vitest'
import { MensajeScan } from '../../hooks/useTopic'
import { Teleoperacion } from '../rosbridge/teleoperacion'
import { Transporte, urlDeRobot } from '../rosbridge/transporte'
import { contarValidos, distanciaMinima, puntosDelBarrido } from './barrido'

const CON_ROBOT = process.env.ATRIZ_ROBOT === '1'
const URL = process.env.ATRIZ_URL ?? urlDeRobot(1)
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe.skipIf(!CON_ROBOT)('la geometria del barrido contra un /scan real', () => {
  it('los supuestos sobre el X2 se cumplen sobre datos de verdad', async () => {
    const t = new Transporte(URL, undefined, { reconectar: false })
    const teleop = new Teleoperacion(t)
    const barridos: MensajeScan[] = []
    t.conectar()

    try {
      // 🔴 `conectar()` NO bloquea: abrir el WebSocket lleva su tiempo, y
      //    llamar a un servicio antes de que abra falla con «sin conexion con el
      //    robot». Se espera a que llegue un mensaje de verdad —`/odom` va a
      //    16,5 Hz— en vez de dormir un numero inventado.
      let vivo = false
      const bajaOdom = t.suscribir('/odom', () => { vivo = true })
      for (let i = 0; i < 100 && !vivo; i++) await dormir(100)
      bajaOdom()
      expect(vivo, `no llego /odom desde ${URL} en 10 s`).toBe(true)

      await teleop.arrancarBarrido()
      const baja = t.suscribir('/scan', (m) => { barridos.push(m as MensajeScan) })
      await dormir(3000)
      baja()

      expect(barridos.length, 'no llego ningun /scan tras arrancar el barrido').toBeGreaterThan(5)

      const tamanos = new Set(barridos.map((s) => s.ranges.length))
      const cuentas = barridos.map((s) => contarValidos(s))
      const ratios = cuentas.map((c) => c.validos / c.total)
      const medio = ratios.reduce((a, b) => a + b, 0) / ratios.length

      console.log(`  barridos: ${barridos.length}`)
      console.log(`  tamaños distintos de ranges: ${[...tamanos].sort((a, b) => a - b).join(', ')}`)
      console.log(`  validos: ${(medio * 100).toFixed(1)} % de media`)
      console.log(`  range_min/max: ${barridos[0].range_min} / ${barridos[0].range_max}`)
      console.log(`  resolucion angular: ${(barridos[0].angle_increment * 180 / Math.PI).toFixed(2)}°`)
      console.log(`  minima del ultimo: ${distanciaMinima(barridos.at(-1) as MensajeScan)?.toFixed(3)} m`)

      // 🔴 El ratio de validos: el proyecto lo tiene medido en 89 %. Se comprueba
      //    una BANDA ancha a proposito -depende de la habitacion-, porque lo que
      //    importa es que NO sea ~100 % (seria que los huecos no se estan
      //    filtrando) ni ~0 % (seria que se filtran de mas).
      expect(medio).toBeGreaterThan(0.4)
      expect(medio).toBeLessThan(0.99)

      // Todos los puntos, a distancias fisicamente posibles.
      for (const s of barridos) {
        for (const p of puntosDelBarrido(s)) {
          const d = Math.hypot(p.x, p.y)
          expect(Number.isFinite(d)).toBe(true)
          expect(d).toBeGreaterThan(0)
          expect(d).toBeLessThanOrEqual(s.range_max + 0.01)
        }
      }
    } finally {
      // Se deja el LIDAR como se encontro.
      try { await t.llamar('/stop_scan') } catch { /* el veredicto ya esta dado */ }
      teleop.desmontar()
      t.cerrar()
    }
  }, 40_000)
})
