# Incident Manager

Extensión de Chrome para gestionar incidencias reportadas en llamadas de soporte: transcribe, resume y categoriza en local con Ollama. Captura dos fuentes: el audio de la pestaña de la llamada (el **usuario**) y el micrófono del **agente**; el audio de la pestaña sigue sonando mientras se captura. No escribe grabaciones en disco.

## Modelo

En PowerShell, descarga la variante rápida:

```powershell
ollama pull frozenlab/qwen3-asr:0.6b
```

Para la categorización, descarga también el modelo decisional Tev1 (requiere Ollama 0.35 o posterior):

```powershell
ollama pull tev1
```

El panel consulta Ollama y muestra los modelos que ya tienes instalados. Elige `frozenlab/qwen3-asr:0.6b` para esta integración.

## Instalar

Requiere Node.js 20 o posterior.

```powershell
npm install
npm run build
```

1. Abre `chrome://extensions` y activa **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y selecciona la carpeta **`dist/`** que genera el build.
3. Chrome 116 o posterior es necesario para mantener la captura en segundo plano.

Tras cambiar el código, vuelve a ejecutar `npm run build` y pulsa **Recargar** en la tarjeta de la extensión.

## Desarrollo

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run dev` | Servidor de desarrollo con recarga del popup (carga `dist/` una vez) |
| `npm test` | Tests unitarios (Vitest) |
| `npm run typecheck` | Solo comprobación de tipos |
| `npm run icons` | Regenera los iconos de la extensión (`public/icons/`) a partir de `APP_ICON` |

Estructura:

- `src/config/`: **valores por defecto y constantes editables** (ver abajo).
- `src/background/`: service worker (control de la captura, transcripción etiquetada).
- `src/offscreen/`: documento oculto que captura pestaña y micrófono y llama al modelo STT.
- `src/popup/`: interfaz en React (vista principal y configuración).
- `src/permission/`: página para conceder el permiso de micrófono.
- `src/categorize/`: categorización con Tev1 por probabilidad conjunta.
- `src/shared/`: cliente de Ollama, ajustes guardados, árbol de categorías, `chrome.storage` y mensajes tipados entre contextos.
- `public/capture-worklet.js`: AudioWorklet que recoge las muestras de audio.
- `tests/`: tests de la lógica sin interfaz.
- `scripts/generate-icons.mjs`: genera los PNG del icono.

### Configuración por defecto (`src/config/`)

Todo lo que un desarrollador puede querer cambiar está aquí; el resto del código lo importa desde `src/config`:

| Archivo | Contenido |
| --- | --- |
| `app.ts` | Nombre (`APP_NAME`), descripción e icono (`APP_ICON`, un nombre de Material Symbols) |
| `models.ts` | URL de Ollama, `keep_alive`, modelos por defecto (STT, resumen y decisional) y patrones para elegir otro si no están instalados |
| `languages.ts` | Idiomas disponibles e idioma por defecto |
| `prompts.ts` | Prompt del STT, prompt de resumen por defecto, mensaje de usuario del resumen y preguntas de categorización |
| `categories.ts` | Árbol de categorías por defecto (con sus descripciones) |
| `capture.ts` | Etiquetas de hablante, ventana/solape del audio, umbral de silencio y opciones del micrófono |

Los valores de `models.ts`, `languages.ts`, `prompts.ts` y `categories.ts` son solo los iniciales: lo que el usuario guarda en Configuración tiene prioridad. Si cambias `APP_ICON`, ejecuta `npm run icons`. Si cambias la URL de Ollama, el permiso del manifest se actualiza solo.

## Uso

1. Abre la llamada o el vídeo en una pestaña web normal y pulsa el icono de la extensión. El icono solo abre el popup; **no inicia la captura**.
2. Elige los modelos en la configuración (engranaje) y pulsa **Cargar modelo** si quieres precalentarlo. Luego pulsa **Comenzar captura** para transcribir el audio de la pestaña activa.
3. Puedes cambiar a otra pestaña o ventana: la captura continúa en segundo plano. Vuelve al popup y pulsa **Detener captura** cuando termine la llamada. El distintivo **REC** indica que sigue activa; también se puede detener desde el menú contextual del icono.
4. Pulsa **Generar resumen** para resumir la conversación con el modelo de texto seleccionado. Los botones **Copiar** copian la transcripción o el resumen.

Cada intervención se etiqueta como `[USUARIO]` (audio de la pestaña) o `[AGENTE]` (micrófono), en una línea nueva cada vez que cambia el hablante. Las ventanas en silencio no se envían al modelo. Usa auriculares para que el micrófono no recoja la voz del usuario.

La captura usa ventanas continuas de cuatro segundos con un segundo de solape para reducir palabras perdidas entre fragmentos. Se eliminan las repeticiones detectadas en el solape de cada hablante. Al iniciar la captura el modelo STT se precalienta automáticamente; aun así, la primera petición tras descargar el modelo de memoria puede tardar más, y **Cargar modelo** reduce esa demora.

## Configuración

El botón del engranaje (arriba a la derecha) muestra la configuración dentro del propio popup; la flecha vuelve a la vista principal. Allí puedes:

- Elegir el modelo STT, el modelo LLM del resumen y el modelo decisional de la categoría.
- Elegir el idioma de la transcripción (Español o Inglés).
- Editar el prompt del resumen (o restaurar el valor por defecto).

Pulsa **Guardar** para aplicar los cambios.

## Fuentes de audio

A la izquierda del header, dos indicadores muestran qué se puede capturar: un punto verde o rojo junto al icono de **pantalla** (audio de la pestaña activa, `[USUARIO]`) y junto al icono de **micrófono** (`[AGENTE]`). Pasa el ratón por encima para ver el motivo.

Si el micrófono está en rojo, púlsalo: se abre una pestaña para conceder el permiso (Chrome no permite pedirlo desde el popup). **Basta con hacerlo una vez**; sin él solo se transcribe al usuario.

## Resumen de la llamada

Pulsa **Generar resumen** cuando quieras resumir la conversación. Gracias a las etiquetas, el resumen reconstruye quién dice qué: motivo de contacto, producto o servicio afectado, síntomas, errores, pasos indicados por el agente y respuestas del usuario, solución o próximos pasos e impacto/urgencia; señala los datos importantes que falten y no debe inventar información. Puedes editar o copiar el resultado desde el cuadro de resumen. El botón **Limpiar sesión** (papelera, arriba) limpia tanto la transcripción como el resumen.

## Categoría

Con el resumen generado, pulsa **Categorizar** para clasificar la incidencia en el árbol de categorías. Se usa el modelo decisional Tev1 a través del endpoint `/v1/systemone` de Ollama y se elige la categoría final con **mayor probabilidad conjunta**: P(área) × P(subgrupo | área) × … × P(categoría | padre). Para ello se hace una pregunta por cada nodo con varias opciones y se recorre el árbol completo, de modo que un área algo menos probable puede ganar si contiene una categoría claramente más probable. Los nodos con una sola opción no se consultan.

El algoritmo escala con el árbol: los nodos con más de 24 opciones se dividen en bloques (con una opción "ninguna de las anteriores") que luego se renormalizan juntos, y las preguntas se reparten en varias peticiones si superan los límites de la API (64 preguntas o 64 KiB por petición).

El resultado aparece en un selector jerárquico, deshabilitado hasta la primera categorización. Al abrirlo se ve el árbol completo: las ramas se despliegan con ▶, la rama elegida aparece abierta y cada opción evaluada por el modelo muestra a la derecha su probabilidad conjunta (las que no pasan por el modelo, sin porcentaje). Puedes elegir otra categoría a mano, y el botón de copiar copia la ruta seleccionada. Al pasar el cursor sobre una categoría se muestra su descripción.

### Editar las categorías

En **Configuración › Categoría** está el editor del árbol:

- **▶ / ▼** despliega o pliega una rama.
- **Arrastrar y soltar** (desde cualquier punto de la fila) mueve una categoría: según dónde la sueltes sobre otra fila queda **antes** (parte superior, línea azul arriba), **dentro** (centro, fondo azul) o **después** (parte inferior, línea azul abajo). Funciona dentro del mismo nivel y entre niveles; no se puede soltar una categoría dentro de sí misma.
- **↑ / ↓** sube o baja una categoría entre sus hermanas, **＋** añade una subcategoría y **🗑** la elimina junto con sus subcategorías.
- **Clic en el nombre** abre su nombre y su descripción para editarlos. La descripción es lo que usa el modelo decisional para elegir, así que conviene que sea clara.
- **Añadir área** crea una categoría de primer nivel y **Restaurar por defecto** recupera el árbol original.

Una categoría sin subcategorías es una categoría final. Los cambios se aplican al pulsar **Guardar**, que comprueba que no haya nombres vacíos ni repetidos entre hermanas; si vuelves atrás sin guardar, se descartan. El árbol por defecto está definido en `src/config/categories.ts`.

La transcripción, el resumen y la categorización se procesan en `http://127.0.0.1:11434`; no se envían a servicios externos.
