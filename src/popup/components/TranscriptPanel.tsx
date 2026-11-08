import { useEffect, useRef } from 'react';
import { CopyButton, Icon } from './Icon';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Texto llegado desde storage: al cambiar, se hace scroll al final. */
  incoming: string;
  capturing: boolean;
  toggleDisabled: boolean;
  onToggleCapture: () => void;
  onCopy: () => void;
}

export function TranscriptPanel({ value, onChange, incoming, capturing, toggleDisabled, onToggleCapture, onCopy }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) textarea.scrollTop = textarea.scrollHeight;
  }, [incoming]);

  return (
    <section className="panel">
      <div className="section-heading">
        <h2><Icon name="record_voice_over" /> Transcripción</h2>
        <div className="heading-actions">
          <CopyButton label="Copiar transcripción" onClick={onCopy} />
          <button id="capture-toggle" className={`record-button${capturing ? ' stop' : ''}`} type="button" disabled={toggleDisabled} onClick={onToggleCapture}>
            <span className="record-dot" />
            <span>{capturing ? 'Detener captura' : 'Comenzar captura'}</span>
          </button>
        </div>
      </div>
      <textarea
        id="transcript"
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="La conversación aparecerá aquí…"
        spellCheck={false}
        aria-label="Transcripción de la llamada"
      />
    </section>
  );
}
