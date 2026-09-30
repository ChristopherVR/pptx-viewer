import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';

import type { EditorState } from '../../../editor/editor-state.svelte';
import SlideTemplatesLauncher from './SlideTemplatesLauncher.svelte';

describe('slide template launcher icon', () => {
	it('uses the same three-panel, 24-unit stroked icon as the other bindings', async () => {
		const target = document.createElement('div');
		const instance = mount(SlideTemplatesLauncher, {
			target,
			props: { editor: { editable: true } as EditorState, onnavigate: () => undefined },
		});
		flushSync();
		const icon = target.querySelector('[data-ribbon-control="home.slides.slideTemplates"] svg');
		expect(icon?.getAttribute('viewBox')).toBe('0 0 24 24');
		expect(icon?.getAttribute('stroke-width')).toBe('2');
		expect(icon?.querySelectorAll('rect')).toHaveLength(3);
		await unmount(instance);
	});
});
