import { hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';

export interface ArrangeExtrasHandlers {
	groupSelected(): void;
	ungroupSelected(): void;
	setStrokeWidth(width: number): void;
}

export interface ArrangeExtrasState {
	editable: boolean;
	/** How many elements the multi-select holds; Group needs two. */
	selectedCount: number;
	selectedElement: PptxElement | undefined;
}

export interface ArrangeExtras {
	el: HTMLElement;
	update(state: ArrangeExtrasState): void;
}

/** Outline thickness the renderer assumes when the shape declares none. */
const DEFAULT_STROKE_WIDTH = 1;

/**
 * The Arrange group's shape-level extras: Group, Ungroup, and the outline
 * width spinner.
 *
 * Its own module so `arrange-group.ts` stays inside the 300-LOC budget, and
 * the three live together because they are gated on the same thing: a
 * selection that is actually a shape (or, for Group, two elements). Group and
 * Ungroup already existed here as entries inside the Drawing group's Arrange
 * dropdown, which is a menu a user has to open to discover; the ribbon buttons
 * are what every other binding offers.
 *
 * The spinner is a bare `<input>` rather than `makeNumberField`, because that
 * helper renders a visible caption and the ribbon has no room for one: the
 * control is named by `aria-label`/`title` alone, exactly as React names it.
 */
export function createArrangeExtras(
	doc: Document,
	t: Translator,
	handlers: ArrangeExtrasHandlers,
): ArrangeExtras {
	const el = createEl(doc, 'div', 'pptxv-arrange-extras');

	const group = makeButton(doc, {
		label: t('pptx.contextMenu.group'),
		icon: 'group',
		onClick: handlers.groupSelected,
	});
	const ungroup = makeButton(doc, {
		label: t('pptx.contextMenu.ungroup'),
		icon: 'ungroup',
		onClick: handlers.ungroupSelected,
	});

	const stroke = doc.createElement('input');
	stroke.type = 'number';
	stroke.className = 'pptxv-field-input pptxv-arrange-stroke';
	stroke.min = '0';
	stroke.max = '120';
	stroke.step = '0.5';
	stroke.value = String(DEFAULT_STROKE_WIDTH);
	stroke.title = t('pptx.ribbon.strokeWidth');
	stroke.setAttribute('aria-label', t('pptx.ribbon.strokeWidth'));
	// The editor's own key handler owns arrows/Delete on the stage; a spinner
	// that let them through would nudge or delete the shape being restyled.
	stroke.addEventListener('keydown', (event) => event.stopPropagation());
	stroke.addEventListener('change', () => {
		const next = Number.parseFloat(stroke.value);
		if (Number.isFinite(next)) {
			handlers.setStrokeWidth(Math.max(0, next));
		}
	});

	el.append(group.btn, ungroup.btn, stroke);

	return {
		el,
		update({ editable, selectedCount, selectedElement }) {
			group.setDisabled(!editable || selectedCount < 2);
			ungroup.setDisabled(!editable || selectedElement?.type !== 'group');
			const shape = selectedElement !== undefined && hasShapeProperties(selectedElement);
			stroke.disabled = !editable || !shape;
			const width =
				selectedElement !== undefined && hasShapeProperties(selectedElement)
					? (selectedElement.shapeStyle?.strokeWidth ?? DEFAULT_STROKE_WIDTH)
					: DEFAULT_STROKE_WIDTH;
			// Never clobber the field while the user is typing into it.
			if (doc.activeElement !== stroke) {
				stroke.value = String(width);
			}
		},
	};
}
