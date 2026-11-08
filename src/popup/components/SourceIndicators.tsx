import { useActiveTabCapturable } from '../hooks/useActiveTabCapturable';
import { useMicPermission } from '../hooks/useMicPermission';
import type { SetStatus } from '../hooks/useStatus';
import { Icon } from './Icon';

const PERMISSION_PAGE = 'src/permission/index.html';

const MIC_TITLES: Record<PermissionState, string> = {
  granted: 'Micrófono disponible: se transcribe como [AGENTE].',
  prompt: 'Micrófono sin permiso: pulsa para concederlo (sin él solo se transcribe al usuario).',
  denied: 'Micrófono bloqueado: pulsa para revisar el permiso.'
};

function Source({ id, icon, ok, title, onClick }: { id: string; icon: string; ok: boolean; title: string; onClick: () => void }) {
  return (
    <button id={id} className={`source${ok ? ' ok' : ''}`} type="button" title={title} aria-label={title} onClick={onClick}>
      <span className="source-dot" />
      <Icon name={icon} />
    </button>
  );
}

/** Punto verde/rojo junto a la pantalla (audio de la pestaña, [USUARIO]) y al micrófono ([AGENTE]). */
export function SourceIndicators({ capturing, setStatus }: { capturing: boolean; setStatus: SetStatus }) {
  const tabOk = useActiveTabCapturable(capturing);
  const micState = useMicPermission();
  const micOk = micState === 'granted';
  const tabTitle = tabOk ? 'Audio de la pestaña disponible.' : 'Esta pestaña no se puede capturar.';

  return (
    <div className="source-status" aria-label="Fuentes de audio">
      <Source id="tab-source" icon="desktop_windows" ok={tabOk} title={tabTitle} onClick={() => setStatus(tabTitle, !tabOk)} />
      <Source
        id="mic-source"
        icon="mic"
        ok={micOk}
        title={MIC_TITLES[micState]}
        onClick={() => {
          // Chrome no muestra la petición de permiso dentro del popup: se concede en una pestaña aparte.
          if (micOk) setStatus('Micrófono disponible.');
          else chrome.tabs.create({ url: chrome.runtime.getURL(PERMISSION_PAGE) });
        }}
      />
    </div>
  );
}
