/**
 * LA ÚNICA PANTALLA PÚBLICA: qué es esto **y** la entrada, juntas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 `/` Y `/entrar` ERAN DOS PÁGINAS PARA UNA SOLA COSA (2026-08-16)
 * ═══════════════════════════════════════════════════════════════════════════
 * Decisión del usuario, y es la correcta: quien llega sin sesión veía una
 * portada que explicaba el laboratorio y ofrecía un botón «Entrar» que llevaba a
 * OTRA página a escribir dos campos. Un salto entero para un formulario de
 * quince segundos, y por el camino un raíl que desaparecía y una pantalla que no
 * devolvía a ningún sitio.
 *
 * Ahora es una: la presentación a un lado, el formulario al otro. `/entrar`
 * sigue existiendo como redirección —hay enlaces y marcadores apuntando ahí— y
 * conserva el `?volver=`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 CON SESIÓN, ESTA PANTALLA NO SE VE
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 Reportado por el usuario: *«si le doy [a Inicio] me regresa al login aunque
 *    tenga cuenta, el raíl se pierde, y si le doy entrar me deja en /entrar y no
 *    sigue al resto»*. Los tres síntomas eran el mismo defecto — una pantalla
 *    para quien NO tiene sesión, ofrecida a quien sí.
 *
 * → Con sesión válida se redirige al resumen. *«Que solo se muestre el resumen
 *   inicial si no hay cuenta»*, literal.
 *
 * ⚠️ Se comprueba la FIRMA, no que haya cookie: una inventada pasa el
 *    middleware, que corre en Edge y no tiene `node:crypto`. Ver `haySesion()`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ Y NO ENSEÑA NINGÚN DATO DE NINGÚN ROBOT, A PROPÓSITO
 * ═══════════════════════════════════════════════════════════════════════════
 * Se planteó un resumen público —cuántos robots hay en marcha— y se descartó:
 * exigiría abrir sockets sin sesión, que es exactamente lo que la puerta cierra.
 * Una portada que dijera «14 de 16 en línea» estaría contando por fuera lo que
 * la puerta guarda por dentro.
 *
 * 📝 Lo que sí cuenta son **hechos del proyecto**, no del laboratorio de hoy:
 *    son ciertos con los robots apagados y no dependen de nada que haya que
 *    medir. La rejilla de dieciséis enlaces que hubo aquí —dieciséis destinos
 *    con aspecto de estar vivos, sin una palabra de estado— vive en el muro,
 *    que sí sabe el estado de cada uno.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { CSSProperties } from 'react'
import { TOTAL_ROBOTS } from '@/lib/interfaz/identidad'
import { ROBOTS_QUE_EXIGEN_CREDENCIAL, concordancia } from '@/lib/sesion/despliegue'
import { DESTINO_POR_DEFECTO } from '@/lib/sesion/regreso'
import { haySesion } from '@/lib/sesion/servidor'
import { FormularioEntrar } from '@/componentes/sesion/FormularioEntrar'
import { Aviso } from '@/componentes/ui/Aviso'

/**
 * Las formas verbales que dependen del número de robots que ya exigen credencial.
 * Se calcula una vez: no depende de nada de la petición.
 */
const DE_LA_FLOTA = concordancia(ROBOTS_QUE_EXIGEN_CREDENCIAL)

export default async function Portada() {
  if (await haySesion()) redirect(DESTINO_POR_DEFECTO)
  return <PortadaPublica />
}

