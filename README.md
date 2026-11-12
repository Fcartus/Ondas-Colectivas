# Ondas colectivas

Una experiencia presencial para **más de 20 personas a la vez**: cada una escanea un QR, elige un sonido (un loop corto), lo enciende y lo **transforma girando el teléfono**. Cada persona es un **par de líneas** que vibran según su sonido real: la ve en su propio teléfono y, al mismo tiempo, proyectada en la pantalla grande junto a las de todos los demás. En reposo las líneas son rectas y verdes; con sonido se curvan, se cruzan y se encienden hacia el blanco, el rosado y el rojo.

Está construida sobre **Tacto** (broker MQTT, QR, el teléfono como control) y toma el motor de sonido y la idea de visualización de **Ondas visibles**.

**Funciona en línea:** se publica en **GitHub Pages** y los teléfonos se conectan con la pantalla a través de un **broker MQTT en línea** (EMQX), desde cualquier red, sin instalar nada. También puede correr en red local con `node server.js` (más rápido, para cuando no hay internet).

| | **En línea** (GitHub Pages) | **Local** (`node server.js`) |
|---|---|---|
| Pantalla | `https://<usuario>.github.io/<repositorio>/pantalla.html` | `https://localhost:8443/pantalla` |
| Teléfonos | Escanean el QR desde **cualquier red** (datos móviles, wifi local, entre otras redes) | Escanean el QR en la **misma red** que el computador |
| Broker | El de `config.js` (EMQX) o el de respaldo | El del propio servidor |
| Aviso de certificado | No | Sí, una vez por dispositivo |
| Latencia de las líneas | ~250 ms | ~10 ms |

El sonido sale de cada teléfono en los dos modos, así que la latencia solo se nota en lo que tarda la línea en llegar a la pantalla.

---

### El broker en línea (`public/config.js`)

```js
window.TACTO_CONFIG = {
  broker: 'wss://<tu-despliegue>.emqxsl.com:8084/mqtt',   // tu EMQX Cloud
  username: '…', password: '…',
  respaldo: 'wss://broker.emqx.io:8084/mqtt',             // si EMQX rechaza el usuario, se usa este (público, sin cuenta)
};

---

## Correr en red local

```bash
npm install        # solo la primera vez (si no está la carpeta node_modules)
node server.js
```



---

## Cómo funciona

```
 Teléfonos (index.html)                                 Computador + proyector (pantalla.html)
 ┌──────────────────────────────────┐    onda     ┌─────────────────────────────────────────────┐
 │ elige loop · enciende/apaga      │ ──────────► │ dibuja TODAS las líneas con la onda que     │
 │ modo + giro → parámetros         │   estado    │ manda cada teléfono                         │
 │ SU sonido suena aquí (Web Audio) │ ──────────► │                                             │
 │ analiza su sonido (8 bandas)     │   pulso     │ sonido de la pantalla: APAGADO al inicio;   │
 │ y dibuja SU par de líneas        │ ──────────► │ si se activa, toca además la mezcla de todos│
 └──────────────────────────────────┘             └─────────────────────────────────────────────┘
