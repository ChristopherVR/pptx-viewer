import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import {
	addTableStyleToMap,
	createTableStyleEntry,
	deleteTableStyleFromMap,
	normalizeTableStyleGuid,
} from 'pptx-viewer-core';
import type { TableStyleEditorPartId } from 'pptx-viewer-shared';
import {
	applyTableStyleFieldEdit,
	describeTableStyleEditor,
	TABLE_STYLE_EDITOR_PARTS,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createTableStyleEditorFields } from './table-style-editor-fields';

export interface TableStyleEditorDeps {
	getTableStyleMap(): ParsedTableStyleMap | undefined;
	getThemeColorMap(): Record<string, string> | undefined;
	/** Commit a full replacement style map (section edit, create, or delete already applied). */
	onStyleMapChange(map: ParsedTableStyleMap): void;
	/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
	onDeleteStyle(styleId: string): void;
	/** Optional: assign a newly-created style to the table being edited. */
	onAssignStyle?(styleId: string): void;
}

export interface TableStyleEditorHandle {
	/** The "Edit style..." button + its collapsible panel. */
	el: HTMLElement;
	update(styleId: string | undefined, canEdit: boolean): void;
}

/**
 * "Edit style..." panel for a table style's own DEFINITION (`a:tblStyleLst`
 * section fill/text/borders/cell3D), distinct from `table-section.ts`'s
 * "which style does this table use" text field. Vanilla port of React's
 * `TableStyleEditor.tsx` / Vue's `TableStyleEditor.vue` / Svelte's
 * `TableStyleEditor.svelte`.
 */
export function createTableStyleEditor(
	doc: Document,
	t: Translator,
	deps: TableStyleEditorDeps,
): TableStyleEditorHandle {
	const el = createEl(doc, 'div', 'pptxv-tse');
	const button = doc.createElement('button');
	button.type = 'button';
	button.className = 'pptxv-tse-btn';
	button.textContent = t('pptx.tableStyleEditor.editButton');
	const panel = createEl(doc, 'div', 'pptxv-tse-panel');
	// Same hook the other four bindings expose for the shared e2e spec.
	panel.dataset.testid = 'table-style-editor';
	panel.hidden = true;
	el.append(button, panel);

	const header = createEl(doc, 'div', 'pptxv-tse-header');
	const heading = createEl(doc, 'span', 'pptxv-tse-heading');
	heading.textContent = t('pptx.tableStyleEditor.title');
	const closeBtn = doc.createElement('button');
	closeBtn.type = 'button';
	closeBtn.textContent = t('pptx.tableStyleEditor.close');
	closeBtn.addEventListener('click', () => setOpen(false));
	header.append(heading, closeBtn);

	const empty = createEl(doc, 'div', 'pptxv-tse-empty');
	empty.textContent = t('pptx.tableStyleEditor.noStyleSelected');

	const partsRow = createEl(doc, 'div', 'pptxv-tse-parts');
	const partButtons = new Map<TableStyleEditorPartId, HTMLButtonElement>();
	let selectedPart: TableStyleEditorPartId = 'wholeTbl';
	// `forEach`, not `for..of`: a listener closure declared inside a loop
	// statement trips oxlint's `no-loop-func`.
	TABLE_STYLE_EDITOR_PARTS.forEach((part) => {
		const btn = doc.createElement('button');
		btn.type = 'button';
		btn.textContent = t(part.labelKey);
		btn.addEventListener('click', () => {
			selectedPart = part.id;
			renderAll();
		});
		partButtons.set(part.id, btn);
		partsRow.appendChild(btn);
	});

	const fields = createTableStyleEditorFields(doc, t, (edit) => {
		const map = deps.getTableStyleMap();
		const entry = map?.[normalizeTableStyleGuid(currentStyleId)];
		if (!map || !entry) {
			return;
		}
		const { entry: nextEntry } = applyTableStyleFieldEdit(entry, selectedPart, edit);
		deps.onStyleMapChange({ ...map, [nextEntry.styleId]: nextEntry });
	});

	const actions = createEl(doc, 'div', 'pptxv-tse-actions');
	const newBtn = doc.createElement('button');
	newBtn.type = 'button';
	newBtn.textContent = t('pptx.tableStyleEditor.newFromCurrent');
	newBtn.addEventListener('click', () => {
		const map = deps.getTableStyleMap();
		const entry = map?.[normalizeTableStyleGuid(currentStyleId)];
		const name = doc.defaultView?.prompt(
			t('pptx.tableStyleEditor.newStyleNamePrompt'),
			entry ? `${entry.styleName ?? ''} Copy`.trim() : '',
		);
		if (!name) {
			return;
		}
		const nextMap: ParsedTableStyleMap = { ...(map ?? {}) };
		const created = createTableStyleEntry(nextMap, { styleName: name, basedOn: entry });
		addTableStyleToMap(nextMap, created);
		deps.onStyleMapChange(nextMap);
		currentStyleId = created.styleId;
		deps.onAssignStyle?.(created.styleId);
		renderAll();
	});
	const deleteBtn = doc.createElement('button');
	deleteBtn.type = 'button';
	deleteBtn.textContent = t('pptx.tableStyleEditor.deleteStyle');
	deleteBtn.addEventListener('click', () => {
		const map = deps.getTableStyleMap();
		const entry = map?.[normalizeTableStyleGuid(currentStyleId)];
		if (!map || !entry || !doc.defaultView?.confirm(t('pptx.tableStyleEditor.deleteConfirm'))) {
			return;
		}
		const nextMap: ParsedTableStyleMap = { ...map };
		deleteTableStyleFromMap(nextMap, entry.styleId);
		deps.onStyleMapChange(nextMap);
		deps.onDeleteStyle(entry.styleId);
		setOpen(false);
	});
	actions.append(newBtn, deleteBtn);

	panel.append(header, empty, partsRow, fields.el, actions);

	let currentStyleId = '';
	let currentCanEdit = true;
	let open = false;

	function setOpen(next: boolean): void {
		open = next;
		panel.hidden = !open;
		if (open) {
			renderAll();
		}
	}

	function renderAll(): void {
		const map = deps.getTableStyleMap();
		const entry = currentStyleId ? map?.[currentStyleId] : undefined;
		empty.hidden = Boolean(entry);
		partsRow.hidden = !entry;
		fields.el.hidden = !entry;
		deleteBtn.hidden = !entry;
		newBtn.textContent = entry
			? t('pptx.tableStyleEditor.newFromCurrent')
			: t('pptx.tableStyleEditor.newStyle');
		for (const [id, btn] of partButtons) {
			btn.classList.toggle('active', id === selectedPart);
			btn.disabled = !currentCanEdit;
		}
		newBtn.disabled = !currentCanEdit;
		deleteBtn.disabled = !currentCanEdit;
		if (entry) {
			const descriptor = describeTableStyleEditor(entry, selectedPart, deps.getThemeColorMap());
			if (descriptor) {
				fields.update(descriptor, deps.getThemeColorMap(), currentCanEdit);
			}
		}
	}

	button.addEventListener('click', () => setOpen(!open));

	return {
		el,
		update(styleId, canEdit) {
			currentStyleId = styleId ? normalizeTableStyleGuid(styleId) : '';
			currentCanEdit = canEdit;
			button.disabled = !canEdit;
			if (open) {
				renderAll();
			}
		},
	};
}
