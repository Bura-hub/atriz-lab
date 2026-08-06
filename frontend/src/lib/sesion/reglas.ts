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
 * 🔴 UNA SOLA CLASE DE CUENTA, Y NO ES UN ATAJO
 * ═══════════════════════════════════════════════════════════════════════════
 * No hay `rol`. Quien tiene cuenta puede liberar una parada y crear otras
 * cuentas; los dieciséis alumnos usan la aplicación **sin entrar**, igual que
 * hasta ahora.
 *
 * Se planteó un campo `rol` con dos valores y se descartó por una razón de este
 * repositorio: hoy solo habría uno en uso, y un campo con un único valor no es
 * una jerarquía — es la promesa de una que no existe. Cuando haga falta separar
 * «administrar» de «operar» se añade, y entonces significará algo.
 *
 * 📝 La decisión de fondo: en un laboratorio de 16 robots con un administrador
 *    presente, la persona que libera una parada y la que da de alta a un monitor
 *    son la misma.
 */

/** Lo que se guarda por cuenta. **Nunca** la contraseña en claro. */
export interface Cuenta {
  usuario: string
  /** `sal:hash`, los dos en hexadecimal. */
  clave: string
  /** Milisegundos desde la época. Se enseña en la tabla; el hash no. */
  creada: number
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
