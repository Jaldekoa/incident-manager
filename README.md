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
2. Desde el popup, elige el modelo de voz y pulsa **Cargar modelo** si quieres precalentarlo. Luego pulsa **Comenzar captura** para transcribir el audio de la pestaña activa.
3. Puedes cambiar a otra pestaña o ventana: la captura continúa en segundo plano. Vuelve al popup y pulsa **Detener captura** cuando termine la llamada. El distintivo **REC** indica que sigue activa; también se puede detener desde el menú contextual del icono.
4. Pulsa **Generar resumen** para resumir la conversación con el modelo de texto seleccionado. Los botones **Copiar** copian la transcripción o el resumen.

Cada intervención se etiqueta como `[USUARIO]` (audio de la pestaña) o `[AGENTE]` (micrófono), en una línea nueva cada vez que cambia el hablante. Las ventanas en silencio no se envían al modelo. Usa auriculares para que el micrófono no recoja la voz del usuario.

La captura usa ventanas continuas de cuatro segundos con un segundo de solape para reducir palabras perdidas entre fragmentos. Se eliminan las repeticiones detectadas en el solape de cada hablante. Al iniciar la captura el modelo STT se precalienta automáticamente; aun así, la primera petición tras descargar el modelo de memoria puede tardar más, y **Cargar modelo** reduce esa demora.

## Configuración

El botón del engranaje (arriba a la derecha) abre la página de configuración, donde puedes:

- Elegir el modelo STT y el modelo LLM del resumen.
- Editar el prompt de cada sección (o restaurar los valores por defecto).
- Conceder el permiso de micrófono a la extensión. **Es necesario hacerlo una vez** para que se transcriba al agente; sin él solo se transcribe al usuario.

## Resumen de la llamada

Debajo de la transcripción, elige un modelo de texto instalado en Ollama y pulsa **Generar resumen** cuando quieras resumir la conversación. Gracias a las etiquetas, el resumen reconstruye quién dice qué: motivo de contacto, producto o servicio afectado, síntomas, errores, pasos indicados por el agente y respuestas del usuario, solución o próximos pasos e impacto/urgencia; señala los datos importantes que falten y no debe inventar información. Puedes editar o copiar el resultado desde el cuadro de resumen. El botón **Limpiar sesión** (papelera, arriba) limpia tanto la transcripción como el resumen.

Tanto la transcripción como el resumen se procesan en `http://127.0.0.1:11434`; no se envían a servicios externos.
