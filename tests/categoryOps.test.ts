import { describe, expect, it } from 'vitest';
import type { CategoryNode, CategoryTree } from '../src/shared/categories';
import {
  canDrop, findNode, insertNode, moveAmongSiblings, moveNode, removeNode, uniqueName, updateNode
} from '../src/shared/categoryOps';

const node = (id: string, children: CategoryNode[] = []): CategoryNode => ({ id, name: id, description: '', children });

/** Árbol de ejemplo:  a(a1, a2(a2x)) · b(b1) · c */
const sample = (): CategoryTree => [
  node('a', [node('a1'), node('a2', [node('a2x')])]),
  node('b', [node('b1')]),
  node('c')
];

/** Representación compacta para comparar: `a(a1,a2(a2x)),b(b1),c`. */
const shape = (tree: CategoryTree): string =>
  tree.map((n) => (n.children.length ? `${n.name}(${shape(n.children)})` : n.name)).join(',');

describe('moveNode (arrastrar y soltar)', () => {
  it('mueve antes o después de otra categoría del mismo nivel', () => {
    expect(shape(moveNode(sample(), 'c', 'a', 'before'))).toBe('c,a(a1,a2(a2x)),b(b1)');
    expect(shape(moveNode(sample(), 'a', 'b', 'after'))).toBe('b(b1),a(a1,a2(a2x)),c');
  });

  it('mueve entre niveles distintos', () => {
    expect(shape(moveNode(sample(), 'a2x', 'b1', 'after'))).toBe('a(a1,a2),b(b1,a2x),c');
    expect(shape(moveNode(sample(), 'b1', 'a', 'before'))).toBe('b1,a(a1,a2(a2x)),b,c');
  });

  it('mete una categoría dentro de otra, al final de sus hijos (también si era una hoja)', () => {
    expect(shape(moveNode(sample(), 'c', 'a', 'inside'))).toBe('a(a1,a2(a2x),c),b(b1)');
    expect(shape(moveNode(sample(), 'b1', 'c', 'inside'))).toBe('a(a1,a2(a2x)),b,c(b1)');
  });

  it('no permite soltar una categoría sobre sí misma ni dentro de su propio subárbol', () => {
    expect(canDrop(sample(), 'a', 'a2x')).toBe(false);
    expect(canDrop(sample(), 'a', 'a')).toBe(false);
    expect(canDrop(sample(), 'a2x', 'a')).toBe(true);
    expect(shape(moveNode(sample(), 'a', 'a2', 'inside'))).toBe(shape(sample()));
  });

  it('no modifica el árbol original', () => {
    const tree = sample();
    moveNode(tree, 'c', 'a', 'inside');
    expect(shape(tree)).toBe('a(a1,a2(a2x)),b(b1),c');
  });
});

describe('moveAmongSiblings (flechas)', () => {
  it('sube y baja entre hermanos sin salir de los extremos', () => {
    expect(shape(moveAmongSiblings(sample(), 'a2', -1))).toBe('a(a2(a2x),a1),b(b1),c');
    expect(shape(moveAmongSiblings(sample(), 'a', 1))).toBe('b(b1),a(a1,a2(a2x)),c');
    expect(shape(moveAmongSiblings(sample(), 'a', -1))).toBe(shape(sample()));
    expect(shape(moveAmongSiblings(sample(), 'c', 1))).toBe(shape(sample()));
  });
});

describe('crear, renombrar y eliminar', () => {
  it('inserta en la raíz o dentro de otra categoría', () => {
    expect(shape(insertNode(sample(), null, 1, node('z')))).toBe('a(a1,a2(a2x)),z,b(b1),c');
    expect(shape(insertNode(sample(), 'b', Number.MAX_SAFE_INTEGER, node('z')))).toBe('a(a1,a2(a2x)),b(b1,z),c');
  });

  it('renombra y cambia la descripción', () => {
    const tree = updateNode(sample(), 'a2x', { name: 'nuevo', description: 'desc' });
    expect(findNode(tree, 'a2x')).toMatchObject({ name: 'nuevo', description: 'desc' });
  });

  it('elimina una categoría con todo su subárbol', () => {
    expect(shape(removeNode(sample(), 'a2'))).toBe('a(a1),b(b1),c');
    expect(findNode(removeNode(sample(), 'a'), 'a2x')).toBeUndefined();
  });

  it('propone un nombre libre entre los hermanos', () => {
    const tree = insertNode(sample(), 'b', 0, node('nueva_categoria'));
    expect(uniqueName(tree, 'b')).toBe('nueva_categoria_2');
    expect(uniqueName(tree, null)).toBe('nueva_categoria');
  });
});
