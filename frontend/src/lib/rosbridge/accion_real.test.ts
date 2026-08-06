/**
 * EL CLIENTE DE ACCIONES CONTRA EL ROSBRIDGE DE VERDAD.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE ESTE FICHERO EXISTE, TENIENDO YA SIETE PRUEBAS DE ACCIONES
 * ═══════════════════════════════════════════════════════════════════════════
 * Las de `transporte.test.ts` corren contra `WSFalso`, o sea contra **mi idea**
 * de lo que contesta rosbridge. Si esa idea es incorrecta, las siete pasan y el
 * cliente no funciona — que es exactamente como este proyecto se quemo con
 * `ros2 topic hz`, con `spin_once` y con el `mensajes/duracion`: el doble
 * confirmando al autor.
 *
 * Esto habla con rvr-01. Cuesta unos segundos y no se ejecuta por accidente.
 *
 *   ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/accion_real.test.ts
 *   ATRIZ_ROBOT=1 ATRIZ_URL=ws://192.168.1.200:9090 npx vitest run ...
 *
 * Sin `ATRIZ_ROBOT=1` se salta, y vitest lo reporta como `skipped`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ NO MUEVE EL ROBOT — Y SE ASEGURA DE ELLO ANTES DE MANDAR NADA
 * ═══════════════════════════════════════════════════════════════════════════
 * Manda un objetivo a `/navigate_to_pose`, y eso **moveria el robot si Nav2
 * estuviera corriendo**. `atriz-nav.service` esta instalado y NO habilitado a
 * proposito, asi que normalmente no lo esta — pero «normalmente» no es una
 * garantia, y aqui una suposicion equivocada empuja un robot de verdad.
 *
 * Por eso lo primero que hace es COMPROBAR que Nav2 esta parado, mirando si
 * llegan `/amcl_pose` o `/map`. Si llega alguno, aborta con un mensaje que dice
 * que hay que parar `atriz-nav` antes. Comprobar es barato; adivinar no.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Transporte } from './transporte'

const CON_ROBOT = process.env.ATRIZ_ROBOT === '1'
const URL = process.env.ATRIZ_URL ?? 'ws://rvr-01.local:9090'

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe.skipIf(!CON_ROBOT)('acciones contra el rosbridge real', () => {
  let t: Transporte

  beforeAll(async () => {
    t = new Transporte(URL, (u) => new WebSocket(u))
    t.conectar()
    // La resolucion mDNS en frio son ~2,8 s: esperar poco daria un falso
    // «no conecta» que este proyecto ya se ha creido una vez hoy.
    for (let i = 0; i < 40 && !t.conectado; i += 1) await dormir(500)
    expect(t.conectado, `no se pudo abrir ${URL}`).toBe(true)

    // ── LA SALVAGUARDA ────────────────────────────────────────────────────
    let señalesDeNav2 = 0
    const bajas = [
      t.suscribir('/amcl_pose', () => { señalesDeNav2 += 1 }),
      t.suscribir('/map', () => { señalesDeNav2 += 1 }),
    ]
    await dormir(4000)
    for (const b of bajas) b()
    expect(
      señalesDeNav2,
      'llegan /amcl_pose o /map: NAV2 ESTA CORRIENDO y este objetivo MOVERIA el robot. '
      + 'Para atriz-nav antes de ejecutar esta prueba.',
    ).toBe(0)
  }, 45000)

  afterAll(() => { t?.cerrar() })

  it('🔴 sin servidor de accion, el cliente RECHAZA con el motivo real del robot', async () => {
    /*
     * Medido a mano el 2026-08-06 antes de escribir el cliente:
     *   {"op":"action_result","action":"/navigate_to_pose",
     *    "values":"No action server available","status":0,"result":false,"id":"act1"}
     *
     * Lo que esta prueba fija es que el cliente lo trata como FALLO y conserva
     * el motivo. Si lo resolviera como exito, la pantalla recibiria la cadena
     * «No action server available» donde espera un resultado — y lo pintaria.
     */
    const { resultado } = t.enviarObjetivo(
      '/navigate_to_pose',
      'nav2_msgs/action/NavigateToPose',
      {
        pose: {
          header: { frame_id: 'map' },
          pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        },
      },
      { ms: 20000 },
    )
    await expect(resultado).rejects.toThrow(/No action server available/i)
  }, 30000)

  it('🔴 una accion fuera de la lista blanca no llega ni a salir por el cable', () => {
    // El robot la denegaria EN SILENCIO —medido: cero mensajes `op=status`—, asi
    // que el cliente tiene que pararla aqui o el sintoma seria «no contesta».
    expect(() => t.enviarObjetivo('/inventada', 'x/action/Y', {})).toThrowError(/acciones/i)
  })
})
