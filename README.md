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

1. Abre la llamada o el vídeo en una pestaña web normal.
2. Pulsa el icono de la extensión. El distintivo **REC** indica que la captura continúa, aunque cambies de pestaña o cierres el panel.
3. Para detenerla, vuelve a pulsar el icono o usa el botón **Detener captura** del panel. Después podrás volver a iniciar desde el panel para la misma pestaña o pulsar el icono desde otra pestaña web.
4. Para abrir el panel con la transcripción y el botón **Cargar modelo**, haz clic derecho en el icono y elige **Abrir transcripción y ajustes**. Pulsa **Cargar modelo** antes de iniciar la captura para cargarlo en memoria; Ollama lo mantiene 30 minutos.

La captura usa ventanas continuas de cuatro segundos con un segundo de solape para reducir palabras perdidas entre fragmentos. El texto se añade sin etiqueta de hablante y se eliminan repeticiones detectadas en el solape. La primera petición después de descargar el modelo o de que Ollama lo descargue de memoria puede tardar más; precargarlo reduce esa demora. El audio se envía solo a `http://127.0.0.1:11434`.
