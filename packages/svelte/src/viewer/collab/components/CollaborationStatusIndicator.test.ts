import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import CollaborationStatusIndicator from './CollaborationStatusIndicator.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('collaborationStatusIndicator', () => {
	it('exposes the exact connected runtime status contract', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(CollaborationStatusIndicator, {
			target,
			props: { status: 'connected', connectedCount: 3, onretry: () => {} },
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};

		const status = target.querySelector('[role="status"]');
		expect(status?.getAttribute('aria-label')).toBe('Collaboration: Connected');
		expect(status?.textContent).toContain('3 people here');
	});
});
