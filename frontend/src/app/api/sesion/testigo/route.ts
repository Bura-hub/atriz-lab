/**
 * EL TESTIGO QUE ABRE EL TERMINAL DE UN ROBOT.
 *
 * `GET /api/sesion/testigo?robot=NN` → `{ testigo }`, firmado con Ed25519 para
 * que el agente de sesion de ESE robot lo verifique.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ES LA PRIMERA VEZ QUE ESTE SERVIDOR AUTORIZA ALGO EN UN ROBOT
 * ═══════════════════════════════════════════════════════════════════════════
 * Hasta hoy la sesion de esta web **protegia la interfaz y no el robot**: el
 * navegador habla directo con rosbridge y el servidor no esta en ese camino.
 * Aqui si: sin sesion no hay testigo, y sin testigo el agente **cierra la
 * conexion**. El terminal es lo unico de esta aplicacion que de verdad exige
 * haber entrado.
 *
 * Por eso devuelve **401 y no un 200 vacio**, al contrario que `/quien`: esto no
 * es una pregunta —«¿quien soy?»— sino una puerta, y llamar a una puerta sin
 * llave si es un fallo de autorizacion. Es el mismo criterio que `/usuarios`.
 *
 * ⚠️ **No comprueba reservas ni quien tiene el robot.** No hay sistema de
 *    reservas: el profesor asigna, y el arbitraje de quien esta ejecutando lo
 *    hace el AGENTE, que es el unico que sabe si hay algo corriendo. Este
 *    endpoint contesta a «¿quien eres?», no a «¿te toca?».
 */

import { NextRequest, NextResponse } from 'next/server'
import { noAutorizado, sesionDe } from '@/lib/sesion/peticion'
import { clavePrivadaDe, firmarTestigoRobot } from '@/lib/sesion/testigo_robot'
import { interpretarIdRobot } from '@/lib/interfaz/identidad'

/**
 * 🔴 500 CON UNA FRASE QUE DICE QUE FALTA, igual que `faltaSecreto()`.
 *
 * Sin la clave, este servidor **arrancaria igual** y todo lo demas seguiria
 * funcionando: el fallo solo aparecería al abrir el terminal, y como un socket
 * que no abre. Quien despliegue tiene que poder leer lo que le pasa.
 */
function faltaClave(): NextResponse {
  return NextResponse.json(
    {
      error: 'Falta ATRIZ_CLAVE en el servidor, así que no se pueden firmar testigos para los '
        + 'robots. Es una clave privada Ed25519 en formato PEM (PKCS#8). Se genera con '
        + '«node herramientas/generar_clave.mjs», y la mitad pública va en cada robot.',
    },
    { status: 500 },
  )
}

export function GET(pet: NextRequest) {
  const usuario = sesionDe(pet)
  if (usuario === null) return noAutorizado()

  /*
   * 🔴 SE REUTILIZA `interpretarIdRobot`, que es la misma funcion con la que el
   *    layout de `/robot/[id]` decide si una ruta existe. Acepta 1..16 y una
   *    IPv4 literal —el camino de escape cuando mDNS falla—, y NADA MAS.
   *
   * Aqui solo vale el NUMERO: el testigo lleva `rob` y el agente lo compara con
   * el suyo. Un robot alcanzado por IP no tiene numero que comparar, asi que se
   * rechaza en vez de firmar algo que no abriria — y se dice por que.
   */
  const crudo = pet.nextUrl.searchParams.get('robot') ?? ''
  const destino = interpretarIdRobot(crudo)
  if (destino === null || destino.clase !== 'NUMERO') {
    return NextResponse.json(
      {
        error: 'Hace falta el número del robot, de 1 a 16. Un robot alcanzado por IP no tiene '
          + 'número que el agente pueda comparar con el suyo, así que no se le puede firmar un testigo.',
      },
      { status: 400 },
    )
  }

  const clave = clavePrivadaDe(process.env.ATRIZ_CLAVE)
  if (clave === null) return faltaClave()

  const testigo = firmarTestigoRobot(clave, { usuario, robot: destino.numero, ahoraMs: Date.now() })
  /*
   * ⚠️ `no-store`. Un testigo cacheado por el navegador —o peor, por algo en
   *    medio— lo reutilizaria despues de caducar, y el sintoma seria «el
   *    terminal no abre» de forma intermitente, que es lo mas caro de perseguir.
   */
  return NextResponse.json({ testigo }, { headers: { 'Cache-Control': 'no-store' } })
}
