/**
 * Árbol de categorías de incidencias, de profundidad libre.
 * Es una lista ordenada de nodos; un nodo sin hijos es una categoría final. El usuario lo edita desde la
 * configuración y se guarda en `chrome.storage.local` (`categories`); si no hay nada guardado se usa el árbol
 * por defecto de `src/config/categories.ts`.
 */
import { CATEGORY_DESCRIPTION_KEY, CATEGORY_NONE_OPTION, DEFAULT_CATEGORY_DEFINITION, type CategoryDefinition } from '../config';

export interface CategoryNode {
  /** Identificador estable para la interfaz (arrastrar, desplegar…). No se envía al modelo. */
  id: string;
  /** Nombre único entre sus hermanos; es la opción que ve el modelo y forma la ruta de la categoría. */
  name: string;
  /** Qué incidencias entran en esta categoría; el modelo decisional se basa en ella. */
  description: string;
  children: CategoryNode[];
}

export type CategoryTree = CategoryNode[];

export const isLeaf = (node: CategoryNode): boolean => node.children.length === 0;
export const pathId = (path: readonly string[]): string => path.join('/');

/** Nombres que no puede tener una categoría. */
export const RESERVED_NAMES = [CATEGORY_DESCRIPTION_KEY, CATEGORY_NONE_OPTION.name];

// ---- Árbol por defecto ----

/** Convierte el formato compacto de `src/config/categories.ts` en la lista ordenada de nodos. */
function fromDefinition(definition: CategoryDefinition, path: string[] = []): CategoryTree {
  return Object.entries(definition)
    .filter(([key]) => key !== CATEGORY_DESCRIPTION_KEY)
    .map(([name, value]) => {
      const nodePath = [...path, name];
      return typeof value === 'string'
        ? { id: pathId(nodePath), name, description: value, children: [] }
        : { id: pathId(nodePath), name, description: String(value[CATEGORY_DESCRIPTION_KEY] ?? ''), children: fromDefinition(value, nodePath) };
    });
}

export const DEFAULT_CATEGORIES: CategoryTree = fromDefinition(DEFAULT_CATEGORY_DEFINITION);

// ---- Validación ----

const isNode = (value: unknown): value is CategoryNode => {
  const node = value as CategoryNode;
  return Boolean(node) && typeof node.id === 'string' && typeof node.name === 'string'
    && typeof node.description === 'string' && Array.isArray(node.children) && node.children.every(isNode);
};

/** Comprueba la forma de un árbol leído de storage (por si está corrupto o es de otra versión). */
export const isCategoryTree = (value: unknown): value is CategoryTree => Array.isArray(value) && value.length > 0 && value.every(isNode);

/** Árbol guardado o, si no hay uno válido, el árbol por defecto. */
export const resolveCategories = (stored: unknown): CategoryTree => (isCategoryTree(stored) ? stored : DEFAULT_CATEGORIES);

/** Devuelve el primer problema del árbol (para mostrarlo al guardar) o `null` si es válido. */
export function validateCategories(tree: CategoryTree): string | null {
  if (!tree.length) return 'Debe haber al menos una categoría.';
  const check = (nodes: CategoryTree, path: string[]): string | null => {
    const seen = new Set<string>();
    const where = path.length ? ` en "${path.join(' › ')}"` : '';
    for (const node of nodes) {
      const name = node.name.trim();
      if (!name) return `Hay una categoría sin nombre${where}.`;
      if (name.includes('/')) return `El nombre "${name}" no puede contener "/".`;
      if (RESERVED_NAMES.includes(name)) return `"${name}" es un nombre reservado.`;
      if (seen.has(name)) return `El nombre "${name}" está repetido${where}.`;
      seen.add(name);
      const problem = check(node.children, [...path, name]);
      if (problem) return problem;
    }
    return null;
  };
  return check(tree, []);
}

/** Copia del árbol con nombres y descripciones sin espacios sobrantes (para guardarlo). */
export const normalizeCategories = (tree: CategoryTree): CategoryTree =>
  tree.map((node) => ({ ...node, name: node.name.trim(), description: node.description.trim(), children: normalizeCategories(node.children) }));
