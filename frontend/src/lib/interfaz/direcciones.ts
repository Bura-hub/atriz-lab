/**
 * DONDE BUSCAR A CADA ROBOT. PURO: sin React, sin red, sin `localStorage`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ LA CAUSA QUE LO HIZO NACER YA ESTA CERRADA — Y ESTO SE QUEDA
 * ═══════════════════════════════════════════════════════════════════════════
 * La tarde del 2026-08-04 el robot paso a tener **una direccion por red**
 * (`[Match] SSID=` de systemd-networkd, y en avahi `use-ipv6=no` **mas**
 * `publish-aaaa-on-ipv4=no`). Hoy `rvr-01.local` resuelve a **una sola**
 * direccion y el muro **funciona por nombre**, verificado con control:
 *
 *     por nombre, sin override   rvr-01 · 7,67 V · en linea     ✅
 *
 * 🔴 **No se retira, y no es por si acaso.** El aula esta **sin probar entera**:
 *    `05-atriz-lab.network` nunca ha casado con nada, y si el SSID real difiere
 *    en un caracter el robot cae al netplan generico y se queda **sin direccion
 *    estatica** con 16 alumnos delante. Esto es el camino de escape para ese
 *    dia, y cuesta un campo de texto.
 *
 * Lo que sigue es el fallo original, conservado porque explica la forma:
 *
 * Medido en el navegador el 2026-08-04 por la mañana, con el robot encendido y
 * sano:
 *
 *   ws://rvr-01.local:9090   🔴 12 s sin abrir, sin error y sin cierre
 *   ws://10.14.7.7:9090      🔴 12 s igual — LA MISMA FIRMA
 *   ws://192.168.1.58:9090   ✅ abre
 *   ws://192.168.1.200:9090  ✅ abre
 *
 * `rvr-01.local` resuelve a CUATRO direcciones, y el resolutor del sistema las
 * devuelve en este orden:
 *
 *   1. fe80::da3a:ddff:fed6:c1ee   IPv6 link-local SIN zona -> inservible
 *   2. 10.14.7.7                   la estatica del LABORATORIO
 *   3. 192.168.1.58                ✅ la que funciona en casa
 *   4. 192.168.1.200               ✅ tambien
 *
 * El navegador prueba en ese orden y **las dos primeras no fallan: se cuelgan**.
 * Un SYN sin respuesta tarda ~21 s en rendirse, asi que nunca llega a las
 * buenas. No es un fallo del robot ni de esta aplicacion: es que el robot tiene
 * tres direcciones IPv4 a la vez —decision tomada y verificada, para que se
 * mude de casa al aula sin tocar un comando— y desde cualquier red **al menos
 * una de ellas es inalcanzable**.
 *
 * ⚠️ Y en el aula pasa lo mismo AL REVES: alli la buena es `10.14.7.7` y las
 *    dos de casa son los agujeros negros. Da la casualidad de que alli el orden
 *    favorece —la del laboratorio va antes— pero eso es suerte, no diseño.
 *
 * 🔴 JavaScript **no puede** enumerar lo que resolvio el nombre ni elegir
 *    direccion: no hay API. Asi que el cliente no puede competir entre ellas
 *    como hace el sistema operativo. Lo unico que puede hacer es dejar que una
 *    persona diga «para este robot, usa esta».
 *
 * 📝 Lo que NO es esto: un descubrimiento automatico. No escanea la red, no
 *    adivina, y no promete que la direccion escrita funcione. Solo cambia a
 *    donde se marca.
 */

/** Clave en `localStorage`. Lleva version por si el formato cambia. */
export const CLAVE_DIRECCIONES = 'atriz.direcciones.v1'

/** `{"1": "192.168.1.58"}` — el numero del robot como texto. */
export type Direcciones = Readonly<Record<string, string>>

/**
 * 🔴 EL PUERTO NO ES CONFIGURABLE, Y ES A PROPOSITO.
 *
 * rosbridge escucha en 9090 en los 16 robots: lo fija `robot.launch.py` y es
 * parte de la imagen dorada. Aceptar `host:puerto` aqui invitaria a escribir
 * `192.168.1.58:9091`, que `urlDeRobot()` convertiria en
 * `ws://192.168.1.58:9091:9090` — una URL rota que fallaria sin decir por que.
 */
const PUERTO_FIJO = 9090

export interface DireccionValida { ok: true; valor: string }
export interface DireccionInvalida { ok: false; motivo: string }

/**
 * Comprueba lo que escribio una persona. Acepta un nombre de maquina o una IPv4;
 * **no** acepta esquema, puerto, ruta ni espacios.
 */
export function validarDireccion(texto: string): DireccionValida | DireccionInvalida {
  const t = texto.trim()
  if (t === '') return { ok: false, motivo: 'esta vacio' }

  if (/^\w+:\/\//.test(t)) {
    return { ok: false, motivo: 'no lleva ws:// ni http://, solo el nombre o la IP' }
  }
  if (t.includes('/')) return { ok: false, motivo: 'no lleva ruta' }
  if (/\s/.test(t)) return { ok: false, motivo: 'no puede llevar espacios' }
  if (t.includes(':')) {
    return { ok: false, motivo: `no lleva puerto: rosbridge esta en el ${PUERTO_FIJO} en los 16` }
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(t)) {
    return { ok: false, motivo: 'solo letras, numeros, puntos y guiones' }
  }
  return { ok: true, valor: t }
}

/**
 * A donde conectarse para el robot `id`.
 *
 * Devuelve el **numero** cuando no hay override —y entonces `urlDeRobot()` arma
 * `rvr-NN.local`, que es lo de siempre— o la **cadena** escrita por la persona.
 */
export function destinoDe(id: number, d: Direcciones): number | string {
  const puesta = d[String(id)]
  return puesta === undefined || puesta === '' ? id : puesta
}

/** Lee lo guardado. Ante cualquier basura devuelve vacio: nunca lanza. */
export function leerDirecciones(crudo: string | null): Direcciones {
  if (crudo === null || crudo === '') return {}
  let dato: unknown
  try {
    dato = JSON.parse(crudo)
  } catch {
    return {}
  }
  if (typeof dato !== 'object' || dato === null || Array.isArray(dato)) return {}

  const salida: Record<string, string> = {}
  for (const [k, v] of Object.entries(dato as Record<string, unknown>)) {
    // 🔴 Se revalida al LEER, no solo al escribir. Lo guardado puede venir de
    //    otra version, de otra pestaña o de alguien editandolo a mano, y una
    //    direccion con `//` o con espacios armaria una URL rota.
    if (typeof v !== 'string') continue
    if (!/^\d+$/.test(k)) continue
    const r = validarDireccion(v)
    if (r.ok) salida[k] = r.valor
  }
  return salida
}

export function escribirDirecciones(d: Direcciones): string {
  return JSON.stringify(d)
}

/** Pone o quita el override de un robot. Texto vacio lo QUITA. */
export function conDireccion(d: Direcciones, id: number, texto: string): Direcciones {
  const copia: Record<string, string> = { ...d }
  const t = texto.trim()
  if (t === '') {
    delete copia[String(id)]
    return copia
  }
  const r = validarDireccion(t)
  if (!r.ok) return d      // invalida: no se guarda nada
  copia[String(id)] = r.valor
  return copia
}

/** Cuantos robots tienen una direccion puesta a mano. Para decirlo en pantalla. */
export function cuantasPuestas(d: Direcciones): number {
  return Object.keys(d).length
}
