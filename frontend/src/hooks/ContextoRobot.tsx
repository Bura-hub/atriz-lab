'use client'

/**
 * El contexto que POSEE el `Transporte` de UN robot.
 *
 * 🔴 UN PROVEEDOR POR ROBOT, Y ESO ES UN WEBSOCKET POR ROBOT. No es un detalle
 * de implementacion: es la arquitectura. Al robot lo identifica la CONEXION -no
 * hay namespace, los topics son `/odom` y no `/rvr_01/odom`-, asi que el mismo
 * codigo sirve para los 16 y un muro de 16 baldosas abre 16 sockets. Anidar dos
 * proveedores para «ver dos robots en la misma vista» funciona: el de dentro
 * gana para sus hijos.
 *
 * 🔴 Y lo que el proveedor NO hace: suscribirse a nada. Quien monta el socket no
 * decide que topics se pagan -eso es de cada vista, con `useTopic`-, porque el
 * ancho de banda del aula lo decide la suma de las 16 (ver
 * `lib/flota/presupuesto.ts`).
 */

import { ReactNode, createContext, useContext, useMemo } from 'react'
import { Aviso, Transporte, urlDeRobot } from '../lib/rosbridge/transporte'
import { ControlTeleoperacion, useTeleoperacion } from './useTeleoperacion'
import { FabricaWS, useTransporte } from './useTransporte'

export interface ValorContextoRobot {
  /** El numero de robot (1-16) o el host/IP con el que se abrio la conexion. */
  robot: number | string
  transporte: Transporte
  conectado: boolean
  ultimoAviso: Aviso | null
  /**
   * 🔴 UNA SOLA TELEOPERACION POR CONEXION, Y VIVE AQUI POR UN MOTIVO MEDIDO.
   *
   * `useTeleoperacion` construye una `Teleoperacion` NUEVA en cada componente
   * que lo llama (`useMemo` local). Con la parada en el marco y otra en
   * `/conducir` habria **dos**, y cada una con su bucle de `setInterval` a
   * 10 Hz publicando en `/cmd_vel_raw`. `BotonParada` ya exigia recibirla en
   * vez de crearla justamente para evitar eso; subirla al proveedor lo hace
   * imposible por construccion en vez de por convencion.
   *
   * Y el ciclo de vida encaja: el proveedor es la frontera de la conexion, asi
   * que cambiar de robot desmonta la teleoperacion vieja -y `desmontar()` corta
   * su bucle- antes de abrir la nueva.
   */
  teleoperacion: ControlTeleoperacion
}

const Contexto = createContext<ValorContextoRobot | null>(null)

/**
 * 🔴 Lanza en vez de devolver `null`. Un `useRobot()` fuera del proveedor
 * devolviendo `null` haria que la vista se quedara «cargando» para siempre, sin
 * un solo error -el patron de fallo silencioso que este proyecto lleva media
 * docena de veces pagando-. Se separa del hook para poder probarla sin React.
 */
export function exigirContextoRobot(valor: ValorContextoRobot | null): ValorContextoRobot {
  if (valor === null) {
    throw new Error(
      'useRobot() se ha llamado fuera de un <ProveedorRobot>: no hay ningun Transporte que usar. ' +
        'Envuelve la vista en <ProveedorRobot robot={NN}>.',
    )
  }
  return valor
}

export interface PropsProveedorRobot {
  /** Numero de robot (1-16), o un host/IP como override. */
  robot: number | string
  /** Solo para pruebas. En el navegador se deja sin pasar. */
  fabrica?: FabricaWS
  children: ReactNode
}

export function ProveedorRobot({ robot, fabrica, children }: PropsProveedorRobot) {
  // `rvr-NN.local` por mDNS, con la IP como override: es lo que hace que el
  // mismo codigo funcione en casa y en el laboratorio sin tocar nada.
  const url = useMemo(() => urlDeRobot(robot), [robot])
  const { transporte, conectado, ultimoAviso } = useTransporte(url, fabrica)
  // La unica de este robot. Ver el comentario de `ValorContextoRobot`.
  const teleoperacion = useTeleoperacion(transporte)

  const valor = useMemo<ValorContextoRobot>(
    () => ({ robot, transporte, conectado, ultimoAviso, teleoperacion }),
    [robot, transporte, conectado, ultimoAviso, teleoperacion],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useRobot(): ValorContextoRobot {
  return exigirContextoRobot(useContext(Contexto))
}
