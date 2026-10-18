# Transcripción local de llamadas

Extensión de Chrome para transcribir en español el audio de una pestaña web con Ollama local. Solo captura audio de pestaña; el audio sigue sonando mientras se captura. No escribe grabaciones en disco.

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
4. Pulsa **Generar** para resumir la conversación con el modelo de texto seleccionado. Los botones **Copiar** copian la transcripción o el resumen.

La captura usa ventanas continuas de cuatro segundos con un segundo de solape para reducir palabras perdidas entre fragmentos. El texto se añade sin etiqueta de hablante y se eliminan repeticiones detectadas en el solape. La primera petición después de descargar el modelo o de que Ollama lo descargue de memoria puede tardar más; precargarlo reduce esa demora.

## Resumen de la llamada

Debajo de la transcripción, elige un modelo de texto instalado en Ollama y pulsa **Generar resumen** cuando quieras resumir lo dicho por el cliente. El resumen prioriza el motivo de contacto, el producto o servicio afectado, síntomas, errores, pruebas realizadas, impacto/urgencia y petición del cliente; señala los datos importantes que falten y no debe inventar información. Puedes editar o copiar el resultado desde el cuadro de resumen. **Borrar texto** limpia tanto la transcripción como el resumen.

Tanto la transcripción como el resumen se procesan en `http://127.0.0.1:11434`; no se envían a servicios externos.
