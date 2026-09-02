import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useElementStorePatch } from './element-store-patch';
import type { TemplateElementMap } from './template-editing';

/**
 * element-store-patch tests: the live-gesture patcher now routes through the
 * shared `walkAndPatchElements` walker, so it finds and rebuilds a target
 * nested inside a `group` (the bug the shared walker fixes: Vue's earlier
 * hand-rolled version only mapped the top-level array and silently dropped
 * patches to grouped children). Also pins the untouched-store-object-identity
 * contract (no history entry is implied) and the template-element routing.
 */
function shape(id: string, name = 'Shape'): PptxElement {
	return { id, type: 'shape', name, x: 0, y: 0, width: 10, height: 10 } as unknown as PptxElement;
}

function group(id: string, children: PptxElement[]): PptxElement {
	return {
		id,
		type: 'group',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		children,
	} as unknown as PptxElement;
}

function slideWith(elements: PptxElement[]): PptxSlide {
	return { id: 'slide-1', slideNumber: 1, elements } as unknown as PptxSlide;
}

describe('useElementStorePatch', () => {
	it('patches a top-level element on the active slide', () => {
		const slides = ref<PptxSlide[]>([slideWith([shape('e1')])]);
		const activeSlideIndex = ref(0);
		const templateElementsBySlideId = ref<TemplateElementMap>({});
		const patch = useElementStorePatch({ slides, activeSlideIndex, templateElementsBySlideId });

		patch('e1', (el) => ({ ...el, name: 'Renamed' }) as PptxElement);

		expect((slides.value[0].elements[0] as unknown as { name: string }).name).toBe('Renamed');
	});

	it('finds and patches an element nested inside a group', () => {
		const nested = shape('child-1');
		const slides = ref<PptxSlide[]>([slideWith([group('g1', [nested, shape('child-2')])])]);
		const activeSlideIndex = ref(0);
		const templateElementsBySlideId = ref<TemplateElementMap>({});
		const patch = useElementStorePatch({ slides, activeSlideIndex, templateElementsBySlideId });

		patch('child-1', (el) => ({ ...el, name: 'Renamed child' }) as PptxElement);

		const grp = slides.value[0].elements[0] as unknown as {
			children: { id: string; name: string }[];
		};
		expect(grp.children[0].name).toBe('Renamed child');
		// The sibling and the group's own reference to unrelated data stay untouched.
		expect(grp.children[1].id).toBe('child-2');
	});

	it('leaves the store untouched (same array reference) when the id is not found', () => {
		const slides = ref<PptxSlide[]>([slideWith([shape('e1')])]);
		const originalElements = slides.value[0].elements;
		const activeSlideIndex = ref(0);
		const templateElementsBySlideId = ref<TemplateElementMap>({});
		const patch = useElementStorePatch({ slides, activeSlideIndex, templateElementsBySlideId });

		patch('missing', (el) => ({ ...el, name: 'x' }) as PptxElement);

		expect(slides.value[0].elements).toBe(originalElements);
	});

	it('routes a layout-/master-prefixed id to the template-element store', () => {
		const slides = ref<PptxSlide[]>([slideWith([])]);
		const activeSlideIndex = ref(0);
		const templateElementsBySlideId = ref<TemplateElementMap>({
			'slide-1': [shape('layout-e1')],
		});
		const patch = useElementStorePatch({ slides, activeSlideIndex, templateElementsBySlideId });

		patch('layout-e1', (el) => ({ ...el, name: 'Renamed template' }) as PptxElement);

		const templateEl = templateElementsBySlideId.value['slide-1'][0] as unknown as { name: string };
		expect(templateEl.name).toBe('Renamed template');
		// Ordinary slide content is untouched by a template-routed patch.
		expect(slides.value[0].elements).toStrictEqual([]);
	});
});
