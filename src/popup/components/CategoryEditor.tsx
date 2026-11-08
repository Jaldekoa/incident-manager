import { createContext, useContext, useState, type DragEvent } from 'react';
import { DEFAULT_CATEGORIES, type CategoryNode, type CategoryTree } from '../../shared/categories';
import {
  canDrop, insertNode, isWithin, moveAmongSiblings, moveNode, removeNode, uniqueName, updateNode,
  type DropPosition
} from '../../shared/categoryOps';
import type { SetStatus } from '../hooks/useStatus';
import { Icon } from './Icon';

interface EditorState {
  categories: CategoryTree;
  expanded: Set<string>;
  editingId: string | null;
  dragId: string | null;
  drop: { targetId: string; position: DropPosition } | null;
  change: (tree: CategoryTree) => void;
  toggle: (id: string) => void;
  setEditingId: (id: string | null) => void;
  setDragId: (id: string | null) => void;
  setDrop: (drop: EditorState['drop']) => void;
  add: (parentId: string | null) => void;
  remove: (node: CategoryNode) => void;
}

const EditorContext = createContext<EditorState | null>(null);
const useEditor = () => useContext(EditorContext)!;

const countDescendants = (node: CategoryNode): number => node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);

/** Antes / dentro / después según la altura del puntero sobre la fila (30 % · 40 % · 30 %). */
function dropPosition(event: DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / rect.height;
  return ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside';
}

function ActionButton({ icon, label, onClick, disabled = false, danger = false }: { icon: string; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" className={`cat-action${danger ? ' danger' : ''}`} title={label} aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

function EditorNode({ node, index, siblingCount }: { node: CategoryNode; index: number; siblingCount: number }) {
  const editor = useEditor();
  const expanded = editor.expanded.has(node.id);
  const editing = editor.editingId === node.id;
  const hasChildren = node.children.length > 0;
  const dropHere = editor.drop?.targetId === node.id ? editor.drop.position : null;

  const endDrag = () => {
    editor.setDragId(null);
    editor.setDrop(null);
  };

  const rowClass = ['cat-row', editing && 'editing', editor.dragId === node.id && 'dragging', dropHere && `drop-${dropHere}`]
    .filter(Boolean).join(' ');

  return (
    <li>
      <div
        className={rowClass}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', node.id);
          editor.setDragId(node.id);
        }}
        onDragOver={(event) => {
          if (!editor.dragId || !canDrop(editor.categories, editor.dragId, node.id)) return;
          event.preventDefault(); // permite soltar aquí
          event.dataTransfer.dropEffect = 'move';
          const position = dropPosition(event);
          if (editor.drop?.targetId !== node.id || editor.drop.position !== position) editor.setDrop({ targetId: node.id, position });
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null) && editor.drop?.targetId === node.id) editor.setDrop(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (editor.dragId) {
            const position = dropPosition(event);
            editor.change(moveNode(editor.categories, editor.dragId, node.id, position));
            if (position === 'inside' && !expanded) editor.toggle(node.id);
          }
          endDrag();
        }}
        onDragEnd={endDrag}
      >
        <span className="material-symbols-outlined cat-handle" aria-hidden="true">drag_indicator</span>
        {hasChildren ? (
          <button type="button" className="cat-toggle" aria-expanded={expanded} aria-label={expanded ? 'Plegar' : 'Desplegar'} onClick={() => editor.toggle(node.id)}>
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="cat-toggle" aria-hidden="true" />
        )}
        <button
          type="button"
          className="cat-name"
          title={node.description ? `${node.description}\n\nClic para editar` : 'Clic para editar el nombre y la descripción'}
          onClick={() => editor.setEditingId(editing ? null : node.id)}
        >
          {node.name || '(sin nombre)'}
        </button>
        <ActionButton icon="arrow_upward" label="Subir" disabled={index === 0} onClick={() => editor.change(moveAmongSiblings(editor.categories, node.id, -1))} />
        <ActionButton icon="arrow_downward" label="Bajar" disabled={index === siblingCount - 1} onClick={() => editor.change(moveAmongSiblings(editor.categories, node.id, 1))} />
        <ActionButton icon="add" label="Añadir subcategoría" onClick={() => editor.add(node.id)} />
        <ActionButton icon="delete" label="Eliminar" danger onClick={() => editor.remove(node)} />
      </div>

      {editing && (
        <div className="cat-edit">
          <label>
            Nombre
            <input
              autoFocus
              value={node.name}
              spellCheck={false}
              onChange={(event) => editor.change(updateNode(editor.categories, node.id, { name: event.target.value }))}
            />
          </label>
          <label>
            Descripción
            <textarea
              value={node.description}
              placeholder="Qué incidencias entran en esta categoría (lo usa el modelo decisional)…"
              onChange={(event) => editor.change(updateNode(editor.categories, node.id, { description: event.target.value }))}
            />
          </label>
        </div>
      )}

      {hasChildren && expanded && <EditorList nodes={node.children} />}
    </li>
  );
}

function EditorList({ nodes, root = false }: { nodes: CategoryTree; root?: boolean }) {
  return (
    <ul className={root ? 'cat-list' : undefined} role={root ? 'tree' : 'group'}>
      {nodes.map((node, index) => <EditorNode key={node.id} node={node} index={index} siblingCount={nodes.length} />)}
    </ul>
  );
}

interface Props {
  categories: CategoryTree;
  onChange: (tree: CategoryTree) => void;
  setStatus: SetStatus;
}

/**
 * Editor del árbol de categorías: desplegar (▶), arrastrar para mover (antes, después o dentro de otra),
 * subir/bajar, añadir subcategorías, eliminar y editar nombre y descripción. Los cambios se aplican al guardar.
 */
export function CategoryEditor({ categories, onChange, setStatus }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<EditorState['drop']>(null);

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const add = (parentId: string | null) => {
    const node: CategoryNode = { id: crypto.randomUUID(), name: uniqueName(categories, parentId), description: '', children: [] };
    onChange(insertNode(categories, parentId, Number.MAX_SAFE_INTEGER, node));
    if (parentId) setExpanded((current) => new Set(current).add(parentId));
    setEditingId(node.id);
  };

  const remove = (node: CategoryNode) => {
    if (editingId && isWithin(categories, node.id, editingId)) setEditingId(null);
    onChange(removeNode(categories, node.id));
    const descendants = countDescendants(node);
    setStatus(`"${node.name}" eliminada${descendants ? ` con sus ${descendants} subcategorías` : ''}. Pulsa Guardar para aplicarlo o vuelve atrás para descartarlo.`);
  };

  const restoreDefaults = () => {
    onChange(DEFAULT_CATEGORIES);
    setEditingId(null);
    setExpanded(new Set());
    setStatus('Categorías por defecto restauradas. Pulsa Guardar para aplicarlas.');
  };

  const state: EditorState = {
    categories, expanded, editingId, dragId, drop,
    change: onChange, toggle, setEditingId, setDragId, setDrop, add, remove
  };

  return (
    <EditorContext.Provider value={state}>
      <div className="category-editor">
        {categories.length
          ? <EditorList nodes={categories} root />
          : <p className="cat-empty">No hay categorías. Añade al menos un área.</p>}
        <div className="cat-footer">
          <button type="button" className="outline-button cat-add" onClick={() => add(null)}>
            <Icon name="add" /> Añadir área
          </button>
          <button type="button" className="text-button" onClick={restoreDefaults}>Restaurar por defecto</button>
        </div>
      </div>
    </EditorContext.Provider>
  );
}
