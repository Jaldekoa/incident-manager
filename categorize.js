import { ollama, KEEP_ALIVE } from './ollama.js';
import { CATEGORIES, childrenOf, describe, isLeaf, pathId } from './categories.js';

// Límites de Tev1 / `/v1/systemone`.
const MAX_OPTIONS = 24; // opciones por pregunta `choice` (admite 26, pero está entrenado con 2–24)
const MAX_QUESTIONS = 64; // preguntas por petición
const MAX_BODY_BYTES = 60 * 1024; // el cuerpo admite 64 KiB; se deja margen
const NONE = 'ninguna_de_las_anteriores';
const NONE_DESCRIPTION = 'Ninguna de las demás opciones describe la incidencia.';

const byteLength = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Genera una pregunta `choice` por cada nodo con 2 o más hijos, redactada como probabilidad condicionada
 * a estar en ese nodo. Si un nodo supera MAX_OPTIONS, sus hijos se reparten en bloques con una opción
 * extra "ninguna", y luego se renormalizan juntos (ver `conditionalProbabilities`).
 */
function buildQuestions(node = CATEGORIES, path = [], questions = []) {
  const children = childrenOf(node);
  if (children.length > 1) {
    const split = children.length > MAX_OPTIONS;
    const instructions = path.length
      ? `Suponiendo que la incidencia descrita en este resumen de una llamada de soporte pertenece a "${path.join(' › ')}", ¿qué subcategoría la describe mejor?`
      : '¿A qué área pertenece la incidencia descrita en este resumen de una llamada de soporte?';
    for (const part of split ? chunk(children, MAX_OPTIONS - 1) : [children]) {
      const criteria = Object.fromEntries(part.map(([key, child]) => [key, describe(child)]));
      if (split) criteria[NONE] = NONE_DESCRIPTION;
      questions.push({ name: `q${questions.length}`, nodeId: pathId(path), body: { type: 'choice', instructions, criteria } });
    }
  }
  for (const [key, child] of children) if (!isLeaf(child)) buildQuestions(child, [...path, key], questions);
  return questions;
}

/** Agrupa las preguntas en peticiones que respeten el máximo de preguntas y de tamaño del cuerpo. */
function batchQuestions(questions, baseBytes) {
  const batches = [];
  let current = [];
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
function probabilitiesOf(answer) {
  const { probabilities, choice, confidence } = answer || {};
  if (Array.isArray(probabilities)) {
    return Object.fromEntries(probabilities.map((item) => [item.option ?? item.choice ?? item.label ?? item.name, item.probability ?? item.p]));
  }
  if (probabilities && typeof probabilities === 'object') return probabilities;
  return choice ? { [choice]: confidence ?? 1 } : {};
}

/**
 * P(hijo | nodo) para cada hijo, indexada por `pathId` del hijo. Une los bloques de un mismo nodo
 * (descartando "ninguna") y normaliza para que los hijos de cada nodo sumen 1.
 */
function conditionalProbabilities(questions, answers) {
  const byNode = {};
  for (const { name, nodeId } of questions) {
    if (!answers[name]) throw new Error('Respuesta incompleta del modelo decisional.');
    for (const [key, value] of Object.entries(probabilitiesOf(answers[name]))) {
      const probability = Number(value);
      if (key === NONE || !Number.isFinite(probability)) continue;
      (byNode[nodeId] ??= {})[key] = probability;
    }
  }
  const conditional = {};
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
 * Devuelve `{ path, score, scores }`; `scores` tiene la probabilidad conjunta de cada nodo evaluado por el
 * modelo (los nodos con un único hijo no se consultan y no aparecen).
 */
export async function categorize(model, summary, onProgress = () => {}) {
  const questions = buildQuestions();
  const batches = batchQuestions(questions, byteLength({ model, state: summary, keep_alive: KEEP_ALIVE, questions: {} }));
  let done = 0;
  onProgress(done, batches.length);
  const responses = await Promise.all(batches.map(async (batch) => {
    const { answers } = await ollama('/v1/systemone', {
      body: { model, state: summary, keep_alive: KEEP_ALIVE, questions: Object.fromEntries(batch.map(({ name, body }) => [name, body])) }
    });
    onProgress(++done, batches.length);
    return answers || {};
  }));
  const conditional = conditionalProbabilities(questions, Object.assign({}, ...responses));

  const scores = {};
  let best = { score: -1 };
  (function walk(node, path, joint) {
    const children = childrenOf(node);
    for (const [key, child] of children) {
      const childPath = [...path, key];
      const id = pathId(childPath);
      const score = children.length > 1 ? joint * (conditional[id] ?? 0) : joint;
      if (children.length > 1) scores[id] = score;
      if (isLeaf(child)) { if (score > best.score) best = { path: childPath, score }; }
      else walk(child, childPath, score);
    }
  })(CATEGORIES, [], 1);

  if (!best.path || best.score <= 0) throw new Error('El modelo decisional no devolvió ninguna categoría válida.');
  return { ...best, scores };
}
