/**
 * LO QUE COMPARTEN LAS CUATRO RUTAS: leer la cookie y decidir si hay sesión.
 *
 * 🔴 EXISTE PARA QUE LA COMPROBACIÓN SE ESCRIBA UNA VEZ. Cuatro rutas copiando
 *    «lee la cookie, abre el testigo, mira la caducidad» son cuatro sitios donde
 *    olvidarse de un paso — y el paso que se olvida siempre es el mismo, mirar
 *    la firma. Aquí no se puede: `sesionDe()` no tiene forma de devolver un
 *    usuario sin haber validado.
 */

import { NextRequest, NextResponse } from 'next/server'
import { DURACION_SESION_MS, firmar, abrir } from './testigo'
import { secreto } from './almacen'

export const COOKIE = 'atriz_sesion'

/**
 * El usuario de esta petición, o `null`.
 *
 * ⚠️ `null` significa las CUATRO cosas a la vez —no hay cookie, está mal
 *    formada, la firma no cuadra, o caducó— y es correcto que no las distinga:
 *    la respuesta al cliente es la misma (401) en los cuatro casos. Decir cuál
 *    de los cuatro fue le diría a quien prueba si va por buen camino.
 */
export function sesionDe(pet: NextRequest): string | null {
  const s = secreto()
  if (s === null) return null

  const crudo = pet.cookies.get(COOKIE)?.value
  if (crudo === undefined) return null

  const r = abrir(crudo, s, Date.now())
  return r.valido ? r.carga.usuario : null
}

/** Respuesta con la cookie de sesión puesta. */
export function conSesion(usuario: string, cuerpo: unknown, estado = 200): NextResponse {
  const s = secreto()
  if (s === null) return faltaSecreto()

  const res = NextResponse.json(cuerpo, { status: estado })
  res.cookies.set(COOKIE, firmar({ usuario, exp: Date.now() + DURACION_SESION_MS }, s), {
    /*
     * 🔴 `httpOnly` ES LA LÍNEA QUE HACE ÚTIL A TODO ESTO. Sin ella, el testigo
     *    se lee y se escribe desde la consola del navegador, y el gesto más
     *    probable de todos —ponerse una sesión a mano— quedaría abierto. Es,
     *    además, el único ataque que este trabajo puede cerrar de verdad: contra
     *    quien habla directo con rosbridge no protege nada, y eso está dicho en
     *    pantalla.
     */
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(DURACION_SESION_MS / 1000),
    /*
     * ⚠️ `secure` SOLO EN PRODUCCIÓN, y no por comodidad: el laboratorio corre
     *    hoy en `http://192.168.1.2:3000`, sin TLS. Con `secure: true` el
     *    navegador descartaría la cookie sin decir nada y el inicio de sesión
     *    «no haría nada» — el modo de fallo favorito de este proyecto.
     */
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}

/** Respuesta que borra la cookie. */
export function sinSesion(): NextResponse {
  const res = new NextResponse(null, { status: 204 })
  res.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}

export function noAutorizado(): NextResponse {
  return NextResponse.json({ error: 'Hace falta una sesión.' }, { status: 401 })
}

/**
 * 🔴 500 CON UNA FRASE QUE DICE QUÉ FALTA, no una traza. Quien despliegue sin
 *    `ATRIZ_SECRETO` tiene que leer lo que le pasa, no deducirlo.
 */
export function faltaSecreto(): NextResponse {
  return NextResponse.json(
    {
      error: 'Falta ATRIZ_SECRETO en el servidor, así que no se pueden firmar sesiones. '
        + 'Es una variable de entorno de al menos 16 caracteres.',
    },
    { status: 500 },
  )
}
