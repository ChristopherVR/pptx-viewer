import type { GeometryPatch } from '../../editor/editor-edit-ops';
import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { NumberFieldHandle } from '../controls';
import { makeButton, makeNumberField } from '../controls';
import { createIcon } from '../icons';
import type { InspectorState } from './types';

export interface PositionSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/** The universal Position & Size section: X/Y/W/H/rotation numeric fields. */
export function createPositionSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	setGeometry: (patch: GeometryPatch) => void,
	toggleElementLock: () => void,
): PositionSection {
	const el = section(t('pptx.arrange.positionSize'));

	// Move the section's own caption into a header row alongside the lock
	// toggle, matching React's ElementInspectorBody / Vue's ArrangePanel.
	const caption = el.querySelector<HTMLElement>('.pptxv-inspector-section-title');
	const headerRow = createEl(doc, 'div', 'pptxv-inspector-lock-row');
	if (caption) {
		el.insertBefore(headerRow, caption);
		headerRow.appendChild(caption);
	} else {
		el.insertBefore(headerRow, el.firstChild);
	}
	// Shared decides both what reads as "locked" and what the toggle writes, so
	// the button's state can never drift from what the canvas enforces.
	const lockBtn = makeButton(doc, {
		label: t('pptx.inspector.lock'),
		icon: 'lock-open',
		className: 'pptxv-inspector-lock-btn',
		onClick: toggleElementLock,
	});
	headerRow.appendChild(lockBtn.btn);

	const grid = createEl(doc, 'div', 'pptxv-inspector-grid');
	el.appendChild(grid);

	const geo = (label: string, key: keyof GeometryPatch, min?: number): NumberFieldHandle => {
		const field = makeNumberField(doc, {
			label,
			min,
			onCommit: (value) => setGeometry({ [key]: value }),
		});
		grid.appendChild(field.el);
		return field;
	};
	const xField = geo(t('pptx.arrange.x'), 'x');
	const yField = geo(t('pptx.arrange.y'), 'y');
	const wField = geo(t('pptx.arrange.width'), 'width', 1);
	const hField = geo(t('pptx.arrange.height'), 'height', 1);
	const rotField = geo(t('pptx.arrange.rotation'), 'rotation');
	const fields = [xField, yField, wField, hField, rotField];

	return {
		el,
		update(state) {
			el.hidden = !state.hasSelection;
			xField.setValue(state.x);
			yField.setValue(state.y);
			wField.setValue(state.width);
			hField.setValue(state.height);
			rotField.setValue(state.rotation);
			for (const f of fields) {
				f.setDisabled(!state.hasSelection);
			}
			lockBtn.setActive(state.isLocked);
			lockBtn.setDisabled(!state.hasSelection);
			const label = t(state.isLocked ? 'pptx.inspector.unlock' : 'pptx.inspector.lock');
			lockBtn.btn.title = label;
			lockBtn.btn.setAttribute('aria-label', label);
			lockBtn.btn.replaceChildren(createIcon(doc, state.isLocked ? 'lock' : 'lock-open'));
		},
	};
}
