import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DigitalSignaturesDialog from './DigitalSignaturesDialog.svelte';
import PasswordProtectionDialog from './PasswordProtectionDialog.svelte';

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe('file info dialogs', () => {
	it('reports signed presentation status', () => {
		const target = document.createElement('div');
		const instance = mount(DigitalSignaturesDialog, {
			target,
			props: { hasSignatures: true, signatureCount: 2, onclose: vi.fn() },
		});
		cleanups.push(() => unmount(instance));
		expect(target.textContent).toContain('2');
	});

	it('validates and accepts a protection password', () => {
		const target = document.createElement('div');
		const onset = vi.fn();
		const instance = mount(PasswordProtectionDialog, {
			target,
			props: { protected: false, onset, onremove: vi.fn(), onclose: vi.fn() },
		});
		cleanups.push(() => unmount(instance));
		const inputs = target.querySelectorAll<HTMLInputElement>('input');
		inputs[0].value = 'Safe123!';
		inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
		inputs[1].value = 'Safe123!';
		inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		(target.querySelector('button.primary') as HTMLButtonElement).click();
		expect(onset).toHaveBeenCalledWith('Safe123!');
	});
});
