import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_LANGUAGE, DEFAULT_SUMMARY_PROMPT, LANGUAGES } from '../../config';
import { getSettings, isLanguage, pickModels, type Language, type ModelChoice } from '../../shared/settings';
import { getLocal, setLocal } from '../../shared/storage';
import { errorMessage } from '../../shared/errors';
import { normalizeCategories, resolveCategories, validateCategories, type CategoryTree } from '../../shared/categories';
import type { InstalledModels } from '../hooks/useInstalledModels';
import type { SetStatus } from '../hooks/useStatus';
import { Icon, IconButton } from '../components/Icon';
import { CategoryEditor } from '../components/CategoryEditor';

interface Form extends ModelChoice {
  language: Language;
  summaryPrompt: string;
  categories: CategoryTree;
}

const EMPTY_FORM: Form = { model: '', summaryModel: '', categoryModel: '', language: DEFAULT_LANGUAGE, summaryPrompt: '', categories: [] };

interface Props {
  visible: boolean;
  models: InstalledModels;
  setStatus: SetStatus;
  onClose: () => void;
}

function ModelField({ id, label, value, models, onChange }: { id: string; label: string; value: string; models: InstalledModels; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={models.models.length ? value : ''} onChange={(event) => onChange(event.target.value)}>
        {models.models.length
          ? models.models.map((name) => <option key={name} value={name}>{name}</option>)
          : <option value="">{models.placeholder}</option>}
      </select>
    </div>
  );
}

export function SettingsView({ visible, models, setStatus, onClose }: Props) {
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const installed = models.models.length > 0;
  // Lo que se muestra y se guarda: los modelos del formulario ajustados a los instalados.
  const shown: Form = installed ? { ...form, ...pickModels(models.models, form) } : form;
  const update = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  const load = useCallback(async () => {
    const [{ model, summaryModel, categoryModel, language, summaryPrompt }, { categories }] = await Promise.all([
      getSettings(),
      getLocal(['categories'])
    ]);
    setForm({ model, summaryModel, categoryModel, language, summaryPrompt, categories: resolveCategories(categories) });
  }, []);

  // Al abrir la configuración se recargan los valores guardados (se descartan cambios sin guardar).
  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const save = async () => {
    const problem = validateCategories(shown.categories);
    if (problem) return setStatus(`No se guardó: ${problem}`, true);
    try {
      const { model, summaryModel, categoryModel, language, summaryPrompt, categories } = shown;
      await setLocal({
        language,
        summaryPrompt: summaryPrompt.trim(),
        categories: normalizeCategories(categories),
        ...(installed && { model, summaryModel, categoryModel })
      });
      await load(); // un prompt vacío vuelve al valor por defecto
      setStatus('Configuración guardada.');
    } catch (error) {
      setStatus(`No se pudo guardar: ${errorMessage(error)}`, true);
    }
  };

  const resetPrompt = () => {
    update('summaryPrompt')(DEFAULT_SUMMARY_PROMPT);
    setStatus('Prompt por defecto restaurado. Pulsa Guardar para aplicarlo.');
  };

  return (
    <div id="settings-view" hidden={!visible}>
      <header className="topbar split-topbar">
        <div className="title-group">
          <IconButton id="close-settings" icon="arrow_back" label="Volver" onClick={onClose} />
          <h1>Configuración</h1>
        </div>
        <div className="header-actions">
          <IconButton id="reset-prompt" icon="restart_alt" label="Restaurar prompt por defecto" onClick={resetPrompt} />
          <IconButton id="save-settings" icon="save" label="Guardar configuración" onClick={save} />
        </div>
      </header>

      <section className="panel">
        <div className="section-heading">
          <h2><Icon name="record_voice_over" /> Transcripción</h2>
        </div>
        <ModelField id="model" label="Modelo STT" value={shown.model} models={models} onChange={update('model')} />
        <div className="field">
          <label htmlFor="language">Idioma</label>
          <select id="language" value={shown.language} onChange={(event) => isLanguage(event.target.value) && update('language')(event.target.value)}>
            {Object.entries(LANGUAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </section>

      <section className="panel summary-panel">
        <div className="section-heading">
          <h2><Icon name="psychology" /> Resumen</h2>
        </div>
        <ModelField id="summary-model" label="Modelo LLM" value={shown.summaryModel} models={models} onChange={update('summaryModel')} />
        <div className="field">
          <label htmlFor="summary-prompt">Prompt de resumen</label>
          <textarea
            id="summary-prompt"
            className="prompt"
            spellCheck={false}
            value={shown.summaryPrompt}
            onChange={(event) => update('summaryPrompt')(event.target.value)}
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2><Icon name="category" /> Categoría</h2>
        </div>
        <ModelField id="category-model" label="Modelo decisional" value={shown.categoryModel} models={models} onChange={update('categoryModel')} />
        <div className="field">
          <label>Categorías</label>
          <CategoryEditor categories={shown.categories} onChange={update('categories')} setStatus={setStatus} />
          <p className="field-hint">Arrastra una categoría para moverla (antes, después o dentro de otra) · clic en el nombre para editarlo.</p>
        </div>
      </section>
    </div>
  );
}
