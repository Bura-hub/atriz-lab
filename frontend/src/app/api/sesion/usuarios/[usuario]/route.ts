/**
 * UNA CUENTA CONCRETA: borrarla, resetear su contraseña, cambiarle el rol.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 NO DECIDE NADA: TODAS LAS REGLAS ESTAN EN `administracion.ts`
 * ═══════════════════════════════════════════════════════════════════════════
 * Aqui solo se lee el cuerpo, se llama a la regla y se traduce su motivo a un
 * codigo. Y no es por elegancia: la regla que impide **borrar al ultimo
 * profesor** es irreversible desde la interfaz —deja la instalacion sin nadie
 * capaz de crear cuentas— y dentro de un `route.ts` **no se puede probar sin
 * levantar un servidor**. Fuera, es una funcion que recibe una lista y devuelve
 * un motivo, y tiene sus dieciocho pruebas.
 *
 * ⚠️ LOS CODIGOS: 401 «no hay sesion» · 403 «hay sesion y no llega» · 404 «esa
 *    cuenta no existe» · 409 «la regla del ultimo profesor» · 422 «la contraseña
 *    nueva no vale». Distinguir 401 de 403 importa: con un 401 la persona vuelve
 *    a entrar creyendo que caduco, y no era eso.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  buscar, porQueNoSePuedeBorrar, porQueNoSePuedeCambiarClave, porQueNoSePuedeCambiarRol,
} from '@/lib/sesion/administracion'
import { hashear, verificar } from '@/lib/sesion/credenciales'
import { MINIMO_CONTRASENA, normalizar, type Rol } from '@/lib/sesion/reglas'
import { guardarCuentas, leerCuentas } from '@/lib/sesion/almacen'
import { cuentaDeSesion, noAutorizado, sesionDe } from '@/lib/sesion/peticion'

type Contexto = { params: Promise<{ usuario: string }> }

/** El 404 y el 409 salen del mismo motivo: se separan por su texto. */
const codigoDe = (motivo: string): number => {
  if (/no existe/i.test(motivo)) return 404
  if (/ultimo profesor/i.test(motivo)) return 409
  return 403
}

export async function DELETE(pet: NextRequest, ctx: Contexto) {
  if (sesionDe(pet) === null) return noAutorizado()
  const quien = await cuentaDeSesion(pet)
  const objetivo = normalizar((await ctx.params).usuario)
  const cuentas = await leerCuentas()

  const motivo = porQueNoSePuedeBorrar(cuentas, quien, objetivo)
  if (motivo !== null) return NextResponse.json({ error: motivo }, { status: codigoDe(motivo) })

  await guardarCuentas(cuentas.filter((c) => normalizar(c.usuario) !== objetivo))
  return NextResponse.json({ usuario: objetivo, borrada: true })
}

export async function PATCH(pet: NextRequest, ctx: Contexto) {
  if (sesionDe(pet) === null) return noAutorizado()
  const quien = await cuentaDeSesion(pet)
  const objetivo = normalizar((await ctx.params).usuario)

  let cuerpo: { contrasena?: unknown; actual?: unknown; rol?: unknown }
  try {
    cuerpo = await pet.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo ilegible.' }, { status: 400 })
  }

  const cuentas = await leerCuentas()

  // ── Cambiar el rol ─────────────────────────────────────────────────────────
  if (cuerpo.rol !== undefined) {
    if (cuerpo.rol !== 'profesor' && cuerpo.rol !== 'alumno') {
      return NextResponse.json({ error: 'El rol es «profesor» o «alumno».' }, { status: 400 })
    }
    const nuevo = cuerpo.rol as Rol
    const motivo = porQueNoSePuedeCambiarRol(cuentas, quien, objetivo, nuevo)
    if (motivo !== null) return NextResponse.json({ error: motivo }, { status: codigoDe(motivo) })

    await guardarCuentas(cuentas.map((c) =>
      (normalizar(c.usuario) === objetivo ? { ...c, rol: nuevo } : c)))
    return NextResponse.json({ usuario: objetivo, rol: nuevo })
  }

  // ── Cambiar la contraseña ──────────────────────────────────────────────────
  if (typeof cuerpo.contrasena !== 'string') {
    return NextResponse.json({ error: 'Hace falta una contraseña nueva o un rol.' }, { status: 400 })
  }
  if (cuerpo.contrasena.length < MINIMO_CONTRASENA) {
    return NextResponse.json(
      { error: `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.` },
      { status: 422 },
    )
  }
  /*
   * 🔴 Y no puede contener el nombre, igual que en el alta. Sin esto, el reseteo
   *    seria la puerta de atras de una regla que el alta si comprueba: quedaria
   *    una contraseña que `revisarAlta` habria rechazado, creada por el mismo
   *    formulario dos clics despues.
   */
  if (cuerpo.contrasena.toLowerCase().includes(objetivo)) {
    return NextResponse.json(
      { error: 'La contraseña no puede contener el nombre de usuario.' },
      { status: 422 },
    )
  }

  const { motivo, exigeLaActual } = porQueNoSePuedeCambiarClave(cuentas, quien, objetivo)
  if (motivo !== null) return NextResponse.json({ error: motivo }, { status: codigoDe(motivo) })

  if (exigeLaActual) {
    /*
     * 🔴 Cambiar la PROPIA exige la actual, y esto no es ceremonia: sin ello una
     *    sesion olvidada en un portatil del aula —que es la escena real: dieciseis
     *    puestos compartidos— permite cambiar la contraseña y quedarse la cuenta.
     */
    if (typeof cuerpo.actual !== 'string') {
      return NextResponse.json(
        { error: 'Para cambiar tu propia contraseña hace falta la actual.' }, { status: 400 },
      )
    }
    const cuenta = buscar(cuentas, objetivo)!
    if (!await verificar(cuerpo.actual, cuenta.clave)) {
      return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 401 })
    }
  }

  const clave = await hashear(cuerpo.contrasena)
  await guardarCuentas(cuentas.map((c) =>
    (normalizar(c.usuario) === objetivo ? { ...c, clave } : c)))
  return NextResponse.json({ usuario: objetivo, cambiada: true })
}
