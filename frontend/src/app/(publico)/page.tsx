/**
 * LA PORTADA PÚBLICA: la única pantalla que se ve sin entrar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA DE ANTES ENUMERABA LOS DIECISÉIS ROBOTS, Y ESO SE ACABÓ
 * ═══════════════════════════════════════════════════════════════════════════
 * La portada anterior pintaba una rejilla de 16 enlaces a `/robot/NN` — dieciséis
 * destinos con aspecto de estar vivos, **sin una palabra de estado de ninguno**,
 * y desde el 2026-08-15 sin que ninguno funcionara para quien no hubiera entrado.
 * Quien la miraba tenía que ir a `/flota` para saber a cuál entrar: dos sitios
 * para una decisión de un paso.
 *
 * Esa rejilla vive ahora donde tiene sentido —en el muro, que sí sabe el estado
 * de cada uno— y esta pantalla hace lo que le toca: **decir qué es esto y dar
 * entrada**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ Y NO ENSEÑA NINGÚN DATO DE NINGÚN ROBOT, A PROPÓSITO
 * ═══════════════════════════════════════════════════════════════════════════
 * Se planteó un resumen público —cuántos robots hay en marcha— y se descartó:
 * exigiría abrir sockets sin sesión, que es exactamente lo que la puerta cierra.
 * Una portada que dijera «14 de 16 en línea» estaría contando por fuera lo que
 * la puerta guarda por dentro.
 *
 * 📝 Lo que sí cuenta son **hechos del proyecto**, no del laboratorio de hoy: son
 *    ciertos con los robots apagados y no dependen de nada que haya que medir.
 */

import Link from 'next/link'
import { CSSProperties } from 'react'
import { TOTAL_ROBOTS } from '@/lib/interfaz/identidad'

export default function Portada() {
  const tono = { '--tono-seccion': 'var(--seccion-portada)' } as CSSProperties

  return (
    <div className="relative min-h-screen bg-background text-foreground" style={tono}>
      <div className="luz-ambiente" aria-hidden="true" />

      <header className="campo-seccion relative z-10">
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6">
          <p className="microetiqueta !text-white/85">Universidad de Nariño</p>
          <h1
            className="mt-3 max-w-[16ch] font-semibold leading-[0.95] tracking-[-0.035em]"
            style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)' }}
          >
            Plataforma Atriz
          </h1>
          <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-white/85">
            El laboratorio de robótica, gobernado desde el navegador. Dieciséis Sphero RVR con
            Raspberry Pi, en el aula, con el alumno delante y una cinta métrica en la mano.
          </p>

          <Link
            href="/entrar"
            className="pulsable focus-ring mt-7 inline-block rounded-md bg-white px-6 py-3 text-[15px] font-semibold text-[rgb(var(--seccion-portada))]"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6">
        <section className="rejilla grid gap-px sm:grid-cols-3">
          {[
            {
              titulo: `${TOTAL_ROBOTS} robots`,
              cuerpo: 'Cada uno con su Raspberry Pi, su LIDAR y su propia conexión. La web habla '
                + 'con ellos directamente, sin nada en medio.',
            },
            {
              titulo: 'ROS 2 Jazzy',
              cuerpo: 'Migrado desde ROS Noetic. Navegación, mapa, sensores y una capa de '
                + 'seguridad que puede frenar al robot antes de que lo haga la persona.',
            },
            {
              titulo: 'Presencial',
              cuerpo: 'No es un laboratorio remoto: el alumno está en la sala, mide con cinta y '
                + 'compara lo que dice la pantalla con lo que dice el suelo.',
            },
          ].map((c) => (
            <article key={c.titulo} className="vidrio p-6">
              <h2 className="filete-titulo text-[19px] font-semibold tracking-tight">{c.titulo}</h2>
              <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-muted-foreground">
                {c.cuerpo}
              </p>
            </article>
          ))}
        </section>

        {/*
          🔴 SE DICE QUE HACE FALTA ENTRAR, Y POR QUÉ. Antes no se decía en ningún
             sitio: alguien sin cuenta veía dieciséis destinos y ninguno
             funcionaba, sin una palabra de explicación. Fue el defecto nº3 de la
             auditoría y costó un diagnóstico entero el 2026-08-16.
        */}
        <section className="mt-12 max-w-prose">
          <h2 className="microetiqueta">para usar los robots</h2>
          <p className="mt-3 text-[15px] leading-relaxed">
            Hace falta <strong>entrar con una cuenta</strong>. No es una formalidad: los robots
            solo aceptan órdenes de un navegador con credencial, así que{' '}
            <strong>sin sesión no se conecta con ninguno</strong>.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            Si eres alumno y aún no tienes cuenta, te la da quien imparte la práctica.
          </p>
        </section>
      </main>
    </div>
  )
}
