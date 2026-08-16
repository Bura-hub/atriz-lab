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
import { FALLOS_POR_CLIENTE, claveDeCliente } from '@/lib/sesion/cliente'
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

  /*
   * ── EL CUBO POR CLIENTE, Y VA PRIMERO ──────────────────────────────────────
   *
   * 🔴 EL ORDEN NO ES ARBITRARIO: el 429 tiene que llegar **antes** de que el
   *    423 pueda hablar. Esta ruta se esfuerza en no filtrar si una cuenta
   *    existe —verifica contra un hash de relleno para que el tiempo no lo
   *    delate— y luego el bloqueo por usuario lo delataba igual, porque **solo
   *    se bloquea lo que existe**. Con el cubo de cliente delante, quien barre
   *    nombres choca con su propio limite antes de aprender nada.
   *
   * 🔴 Y cierra el otro hueco: el contador por nombre se REINICIA en cada
   *    nombre, asi que probar `alumno-01`, `alumno-02`… nunca se bloqueaba. Con
   *    dieciseis nombres predecibles —justo los que crea el alta por lote— eso
   *    deja de ser teorico.
   *
   * ⚠️ Sin proxy delante todos los clientes comparten cubo (ver `cliente.ts`).
   *    Por eso el umbral es MUCHO mas alto: tiene que estorbar al barrido sin
   *    dejar fuera a una clase entera por un alumno torpe.
   */
  const cliente = claveDeCliente(pet.headers)
  const previoCliente = intentosDe(cliente)
  const faltanCliente = segundosQueFaltan(previoCliente, ahora)
  if (faltanCliente > 0) {
    return NextResponse.json(
      { error: 'Demasiados intentos desde aquí. Espera un momento.', segundos: faltanCliente },
      { status: 429 },
    )
  }

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
    // Los DOS cubos suben con cada fallo, cada uno con su umbral.
    anotarIntentos(cliente, trasFallar(previoCliente, ahora, FALLOS_POR_CLIENTE))
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

  // 🔴 Acertar limpia los DOS. Si el cubo de cliente no se limpiara, un aula sin
  //    proxy —donde los 16 comparten clave— acumularia los fallos de toda la
  //    mañana y acabaria bloqueando a quien nunca fallo.
  anotarIntentos(usuario, trasAcertar())
  anotarIntentos(cliente, trasAcertar())
  return conSesion(usuario, { usuario })
}
