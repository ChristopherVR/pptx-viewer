import { autosaveRecoveryPrompt } from 'pptx-viewer-shared';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AutosaveRecoveryDialog from './AutosaveRecoveryDialog.svelte';
import SignatureStrippedDialog from './SignatureStrippedDialog.svelte';
import VersionHistoryPanel from './VersionHistoryPanel.svelte';

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

/**
 * The dialog is the whole point of the recovery feature in this binding: the
 * snapshots were always written and never once offered back. It renders the
 * shared descriptor verbatim, so the descriptor is built here by the shared
 * decision function rather than hand-written.
 */
describe('the autosave recovery prompt', () => {
	function renderPrompt(ageMinutes: number): {
		target: HTMLElement;
		onrestore: ReturnType<typeof vi.fn>;
		ondiscard: ReturnType<typeof vi.fn>;
	} {
		const now = Date.now();
		const prompt = autosaveRecoveryPrompt({
			record: { key: 'quarterly.pptx', timestamp: now - ageMinutes * 60_000, size: 831_488 },
			now,
		});
		if (!prompt) {
			throw new Error('the shared prompt builder rejected a fresh snapshot');
		}
		const target = document.createElement('div');
		const onrestore = vi.fn();
		const ondiscard = vi.fn();
		const instance = mount(AutosaveRecoveryDialog, {
			target,
			props: { prompt, onrestore, ondiscard },
		});
		cleanups.push(() => unmount(instance));
		return { target, onrestore, ondiscard };
	}

	it('names the deck, its size and its age, under an e2e-stable marker', () => {
		const { target } = renderPrompt(3);
		const overlay = target.querySelector('[data-pptx-autosave-recovery="true"]');
		const dialog = overlay?.querySelector('[role="dialog"]');

		expect(dialog?.getAttribute('aria-label')).toBe('Recover unsaved changes?');
		expect(target.textContent).toContain('quarterly.pptx');
		expect(target.textContent).toContain('812 KB');
		expect(target.textContent).toContain('Autosaved 3 min ago');
	});

	it('translates an older snapshot in hours', () => {
		expect(renderPrompt(150).target.textContent).toContain('Autosaved 2 h ago');
	});

	it('routes its two buttons to restore and discard', () => {
		const { target, onrestore, ondiscard } = renderPrompt(3);
		const button = (name: string): HTMLButtonElement | null =>
			[...target.querySelectorAll('button')].find(
				(candidate) => candidate.textContent?.trim() === name,
			) ?? null;

		button('Restore')?.click();
		button('Discard')?.click();

		expect(onrestore).toHaveBeenCalledOnce();
		expect(ondiscard).toHaveBeenCalledOnce();
	});
});

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