```

### Dónde suena

- **Cada persona suena en su propio teléfono, siempre**, desde que toca ENCENDER hasta que apaga. Así el audio de 20+ personas se reparte entre los teléfonos y no se satura un solo parlante. El teléfono genera su loop con el mismo motor de la pantalla, lo analiza (8 bandas de frecuencia y su nivel) y con eso dibuja su línea; esa misma medición viaja a la pantalla ~12 veces por segundo.
- **La pantalla parte en silencio:** solo muestra. En el panel (**B**), **Activar sonido de la pantalla** suma además la mezcla de todos por los parlantes de la sala (cada voz con el estado que manda su teléfono); el mismo botón la vuelve a apagar. La cabecera dice dónde está sonando: *🔈 en los teléfonos* o *🔊 pantalla + teléfonos*.
- Con el sonido de la pantalla activado, reverb y eco son uno solo para todos y el volumen de cada voz baja solo cuando suenan muchas, para no saturar.

> **iPhone:** el volumen del sonido es el del teléfono. La página pide a Safari que suene aunque esté el interruptor de silencio; si en algún iPhone no se escucha, revisa ese interruptor y sube el volumen.

### Qué se ve en las líneas

| Lo que suena | Cómo se ve |
|---|---|
| Graves | La línea se mece entera, en curvas amplias |
| Agudos | Ondulaciones finas y rápidas |
| Más volumen | Más curvatura, línea más gruesa, color de verde → blanco → rosado → rojo |
| Eco | La segunda línea del par es **la misma cuerda un instante antes**: con más eco, se atrasa y se separa más |
| Silencio / apagado | Par de líneas rectas y verdes (la persona está presente) |
| Tocar la pantalla del teléfono | Un destello y un golpe de sonido en esa persona |

Las líneas que no son de nadie quedan de fondo, finas y tenues. Hay al menos 80 columnas: a cada persona le toca un lugar repartido parejo.

---

## Puesta en marcha (modo local)

En línea basta con abrir la pantalla de GitHub Pages y escanear el QR. En modo local:

1. Computador y teléfonos en la **misma red**. Con más de 8–10 personas usa un **router WiFi** (no necesita internet): el hotspot de un teléfono acepta pocos dispositivos.
2. `node server.js` en esta carpeta. Si ya hay otro servidor de Tacto corriendo, ciérralo (usan el mismo puerto 8443) o usa otro: `$env:PORT="8444"; node server.js`.
3. En el computador, desde la barra de direcciones (no abriendo el archivo): **`https://localhost:8443/pantalla`**. Acepta el aviso del certificado (*Configuración avanzada → Continuar*).
4. **F** pone pantalla completa. El sonido sale de cada teléfono; si además quieres la mezcla por los parlantes de la sala, actívala en el panel (**B**).
5. Cada persona **escanea el QR**, acepta el aviso del certificado y entra directo, con un nombre al azar (tocando el nombre arriba se cambia).

## En el teléfono

1. Elige un **sonido** de la fila.
2. Toca **ENCENDER**. En iPhone pide el permiso de movimiento: hay que aceptarlo. El loop queda sonando hasta tocar **APAGAR**.
3. Elige un **modo** y **gira el teléfono**: el sonido y tu línea cambian al instante, en tu teléfono y en la pantalla grande.
4. **Toca tu línea** para dar un golpe (acento).
5. **Recalibrar posición** toma la posición actual como punto de partida; **Sonido original** vuelve todo a cero.

Todo es **relativo**: al entrar a un modo se guarda cómo tienes el teléfono y desde ahí inclinar suma o resta. Cambiar de modo **congela** lo que ajustaste en el anterior, así que se pueden ir sumando transformaciones: por ejemplo, oscurecer en *Filtro*, ensuciar en *Textura* y después abrir el espacio en *Espacio*.

Sin sensor de giro (en un computador, o si no se dio el permiso) se puede **arrastrar el dedo** sobre la línea: horizontal = inclinar a los lados, vertical = adelante/atrás.

### Modos

| Modo | Adelante / atrás | A los lados | Girar sobre la mesa |
|---|---|---|---|
| **Fusión** (todos a la vez) | energía: filtro + saturación + resonancia | tono + forma | espacio: reverb + eco |
| **Tono y forma** | tono (±12 semitonos) | forma de la onda (pliegue) | — |
| **Filtro** | corte (oscuro ↔ brillante) | resonancia | — |
| **Textura** | saturación | bits (sonido digital) | — |
| **Espacio** | reverb y eco | paneo izquierda ↔ derecha | — |

45° de inclinación recorren todo el rango de un parámetro (90° al girar sobre la mesa).

---

## Los sonidos

Los loops son los archivos de audio de **`public/sonidos/`** (wav, mp3, ogg, m4a, flac). Para agregar los tuyos:

1. Cópialos a esa carpeta. Que duren **10 segundos o menos** y que empiecen y terminen limpios para que el loop no haga clic.
2. Recarga la pantalla y los teléfonos. Aparecen solos, con el nombre del archivo (el número del comienzo sirve para ordenarlos y no se muestra: `1-pulso grave.wav` → *pulso grave*).

Vienen 5 loops de ejemplo, sintetizados (sin derechos de autor): *pulso grave*, *colchón*, *arpegio*, *lluvia* y *campanas*. Bórralos cuando subas los tuyos.

## La pantalla (panel, tecla **B**)

| Control | Qué hace |
|---|---|
| **Activar / Apagar sonido de la pantalla** | Suma o quita la mezcla de todos por los parlantes de la sala. Parte apagado: los teléfonos suenan siempre |
| **Volumen pantalla** | Volumen de esa mezcla (no cambia el de los teléfonos) |
| **Estela** | Cuánto tarda en apagarse el rastro de las líneas |
| **Mostrar nombres** | Nombre de cada persona al pie de su línea (**N**) |
| **Líneas de fondo** | Las líneas verdes tenues que no son de nadie |
| **Nueva sala** | Crea otra sala; todos vuelven a escanear |

