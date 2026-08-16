'use client'

/**
 * DONDE BUSCAR A CADA ROBOT. El override de direccion del muro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE EXISTE — y no es una preferencia, es un fallo medido
 * ═══════════════════════════════════════════════════════════════════════════
 * `rvr-NN.local` resolvia a CUATRO direcciones y el navegador probaba las dos
 * peores primero. Ninguna fallaba: **se colgaban**. Medido el 2026-08-04 con el
 * robot encendido y sano — 12 s sin `onopen`, sin `onerror` y sin `onclose`.
 *
 * ✅ **Esa causa esta cerrada en el robot** desde esa misma tarde: una direccion
 *    por red. Hoy el muro funciona por nombre, sin tocar nada de aqui.
 *
 * 🔴 **Y esto se queda, porque el AULA esta sin probar entera.** El fichero de
 *    red del laboratorio nunca ha casado con nada: si su SSID difiere en un
 *    caracter, el robot cae al netplan generico y se queda sin direccion
 *    estatica — con 16 alumnos delante. Este cuadro es el camino de escape para
 *    ese dia. El detalle esta en `lib/interfaz/direcciones.ts`.
 *
 * JavaScript no puede enumerar lo que resolvio un nombre ni elegir direccion:
 * no hay API. Asi que lo unico que puede hacer el cliente es dejar que una
 * persona lo diga.
 *
 * ⚠️ **Esto no descubre nada ni promete nada.** No escanea la red, no adivina y
 *    no comprueba que la direccion escrita responda: solo cambia a donde se
 *    marca. Si la baldosa sigue diciendo «no llego», la direccion tambien esta
 *    mal — y eso es informacion, no un fallo de este cuadro.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  CLAVE_DIRECCIONES, Direcciones, conDireccion, cuantasPuestas, escribirDirecciones,
  leerDirecciones, validarDireccion,
} from '@/lib/interfaz/direcciones'
import { ROBOTS } from '@/lib/interfaz/identidad'

/**
 * Lee y escribe el override.
 *
 * 🔴 Arranca VACIO y carga en un efecto, a proposito: el servidor no tiene
 *    `localStorage`, asi que leerlo durante el render daria un HTML distinto
 *    del del cliente y React abortaria la hidratacion — la pantalla entera se
 *    volveria a pintar sin avisar de nada.
 */
export function useDirecciones() {
  const [direcciones, setDirecciones] = useState<Direcciones>({})
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    try {
      setDirecciones(leerDirecciones(window.localStorage.getItem(CLAVE_DIRECCIONES)))
    } catch {
      // localStorage puede lanzar (modo privado, cuota, politica del navegador).
      // Sin override el muro sigue funcionando por nombre: no hay nada que hacer.
    }
    setCargado(true)
  }, [])

  const poner = useCallback((id: number, texto: string) => {
    setDirecciones((antes) => {
      const nuevas = conDireccion(antes, id, texto)
      try {
        window.localStorage.setItem(CLAVE_DIRECCIONES, escribirDirecciones(nuevas))
      } catch { /* ver arriba */ }
      return nuevas
    })
  }, [])

  return { direcciones, poner, cargado }
}

function Fila({ id, valor, poner }: {
  id: number
  valor: string
  poner: (id: number, texto: string) => void
}) {
  const [texto, setTexto] = useState(valor)
  // Si otra fila cambia el mapa, esta no debe perder lo que se esta escribiendo:
  // solo se resincroniza cuando cambia SU valor guardado.
  useEffect(() => { setTexto(valor) }, [valor])

  const r = validarDireccion(texto)
  const invalido = texto.trim() !== '' && !r.ok

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <label className="w-16 shrink-0 font-mono text-xs text-muted-foreground" htmlFor={`dir-${id}`}>
        rvr-{String(id).padStart(2, '0')}
      </label>
      <input
        id={`dir-${id}`}
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => poner(id, texto)}
        onKeyDown={(e) => { if (e.key === 'Enter') poner(id, texto) }}
        placeholder="rvr-NN.local"
        className={`focus-ring w-56 border bg-input px-2 py-1 font-mono text-xs ${
          invalido ? 'border-[rgb(var(--estado-ir))]' : 'border-border'
        }`}
      />
      <span className="text-[11px] text-muted-foreground">
        {invalido && r.ok === false
          ? r.motivo
          : texto.trim() === ''
            ? 'por nombre'
            : 'se guarda al salir del campo'}
      </span>
    </div>
  )
}

