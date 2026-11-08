import { CopyButton, Icon } from './Icon';

interface Props {
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  onSummarize: () => void;
  onCopy: () => void;
}

export function SummaryPanel({ value, onChange, busy, onSummarize, onCopy }: Props) {
  return (
    <section className="panel summary-panel">
      <div className="section-heading">
        <h2><Icon name="psychology" /> Resumen</h2>
        <div className="summary-actions">
          <CopyButton label="Copiar resumen" onClick={onCopy} />
          <button id="summarize" className="generate-button" type="button" disabled={busy} onClick={onSummarize}>
            <Icon name="wand_stars" /> Generar resumen
          </button>
        </div>
      </div>
      <textarea
        id="summary"
        className="summary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Genera un resumen con motivo, síntomas, errores y pasos ya probados…"
        spellCheck={false}
        aria-label="Resumen de la llamada"
      />
    </section>
  );
}
