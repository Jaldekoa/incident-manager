import { afterEach, describe, expect, it, vi } from 'vitest';
import { asrPrompt, DEFAULT_ASR_MODEL, DEFAULT_SUMMARY_PROMPT } from '../src/config';
import { getSettings, isCapturableUrl, pickModels } from '../src/shared/settings';

const mockStorage = (saved: Record<string, unknown>) =>
  vi.stubGlobal('chrome', { storage: { local: { get: async () => saved } } });

afterEach(() => vi.unstubAllGlobals());

describe('pickModels', () => {
  const installed = ['llama3.2:3b', 'frozenlab/qwen3-asr:0.6b', 'tev1:latest'];

  it('elige por rol: ASR para STT, un LLM normal para resumen y tev1 para categoría', () => {
    expect(pickModels(installed, {})).toEqual({
      model: 'frozenlab/qwen3-asr:0.6b',
      summaryModel: 'llama3.2:3b',
      categoryModel: 'tev1:latest'
    });
  });

  it('respeta el modelo guardado si sigue instalado y lo sustituye si no', () => {
    expect(pickModels(installed, { summaryModel: 'tev1:latest', categoryModel: 'borrado:1b' })).toMatchObject({
      summaryModel: 'tev1:latest',
      categoryModel: 'tev1:latest'
    });
  });

  it('usa el primer modelo si ninguno encaja con el rol, y vacío si no hay modelos', () => {
    expect(pickModels(['llama3.2:3b'], {}).categoryModel).toBe('llama3.2:3b');
    expect(pickModels([], {})).toEqual({ model: '', summaryModel: '', categoryModel: '' });
  });
});

describe('getSettings', () => {
  it('aplica los valores por defecto cuando no hay nada guardado', async () => {
    mockStorage({});
    expect(await getSettings()).toEqual({
      model: DEFAULT_ASR_MODEL,
      summaryModel: '',
      categoryModel: '',
      language: 'Spanish',
      asrPrompt: 'language Spanish<asr_text>',
      summaryPrompt: DEFAULT_SUMMARY_PROMPT
    });
  });

  it('genera el prompt STT a partir del idioma e ignora idiomas desconocidos o prompts vacíos', async () => {
    mockStorage({ language: 'English', summaryPrompt: '   ' });
    expect(await getSettings()).toMatchObject({ asrPrompt: asrPrompt('English'), summaryPrompt: DEFAULT_SUMMARY_PROMPT });
    mockStorage({ language: 'Klingon' });
    expect((await getSettings()).language).toBe('Spanish');
  });
});

describe('isCapturableUrl', () => {
  it('solo acepta páginas web normales', () => {
    expect(isCapturableUrl('https://softphone.example.com')).toBe(true);
    expect(isCapturableUrl('chrome://extensions')).toBe(false);
    expect(isCapturableUrl(undefined)).toBe(false);
  });
});