export function DondeBuscar({ direcciones, poner, nadieResponde = false }: {
  direcciones: Direcciones
  poner: (id: number, texto: string) => void
  /** El muro no llega a NINGUN robot. Entonces esto es el remedio, no un ajuste. */
  nadieResponde?: boolean
}) {
  const puestas = cuantasPuestas(direcciones)
  const deberiaAbrirse = nadieResponde || puestas > 0
  const [abierto, setAbierto] = useState(deberiaAbrirse)

  /*
   * 🔴 SOLO ABRE, NUNCA CIERRA. Si `nadieResponde` deja de ser cierto mientras
   *    alguien esta escribiendo una direccion, cerrarle el cuadro en la cara
   *    seria peor que no haberlo abierto.
   */
  useEffect(() => {
    if (deberiaAbrirse) setAbierto(true)
  }, [deberiaAbrirse])

  return (
    /*
      🔴 `vidrio rounded-ficha`, COMO TODO LO DEMÁS DE ESTA PANTALLA. Era la
         única caja de esquinas vivas del muro —`border` + `bg-card` a pelo—
         entre dieciséis fichas redondeadas y dos pastillas de vidrio, así que
         se leía como algo pegado de otro sitio.

      ⚠️ `overflow-hidden` no es adorno: sin él la lista de dieciséis filas y
         sus separadores de 1 px salen por las esquinas redondeadas.
    */
    /*
      ═══════════════════════════════════════════════════════════════════════
      🔴 SE ABRE SOLO CUANDO ES LA RESPUESTA (2026-08-16, F5)
      ═══════════════════════════════════════════════════════════════════════
      El plan pedia que este cuadro «deje de estar plegado», y dejarlo SIEMPRE
      abierto habria sido peor: son dieciseis filas de direcciones en la unica
      pantalla cuyo criterio es **una persona a tres metros**.

      Lo que hacia falta es que no este escondido CUANDO IMPORTA, y este mismo
      fichero ya tenia escrito cuando es eso: «cuando el aviso de ningun robot
      responde tiene razon, esto es justo lo que hay que abrir». Se cumple.

      🔴 Y el segundo caso es el que de verdad muerde: **si hay alguna direccion
         puesta, se abre**. Una configuracion que NO es la de por defecto no
         puede quedar invisible — con un override mal escrito, el muro pinta
         dieciseis baldosas muertas y la causa esta plegada dos lineas mas
         arriba. Es la forma de fallo de este proyecto entera: el remedio
         escondido debajo del sintoma.

      ⚠️ Y se puede CERRAR. Es estado local sembrado desde fuera, no un `open`
         atado a una prop: con la prop a pelo, cualquier re-render —y aqui llegan
         datos cada segundo— lo volveria a abrir y nadie podria cerrarlo.
    */
    <details
      className="vidrio group overflow-hidden rounded-ficha"
      open={abierto}
      onToggle={(e) => setAbierto(e.currentTarget.open)}
    >
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-ficha px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground">
        {/*
          📝 El ` · ` entre etiqueta y valor. Sin él se leía «Dónde buscar a los
             robots todos por nombre», que es una frase rota: dos cosas
             distintas —el nombre del cuadro y su estado— pegadas en una línea.
        */}
        <span>Dónde buscar a los robots</span>
        <span aria-hidden="true" className="opacity-50">·</span>
        <span className="font-mono">
          {puestas === 0 ? 'todos por nombre' : `${puestas} con dirección puesta`}
        </span>
        {/*
          El chevron, DIBUJADO y a la derecha. Antes era un `▸` Unicode a la
          izquierda: un glifo de fuente, que `craft-floor` prohíbe como icono y
          que además cambia de forma y de peso según qué fuente lo resuelva.
          A la derecha porque es donde el ojo espera el gesto de plegar, y en el
          extremo de la caja, no pegado al texto.
        */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="ml-auto shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-180"
        >
          <path
            d="M4 6.25 8 10.25 12 6.25"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="border-t border-border">
        <p className="max-w-prose px-3 py-2 text-xs leading-snug text-muted-foreground">
          Por defecto cada baldosa busca <code>rvr-NN.local</code>. Ese nombre puede resolver a
          varias direcciones, y el navegador prueba primero las que no sirven desde esta red:
          no dan error, <strong>se quedan colgadas</strong>. Escribe aquí una IP y esa baldosa irá
          directa. Se guarda en este navegador.
        </p>
        <div className="max-h-64 overflow-y-auto border-t border-border">
          {ROBOTS.map((id) => (
            <Fila key={id} id={id} valor={direcciones[String(id)] ?? ''} poner={poner} />
          ))}
        </div>
      </div>
    </details>
  )
}
