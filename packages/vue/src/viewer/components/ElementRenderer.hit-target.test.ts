// Issue #285: the element wrapper used to clamp width/height to
// MIN_ELEMENT_SIZE (12px), so a degenerate shape (a 1-pt horizontal rule
// authored ~1.25px tall) painted as a solid bar instead of a hairline once its
// fill rode on the wrapper's own background-color.
//
// The painted box must now stay at the element's authored size always, and
// grabbability for a degenerate element is a separate, interaction-only
// `[data-pptx-hit-target]` overlay rendered only while `interactive` is true
// and the element is not presenting. This file covers the `group` branch of
// `ElementRenderer.vue` itself (the shape/text branch is already covered by
// `element-style.test.ts` + the shape rendering tests); the delegated
// per-type renderers (image, chart, table, etc.) have their own colocated
// tests, e.g. `ElementImageBox.test.ts`, `ChartRenderer.test.ts`.
import { mount } from '@vue/test-utils';
import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.vue';

function thinGroup(overrides: Partial<GroupPptxElement> = {}): PptxElement {
	return {
		type: 'group',
		id: 'grp-1',
		x: 0,
		y: 0,
		width: 400,
		height: 1,
		children: [
			{
				type: 'shape',
				id: 'child-1',
				x: 0,
				y: 0,
				width: 400,
				height: 1,
				shapeStyle: { fillColor: '#000000', fillMode: 'solid' },
			},
		],
		...overrides,
	} as PptxElement;
}

describe('elementRenderer group hit target (issue #285)', () => {
	it('adds a padded, pointer-events:auto hit target on a degenerate group only when interactive and not presenting', () => {
		const wrapper = mount(ElementRenderer, {
			props: {
				element: thinGroup(),
				mediaDataUrls: new Map(),
				zIndex: 1,
				interactive: true,
				presenting: false,
			},
		});
		const root = wrapper.get('[data-element-id="grp-1"]');
		const hitTarget = root.find('[data-pptx-hit-target]');
		expect(hitTarget.exists()).toBeTruthy();
		expect(hitTarget.attributes('style')).toContain('height: 12px');
		expect(hitTarget.attributes('style')).toContain('pointer-events: auto');
		// The painted group box itself stays at the authored (unpadded) size.
		expect(root.attributes('style')).toContain('height: 1px');
	});

	it('never adds the hit target on a read-only (non-interactive) group render', () => {
		const wrapper = mount(ElementRenderer, {
			props: {
				element: thinGroup(),
				mediaDataUrls: new Map(),
				zIndex: 1,
				interactive: false,
			},
		});
		expect(wrapper.find('[data-pptx-hit-target]').exists()).toBeFalsy();
	});

	it('never adds the hit target on a presenting (live show) group render', () => {
		const wrapper = mount(ElementRenderer, {
			props: {
				element: thinGroup(),
				mediaDataUrls: new Map(),
				zIndex: 1,
				interactive: true,
				presenting: true,
			},
		});
		expect(wrapper.find('[data-pptx-hit-target]').exists()).toBeFalsy();
	});
});
