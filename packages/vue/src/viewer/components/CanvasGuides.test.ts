import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CanvasGuides from './CanvasGuides.vue';

const guides = [
	{ id: 'h1', axis: 'h' as const, position: 200 },
	{ id: 'v1', axis: 'v' as const, position: 300 },
];

describe('canvasGuides', () => {
	it('renders one positioned line per guide', () => {
		const wrapper = mount(CanvasGuides, { props: { guides, scale: 1 } });
		const lines = wrapper.findAll('div');
		expect(lines).toHaveLength(2);
		expect(lines[0].attributes('style')).toContain('top: 200px');
		expect(lines[0].attributes('style')).toContain('row-resize');
		expect(lines[1].attributes('style')).toContain('left: 300px');
		expect(lines[1].attributes('style')).toContain('col-resize');
	});

	it('emits remove on double-click', async () => {
		const wrapper = mount(CanvasGuides, { props: { guides, scale: 1 } });
		await wrapper.findAll('div')[0].trigger('dblclick');
		expect(wrapper.emitted('remove')?.[0]).toStrictEqual(['h1']);
	});
});
