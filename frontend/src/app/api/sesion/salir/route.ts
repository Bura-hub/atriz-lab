/**
 * SALIR. Borra la cookie y ya.
 *
 * 📝 Responde 204 SIEMPRE, haya sesión o no. Salir sin estar dentro no es un
 *    error del que haya que informar, y devolver 401 aquí obligaría a la
 *    pantalla a distinguir dos casos que terminan igual: fuera.
 */

import { sinSesion } from '@/lib/sesion/peticion'

export function POST() {
  return sinSesion()
}
