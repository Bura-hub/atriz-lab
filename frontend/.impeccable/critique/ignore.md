# Reglas de `impeccable` silenciadas aquí, y por qué

Este fichero es el mecanismo oficial de la skill. Cada entrada es una decisión
**deliberada y reversible**, no un descuido: si el motivo deja de valer, se borra
la entrada y la regla vuelve a aplicar.

---

## `side-tab` — «Side-tab accent border»

**Dónde:** `src/componentes/flota/BaldosaRobot.tsx:50-51` (`border-l-4`, `border-l-8`)

**Lo que dice el detector:** *«Thick colored border on one side of a card — the
most recognizable tell of AI-generated UIs.»*

**Por qué se mantiene:** la franja **no es un acento decorativo: es la
codificación de urgencia para la distancia larga.** El muro se mira desde el otro
lado del aula y a veces proyectado; el nivel de atención no puede depender solo
del color, porque un proyector desatura y una de cada doce personas no distingue
rojo de ámbar.

🔴 **Y lo dice la propia skill**, en `critique.md:718`, que lista como defecto de
accesibilidad: *«Meaning conveyed by color alone (red = error, green = success)»*.
Las dos reglas de `impeccable` chocan aquí, y gana la de accesibilidad.

**Se comprobó que no era redundante antes de decidir:** la baldosa ya lleva el
texto «mirar» / «hay que ir», pero en `text-xs` — ilegible a tres metros. Son dos
codificaciones para dos distancias de lectura, no la misma dos veces.

**Cuándo dejaría de valer:** si el muro dejara de proyectarse o de mirarse de
lejos, el texto bastaría y la franja sobraría. Entonces se borra esta entrada.
