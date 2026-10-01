import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';

import type { EditorState } from '../../../editor/editor-state.svelte';
import SlideTemplatesLauncher from './SlideTemplatesLauncher.svelte';

describe('slide template launcher', () => {
	it('renders nothing until the shared Slide Templates control asks for the gallery', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		const props = $state({
			editor: { editable: true } as EditorState,
			onnavigate: () => undefined,
			open: false,
		});
		const instance = mount(SlideTemplatesLauncher, { target, props });
		flushSync();
		expect(target.querySelector('dialog')).toBeNull();
		props.open = true;
		flushSync();
		expect(target.querySelector('dialog, [role="dialog"]')).not.toBeNull();
		await unmount(instance);
		target.remove();
	});
});
