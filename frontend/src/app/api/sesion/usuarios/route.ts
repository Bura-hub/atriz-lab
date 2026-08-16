/**
 * LAS CUENTAS: listarlas y crear una.
 *
 * 🔴 SIN SESIÓN NO SE PUEDE NI LISTAR. La lista de nombres de quien puede
 *    liberar una parada es justo lo que se le da a quien quiere adivinar una
 *    contraseña.
 *
 * 🔴 Y AQUÍ PONÍA «no hay borrar ni editar», con este motivo: *«dar de baja se
 *    hace a mano en `usuarios.json`; con una plantilla que cambia una vez por
 *    semestre, un formulario de borrado es superficie sin nadie a quien
 *    servir»*. **Era cierto cuando había tres cuentas de personal.** Desde la
 *    Fase B los dieciséis alumnos necesitan cuenta, así que la plantilla pasó de
 *    tres a diecinueve y cambia **cada semestre entero**. Borrar y resetear
 *    viven ahora en `[usuario]/route.ts`, y el alta por lote en `lote/`.
 *
 * ⚠️ CREAR ES DE PROFESORES. Listar no: la lista con el rol es lo que la pantalla
 *    necesita para que un alumno vea a quién pedirle un reseteo, y sale sin
 *    ningún dato sensible.
 */

import { NextRequest, NextResponse } from 'next/server'
import { hashear } from '@/lib/sesion/credenciales'
import { esProfesor, normalizar, revisarAlta, rolDe, type Rol } from '@/lib/sesion/reglas'
import { guardarCuentas, leerCuentas } from '@/lib/sesion/almacen'
import { cuentaDeSesion, noAutorizado, noLlega, sesionDe } from '@/lib/sesion/peticion'

export async function GET(pet: NextRequest) {
  if (sesionDe(pet) === null) return noAutorizado()
  const cuentas = await leerCuentas()
  // 🔴 `clave` NO sale de aquí. Es un hash, no una contraseña, pero mandarlo al
  //    navegador lo pone a tiro de un ataque sin conexión y no sirve para nada.
  return NextResponse.json({
    cuentas: cuentas.map((c) => ({ usuario: c.usuario, creada: c.creada, rol: rolDe(c) })),
  })
}

export async function POST(pet: NextRequest) {
  if (sesionDe(pet) === null) return noAutorizado()
  // 403 y no 401: hay sesión, lo que pasa es que no llega. Distinguirlo evita
  // que alguien vuelva a entrar creyendo que la sesión caducó.
  const quien = await cuentaDeSesion(pet)
  if (!esProfesor(quien)) return noLlega('Solo un profesor puede crear cuentas.')

  let cuerpo: { usuario?: unknown; contrasena?: unknown; rol?: unknown }
  try {
    cuerpo = await pet.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo ilegible.' }, { status: 400 })
  }
  if (typeof cuerpo.usuario !== 'string' || typeof cuerpo.contrasena !== 'string') {
    return NextResponse.json({ error: 'Hacen falta usuario y contraseña.' }, { status: 400 })
  }

  /*
   * 🔴 LAS MISMAS REGLAS QUE EN EL NAVEGADOR, otra vez aquí. No es duplicar por
   *    duplicar: la validación de la pantalla es comodidad —dice qué falla
   *    mientras se escribe— y esta es la que manda, porque a esta ruta se le
   *    puede llamar con `curl` sin pasar por ninguna pantalla. Las dos llaman a
   *    `revisarAlta`, así que la regla vive en un solo sitio.
   */
  const motivo = revisarAlta(cuerpo.usuario, cuerpo.contrasena)
  if (motivo !== null) return NextResponse.json({ error: motivo }, { status: 422 })

  const usuario = normalizar(cuerpo.usuario)
  const cuentas = await leerCuentas()
  if (cuentas.some((c) => c.usuario === usuario)) {
    return NextResponse.json({ error: `Ya existe una cuenta «${usuario}».` }, { status: 409 })
  }

  /*
   * 🔴 EL ROL POR DEFECTO DE UN ALTA NUEVA ES `alumno`, al revés que el de una
   *    cuenta que ya existía (ver `rolDe`). No es incoherencia: son dos preguntas
   *    distintas. «Qué era esto antes de que existiera el campo» se responde
   *    **administración**, porque eso es lo que había; «qué es una cuenta que
   *    alguien acaba de crear» se responde **lo menos posible**, porque el que la
   *    crea puede ascenderla en un clic y nadie puede deshacer un permiso que ya
   *    se usó.
   */
  const rol: Rol = cuerpo.rol === 'profesor' ? 'profesor' : 'alumno'

  await guardarCuentas([
    ...cuentas,
    { usuario, clave: await hashear(cuerpo.contrasena), creada: Date.now(), rol },
  ])
  return NextResponse.json({ usuario, rol }, { status: 201 })
}
