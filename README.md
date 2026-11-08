# Transcripción local de llamadas

Extensión de Chrome para transcribir en español el audio de una pestaña web con Ollama local. Captura dos fuentes: el audio de la pestaña de la llamada (el **usuario**) y el micrófono del **agente**; el audio de la pestaña sigue sonando mientras se captura. No escribe grabaciones en disco.

## Modelo

En PowerShell, descarga la variante rápida:

```powershell
ollama pull frozenlab/qwen3-asr:0.6b
```

El panel consulta Ollama y muestra los modelos que ya tienes instalados. Elige `frozenlab/qwen3-asr:0.6b` para esta integración.

## Instalar

1. Abre `chrome://extensions` y activa **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y selecciona esta carpeta.
3. Chrome 116 o posterior es necesario para mantener la captura en segundo plano.

## Uso

1. Abre la llamada o el vídeo en una pestaña web normal y pulsa el icono de la extensión. El icono solo abre el popup; **no inicia la captura**.
2. Elige los modelos en la configuración (engranaje) y pulsa **Cargar modelo** si quieres precalentarlo. Luego pulsa **Comenzar captura** para transcribir el audio de la pestaña activa.
3. Puedes cambiar a otra pestaña o ventana: la captura continúa en segundo plano. Vuelve al popup y pulsa **Detener captura** cuando termine la llamada. El distintivo **REC** indica que sigue activa; también se puede detener desde el menú contextual del icono.
4. Pulsa **Generar resumen** para resumir la conversación con el modelo de texto seleccionado. Los botones **Copiar** copian la transcripción o el resumen.

Cada intervención se etiqueta como `[USUARIO]` (audio de la pestaña) o `[AGENTE]` (micrófono), en una línea nueva cada vez que cambia el hablante. Las ventanas en silencio no se envían al modelo. Usa auriculares para que el micrófono no recoja la voz del usuario.

La captura usa ventanas continuas de cuatro segundos con un segundo de solape para reducir palabras perdidas entre fragmentos. Se eliminan las repeticiones detectadas en el solape de cada hablante. Al iniciar la captura el modelo STT se precalienta automáticamente; aun así, la primera petición tras descargar el modelo de memoria puede tardar más, y **Cargar modelo** reduce esa demora.

## Configuración

El botón del engranaje (arriba a la derecha) muestra la configuración dentro del propio popup; la flecha vuelve a la vista principal. Allí puedes:

- Elegir el modelo STT y el modelo LLM del resumen.
- Elegir el idioma de la transcripción (Español o Inglés).
- Editar el prompt del resumen (o restaurar el valor por defecto).

Pulsa **Guardar** para aplicar los cambios.

## Fuentes de audio

A la izquierda del header, dos indicadores muestran qué se puede capturar: un punto verde o rojo junto al icono de **pantalla** (audio de la pestaña activa, `[USUARIO]`) y junto al icono de **micrófono** (`[AGENTE]`). Pasa el ratón por encima para ver el motivo.

Si el micrófono está en rojo, púlsalo: se abre una pestaña para conceder el permiso (Chrome no permite pedirlo desde el popup). **Basta con hacerlo una vez**; sin él solo se transcribe al usuario.

## Resumen de la llamada

Pulsa **Generar resumen** cuando quieras resumir la conversación. Gracias a las etiquetas, el resumen reconstruye quién dice qué: motivo de contacto, producto o servicio afectado, síntomas, errores, pasos indicados por el agente y respuestas del usuario, solución o próximos pasos e impacto/urgencia; señala los datos importantes que falten y no debe inventar información. Puedes editar o copiar el resultado desde el cuadro de resumen. El botón **Limpiar sesión** (papelera, arriba) limpia tanto la transcripción como el resumen.

Tanto la transcripción como el resumen se procesan en `http://127.0.0.1:11434`; no se envían a servicios externos.
