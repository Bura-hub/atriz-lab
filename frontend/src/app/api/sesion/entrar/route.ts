/**
 * ENTRAR. El único sitio donde se comprueba una contraseña.
 *
 * ⚠️ Los códigos de estado son los de `SIVE_App` a propósito —401, 423, 429—,
 *    porque la pantalla los discrimina igual que la suya y así las dos hablan el
 *    mismo idioma para quien mantiene los dos proyectos.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verificar } from '@/lib/sesion/credenciales'
import { normalizar } from '@/lib/sesion/reglas'
import { segundosQueFaltan, trasAcertar, trasFallar } from '@/lib/sesion/bloqueo'
import { anotarIntentos, intentosDe, leerCuentas, secreto } from '@/lib/sesion/almacen'
import { conSesion, faltaSecreto } from '@/lib/sesion/peticion'

export async function POST(pet: NextRequest) {
  if (secreto() === null) return faltaSecreto()

  let cuerpo: { usuario?: unknown; contrasena?: unknown }
  try {
    cuerpo = await pet.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo ilegible.' }, { status: 400 })
  }
  if (typeof cuerpo.usuario !== 'string' || typeof cuerpo.contrasena !== 'string') {
    return NextResponse.json({ error: 'Hacen falta usuario y contraseña.' }, { status: 400 })
  }

  const usuario = normalizar(cuerpo.usuario)
  const ahora = Date.now()

  // ── El bloqueo, ANTES de mirar nada más ────────────────────────────────────
  // Comprobarlo después de verificar la contraseña dejaría probar contraseñas a
  // ritmo libre mientras el contador sube: el bloqueo tiene que cortar el
  // trabajo, no solo la respuesta.
  const previo = intentosDe(usuario)
  const faltan = segundosQueFaltan(previo, ahora)
  if (faltan > 0) {
    return NextResponse.json(
      { error: 'Cuenta bloqueada temporalmente.', segundos: faltan },
      { status: 423 },
    )
  }

  const cuentas = await leerCuentas()
  const cuenta = cuentas.find((c) => c.usuario === usuario)

  /*
   * 🔴 SE VERIFICA AUNQUE LA CUENTA NO EXISTA, contra un hash de mentira.
   *
   * Si se saliera antes con «no existe», el tiempo de respuesta separaría los
   * nombres reales de los inventados: probando mil nombres se sabría cuáles
   * existen sin acertar ni una contraseña. `scrypt` es lento a propósito, así
   * que esa diferencia es de milisegundos y se mide desde fuera.
   *
   * 📝 El hash de relleno es sintácticamente válido, así que `verificar()`
   *    recorre el mismo camino que con uno real y devuelve `false`.
   */
  const relleno = `${'0'.repeat(32)}:${'0'.repeat(128)}`
  const correcta = await verificar(cuerpo.contrasena, cuenta?.clave ?? relleno)

  if (cuenta === undefined || !correcta) {
    const ahoraFallos = trasFallar(previo, ahora)
    anotarIntentos(usuario, ahoraFallos)
    const castigo = segundosQueFaltan(ahoraFallos, ahora)
    if (castigo > 0) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera antes de volver a probar.', segundos: castigo },
        { status: 429 },
      )
    }
    // 🔴 «Usuario o contraseña incorrectos», nunca «ese usuario no existe»:
    //    decir cuál de los dos falla regala la mitad del par.
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 })
  }

  anotarIntentos(usuario, trasAcertar())
  return conSesion(usuario, { usuario })
}
