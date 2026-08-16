# La cara del panel

**Archivo**, de Omnibus-Type. Grotesca industrial de linaje de señalética, variable en
**dos ejes**: anchura 62–125 y peso 400–700.

## Por qué está aquí y no se pide a la red

La regla de este repositorio no es «cero dependencias»: es **cero peticiones a la red en
tiempo de ejecución**, y tiene un caso testigo — una fuente de iconos que no llegó dejó los
nombres (`visibility`, `shield`, `memory`) sueltos en mitad de la interfaz.

`next/font/google` descarga **en el build** y sirve local, así que en tiempo de ejecución
también cumple. Aun así los ficheros van versionados: el aula tiene un punto de acceso propio
y una compilación no puede depender de que ese día haya salida a internet. Un `.woff2` de
88 kB en git cuesta menos que un despliegue que falla el día de la clase.

## Por qué DOS ejes, y por qué eso importa

La dirección visual es un **frontal de instrumento de banco**. En un panel de laboratorio hay
dos clases de letra impresa y no son la misma:

| | Qué es | Eje |
|---|---|---|
| **Rótulo grabado** | `VOLTAJE`, `RANGO 0–8,4 V`, `CRIT` | **estrecha** (~78) y espaciada — cabe junto al control sin empujarlo |
| **Texto de panel** | títulos, prosa, botones | anchura normal (100) |

Con una fuente de un solo eje harían falta **dos ficheros**. Con Archivo variable es **uno**,
y la anchura se pide con `font-stretch` — que además interpola, así que el rótulo no salta de
una anchura a otra al cambiar de tamaño.

⚠️ **Lo que Archivo NO hace: medidas.** Las cifras siguen en Geist Mono. Es la regla del
proyecto y no cambia con la dirección: *la monoespaciada es para MEDIDAS*, no para disfrazar
algo de técnico.

## Subconjuntos

Dos: `latin` y `latin-ext`. El español entero (`áéíóúüñ¿¡`) cabe en `latin` —está en
U+00A1..U+00FF—; `latin-ext` va por los nombres propios. El vietnamita que sirve Google se
descartó: 86 kB para lo que aquí no se escribe.

## Procedencia

```
https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700
  latin      k3kQo8UDI-1M0wlSfdnoLg.woff2      90 104 B
  latin-ext  k3kQo8UDI-1M0wlSfdfoLnnA.woff2    86 240 B
```

Versión `v25`, descargados el **2026-08-16**. Licencia **SIL OFL 1.1**, en `OFL.txt` — permite
empaquetar y redistribuir; lo único que prohíbe es venderla suelta.