function PortadaPublica() {
  const tono = { '--tono-seccion': 'var(--seccion-portada)' } as CSSProperties

  return (
    <div className="relative min-h-screen bg-background text-foreground" style={tono}>
      <div className="luz-ambiente" aria-hidden="true" />

      <header className="campo-seccion relative z-10">
        <div className="relative mx-auto max-w-6xl px-4 pb-11 pt-10 sm:px-6">
          <p className="microetiqueta !text-white/85">Universidad de Nariño</p>
          <h1
            className="mt-3 max-w-[16ch] font-semibold leading-[0.95] tracking-[-0.035em]"
            style={{ fontSize: 'clamp(2.2rem, 5.2vw, 3.4rem)' }}
          >
            Plataforma Atriz
          </h1>
          <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-white/85">
            El laboratorio de robótica, gobernado desde el navegador. Dieciséis Sphero RVR con
            Raspberry Pi, en el aula, con el alumno delante y una cinta métrica en la mano.
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        {/*
          🔴 EL FORMULARIO VA EL PRIMERO EN EL DOM Y A LA IZQUIERDA, y no es
             indiferente: quien llega a esta pantalla casi siempre viene a
             entrar, no a leer qué es esto. Ponerlo detrás de la explicación lo
             dejaría bajo el pliegue en un portátil de aula — y con el tabulador,
             detrás de tres párrafos.

             La explicación queda al lado, que es donde le toca: la lee quien no
             sabe dónde ha llegado, una vez.
        */}
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <section className="space-y-5">
            <h2 className="microetiqueta">Entrar</h2>
            <Suspense fallback={null}>
              <FormularioEntrar />
            </Suspense>

            {/*
              ═══════════════════════════════════════════════════════════════
              🔴 LA FRASE QUE HACE HONESTA ESTA PANTALLA, y por eso no es letra
                 pequeña ni se puede cerrar.
              ═══════════════════════════════════════════════════════════════
              Sin ella, una pantalla de acceso da a entender que hay control de
              acceso. Aquí lo hay sobre la INTERFAZ y no sobre el robot, y la
              diferencia es enorme: el navegador habla directamente con el
              rosbridge de cada robot, y ese camino no pasa por este servidor.

              🔴🔴 Y AUN ASI, AQUI SE LLEGO A AFIRMAR DE LOS DIECISEIS LO QUE
                 HACE UNO. Ponia: «al entrar, este servidor te firma una
                 credencial para ese robot en concreto, **y el robot la
                 comprueba**. Sin ella te cierra la puerta». La Fase B esta
                 cerrada en **rvr-01**, y el repositorio de migracion lo anota
                 al lado: «lo que la Fase B no cierra: TLS y los otros 15
                 robots». O sea que quince de dieciseis aceptaban una conexion
                 sin credencial mientras la unica pantalla publica decia lo
                 contrario.

                 Que pasara JUSTO AQUI es lo que hay que recordar: el parrafo
                 escrito para no sobre-afirmar seguridad acabo sobre-afirmando
                 seguridad, porque describia el DISEÑO y no el DESPLIEGUE. Una
                 frase envejece cuando lo que describe se despliega por partes.

              👤 Decision del usuario (2026-08-17): corregir la frase, no
                 desplegar la Fase B a los quince ahora — la recibiran con la
                 imagen dorada.

              ⚠️ El numero sale de `ROBOTS_QUE_EXIGEN_CREDENCIAL` y se mantiene
                 A MANO: esta pantalla NO abre socket con ningun robot, a
                 proposito, asi que no hay a quien preguntarle. Si envejece,
                 envejece hacia el lado seguro — infra-afirmar no hace daño.
                 Y la concordancia de numero se DERIVA (`concordancia()`), para
                 que el dia que valga 16 la frase siga bien escrita sin que
                 nadie se acuerde de revisarla.
            */}
            <Aviso nivel="ATENCION" titulo="Qué protege esta sesión">
              Identifica a quien usa <strong>esta interfaz</strong>, y es lo que evita que se
              libere una parada por curiosidad o por error. Al entrar, este servidor te firma
              además una <strong>credencial para ese robot en concreto</strong>, y una credencial
              del robot 2 no abre el 1.{' '}
              <strong>
                Hoy {DE_LA_FLOTA.exige} {ROBOTS_QUE_EXIGEN_CREDENCIAL} de los {TOTAL_ROBOTS} robots
              </strong>{' '}
              —desde el 15 de agosto de 2026—: {DE_LA_FLOTA.ese} {DE_LA_FLOTA.cierra} la puerta sin
              ella. A los demás{' '}
              <strong>todavía no se les ha instalado</strong>, así que aceptan una conexión sin
              comprobarla; la exigirán cuando se les ponga la imagen del laboratorio.{' '}
              <strong>Y lo que no protege en ninguno</strong>: lo que viaja va{' '}
              <strong>sin cifrar</strong>, así que alguien en la misma red puede leer la
              telemetría aunque no pueda conducir. Y quien ejecute código{' '}
              <em>dentro</em> del robot desde el Taller tiene más permisos que esta pantalla.
            </Aviso>

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Las cuentas las crea un <strong>profesor</strong>, desde <strong>Usuarios</strong>, y
              una clase entera se da de alta de una vez. La primera cuenta se crea en la máquina
              que sirve la aplicación con <code>node herramientas/crear-cuenta.mjs</code>. No hay
              registro abierto: en la red de un aula, la primera cuenta se la quedaría quien
              llegara antes.
            </p>
          </section>

          <section className="space-y-8">
            <div className="rejilla grid gap-px sm:grid-cols-2">
              {[
                {
                  titulo: `${TOTAL_ROBOTS} robots`,
                  cuerpo: 'Cada uno con su Raspberry Pi, su LIDAR y su propia conexión. La web '
                    + 'habla con ellos directamente, sin nada en medio.',
                },
                {
                  titulo: 'ROS 2 Jazzy',
                  cuerpo: 'Migrado desde ROS Noetic. Navegación, mapa, sensores y una capa de '
                    + 'seguridad que puede frenar al robot antes de que lo haga la persona.',
                },
                {
                  titulo: 'Presencial',
                  cuerpo: 'No es un laboratorio remoto: el alumno está en la sala, mide con cinta '
                    + 'y compara lo que dice la pantalla con lo que dice el suelo.',
                },
                {
                  titulo: 'Se niega a adivinar',
                  cuerpo: 'Lo que no se ha medido sale como una raya, nunca como un cero. Y cada '
                    + 'medida lleva impreso el rango contra el que se lee.',
                },
              ].map((c) => (
                <article key={c.titulo} className="vidrio p-6">
                  <h3 className="filete-titulo text-[19px] font-semibold tracking-tight">
                    {c.titulo}
                  </h3>
                  <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-muted-foreground">
                    {c.cuerpo}
                  </p>
                </article>
              ))}
            </div>

            {/*
              🔴 SE DICE QUE HACE FALTA ENTRAR, Y POR QUÉ. Antes no se decía en
                 ningún sitio: alguien sin cuenta veía dieciséis destinos y
                 ninguno funcionaba, sin una palabra de explicación. Fue el
                 defecto nº3 de la auditoría y costó un diagnóstico entero el
                 2026-08-16.
            */}
            <div className="max-w-prose">
              <h2 className="microetiqueta">para usar los robots</h2>
              {/*
                🔴 LA SEGUNDA AFIRMACION FALSA, y se corrige por la MISMA razon
                   que la de arriba: «los robots solo aceptan ordenes de un
                   navegador con credencial» era cierto de UNO.

                📌 Lo que SI es cierto de los dieciseis es lo otro que ya decia
                   —«sin sesion no se conecta con ninguno»—, pero por un motivo
                   distinto que ahora se dice: es **esta plataforma** la que se
                   niega a intentarlo, no el robot el que lo rechaza. Confundir
                   «me niego a llamar» con «no me abren la puerta» es
                   exactamente la clase de deriva que la pantalla de arriba
                   acaba de pagar.
              */}
              <p className="mt-3 text-[15px] leading-relaxed">
                Hace falta <strong>entrar con una cuenta</strong>. No es una formalidad:{' '}
                <strong>sin sesión esta plataforma no abre conexión con ningún robot</strong>, se
                niega a intentarlo. Que además <em>el robot</em> rechace a quien llegue sin
                credencial es lo que hoy {DE_LA_FLOTA.hace}{' '}
                {ROBOTS_QUE_EXIGEN_CREDENCIAL} de los {TOTAL_ROBOTS}.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                Si eres alumno y aún no tienes cuenta, te la da quien imparte la práctica.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
