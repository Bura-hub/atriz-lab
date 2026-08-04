/**
 * 🔑 LA FRONTERA DE LA CONEXION: aqui se abre el WebSocket de ESTE robot y aqui
 * se cierra al salir.
 *
 * 🔴 ESTE FICHERO ES UN COMPONENTE DE SERVIDOR, y tiene que seguir siendolo. Los
 * `layout.tsx` del App Router lo son por defecto, y lo unico que hace de servidor
 * es lo que se ve abajo: leer `params` y decidir si el segmento nombra un robot.
 * Todo lo que toca React en el navegador -el proveedor del contexto, el
 * `Transporte`, los efectos- vive en `<MarcoRobot>`, que lleva su `'use client'`.
 *
 * Si el `'use client'` se olvidara, Next falla en tiempo de ejecucion con un
 * mensaje que **no habla de WebSockets** y manda a buscar donde no es.
 *
 * ⚠️ `params` es una PROMESA en Next 15: hay que esperarla.
 */

import { notFound } from 'next/navigation'
import { ReactNode } from 'react'
import { MarcoRobot } from '@/componentes/robot/MarcoRobot'
import { interpretarIdRobot } from '@/lib/interfaz/identidad'

export default async function DisposicionRobot({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const destino = interpretarIdRobot(id)

  // 🔴 404 en vez de «robot por defecto». Este segmento decide a que maquina abre
  //    un WebSocket el navegador del alumno: mandarle al robot 1 porque escribio
  //    mal la URL seria moverle un robot que no pidio.
  if (destino === null) notFound()

  return <MarcoRobot destino={destino}>{children}</MarcoRobot>
}
