import { APP_ICON, APP_NAME } from '../../config';
import { Icon } from './Icon';

/** Cabecera de marca, común a todas las vistas del popup. */
export function BrandBar() {
  return (
    <div className="brandbar">
      <span className="brand-mark"><Icon name={APP_ICON} /></span>
      <span className="brand-name">{APP_NAME}</span>
    </div>
  );
}
