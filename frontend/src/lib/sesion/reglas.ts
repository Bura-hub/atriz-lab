/**
 * LAS REGLAS DE UNA CUENTA. Sin `node:crypto`, sin `fs`, sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ ESTO ESTÁ SEPARADO DE `credenciales.ts`, QUE TAMBIÉN ES PURO
 * ═══════════════════════════════════════════════════════════════════════════
 * «Puro» y «se puede meter en el navegador» no son lo mismo, y confundirlos
 * costó un fallo de compilación en cuanto la pantalla de alta quiso validar
 * mientras se escribe: `credenciales.ts` no toca disco ni estado —es puro— pero
 * importa `node:crypto` en su primera línea, y eso **no existe en el navegador**.
 *
 * Aquí vive lo que las dos orillas necesitan decir igual: el mínimo de la
 * contraseña y el motivo por el que un alta no vale. `revisarAlta` la llaman la
 * pantalla y el endpoint, así que **la regla vive en un solo sitio** — que era
 * el objetivo — sin arrastrar la criptografía hasta el navegador.
 *
 * ⚠️ La validación del navegador es COMODIDAD. La que manda es la del endpoint:
 *    a `/api/sesion/usuarios` se le puede llamar con `curl` sin pasar por
 *    ninguna pantalla.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 AHORA SÍ HAY DOS ROLES, Y EL MOTIVO ES QUE CAMBIÓ EL HECHO
 * ═══════════════════════════════════════════════════════════════════════════
 * Aquí ponía que **no hay `rol`**, y el argumento era bueno:
 *
 *   > «Se planteó un campo `rol` con dos valores y se descartó: hoy solo habría
 *   >  uno en uso, y un campo con un único valor no es una jerarquía — es la
 *   >  promesa de una que no existe.»
 *
 * Se apoyaba en un hecho, escrito dos líneas más arriba: *«los dieciséis alumnos
 * usan la aplicación **sin entrar**»*. **Ese hecho dejó de ser cierto el
 * 2026-08-15**, cuando la Fase B hizo obligatorio el testigo: hoy, sin sesión,
 * no se abre ni un socket con ningún robot.
 *
 * Así que el segundo valor **existe de verdad**: dieciséis personas que operan y
 * unas pocas que administran. No se revoca una decisión buena — se revoca el
 * hecho en el que se apoyaba, que es distinto y hay que decirlo así.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUÉ SEPARA UN ROL DEL OTRO
 * ═══════════════════════════════════════════════════════════════════════════
 *   conducir · medir · LIDAR · Taller · cuaderno · ver el muro   los DOS
 *   liberar la parada de emergencia                              los DOS  ← 👤
 *   arrancar y parar SLAM y Nav2                                 profesor
 *   crear, borrar y resetear cuentas                             profesor
 *
 * 👤 **La parada la libera cualquiera con sesión, y no es una concesión.** Lo
 *    decidió el usuario con un dato de la Pi delante: liberar es seguro del lado
 *    del robot —`cancelar_nav2` está verificado **con control**: el objetivo
 *    queda `CANCELED` y el robot se mueve **0,0 cm**, o sea que no arranca solo—.
 *    Y el riesgo de reservarla era real: si solo el profesor puede liberar y no
 *    está en el aula, un robot se queda parado hasta que aparezca.
 *
 * ⚠️ EL ROL NO VIAJA EN LA COOKIE, y esto no es un detalle de implementación:
 *    se resuelve en el servidor leyendo la cuenta. Si viajara firmado dentro,
 *    degradar a alguien exigiría esperar a que caduque su sesión —hasta **ocho
 *    horas**— y un profesor recién retirado seguiría administrando cuentas
 *    durante toda una clase.
 */

/** Quién es quien mira. Dos valores, y los dos se usan. */
export type Rol = 'profesor' | 'alumno'

/** Lo que se guarda por cuenta. **Nunca** la contraseña en claro. */
export interface Cuenta {
  usuario: string
  /** `sal:hash`, los dos en hexadecimal. */
  clave: string
  /** Milisegundos desde la época. Se enseña en la tabla; el hash no. */
  creada: number
  /**
   * 🔴 OPCIONAL, Y SU AUSENCIA SE LEE COMO `profesor`. Ver `rolDe`.
   */
  rol?: Rol
}

/**
 * El rol de una cuenta, con las que ya existen resueltas.
 *
 * 🔴 **La ausencia se lee como `profesor`, y es deliberado.** Las cuentas que ya
 *    están en `usuarios.json` cuando esto se despliega son las de administración
 *    —hoy hay una— y leerlas como `alumno` **degradaría en silencio al único que
 *    puede administrar**, dejando la instalación sin nadie capaz de crear
 *    cuentas. La única salida sería editar el JSON a mano en el portátil del
 *    aula, que es exactamente el estado del que esta pantalla existe para sacar.
 *
 * 📝 El lado seguro de un campo nuevo depende de qué había antes, no de cuál es
 *    el valor «menor». Aquí lo que había antes era administración.
 */
export function rolDe(c: Pick<Cuenta, 'rol'>): Rol {
  return c.rol ?? 'profesor'
}

/** ¿Puede esta cuenta administrar cuentas y arrancar la navegación? */
export function esProfesor(c: Pick<Cuenta, 'rol'> | null | undefined): boolean {
  return c !== null && c !== undefined && rolDe(c) === 'profesor'
}

/** Mínimo de la contraseña. Corto a propósito: ver `revisarAlta`. */
export const MINIMO_CONTRASENA = 10

/** Lo que se acepta como nombre: letras sin acento, dígitos, punto y guiones. */
const NOMBRE_VALIDO = /^[a-z0-9][a-z0-9._-]{2,31}$/

/**
 * Por qué NO se puede dar de alta, o `null` si se puede.
 *
 * 🔴 Devuelve el MOTIVO y no un booleano: la pantalla tiene que poder decir qué
 *    falla. Un «datos inválidos» a secas obliga a adivinar, y quien da de alta a
 *    un monitor con la clase empezando no está para adivinar.
 *
 * ⚠️ El mínimo son 10 caracteres y NO se exige mayúscula, dígito ni símbolo
 *    —SIVE pide 12 con las cuatro familias—. Es deliberado: esas reglas empujan
 *    a `Laboratorio2026!`, que es peor que una frase larga, y aquí las cuentas
 *    las crea a mano una persona que está en la sala. La longitud es lo único
 *    que de verdad cuesta romper.
 */
export function revisarAlta(usuario: string, contrasena: string): string | null {
  const u = usuario.trim().toLowerCase()
  if (u === '') return 'Hace falta un nombre de usuario.'
  if (!NOMBRE_VALIDO.test(u)) {
    return 'El nombre va en minúsculas, de 3 a 32 caracteres, y solo admite letras, dígitos, punto, guion y guion bajo.'
  }
  if (contrasena.length < MINIMO_CONTRASENA) {
    return `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.`
  }
  // Una contraseña que es el propio nombre pasa cualquier regla de forma y no
  // protege de nada: es lo primero que prueba quien la adivina.
  if (contrasena.toLowerCase().includes(u)) {
    return 'La contraseña no puede contener el nombre de usuario.'
  }
  return null
}

/** El nombre tal y como se guarda y se compara: recortado y en minúsculas. */
export function normalizar(usuario: string): string {
  return usuario.trim().toLowerCase()
}
