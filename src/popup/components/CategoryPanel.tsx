import type { CategoryResult } from '../../categorize/categorize';
import { CategoryTree } from './CategoryTree';
import { CopyButton, Icon } from './Icon';

interface Props {
  category: CategoryResult | null;
  busy: boolean;
  onCategorize: () => void;
  onSelect: (path: string[]) => void;
  onCopy: () => void;
}

export function CategoryPanel({ category, busy, onCategorize, onSelect, onCopy }: Props) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2><Icon name="category" /> Categoría</h2>
        <div className="summary-actions">
          <CopyButton label="Copiar categoría" onClick={onCopy} />
          <button id="categorize" className="generate-button" type="button" disabled={busy} onClick={onCategorize}>
            <Icon name="label" /> Categorizar
          </button>
        </div>
      </div>
      <CategoryTree category={category} onSelect={onSelect} />
    </section>
  );
}
