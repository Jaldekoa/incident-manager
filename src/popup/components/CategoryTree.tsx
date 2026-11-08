import { useEffect, useState } from 'react';
import { isLeaf, pathId, type CategoryTree as Categories } from '../../shared/categories';
import type { CategoryResult } from '../../categorize/categorize';
import { Icon } from './Icon';

const PLACEHOLDER = 'Categoriza el resumen para asignar una categoría…';

const formatScore = (score: number | undefined) => (score !== undefined && Number.isFinite(score) ? `${Math.round(score * 100)} %` : '');

/** Normaliza lo guardado: una categoría de versiones anteriores (con `path` en texto) se ignora. */
export const validCategory = (category: CategoryResult | null | undefined): CategoryResult | null =>
  Array.isArray(category?.path) && category.path.length ? { ...category, scores: category.scores ?? {} } : null;

interface LevelProps {
  nodes: Categories;
  path: string[];
  selectedId: string;
  scores: Record<string, number>;
  onSelect: (path: string[]) => void;
}

function Level({ nodes, path, selectedId, scores, onSelect }: LevelProps) {
  return (
    <ul>
      {nodes.map((child) => {
        const itemPath = [...path, child.name];
        const id = pathId(itemPath);
        const row = (
          <>
            <span className="tree-name" title={child.description}>{child.name}</span>
            <span className="tree-score">{formatScore(scores[id])}</span>
          </>
        );
        return (
          <li key={child.id}>
            {isLeaf(child) ? (
              <button type="button" className={`tree-leaf${id === selectedId ? ' selected' : ''}`} onClick={() => onSelect(itemPath)}>
                {row}
              </button>
            ) : (
              // La rama de la categoría elegida aparece abierta.
              <details open={selectedId.startsWith(`${id}/`)}>
                <summary>{row}</summary>
                <Level nodes={child.children} path={itemPath} selectedId={selectedId} scores={scores} onSelect={onSelect} />
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Selector jerárquico de categorías: un botón con la categoría elegida que despliega el árbol completo.
 * Las ramas se abren con ▶ y cada opción evaluada por el modelo muestra su porcentaje a la derecha.
 * Está deshabilitado hasta que hay una categoría.
 */
interface Props {
  categories: Categories;
  category: CategoryResult | null;
  onSelect: (path: string[]) => void;
}

export function CategoryTree({ categories, category, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const enabled = Boolean(category);
  const selectedId = category ? pathId(category.path) : '';

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  return (
    <div id="category" className="tree-select">
      <button
        className="tree-select-trigger"
        type="button"
        aria-expanded={open}
        aria-label="Categoría de la incidencia"
        disabled={!enabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="tree-select-label">{category ? category.path.join(' › ') : PLACEHOLDER}</span>
        <Icon name="expand_more" />
      </button>
      <div className="tree-select-panel" role="tree" hidden={!open}>
        {/* `key` remonta el árbol al cambiar de categoría para volver a abrir solo la rama elegida. */}
        <Level
          key={selectedId}
          nodes={categories}
          path={[]}
          selectedId={selectedId}
          scores={category?.scores ?? {}}
          onSelect={(path) => {
            setOpen(false);
            onSelect(path);
          }}
        />
      </div>
    </div>
  );
}
