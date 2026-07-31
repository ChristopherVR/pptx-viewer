import {
	addTagToCollections,
	deleteTagFromCollections,
	flattenTagCollections,
	updateTagInCollections,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { DeckCard } from './deck-card-helpers';
import { makeDeckButton, makeSection } from './deck-card-helpers';
import type { InspectorDeckState, InspectorHandlers } from './types';

/**
 * The TAGS card (React's `TagsSection`, reached from its
 * `PresentationPropertiesPanel`): PowerPoint's programmatic name/value metadata
 * from `ppt/tags/*.xml`, shown as one flat editable list.
 *
 * The flat row to nested `(collection, tag)` address mapping lives in
 * `pptx-viewer-shared/tag-collections`, so vanilla cannot drift from the other
 * bindings on which tag a row edits. Collapsed by default like React, because a
 * deck authored by an add-in can carry dozens of tags nobody is looking at.
 */
export function createTagsCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'updateTagCollections'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.tags.title'));

	const toggle = createEl(doc, 'button', 'pptxv-tags-toggle');
	toggle.type = 'button';
	const toggleLabel = createEl(doc, 'span', 'pptxv-tags-toggle-label');
	const count = createEl(doc, 'span', 'pptxv-tags-count');
	toggle.append(toggleLabel, count);
	const list = createEl(doc, 'div', 'pptxv-tags-list');
	const empty = createEl(doc, 'p', 'pptxv-tags-empty');
	empty.textContent = t('pptx.tags.noTags');
	const addButton = makeDeckButton(doc, t('pptx.tags.addTag'), () =>
		handlers.updateTagCollections(addTagToCollections(collections)),
	);
	body.append(toggle, list, empty, addButton);

	let collections: InspectorDeckState['tagCollections'] = [];
	let collapsed = true;
	let editable = false;

	const field = (
		value: string,
		placeholder: string,
		commit: (next: string) => void,
	): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'text';
		input.className = 'pptxv-tags-input';
		input.value = value;
		input.placeholder = placeholder;
		input.setAttribute('aria-label', placeholder);
		input.disabled = !editable;
		input.addEventListener('change', () => commit(input.value));
		input.addEventListener('keydown', (event) => event.stopPropagation());
		return input;
	};

	/** One editable name/value row, built outside the render loop. */
	const buildRow = (row: { name: string; value: string; colIdx: number; tagIdx: number }) => {
		const rowEl = createEl(doc, 'div', 'pptxv-tags-row');
		rowEl.append(
			field(row.name, t('pptx.tags.name'), (next) =>
				handlers.updateTagCollections(
					updateTagInCollections(collections, row.colIdx, row.tagIdx, 'name', next),
				),
			),
			field(row.value, t('pptx.tags.value'), (next) =>
				handlers.updateTagCollections(
					updateTagInCollections(collections, row.colIdx, row.tagIdx, 'value', next),
				),
			),
		);
		if (editable) {
			const remove = createEl(doc, 'button', 'pptxv-tags-remove');
			remove.type = 'button';
			remove.textContent = '×';
			remove.title = t('pptx.tags.deleteTag');
			remove.setAttribute('aria-label', t('pptx.tags.deleteTag'));
			remove.addEventListener('click', () =>
				handlers.updateTagCollections(
					deleteTagFromCollections(collections, row.colIdx, row.tagIdx),
				),
			);
			rowEl.appendChild(remove);
		}
		return rowEl;
	};

	const render = (): void => {
		const rows = flattenTagCollections(collections);
		count.textContent = String(rows.length);
		toggleLabel.textContent = `${collapsed ? '▸' : '▾'} ${t('pptx.tags.title')}`;
		toggle.setAttribute('aria-expanded', String(!collapsed));
		list.hidden = collapsed || rows.length === 0;
		empty.hidden = collapsed || rows.length > 0;
		addButton.hidden = collapsed || !editable;
		addButton.disabled = !editable;
		if (collapsed) {
			return;
		}
		list.textContent = '';
		list.append(...rows.map(buildRow));
	};

	toggle.addEventListener('click', () => {
		collapsed = !collapsed;
		render();
	});

	return {
		el,
		update(state) {
			collections = state.tagCollections;
			editable = state.editable;
			render();
		},
	};
}