Teclas: **F** pantalla completa · **Q** muestra/oculta el QR · **B** panel · **N** nombres.

---

## Archivos

```
Ondas colectivas/
├─ server.js            Servidor para el modo local: páginas, broker MQTT, QR, /pantalla y /sonidos.json
├─ lista-sonidos.js     Lista los loops (la usan el servidor y la publicación en Pages)
├─ package.json         Dependencias (las mismas de Tacto)
├─ .github/workflows/pages.yml   Publica public/ en GitHub Pages
└─ public/
   ├─ index.html        El teléfono: sonido, encender, modos, giro, tu línea
   ├─ pantalla.html     La pantalla grande: todas las líneas, QR, panel
   ├─ ondas-comun.js    Parámetros, modos, fórmula de las cuerdas y colores (lo comparten ambos)
   ├─ ondas-audio.js    Motor de sonido (lo usan el teléfono y la pantalla): voces, reverb y eco, análisis
   ├─ sonidos/          Los loops
   ├─ tacto.js          Conexión MQTT y salas (de Tacto)
   ├─ ui.css, config.js, manifest.webmanifest, icon.svg
```

### Mensajes MQTT

Todos bajo `tacto/<sala>/<dev>/`, en JSON.

| Tema | Quién → quién | Contenido |
|---|---|---|
| `status` (retenido, con testamento) | teléfono → pantalla | `{ online, name, app: 'ondas' }`, repetido cada 8 s |
| `estado` | teléfono → pantalla | `{ on, sonido, modo, p: { tono, forma, corte, reso, drive, bits, rev, eco, pan } }`, hasta ~15 por segundo mientras cambia |
| `pulso` | teléfono → pantalla | `{}`: golpe al tocar la línea |
| `onda` | teléfono → pantalla | `{ b: [8 bandas 0–99], n: nivel 0–99 }`: cómo suena su loop, ~12 por segundo (con esto se dibuja su línea) |

Con 25 personas son unos 700 mensajes pequeños por segundo: sin problema para el broker local.

### Ajustes

| Dónde | Qué |
|---|---|
| `ondas-comun.js` → `PARAMS` | Rangos y valores iniciales de cada parámetro |
| `ondas-comun.js` → `MODOS` | Qué mueve cada eje en cada modo, y con qué peso |
| `ondas-comun.js` → `aplicarGiro` | Grados para recorrer todo el rango (45° / 90°) |
| `ondas-comun.js` → `PALETA`, `ARMONICOS` | Colores por intensidad y cómo cada banda dobla la cuerda |
| `ondas-audio.js` → `analizar` | Sensibilidad de las bandas y del nivel |
| `pantalla.html` → loop de dibujo | Cantidad mínima de columnas (80), amplitud de las líneas |

---

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| "La conexión no es privada" | Es el certificado autofirmado: *Configuración avanzada → Continuar* (computador), *Mostrar detalles → visitar este sitio web* (iPhone), *Avanzado → Continuar* (Android). |
| Un teléfono no suena | La persona no tocó **ENCENDER**, tiene el volumen bajo o (iPhone) el interruptor de silencio activado. |
| La pantalla no suena | Es lo normal: parte en silencio. Actívala en el panel (**B**) con **Activar sonido de la pantalla**. |
| El giro no hace nada | No se aceptó el permiso de movimiento. En iPhone: cierra Safari por completo y vuelve a entrar. Mientras tanto, se puede arrastrar el dedo sobre la línea. |
| La pantalla dice "(respaldo)" | Tu EMQX rechazó el usuario o la contraseña de `config.js`: revísalos en la consola de EMQX Cloud. Mientras tanto funciona por el broker público. |
| En Pages faltan sonidos nuevos | Revisa en la pestaña **Actions** que la publicación terminó; recarga con la caché vacía. |
| Algunos teléfonos no logran entrar | El hotspot llegó a su límite de dispositivos: usa un router. |
| Un loop no aparece | Revisa que esté en `public/sonidos/` con una extensión de audio y recarga. Si el navegador no puede leer el formato, conviértelo a wav o mp3. |
| Aparece alguien que ya se fue | Desaparece solo a los 25–35 s sin señales de su teléfono. |
