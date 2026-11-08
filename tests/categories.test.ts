import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATEGORIES, isLeaf, normalizeCategories, resolveCategories, validateCategories, type CategoryNode
} from '../src/shared/categories';

const node = (name: string, children: CategoryNode[] = []): CategoryNode => ({ id: name, name, description: 'd', children });

describe('árbol por defecto', () => {
  it('conserva el orden y la jerarquía del JSON original con sus descripciones', () => {
    expect(DEFAULT_CATEGORIES.map((area) => area.name)).toEqual(['mantenimiento', 'informatica', 'logistica', 'comercial', 'rrhh', 'otros']);
    const hardware = DEFAULT_CATEGORIES[1].children[0];
    expect(hardware.name).toBe('hardware');
    expect(hardware.children.map((leaf) => leaf.name)).toEqual(['pcs', 'perifericos', 'impresoras']);
    expect(hardware.children.every(isLeaf)).toBe(true);
    expect(hardware.children[2].description).toContain('Atascos de papel');
    expect(validateCategories(DEFAULT_CATEGORIES)).toBeNull();
  });
});

describe('resolveCategories', () => {
  it('usa el árbol guardado si es válido y el de por defecto si no', () => {
    const custom = [node('x')];
    expect(resolveCategories(custom)).toBe(custom);
    expect(resolveCategories(null)).toBe(DEFAULT_CATEGORIES);
    expect(resolveCategories([])).toBe(DEFAULT_CATEGORIES);
    expect(resolveCategories({ mantenimiento: {} })).toBe(DEFAULT_CATEGORIES); // formato antiguo
  });
});

describe('validateCategories', () => {
  it('detecta nombres vacíos, repetidos entre hermanos, con "/" o reservados', () => {
    expect(validateCategories([])).toMatch(/al menos una/);
    expect(validateCategories([node('a', [node('  ')])])).toBe('Hay una categoría sin nombre en "a".');
    expect(validateCategories([node('a', [node('x'), node('x')])])).toBe('El nombre "x" está repetido en "a".');
    expect(validateCategories([node('a/b')])).toMatch(/no puede contener/);
    expect(validateCategories([node('ninguna_de_las_anteriores')])).toMatch(/reservado/);
  });

  it('permite el mismo nombre en ramas distintas', () => {
    expect(validateCategories([node('a', [node('otros')]), node('b', [node('otros')])])).toBeNull();
  });
});

describe('normalizeCategories', () => {
  it('quita espacios sobrantes de nombres y descripciones en todo el árbol', () => {
    const [root] = normalizeCategories([{ id: '1', name: ' a ', description: ' d ', children: [{ id: '2', name: 'b ', description: '', children: [] }] }]);
    expect(root).toMatchObject({ name: 'a', description: 'd' });
    expect(root.children[0].name).toBe('b');
  });
});
