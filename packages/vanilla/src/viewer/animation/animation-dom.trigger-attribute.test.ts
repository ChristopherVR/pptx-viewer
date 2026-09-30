import { PRESENTATION_ANIM_TRIGGER_ATTRIBUTE } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { applyElementAnimationStyles } from './animation-dom';

function stage(): HTMLElement {
	const root = document.createElement('div');
	for (const id of ['sp_plain', 'sp_click', 'sp_hover']) {
		const el = document.createElement('div');
		el.dataset.elementId = id;
		root.appendChild(el);
	}
	document.body.appendChild(root);
	return root;
}

// The running-show hit-test CSS blanket-hides every element from the pointer
// and re-enables only what owns its own click. A trigger shape owns its click
// (its sequence plays instead of the show advancing), so the playback pass must
// stamp `PRESENTATION_ANIM_TRIGGER_ATTRIBUTE` on it - the cursor alone was
// never enough: the pointer never reached the element, so the cursor was
// invisible and the delegated listeners resolved the stage as the target.
describe('applyElementAnimationStyles trigger marker', () => {
	it('marks interactive and hover trigger shapes for the hit-test whitelist', () => {
		const root = stage();
		applyElementAnimationStyles(root, new Map(), new Set(['sp_click']), new Set(['sp_hover']));

		const plain = root.querySelector<HTMLElement>('[data-element-id="sp_plain"]');
		const click = root.querySelector<HTMLElement>('[data-element-id="sp_click"]');
		const hover = root.querySelector<HTMLElement>('[data-element-id="sp_hover"]');
		expect(plain?.hasAttribute(PRESENTATION_ANIM_TRIGGER_ATTRIBUTE)).toBeFalsy();
		expect(click?.hasAttribute(PRESENTATION_ANIM_TRIGGER_ATTRIBUTE)).toBeTruthy();
		expect(click?.style.cursor).toBe('pointer');
		expect(hover?.hasAttribute(PRESENTATION_ANIM_TRIGGER_ATTRIBUTE)).toBeTruthy();
		expect(hover?.style.cursor).toBe('pointer');
	});

	it('clears the marker once the element stops being a trigger shape', () => {
		const root = stage();
		applyElementAnimationStyles(root, new Map(), new Set(['sp_click']), new Set());
		expect(
			root
				.querySelector<HTMLElement>('[data-element-id="sp_click"]')
				?.hasAttribute(PRESENTATION_ANIM_TRIGGER_ATTRIBUTE),
		).toBeTruthy();

		applyElementAnimationStyles(root, new Map(), new Set(), new Set());
		expect(
			root
				.querySelector<HTMLElement>('[data-element-id="sp_click"]')
				?.hasAttribute(PRESENTATION_ANIM_TRIGGER_ATTRIBUTE),
		).toBeFalsy();
	});
});
