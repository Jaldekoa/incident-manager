import { useEffect, useState } from 'react';
import { getSettings, listInstalledModels, pickModels } from '../../shared/settings';
import { setLocal } from '../../shared/storage';
import { errorMessage } from '../../shared/errors';
import type { SetStatus } from './useStatus';

export interface InstalledModels {
  models: string[];
  /** Texto de la opción vacía cuando no hay modelos que mostrar. */
  placeholder: string;
}

/**
 * Lee los modelos instalados en Ollama al abrir el popup y guarda un modelo por rol (STT, LLM, decisional)
 * si el guardado no está instalado, para que las acciones funcionen sin pasar por la configuración.
 */
export function useInstalledModels(setStatus: SetStatus): InstalledModels {
  const [state, setState] = useState<InstalledModels>({ models: [], placeholder: 'Cargando modelos…' });

  useEffect(() => {
    (async () => {
      try {
        const models = await listInstalledModels();
        if (!models.length) {
          setState({ models, placeholder: 'No hay modelos instalados' });
          setStatus('No hay modelos instalados en Ollama.', true);
          return;
        }
        setState({ models, placeholder: '' });
        await setLocal(pickModels(models, await getSettings()));
      } catch (error) {
        setState({ models: [], placeholder: 'No se pudo leer Ollama' });
        setStatus(errorMessage(error), true);
      }
    })();
  }, [setStatus]);

  return state;
}
