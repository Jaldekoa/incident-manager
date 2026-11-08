import { CATEGORIES, childrenOf, describe, isLeaf, pathId } from './categories.js';

const PLACEHOLDER = 'Categoriza el resumen para asignar una categoría…';

function element(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

const formatScore = (score) => (Number.isFinite(score) ? `${Math.round(score * 100)} %` : '');

/**
 * Selector jerárquico de categorías: un botón con la categoría elegida que despliega el árbol completo.
 * Las ramas se abren con ▶ y cada opción evaluada por el modelo muestra su porcentaje a la derecha.
 * Está deshabilitado hasta que se le asigna una categoría con `setCategory`.
 */
export function createCategoryTree(root, { onSelect }) {
  const trigger = root.querySelector('.tree-select-trigger');
  const label = root.querySelector('.tree-select-label');
  const panel = root.querySelector('.tree-select-panel');
  let category = { path: [], scores: {} };

  const setOpen = (open) => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  };

  function row(key, node, id) {
    const name = element('span', 'tree-name', key);
    name.title = describe(node); // la descripción aparece al pasar el cursor
    return [name, element('span', 'tree-score', formatScore(category.scores[id]))];
  }

  function buildLevel(parent, path) {
    const selectedId = pathId(category.path);
    return element('ul', '', ...childrenOf(parent).map(([key, node]) => {
      const itemPath = [...path, key];
      const id = pathId(itemPath);
      if (isLeaf(node)) {
        const leaf = element('button', `tree-leaf${id === selectedId ? ' selected' : ''}`, ...row(key, node, id));
        leaf.type = 'button';
        leaf.addEventListener('click', () => select(itemPath));
        return element('li', '', leaf);
      }
      const branch = element('details', '', element('summary', '', ...row(key, node, id)), buildLevel(node, itemPath));
      branch.open = selectedId.startsWith(`${id}/`); // despliega la rama de la categoría elegida
      return element('li', '', branch);
    }));
  }

  function render() {
    const enabled = category.path.length > 0;
    label.textContent = enabled ? category.path.join(' › ') : PLACEHOLDER;
    trigger.disabled = !enabled;
    panel.replaceChildren(buildLevel(CATEGORIES, []));
    if (!enabled) setOpen(false);
  }

  function select(path) {
    category = { ...category, path };
    render();
    setOpen(false);
    onSelect(category);
  }

  trigger.addEventListener('click', () => setOpen(panel.hidden));
  render();

  return {
    /** Asigna `{ path, scores }` (o nada para vaciar y deshabilitar el selector). */
    setCategory(value) {
      category = Array.isArray(value?.path) ? { path: value.path, scores: value.scores || {} } : { path: [], scores: {} };
      render();
    },
    /** Ruta elegida en texto, para copiarla. */
    get value() {
      return category.path.join(' › ');
    }
  };
}
