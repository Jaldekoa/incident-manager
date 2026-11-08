import { useCallback, useEffect, useState } from 'react';
import { getSession } from '../shared/storage';
import { useStatus } from './hooks/useStatus';
import { useInstalledModels } from './hooks/useInstalledModels';
import { StatusBar } from './components/StatusBar';
import { BrandBar } from './components/BrandBar';
import { MainView } from './views/MainView';
import { SettingsView } from './views/SettingsView';

type View = 'main' | 'settings';

export function App() {
  const [status, setStatus] = useStatus();
  const [view, setView] = useState<View>('main');
  const models = useInstalledModels(setStatus);

  // Errores de captura: el último se muestra al abrir; un cambio de estado limpia la barra.
  useEffect(() => {
    getSession(['lastError']).then(({ lastError }) => lastError && setStatus(lastError, true));
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'session') return;
      if (changes.capturing) setStatus();
      if (changes.lastError?.newValue) setStatus(changes.lastError.newValue as string, true);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [setStatus]);

  const show = useCallback((next: View) => {
    setView(next);
    setStatus();
  }, [setStatus]);

  // Ambas vistas siguen montadas (solo se ocultan) para no perder textos editados ni acciones en curso.
  return (
    <main>
      <BrandBar />
      <MainView hidden={view !== 'main'} setStatus={setStatus} onOpenSettings={() => show('settings')} />
      <SettingsView visible={view === 'settings'} models={models} setStatus={setStatus} onClose={() => show('main')} />
      <StatusBar status={status} />
    </main>
  );
}
