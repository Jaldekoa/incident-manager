import { useEffect, useState } from 'react';
import { ollama, KEEP_ALIVE, type ChatResponse } from '../../shared/ollama';
import { getSettings } from '../../shared/settings';
import { getSession, setLocal } from '../../shared/storage';
import { sendToBackground, type Broadcast } from '../../shared/messages';
import { errorMessage } from '../../shared/errors';
import { categorize } from '../../categorize/categorize';
import { useChromeStorage } from '../hooks/useChromeStorage';
import type { SetStatus } from '../hooks/useStatus';
import { IconButton } from '../components/Icon';
import { SourceIndicators } from '../components/SourceIndicators';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { SummaryPanel } from '../components/SummaryPanel';
import { CategoryPanel } from '../components/CategoryPanel';
import { validCategory } from '../components/CategoryTree';

interface Props {
  hidden: boolean;
  setStatus: SetStatus;
  onOpenSettings: () => void;
}

type Action = 'capture' | 'summarize' | 'categorize';

/** Texto editable en el popup que se reemplaza cada vez que cambia el valor guardado. */
function useEditableCopy(stored: string) {
  const [value, setValue] = useState(stored);
  useEffect(() => setValue(stored), [stored]);
  return [value, setValue] as const;
}

export function MainView({ hidden, setStatus, onOpenSettings }: Props) {
  const [capturing] = useChromeStorage('session', 'capturing', false);
  const [storedTranscript] = useChromeStorage('local', 'transcript', '');
  const [storedSummary] = useChromeStorage('local', 'summary', '');
  const [storedCategory, setStoredCategory] = useChromeStorage('local', 'category', null);
  const [transcript, setTranscript] = useEditableCopy(storedTranscript);
  const [summary, setSummary] = useEditableCopy(storedSummary);
  const category = validCategory(storedCategory);

  const [busy, setBusy] = useState<Record<Action, boolean>>({ capture: false, summarize: false, categorize: false });
  const [preloading, setPreloading] = useState(false);

  /** Ejecuta una acción con su botón deshabilitado mientras dura. */
  const run = async (action: Action, task: () => Promise<void>) => {
    setBusy((state) => ({ ...state, [action]: true }));
    try {
      await task();
    } finally {
      setBusy((state) => ({ ...state, [action]: false }));
    }
  };

  useEffect(() => {
    const listener = (message: Broadcast) => {
      if (message?.type === 'PRELOAD_DONE') setStatus('Modelo cargado y listo.');
      else if (message?.type === 'PRELOAD_FAILED') setStatus(`No se pudo cargar el modelo: ${message.error}`, true);
      else return;
      setPreloading(false);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setStatus]);

  const copy = async (text: string, doneMessage: string) => {
    if (!text.trim()) return setStatus('No hay texto para copiar.', true);
    try {
      await navigator.clipboard.writeText(text);
      setStatus(doneMessage);
    } catch (error) {
      setStatus(`No se pudo copiar: ${errorMessage(error)}`, true);
    }
  };

  const clearSession = async () => {
    setTranscript('');
    setSummary('');
    await setLocal({ transcript: '', lastSegments: {}, lastSpeaker: '', summary: '', category: null });
  };

  const preload = async () => {
    const { model } = await getSettings();
    setPreloading(true);
    setStatus(`Cargando ${model} en Ollama…`);
    sendToBackground({ type: 'PRELOAD_MODEL', model });
  };

  const toggleCapture = () => run('capture', async () => {
    try {
      const { capturing: active } = await getSession(['capturing']);
      const result = active
        ? await sendToBackground({ type: 'STOP_CAPTURE' })
        : await sendToBackground({ type: 'START_CAPTURE', tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id });
      if (!result?.ok) setStatus((result && !result.ok && result.error) || 'No se pudo cambiar el estado de captura.', true);
    } catch (error) {
      setStatus(`No se pudo cambiar el estado de captura: ${errorMessage(error)}`, true);
    }
  });

  const summarize = async () => {
    const text = transcript.trim();
    const { summaryModel: model, summaryPrompt } = await getSettings();
    if (!text) return setStatus('Aún no hay transcripción para resumir.', true);
    if (!model) return setStatus('Elige un modelo de resumen en Configuración.', true);
    await run('summarize', async () => {
      setStatus(`Generando resumen con ${model}…`);
      try {
        const { message } = await ollama<ChatResponse>('/api/chat', {
          body: {
            model,
            stream: false,
            keep_alive: KEEP_ALIVE,
            messages: [
              { role: 'system', content: summaryPrompt },
              { role: 'user', content: `Resume esta transcripción de una llamada de soporte técnico:\n\n${text}` }
            ]
          }
        });
        const result = message?.content?.trim();
        if (!result) throw new Error('El modelo devolvió un resumen vacío.');
        setSummary(result);
        await setLocal({ summary: result });
        setStatus('Resumen generado.');
      } catch (error) {
        setStatus(`No se pudo generar el resumen: ${errorMessage(error)}`, true);
      }
    });
  };

  const categorizeSummary = async () => {
    const text = summary.trim();
    const { categoryModel: model } = await getSettings();
    if (!text) return setStatus('Genera primero el resumen para poder categorizarlo.', true);
    if (!model) return setStatus('Elige un modelo decisional en Configuración.', true);
    await run('categorize', async () => {
      try {
        const result = await categorize(model, text, (done, total) =>
          setStatus(`Categorizando con ${model}…${total > 1 ? ` (${done}/${total})` : ''}`));
        await setStoredCategory(result);
        setStatus('Incidencia categorizada.');
      } catch (error) {
        setStatus(`No se pudo categorizar: ${errorMessage(error)}`, true);
      }
    });
  };

  return (
    <div id="main-view" hidden={hidden}>
      <header className="topbar split-topbar">
        <SourceIndicators capturing={capturing} setStatus={setStatus} />
        <div className="header-actions">
          <IconButton id="clear" icon="delete_sweep" label="Limpiar sesión" onClick={clearSession} />
          <button id="preload" className="outline-button header-button" type="button" disabled={preloading} onClick={preload}>
            Cargar modelo
          </button>
          <IconButton id="open-settings" icon="settings" label="Configuración" onClick={onOpenSettings} />
        </div>
      </header>

      <TranscriptPanel
        value={transcript}
        onChange={setTranscript}
        incoming={storedTranscript}
        capturing={capturing}
        toggleDisabled={busy.capture}
        onToggleCapture={toggleCapture}
        onCopy={() => copy(transcript, 'Transcripción copiada.')}
      />
      <SummaryPanel
        value={summary}
        onChange={setSummary}
        busy={busy.summarize}
        onSummarize={summarize}
        onCopy={() => copy(summary, 'Resumen copiado.')}
      />
      <CategoryPanel
        category={category}
        busy={busy.categorize}
        onCategorize={categorizeSummary}
        onSelect={(path) => category && setStoredCategory({ ...category, path })}
        onCopy={() => copy(category?.path.join(' › ') ?? '', 'Categoría copiada.')}
      />
    </div>
  );
}
