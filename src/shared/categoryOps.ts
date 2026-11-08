import type { CategoryNode, CategoryTree } from './categories';

/** Dónde se suelta una categoría respecto a otra al arrastrar. */
export type DropPosition = 'before' | 'after' | 'inside';

interface Location {
  parentId: string | null;
  index: number;
  siblings: CategoryTree;
}

export function findNode(tree: CategoryTree, id: string): CategoryNode | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export function locate(tree: CategoryTree, id: string, parentId: string | null = null): Location | undefined {
  for (let index = 0; index < tree.length; index++) {
    if (tree[index].id === id) return { parentId, index, siblings: tree };
    const found = locate(tree[index].children, id, tree[index].id);
    if (found) return found;
  }
  return undefined;
}

/** Si `id` está dentro del subárbol de `ancestorId` (o es él mismo). */
export function isWithin(tree: CategoryTree, ancestorId: string, id: string): boolean {
  const ancestor = findNode(tree, ancestorId);
  return Boolean(ancestor) && (ancestorId === id || Boolean(findNode(ancestor!.children, id)));
}

/** Aplica `change` a la lista de hijos de `parentId` (o a la raíz si es `null`). */
function updateSiblings(tree: CategoryTree, parentId: string | null, change: (siblings: CategoryTree) => CategoryTree): CategoryTree {
  if (parentId === null) return change(tree);
  return tree.map((node) => node.id === parentId
    ? { ...node, children: change(node.children) }
    : { ...node, children: updateSiblings(node.children, parentId, change) });
}

export function updateNode(tree: CategoryTree, id: string, patch: Partial<Pick<CategoryNode, 'name' | 'description'>>): CategoryTree {
  return tree.map((node) => node.id === id ? { ...node, ...patch } : { ...node, children: updateNode(node.children, id, patch) });
}

export function removeNode(tree: CategoryTree, id: string): CategoryTree {
  return tree.filter((node) => node.id !== id).map((node) => ({ ...node, children: removeNode(node.children, id) }));
}

/** Inserta `node` en la posición `index` de los hijos de `parentId` (al final si `index` se pasa). */
export function insertNode(tree: CategoryTree, parentId: string | null, index: number, node: CategoryNode): CategoryTree {
  return updateSiblings(tree, parentId, (siblings) => [...siblings.slice(0, index), node, ...siblings.slice(index)]);
}

/** Sube (`-1`) o baja (`+1`) una categoría entre sus hermanos. */
export function moveAmongSiblings(tree: CategoryTree, id: string, delta: -1 | 1): CategoryTree {
  const location = locate(tree, id);
  if (!location) return tree;
  const target = location.index + delta;
  if (target < 0 || target >= location.siblings.length) return tree;
  return updateSiblings(tree, location.parentId, (siblings) => {
    const next = [...siblings];
    [next[location.index], next[target]] = [next[target], next[location.index]];
    return next;
  });
}

/** Si se puede soltar `id` sobre `targetId`: no sobre sí misma ni dentro de su propio subárbol. */
export const canDrop = (tree: CategoryTree, id: string, targetId: string): boolean => !isWithin(tree, id, targetId);

/** Mueve `id` antes, después o dentro de `targetId`, también entre niveles distintos. */
export function moveNode(tree: CategoryTree, id: string, targetId: string, position: DropPosition): CategoryTree {
  const node = findNode(tree, id);
  if (!node || !canDrop(tree, id, targetId)) return tree;
  const without = removeNode(tree, id);
  if (position === 'inside') return insertNode(without, targetId, Number.MAX_SAFE_INTEGER, node);
  const target = locate(without, targetId);
  if (!target) return tree;
  return insertNode(without, target.parentId, target.index + (position === 'after' ? 1 : 0), node);
}

/** Nombre libre entre los hijos de `parentId`: `base`, `base_2`, `base_3`… */
export function uniqueName(tree: CategoryTree, parentId: string | null, base = 'nueva_categoria'): string {
  const siblings = parentId === null ? tree : findNode(tree, parentId)?.children ?? [];
  const taken = new Set(siblings.map((node) => node.name));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix++;
  return `${base}_${suffix}`;
}
