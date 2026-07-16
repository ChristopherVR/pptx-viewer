import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SignatureStrippedDialog from './SignatureStrippedDialog.svelte';
import VersionHistoryPanel from './VersionHistoryPanel.svelte';

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe('recovery and signature surfaces', () => {
	it('renders the signed-edit warning count and action', () => {
		const target = document.createElement('div');
		const instance = mount(SignatureStrippedDialog, {
			target,
			props: { signatureCount: 2, onclose: vi.fn() },
		});
		cleanups.push(() => unmount(instance));
		expect(target.textContent).toContain('2');
		expect(target.textContent).toContain('Edit anyway');
	});

	it('renders an empty version history without a file path', async () => {
		const target = document.createElement('div');
		const instance = mount(VersionHistoryPanel, {
			target,
			props: { onclose: vi.fn(), onrestore: vi.fn() },
		});
		cleanups.push(() => unmount(instance));
		await vi.waitFor(() => expect(target.textContent).toContain('No versions'));
		expect(target.textContent).toContain('No versions');
	});
});
