import { afterEach, describe, expect, it, vi } from 'vitest';
import { categorize, MAX_BODY_BYTES, MAX_OPTIONS, MAX_QUESTIONS } from '../src/categorize/categorize';
import { CATEGORIES } from '../src/shared/categories';

interface SentRequest {
  url: string;
  bytes: number;
  questions: Record<string, { criteria: Record<string, string> }>;
}

/**
 * Simula `/v1/systemone`: cada opción listada en `prefer` recibe esa probabilidad y el resto de la masa
 * se reparte a partes iguales entre las demás opciones de la pregunta.
 */
function mockTev1(prefer: Record<string, number>) {
  const requests: SentRequest[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    requests.push({ url, bytes: new TextEncoder().encode(init.body as string).length, questions: body.questions });
    const answers: Record<string, unknown> = {};
    for (const [name, question] of Object.entries<{ criteria: Record<string, string> }>(body.questions)) {
      const options = Object.keys(question.criteria);
      const hits = options.filter((option) => option in prefer);
      const rest = (1 - hits.reduce((sum, option) => sum + prefer[option], 0)) / Math.max(1, options.length - hits.length);
      answers[name] = { probabilities: Object.fromEntries(options.map((option) => [option, prefer[option] ?? rest])) };
    }
    return new Response(JSON.stringify({ answers }));
  });
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

describe('categorize', () => {
  it('elige la categoría de mayor probabilidad conjunta en una sola petición a /v1/systemone', async () => {
    const requests = mockTev1({ informatica: 0.8, hardware: 0.7, impresoras: 0.7 });
    const result = await categorize('tev1', 'La impresora no imprime');

    expect(result.path).toEqual(['informatica', 'hardware', 'impresoras']);
    expect(result.score).toBeCloseTo(0.8 * 0.7 * 0.7);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('http://127.0.0.1:11434/v1/systemone');
    expect(result.scores.informatica).toBeCloseTo(0.8);
    expect(result.scores['informatica/hardware']).toBeCloseTo(0.56);
  });

  it('las probabilidades conjuntas de las categorías finales suman 1', async () => {
    mockTev1({ informatica: 0.8, hardware: 0.7, impresoras: 0.7 });
    const { scores } = await categorize('tev1', 'x');
    // `otros` solo tiene un hijo por nivel: su probabilidad conjunta es la del área.
    const leaves = Object.entries(scores).filter(([id]) => id.split('/').length === 3 || id === 'otros');
    expect(leaves.reduce((sum, [, p]) => sum + p, 0)).toBeCloseTo(1);
  });

  it('encuentra el máximo global aunque no esté en el área más probable', async () => {
    mockTev1({ informatica: 0.5, comercial: 0.45, hardware: 0.4, facturacion: 0.95, tpv: 0.97 });
    const result = await categorize('tev1', 'x');
    expect(result.path).toEqual(['comercial', 'facturacion', 'tpv']);
    expect(result.score).toBeCloseTo(0.45 * 0.95 * 0.97);
  });

  it('no consulta al modelo en nodos con un único hijo', async () => {
    mockTev1({ otros: 0.7 });
    const result = await categorize('tev1', 'x');
    expect(result.path).toEqual(['otros', 'sin_clasificar', 'desconocido']);
    expect(result.scores['otros/sin_clasificar']).toBeUndefined();
  });

  it('divide nodos con demasiadas opciones y reparte las preguntas en varias peticiones', async () => {
    const added = ['grande', ...Array.from({ length: 100 }, (_, i) => `extra${i}`)];
    CATEGORIES.grande = {
      descripcion_global: 'Área de prueba',
      ...Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`hoja${i}`, `Descripción de prueba número ${i}.`]))
    };
    for (const key of added.slice(1)) CATEGORIES[key] = { descripcion_global: 'x', a: { descripcion_global: 'y', b: 'b', c: 'c' }, d: 'd' };
    try {
      const requests = mockTev1({ grande: 0.9, hoja47: 0.8 });
      const result = await categorize('tev1', 'x');

      expect(result.path).toEqual(['grande', 'hoja47']);
      expect(requests.length).toBeGreaterThan(1);
      for (const request of requests) {
        expect(Object.keys(request.questions).length).toBeLessThanOrEqual(MAX_QUESTIONS);
        expect(request.bytes).toBeLessThanOrEqual(MAX_BODY_BYTES);
        for (const question of Object.values(request.questions)) {
          expect(Object.keys(question.criteria).length).toBeLessThanOrEqual(MAX_OPTIONS);
        }
      }
    } finally {
      for (const key of added) delete CATEGORIES[key];
    }
  });

  it('falla con un mensaje claro si la respuesta no trae las preguntas', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ answers: {} })));
    await expect(categorize('tev1', 'x')).rejects.toThrow('Respuesta incompleta del modelo decisional.');
  });
});
