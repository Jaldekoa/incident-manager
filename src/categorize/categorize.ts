import { CATEGORY_NONE_OPTION, CATEGORY_ROOT_QUESTION, KEEP_ALIVE, categorySubQuestion } from '../config';
import { ollama } from '../shared/ollama';
import { isLeaf, pathId, type CategoryTree } from '../shared/categories';

// Límites de la API de Tev1 (`/v1/systemone`); no son opciones de la extensión.
export const MAX_OPTIONS = 24; // opciones por pregunta `choice` (admite 26, pero está entrenado con 2–24)
export const MAX_QUESTIONS = 64; // preguntas por petición
export const MAX_BODY_BYTES = 60 * 1024; // el cuerpo admite 64 KiB; se deja margen
const NONE = CATEGORY_NONE_OPTION.name;

export interface CategoryResult {
  /** Ruta de la categoría elegida, p. ej. `['informatica', 'hardware', 'impresoras']`. */
  path: string[];
  /** Probabilidad conjunta de la categoría elegida. */
  score?: number;
  /** Probabilidad conjunta de cada nodo evaluado por el modelo, indexada por `pathId`. */
  scores: Record<string, number>;
}

interface ChoiceQuestion {
  type: 'choice';
  instructions: string;
  /** Opción → descripción; `null` deja que el nombre de la opción se describa a sí mismo. */
  criteria: Record<string, string | null>;
}

interface PendingQuestion {
  name: string;
  nodeId: string;
  body: ChoiceQuestion;
}

interface ChoiceAnswer {
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number> | Array<{ option?: string; choice?: string; label?: string; name?: string; probability?: number; p?: number }>;
}

interface SystemOneResponse {
  answers?: Record<string, ChoiceAnswer>;
}

const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Genera una pregunta `choice` por cada nodo con 2 o más hijos, redactada como probabilidad condicionada
 * a estar en ese nodo. Si un nodo supera MAX_OPTIONS, sus hijos se reparten en bloques con una opción
 * extra "ninguna", y luego se renormalizan juntos (ver `conditionalProbabilities`).
 */
function buildQuestions(children: CategoryTree, path: string[] = [], questions: PendingQuestion[] = []): PendingQuestion[] {
  if (children.length > 1) {
    const split = children.length > MAX_OPTIONS;
    const instructions = path.length ? categorySubQuestion(path) : CATEGORY_ROOT_QUESTION;
    for (const part of split ? chunk(children, MAX_OPTIONS - 1) : [children]) {
      const criteria: Record<string, string | null> = Object.fromEntries(part.map((child) => [child.name, child.description || null]));
      if (split) criteria[NONE] = CATEGORY_NONE_OPTION.description;
      questions.push({ name: `q${questions.length}`, nodeId: pathId(path), body: { type: 'choice', instructions, criteria } });
    }
  }
  for (const child of children) if (!isLeaf(child)) buildQuestions(child.children, [...path, child.name], questions);
  return questions;
}

/** Agrupa las preguntas en peticiones que respeten el máximo de preguntas y de tamaño del cuerpo. */
function batchQuestions(questions: PendingQuestion[], baseBytes: number): PendingQuestion[][] {
  const batches: PendingQuestion[][] = [];
  let current: PendingQuestion[] = [];
  let bytes = baseBytes;
  for (const question of questions) {
    const size = byteLength({ [question.name]: question.body });
    if (current.length && (current.length === MAX_QUESTIONS || bytes + size > MAX_BODY_BYTES)) {
      batches.push(current);
      [current, bytes] = [[], baseBytes];
    }
    current.push(question);
    bytes += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** Probabilidades de una respuesta `choice` como `{ opción: p }`; si no vienen, usa la opción elegida. */
function probabilitiesOf(answer: ChoiceAnswer | undefined): Record<string, number> {
  const { probabilities, choice, confidence } = answer ?? {};
  if (Array.isArray(probabilities)) {
    return Object.fromEntries(probabilities.map((item) =>
      [item.option ?? item.choice ?? item.label ?? item.name ?? '', item.probability ?? item.p ?? NaN]));
  }
  if (probabilities && typeof probabilities === 'object') return probabilities;
  return choice ? { [choice]: confidence ?? 1 } : {};
}

/**
 * P(hijo | nodo) para cada hijo, indexada por `pathId` del hijo. Une los bloques de un mismo nodo
 * (descartando "ninguna") y normaliza para que los hijos de cada nodo sumen 1.
 */
function conditionalProbabilities(questions: PendingQuestion[], answers: Record<string, ChoiceAnswer>): Record<string, number> {
  const byNode: Record<string, Record<string, number>> = {};
  for (const { name, nodeId } of questions) {
    if (!answers[name]) throw new Error('Respuesta incompleta del modelo decisional.');
    for (const [key, value] of Object.entries(probabilitiesOf(answers[name]))) {
      const probability = Number(value);
      if (key === NONE || !Number.isFinite(probability)) continue;
      (byNode[nodeId] ??= {})[key] = probability;
    }
  }
  const conditional: Record<string, number> = {};
  for (const [nodeId, children] of Object.entries(byNode)) {
    const total = Object.values(children).reduce((sum, p) => sum + p, 0);
    for (const [key, p] of Object.entries(children)) {
      conditional[nodeId ? `${nodeId}/${key}` : key] = total > 0 ? p / total : 0;
    }
  }
  return conditional;
}

/**
 * Clasifica `summary` buscando la categoría final de mayor probabilidad conjunta:
 * P(área) × P(subgrupo | área) × … × P(categoría | padre). Todas las preguntas se resuelven de una vez
 * (repartidas en las peticiones necesarias) y luego se recorre el árbol completo.
 * Los nodos con un único hijo no se consultan y no aparecen en `scores`.
 */
export async function categorize(
  model: string,
  summary: string,
  categories: CategoryTree,
  onProgress: (done: number, total: number) => void = () => {}
): Promise<CategoryResult> {
  const questions = buildQuestions(categories);
  const batches = batchQuestions(questions, byteLength({ model, state: summary, keep_alive: KEEP_ALIVE, questions: {} }));
  let done = 0;
  onProgress(done, batches.length);
  const responses = await Promise.all(batches.map(async (batch) => {
    const { answers } = await ollama<SystemOneResponse>('/v1/systemone', {
      body: { model, state: summary, keep_alive: KEEP_ALIVE, questions: Object.fromEntries(batch.map(({ name, body }) => [name, body])) }
    });
    onProgress(++done, batches.length);
    return answers ?? {};
  }));
  const conditional = conditionalProbabilities(questions, Object.assign({}, ...responses));

  const scores: Record<string, number> = {};
  let best: { path?: string[]; score: number } = { score: -1 };
  (function walk(children: CategoryTree, path: string[], joint: number) {
    for (const child of children) {
      const childPath = [...path, child.name];
      const id = pathId(childPath);
      const score = children.length > 1 ? joint * (conditional[id] ?? 0) : joint;
      if (children.length > 1) scores[id] = score;
      if (isLeaf(child)) {
        if (score > best.score) best = { path: childPath, score };
      } else {
        walk(child.children, childPath, score);
      }
    }
  })(categories, [], 1);

  if (!best.path || best.score <= 0) throw new Error('El modelo decisional no devolvió ninguna categoría válida.');
  return { path: best.path, score: best.score, scores };
}
