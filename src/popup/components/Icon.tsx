/** Icono de Material Symbols (la fuente va empaquetada con la extensión). */
export function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined">{name}</span>;
}

/** Botón cuadrado solo con icono; `label` se usa como tooltip y como nombre accesible. */
export function IconButton({ icon, label, onClick, id }: { icon: string; label: string; onClick: () => void; id?: string }) {
  return (
    <button id={id} className="icon-button" type="button" title={label} aria-label={label} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

export function CopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="text-button icon-action" type="button" title={label} aria-label={label} onClick={onClick}>
      <Icon name="content_copy" />
    </button>
  );
}
