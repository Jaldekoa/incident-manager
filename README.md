<div align="center">

# 📝 Incident Manager

### Transcribe, resume y categoriza llamadas de soporte, todo en local y en tiempo real

Una extensión de Chrome que escucha la llamada, separa la voz del **usuario** y la del **agente**, genera un **resumen** de la incidencia listo para el ticket y la **clasifica** en tu árbol de categorías. Todo se procesa con modelos que corren en tu máquina gracias a **Ollama**: ni el audio ni el texto salen de tu equipo.

<br/>

![Chrome](https://img.shields.io/badge/Chrome-116%2B-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge&logo=googlechrome&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
<br/>
![Ollama](https://img.shields.io/badge/Ollama-local-000000?style=for-the-badge&logo=ollama&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-42%20tests%20✓-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Privacy](https://img.shields.io/badge/Privacidad-100%25%20local-8A2BE2?style=for-the-badge&logo=shieldsdotio&logoColor=white)

<br/>

[Características](#-características) ·
[Cómo funciona](#-cómo-funciona) ·
[Arquitectura](#%EF%B8%8F-arquitectura) ·
[Instalación](#-instalación) ·
[Uso](#-uso) ·
[Configuración](#%EF%B8%8F-configuración) ·
[Desarrollo](#-desarrollo)

</div>

---

## 📸 Capturas

<table>
  <tr>
    <td align="center" width="33%">
      <img src="public/screenshot-main.png" alt="Vista principal: transcripción etiquetada, resumen y categoría" />
      <br/><sub><b>Vista principal</b>: transcripción en vivo, resumen y categoría</sub>
    </td>
    <td align="center" width="33%">
      <img src="public/screenshot-settings-1.png" alt="Configuración: modelos, idioma y prompt de resumen" />
      <br/><sub><b>Configuración</b>: modelos, idioma y prompt de resumen</sub>
    </td>
    <td align="center" width="33%">
      <img src="public/screenshot-settings-2.png" alt="Configuración: prompt de resumen y editor del árbol de categorías" />
      <br/><sub><b>Configuración</b>: prompt de resumen y editor del árbol de categorías</sub>
    </td>
  </tr>
</table>

---

## 💡 ¿Por qué existe?

En un servicio de soporte, cada llamada termina igual: el agente tiene que **reconstruir de memoria** lo que se ha dicho, redactar la incidencia y elegir a mano una categoría entre decenas. Es lento, propenso a errores y hace que los tickets sean irregulares.

**Incident Manager** automatiza ese trabajo mientras la llamada sucede:

| Sin la extensión | Con Incident Manager |
| --- | --- |
| Tomar notas mientras se atiende | Transcripción automática con quién dijo qué |
| Redactar el ticket al colgar | Resumen estructurado con un clic |
| Buscar la categoría en un desplegable enorme | Categoría propuesta con su probabilidad |
| Riesgo de enviar datos de clientes a la nube | **Todo en `127.0.0.1`**, sin servicios externos |

---

## ✨ Características

```mermaid
mindmap
  root((Incident<br/>Manager))
    🎙️ Transcripción STT
      Audio de la pestaña = USUARIO
      Micrófono = AGENTE
      Ventanas de 4 s con 1 s de solape
      Elimina repeticiones del solape
      Descarta silencios
      Sigue en segundo plano
    🧠 Resumen LLM
      Motivo, síntomas y errores
      Pasos del agente y respuestas
      Solución y próximos pasos
      Prompt editable
      No inventa datos
    🏷️ Categorización
      Modelo decisional Tev1
      Probabilidad conjunta en todo el árbol
      Escala a árboles grandes
      Corrección manual
      Editor drag and drop
    🔒 Privacidad
      Ollama en local
      Sin grabaciones en disco
      Sin servicios externos
```

- **🎙️ Transcripción a dos voces**: captura simultáneamente el audio de la pestaña de la llamada (el cliente) y el micrófono del agente, y etiqueta cada intervención como `[USUARIO]` o `[AGENTE]`. El audio de la pestaña **sigue sonando** mientras se captura.
- **🔁 Captura en segundo plano**: puedes cambiar de pestaña o de ventana; la transcripción continúa y el icono muestra un distintivo **REC**.
- **🧠 Resumen para el ticket**: un LLM reconstruye la conversación y devuelve un resumen en viñetas con motivo, producto afectado, síntomas, mensajes de error, pasos ya probados, solución e impacto. Si falta algo importante lo marca como *pendiente de confirmar*.
- **🏷️ Categorización probabilística**: recorre **todo** el árbol de categorías y elige la hoja con mayor probabilidad conjunta, mostrando el porcentaje de cada opción evaluada.
- **🌳 Editor de categorías**: arrastrar y soltar, reordenar, añadir, renombrar y describir categorías desde la propia extensión.
- **⚙️ Todo configurable**: modelos por rol, idioma (español / inglés), prompt del resumen y árbol de categorías.
- **🔒 100 % local**: STT, resumen y categorización se ejecutan contra Ollama en `http://127.0.0.1:11434`. No se escribe ninguna grabación en disco.

---

## 🧩 Cómo funciona

La extensión encadena tres modelos especializados, cada uno con un rol distinto:

```mermaid
flowchart LR
    subgraph IN["🎧 Entrada"]
        TAB["🖥️ Audio de la pestaña<br/><b>[USUARIO]</b>"]
        MIC["🎙️ Micrófono<br/><b>[AGENTE]</b>"]
    end

    subgraph P1["① ASR / STT"]
        ASR["Qwen3-ASR 0.6B<br/><code>/api/chat</code>"]
    end

    subgraph P2["② Resumen"]
        LLM["LLM de texto<br/>p. ej. Gemma<br/><code>/api/chat</code>"]
    end

    subgraph P3["③ Categorización"]
        DEC["Tev1 decisional<br/><code>/v1/systemone</code>"]
    end

    TAB --> ASR
    MIC --> ASR
    ASR -- "transcripción etiquetada" --> LLM
    LLM -- "resumen" --> DEC
    DEC -- "ruta + probabilidad" --> OUT["📋 Ticket listo<br/>transcripción · resumen · categoría"]

    classDef stage fill:#eef4ff,stroke:#4f6bed,color:#1b2a6b
    class P1,P2,P3 stage
```

### ① Transcripción (ASR / STT)

El documento *offscreen* recibe dos `MediaStream` (pestaña y micrófono), los pasa por un **AudioWorklet** propio y los trocea en ventanas deslizantes. Cada ventana con voz se convierte a **WAV PCM16 mono a 16 kHz**, se codifica en base64 y se envía a **Qwen3-ASR** a través de Ollama.

```mermaid
flowchart TD
    S["MediaStream<br/>(pestaña o micro)"] --> W["AudioWorklet<br/><code>capture-worklet.js</code><br/>mezcla a mono · lotes de 2048 muestras"]
    W --> R["Buffer circular<br/><code>createWindower()</code>"]
    R -->|"cada 3 s → ventana de 4 s"| V{"RMS ≥ 0,005?"}
    V -- "no (silencio)" --> X["🗑️ Se descarta"]
    V -- "sí" --> WAV["Remuestreo a 16 kHz<br/>WAV PCM16 + base64"]
    WAV --> Q["Cola única compartida<br/>(mantiene el orden cronológico)"]
    Q --> O["Ollama · Qwen3-ASR"]
    O --> T["Extrae el texto tras <code>&lt;asr_text&gt;</code>"]
    T --> D["Service worker<br/><code>removeOverlap()</code> + <code>appendSegment()</code>"]
    D --> ST[("chrome.storage.local<br/>transcript")]
```

**Ventanas con solape.** Para no cortar palabras entre fragmentos, cada ventana dura 4 s pero se emite una nueva cada 3 s, así que dos ventanas consecutivas comparten 1 s de audio:

```mermaid
gantt
    title Ventanas deslizantes (WINDOW = 4 s, STRIDE = 3 s)
    dateFormat ss
    axisFormat %S s
    section Audio
    Ventana 1           :w1, 00, 4s
    Ventana 2           :w2, 03, 4s
    Ventana 3           :w3, 06, 4s
    Ventana 4           :w4, 09, 4s
    section Solape
    1 s compartido      :crit, 03, 1s
    1 s compartido      :crit, 06, 1s
    1 s compartido      :crit, 09, 1s
```

El texto repetido que produce el solape se elimina en el service worker: `removeOverlap()` compara (normalizando mayúsculas y puntuación) las últimas 2–10 palabras del segmento anterior **de ese mismo hablante** con el principio del nuevo y descarta la coincidencia más larga. Después, `appendSegment()` continúa la línea si habla la misma persona o abre una nueva con su etiqueta:

```text
[USUARIO] Hola, buenos días. Llamo porque la impresora de la segunda planta no imprime nada.
[AGENTE] De acuerdo. ¿Le aparece algún mensaje de error en la pantalla?
[USUARIO] Sí, pone "atasco de papel", pero ya he abierto la bandeja y no hay nada.
```

<details>
<summary><b>🔬 Formato del audio enviado al modelo</b></summary>

<br/>

Cada fragmento se serializa en memoria (nunca toca el disco) como un WAV estándar de 44 bytes de cabecera seguido de las muestras PCM de 16 bits:

```mermaid
packet-beta
    title Cabecera WAV generada por wavFromPcm()
    0-31: "ChunkID = RIFF"
    32-63: "ChunkSize = 36 + datos"
    64-95: "Format = WAVE"
    96-127: "Subchunk1ID = fmt"
    128-159: "Subchunk1Size = 16"
    160-175: "AudioFormat = 1 (PCM)"
    176-191: "NumChannels = 1"
    192-223: "SampleRate = 16000"
    224-255: "ByteRate = 32000"
    256-271: "BlockAlign = 2"
    272-287: "BitsPerSample = 16"
    288-319: "Subchunk2ID = data"
    320-351: "Subchunk2Size = muestras × 2"
```

</details>

### ② Resumen

Con la transcripción etiquetada, un LLM de texto (por defecto `gemma4:12b`) recibe un *system prompt* de asistente de call center. Gracias a las etiquetas `[AGENTE]` / `[USUARIO]`, el modelo atribuye cada dato a quien lo dijo y devuelve un resumen en viñetas con:

> motivo de contacto · producto o servicio afectado · problema y síntomas · cuándo ocurre · mensajes de error · pasos que el usuario ya había probado · comprobaciones indicadas por el agente y su resultado · solución o próximos pasos · impacto o urgencia · estado final

El prompt le exige **no inventar datos** y marcar lo que falte como *pendiente de confirmar*. Es editable desde la configuración y el resultado se puede retocar a mano antes de copiarlo.

### ③ Categorización por probabilidad conjunta

La categoría la elige **Tev1**, un modelo *decisional* que, en lugar de generar texto, responde preguntas de tipo `choice` devolviendo **una distribución de probabilidad** sobre las opciones. La extensión aprovecha esto para hacer algo mejor que una clasificación voraz:

1. **Genera una pregunta por cada nodo con dos o más hijos**, redactada como probabilidad condicionada (*«Suponiendo que la incidencia pertenece a `informatica › hardware`, ¿qué subcategoría la describe mejor?»*). Las descripciones de cada categoría son los criterios.
2. **Resuelve todas las preguntas de una vez**, repartidas en las peticiones necesarias y en paralelo.
3. **Normaliza** las probabilidades de los hijos de cada nodo para obtener `P(hijo | padre)`.
4. **Recorre el árbol completo** multiplicando probabilidades y elige la hoja con mayor valor:

$$
P(\text{categoría}) = P(\text{área}) \times P(\text{subgrupo} \mid \text{área}) \times \dots \times P(\text{hoja} \mid \text{padre})
$$

¿Por qué no bajar simplemente por la rama más probable? Porque **un área algo menos probable puede contener una categoría mucho más clara**:

```mermaid
flowchart TD
    R(("Incidencia")) -->|"0,55"| A["informatica"]
    R -->|"0,45"| B["comercial"]

    A -->|"0,40"| A1["hardware<br/><b>0,22</b>"]
    A -->|"0,30"| A2["software<br/>0,165"]
    A -->|"0,30"| A3["redes<br/>0,165"]

    B -->|"0,90"| B1["facturacion<br/><b>0,405</b> 🏆"]
    B -->|"0,10"| B2["postventa<br/>0,045"]

    classDef win fill:#d9f7e3,stroke:#1f9d55,color:#0b4d2a,stroke-width:2px
    classDef greedy fill:#fff4d6,stroke:#d69e2e,color:#5f4300
    class B,B1 win
    class A,A1 greedy
```

> Un algoritmo voraz habría elegido `informatica › hardware` (0,22). La búsqueda exhaustiva encuentra `comercial › facturacion` (0,405), casi el doble de probable.

**Escala con el árbol**: los nodos con más de 24 opciones se dividen en bloques con una opción extra *«ninguna de las anteriores»*, que se descarta y se renormaliza al unir los bloques; y las preguntas se agrupan respetando los límites de la API (64 preguntas y 64 KiB por petición). Los nodos con un único hijo no se consultan.

El resultado se muestra en un **selector jerárquico** con la rama ganadora desplegada y el porcentaje conjunto de cada opción evaluada. Si el agente no está de acuerdo, puede elegir otra categoría a mano.

<details>
<summary><b>🌳 Árbol de categorías por defecto</b></summary>

<br/>

```mermaid
mindmap
  root((Categorías))
    mantenimiento
      instalaciones
        clima
        electricidad
        fontaneria
      mobiliario
        estructura
        muebles
        puertas_ventanas
      seguridad
        alarmas
        tornos
      limpieza
        higienicos
        residuos
    informatica
      hardware
        pcs
        perifericos
        impresoras
      software
        corporativo
        ofimatica
        nuevas_instalaciones
      redes
        internet
        wifi
        telefonia
      cuentas
        passwords
        permisos
        virus
    logistica
      recepcion
        roturas
        descuadres_albaran
        retrasos
      almacen
        descuadres_stock
        caducidades
        maquinaria
      envios
        retrasos_ruta
        entregas_fallidas
        perdidas
      flota
        averias
        itv
        accidentes
    comercial
      postventa
        quejas
        devoluciones
        fidelizacion
      facturacion
        errores_precio
        cobros
        tpv
      marketing
        plv
        cupones
        web
      b2b
        contratos
        datos_fiscales
    rrhh
      gestion
        nominas
        prl
        tramites
    otros
      sin_clasificar
        desconocido
```

Cada nodo incluye una descripción que el modelo decisional usa como criterio. El árbol se define en [`src/config/categories.ts`](src/config/categories.ts) y se puede editar desde la extensión.

</details>

---

## 🏗️ Arquitectura

Una extensión Manifest V3 no puede capturar audio desde el popup (se cierra al perder el foco) ni desde el service worker (no tiene acceso al DOM ni a Web Audio). Por eso la extensión se reparte en cuatro contextos que se comunican con **mensajes tipados**:

```mermaid
architecture-beta
    group chrome(cloud)[Chrome]

    service popup(internet)[Popup React] in chrome
    service sw(server)[Service worker] in chrome
    service off(server)[Offscreen document] in chrome
    service perm(internet)[Pagina de permiso] in chrome
    service storage(database)[chrome storage] in chrome

    group local(cloud)[Equipo local]
    service ollama(server)[Ollama 127001 11434] in local
    service models(disk)[Modelos ASR LLM Tev1] in local

    popup:R --> L:sw
    sw:R --> L:off
    sw:B --> T:storage
    popup:B --> T:perm
    off:B --> T:ollama
    ollama:R --> L:models
```

<details open>
<summary><b>Vista detallada de componentes</b></summary>

<br/>

```mermaid
flowchart TB
    subgraph CHROME["🌐 Chrome"]
        direction TB

        subgraph UI["Popup · React 19"]
            MV["MainView<br/>captura · transcripción · resumen · categoría"]
            SV["SettingsView<br/>modelos · idioma · prompt · editor de categorías"]
        end

        PERM["Página de permiso<br/><i>getUserMedia(audio)</i>"]

        subgraph SW["Service worker"]
            H["Handlers tipados<br/>START / STOP / APPEND / STATE / PRELOAD"]
            TR["transcript.ts<br/>removeOverlap · appendSegment"]
            BADGE["Badge REC · menú contextual"]
        end

        subgraph OFF["Offscreen document"]
            CAP["capture.ts<br/>AudioContext · cola de transcripción"]
            WK["capture-worklet.js<br/>AudioWorkletProcessor"]
            AUD["audio.ts<br/>windower · RMS · WAV · base64"]
        end

        LS[("storage.local<br/>transcript · summary · category<br/>categories · modelos · prompt")]
        SS[("storage.session<br/>capturing · lastError")]
    end

    subgraph OLLAMA["🦙 Ollama · 127.0.0.1:11434"]
        E1["/api/chat · Qwen3-ASR"]
        E2["/api/chat · LLM de resumen"]
        E3["/v1/systemone · Tev1"]
        E4["/api/tags · /api/generate"]
    end

    MV -- "START_CAPTURE / STOP_CAPTURE" --> H
    H -- "tabCapture streamId" --> CAP
    CAP --> WK --> AUD --> CAP
    CAP -- "WAV base64" --> E1
    CAP -- "APPEND_TRANSCRIPT" --> TR --> LS
    CAP -- "CAPTURE_STATE" --> H --> SS
    H --> BADGE
    LS -. "onChanged (useChromeStorage)" .-> MV
    SS -. "onChanged" .-> MV
    MV -- "resumen" --> E2
    MV -- "categorize()" --> E3
    SV -- "modelos instalados" --> E4
    SV --> LS
    MV -- "sin permiso de micro" --> PERM
```

</details>

| Contexto | Responsabilidad | Ficheros |
| --- | --- | --- |
| **Popup** | Interfaz en React: botones de captura, transcripción en vivo, resumen, categoría y configuración. Lanza el resumen y la categorización directamente contra Ollama. | [`src/popup/`](src/popup) |
| **Service worker** | Orquestador: crea el documento offscreen, obtiene el `streamId` de `tabCapture`, une los segmentos de la transcripción, mantiene el estado y el distintivo **REC**. | [`src/background/`](src/background) |
| **Offscreen document** | Documento oculto con acceso a Web Audio: captura pestaña y micrófono, trocea el audio, filtra silencios y llama al modelo STT. Sobrevive al cierre del popup. | [`src/offscreen/`](src/offscreen), [`public/capture-worklet.js`](public/capture-worklet.js) |
| **Página de permiso** | Chrome no permite pedir el micrófono desde un popup; esta pestaña lo solicita una sola vez y se cierra sola. | [`src/permission/`](src/permission) |
| **Shared** | Cliente de Ollama, mensajes tipados, `chrome.storage` tipado, ajustes y operaciones sobre el árbol de categorías. | [`src/shared/`](src/shared) |
| **Categorize** | Algoritmo de probabilidad conjunta con Tev1. | [`src/categorize/`](src/categorize) |
| **Config** | Única fuente de valores por defecto editables por el desarrollador. | [`src/config/`](src/config) |

### Decisiones de diseño destacables

- **Mensajería con tipos de extremo a extremo**: `BackgroundRequest`, `OffscreenRequest` y `BackgroundResponse<T>` son uniones discriminadas; el mapa de *handlers* del service worker está tipado para que el compilador exija un manejador por cada mensaje y su respuesta correcta.
- **Generaciones de captura**: cada inicio incrementa un contador `captureGeneration`. Las respuestas del ASR que llegan tarde de una sesión anterior se descartan, y la petición en curso se aborta con `AbortController` al detener.
- **Operaciones serializadas**: `enqueueCaptureOperation()` encadena los *start/stop* para que nunca se solapen, aunque el usuario pulse rápido.
- **Una sola cola de transcripción** para ambas fuentes, de modo que el texto llega en orden cronológico aunque las dos voces se solapen.
- **Sin realimentación**: el micrófono se procesa a través de un `GainNode` a volumen 0; la pestaña, en cambio, se reenvía al `destination` para que se siga oyendo.
- **Estado reactivo**: el popup no guarda estado propio de la sesión; se suscribe a `chrome.storage` con el hook `useChromeStorage`, así que al reabrirlo muestra exactamente lo que hay.
- **Precalentamiento**: al iniciar la captura (o con **Cargar modelo**) se hace una petición vacía con `keep_alive: 30m` para que el modelo esté cargado cuando llegue la primera ventana.

---

## 🔄 Secuencia completa

```mermaid
sequenceDiagram
    autonumber
    actor A as 👤 Agente
    participant P as Popup (React)
    participant SW as Service worker
    participant OF as Offscreen
    participant ST as chrome.storage
    participant OL as 🦙 Ollama

    A->>P: Pulsa «Comenzar captura»
    P->>SW: START_CAPTURE { tabId }
    SW->>SW: ensureOffscreen() + PING
    SW->>SW: tabCapture.getMediaStreamId()
    SW->>OF: START_CAPTURE { streamId }
    OF-)OL: /api/generate (precalentar ASR)
    OF->>OF: getUserMedia(pestaña) + getUserMedia(micro)
    OF->>SW: CAPTURE_STATE { capturing: true }
    SW->>ST: session.capturing = true
    SW->>SW: Badge «REC»

    loop Cada 3 s y por cada fuente con voz
        OF->>OF: Ventana de 4 s → RMS → WAV 16 kHz
        OF->>OL: /api/chat (Qwen3-ASR + audio base64)
        OL-->>OF: «language Spanish<asr_text>…»
        OF->>SW: APPEND_TRANSCRIPT { speaker, text }
        SW->>SW: removeOverlap() + appendSegment()
        SW->>ST: local.transcript
        ST--)P: onChanged → la transcripción se actualiza
    end

    A->>P: Pulsa «Detener captura»
    P->>SW: STOP_CAPTURE
    SW->>OF: STOP_CAPTURE (aborta petición, cierra streams)
    SW->>ST: session.capturing = false

    A->>P: Pulsa «Generar resumen»
    P->>OL: /api/chat (system prompt + transcripción)
    OL-->>P: Resumen en viñetas
    P->>ST: local.summary

    A->>P: Pulsa «Categorizar»
    P->>OL: /v1/systemone × N lotes en paralelo
    OL-->>P: Distribuciones de probabilidad
    P->>P: Normaliza y recorre el árbol
    P->>ST: local.category { path, score, scores }
    P-->>A: Categoría + probabilidades
```

### Ciclo de vida de la captura

```mermaid
stateDiagram-v2
    [*] --> Inactiva
    Inactiva --> Iniciando: Comenzar captura
    Iniciando --> Capturando: streams listos
    Iniciando --> Inactiva: error (pestaña no capturable, Ollama caído…)

    state Capturando {
        [*] --> SoloUsuario: sin permiso de micro
        [*] --> DosVoces: micro concedido
        SoloUsuario --> SoloUsuario: ventana → ASR
        DosVoces --> DosVoces: ventana → ASR
    }

    Capturando --> Deteniendo: Detener captura
    Capturando --> Deteniendo: menú contextual «Detener captura»
    Capturando --> Deteniendo: la pestaña se cierra
    Deteniendo --> Inactiva: streams cerrados · badge limpio
    Inactiva --> [*]
```

---

## 🛠️ Tecnologías

| Área | Tecnología | Uso |
| --- | --- | --- |
| Plataforma | **Chrome Extensions MV3** | `tabCapture`, `offscreen`, `storage`, `contextMenus`, `activeTab`, `clipboardWrite` |
| Lenguaje | **TypeScript 5.9** (modo estricto) | Todo el código, incluida la mensajería entre contextos |
| UI | **React 19** + CSS propio | Popup con vistas principal y de configuración |
| Iconos | **Material Symbols** | Interfaz y generación del icono de la extensión con **sharp** |
| Build | **Vite 6** + **@crxjs/vite-plugin** | Manifest en TypeScript, HMR del popup y empaquetado en `dist/` |
| Audio | **Web Audio API** · **AudioWorklet** | Captura, mezcla a mono, ventanas y remuestreo a 16 kHz |
| IA local | **Ollama** | Servidor de inferencia en `127.0.0.1:11434` |
| STT | **Qwen3-ASR 0.6B** (`frozenlab/qwen3-asr:0.6b`) | Reconocimiento de voz por fragmentos |
| Resumen | **LLM de texto** (por defecto `gemma4:12b`) | Cualquier modelo de chat instalado en Ollama |
| Clasificación | **Tev1** (`/v1/systemone`) | Preguntas `choice` con distribución de probabilidad |
| Tests | **Vitest** | 42 tests de la lógica sin interfaz |

---

## 📦 Instalación

### Requisitos

- **Google Chrome 116** o posterior
- **Node.js 20** o posterior
- **[Ollama](https://ollama.com) 0.35** o posterior (necesario para Tev1)

### 1. Descarga los modelos

```powershell
ollama pull frozenlab/qwen3-asr:0.6b   # transcripción (STT)
ollama pull gemma4:12b                 # resumen (o cualquier otro LLM de chat)
ollama pull tev1                       # categorización (modelo decisional)
```

> [!TIP]
> No es obligatorio usar estos modelos: el panel lee los que tienes instalados en Ollama y, si el modelo por defecto de un rol no está, preselecciona automáticamente el que mejor encaja.

### 2. Compila la extensión

```powershell
git clone <url-del-repositorio>
cd stt-extension
npm install
npm run build
```

### 3. Cárgala en Chrome

1. Abre `chrome://extensions` y activa el **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y selecciona la carpeta **`dist/`**.
3. Fija el icono de la extensión en la barra para tenerla a mano.

> [!NOTE]
> Tras cambiar el código, ejecuta de nuevo `npm run build` y pulsa **Recargar** en la tarjeta de la extensión.

---

## 🚀 Uso

1. **Abre la llamada** (o un vídeo) en una pestaña web normal y pulsa el icono de la extensión. Abrir el popup **no** inicia la captura.
2. **Comprueba las fuentes**: a la izquierda de la cabecera, un punto verde o rojo indica si se puede capturar la **pantalla** (`[USUARIO]`) y el **micrófono** (`[AGENTE]`). Si el micrófono está en rojo, púlsalo para conceder el permiso: **basta con hacerlo una vez**.
3. Opcionalmente pulsa **Cargar modelo** para precalentar el ASR y pulsa **Comenzar captura**.
4. Atiende la llamada con normalidad. Puedes cambiar de pestaña: la captura sigue y el icono muestra **REC**.
5. Pulsa **Detener captura** (también disponible en el menú contextual del icono).
6. Pulsa **Generar resumen** y, cuando esté listo, **Categorizar**.
7. Revisa, ajusta si hace falta y usa los botones **Copiar** para llevar la transcripción, el resumen o la ruta de la categoría a tu herramienta de tickets.
8. **Limpiar sesión** (papelera) borra la transcripción, el resumen y la categoría para la siguiente llamada.

> [!IMPORTANT]
> Usa **auriculares**: si el micrófono recoge el altavoz, la voz del usuario aparecerá también como `[AGENTE]`.

---

## ⚙️ Configuración

El engranaje de la cabecera abre la configuración dentro del propio popup:

| Sección | Opciones |
| --- | --- |
| **Transcripción** | Modelo STT e idioma (español o inglés) |
| **Resumen** | Modelo LLM y prompt del resumen (con botón para restaurar el valor por defecto) |
| **Categoría** | Modelo decisional y editor del árbol de categorías |

### Editor de categorías

| Acción | Cómo |
| --- | --- |
| Desplegar / plegar | **▶ / ▼** |
| Mover | **Arrastrar y soltar** sobre otra fila: parte superior = **antes**, centro = **dentro**, parte inferior = **después** |
| Reordenar entre hermanas | **↑ / ↓** |
| Añadir subcategoría | **＋** |
| Eliminar (con sus hijas) | **🗑** |
| Renombrar y describir | **Clic en el nombre** |
| Nueva área | **Añadir área** |
| Volver al original | **Restaurar por defecto** |

Una categoría sin hijas es una categoría final. **Guardar** valida que no haya nombres vacíos ni repetidos entre hermanas; si vuelves atrás sin guardar, los cambios se descartan.

> [!TIP]
> La descripción de cada categoría es lo que el modelo decisional lee para elegir: cuanto más clara y distintiva, mejor categoriza.

### Valores por defecto para desarrolladores

Todo lo ajustable está centralizado en [`src/config/`](src/config). Lo que el usuario guarda en la configuración tiene prioridad sobre estos valores.

| Fichero | Contenido |
| --- | --- |
| [`app.ts`](src/config/app.ts) | Nombre, descripción e icono (`APP_ICON`, un nombre de Material Symbols) |
| [`models.ts`](src/config/models.ts) | URL de Ollama, `keep_alive`, modelos por defecto y patrones de autodetección |
| [`languages.ts`](src/config/languages.ts) | Idiomas disponibles e idioma por defecto |
| [`prompts.ts`](src/config/prompts.ts) | Prompt del STT, del resumen y preguntas de categorización |
| [`categories.ts`](src/config/categories.ts) | Árbol de categorías por defecto |
| [`capture.ts`](src/config/capture.ts) | Etiquetas de hablante, ventana/solape, umbral de silencio y procesado del micrófono |

> [!NOTE]
> Si cambias `APP_ICON`, ejecuta `npm run icons`. Si cambias la URL de Ollama, `host_permissions` del manifest se actualiza solo.

---

## 🧑‍💻 Desarrollo

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run dev` | Servidor de desarrollo con recarga del popup (carga `dist/` una vez) |
| `npm test` | Ejecuta los tests unitarios con Vitest |
| `npm run typecheck` | Solo comprobación de tipos |
| `npm run icons` | Regenera los iconos de `public/icons/` a partir de `APP_ICON` |

### Estructura del proyecto

```text
stt-extension/
├── manifest.config.ts        # Manifest MV3 en TypeScript (@crxjs)
├── vite.config.ts
├── public/
│   ├── capture-worklet.js    # AudioWorkletProcessor de captura
│   └── icons/                # Iconos generados
├── scripts/
│   └── generate-icons.mjs    # Material Symbols → PNG con sharp
├── src/
│   ├── config/               # ⚙️ Valores por defecto editables
│   ├── background/           # Service worker: orquestación y transcripción
│   ├── offscreen/            # Captura de audio y llamadas al STT
│   ├── popup/                # Interfaz React (views, components, hooks)
│   ├── permission/           # Página de permiso de micrófono
│   ├── categorize/           # Categorización por probabilidad conjunta
│   └── shared/               # Ollama, mensajes, storage, ajustes y categorías
└── tests/                    # Tests de la lógica sin interfaz
```

### Tests

La lógica pura está separada de las APIs del navegador para poder probarla sin Chrome:

| Suite | Qué cubre |
| --- | --- |
| `audio.test.ts` | Ventanas deslizantes, RMS, WAV y base64 |
| `transcript.test.ts` | Eliminación del solape y etiquetado por hablante |
| `categorize.test.ts` | Preguntas, lotes, bloques de más de 24 opciones y probabilidad conjunta |
| `categories.test.ts` | Conversión y validación del árbol de categorías |
| `categoryOps.test.ts` | Operaciones del editor: mover, reordenar, añadir y eliminar |
| `settings.test.ts` | Ajustes, URLs capturables y elección automática de modelos |

---

## 🔒 Privacidad

```mermaid
flowchart LR
    subgraph PC["💻 Tu equipo"]
        EXT["Extensión"] <-->|"HTTP local"| OL["Ollama<br/>127.0.0.1:11434"]
        EXT --> MEM["Memoria<br/>(audio en RAM)"]
        EXT --> ST[("chrome.storage<br/>solo texto")]
    end
    PC -.-x|"❌ nada sale de aquí"| NET(("☁️ Internet"))
```

- El audio se procesa **en memoria** en ventanas de 4 s y **nunca se escribe en disco**.
- Lo único que se guarda es texto (transcripción, resumen, categoría y ajustes) en `chrome.storage` de tu navegador.
- El único host al que la extensión tiene permiso para conectarse es tu Ollama local (`host_permissions`).

---

<div align="center">

Hecho con ☕ y 🎧 por **Jon Aldekoa**

</div>
