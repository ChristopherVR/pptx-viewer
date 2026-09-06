/**
 * read-only-recommendation-wiring.test.ts: the modify-password unlock prompt
 * end to end through the real `PptxViewer`/store/chrome, not just the shared
 * decision helper (already unit-tested in
 * `pptx-viewer-shared/render/read-only-recommendation` and
 * `modify-password-check`) or the banner's own DOM (`ui/read-only-banner.test.ts`).
 *
 * PowerPoint's own behaviour: a wrong password leaves the deck read-only, the
 * correct one unlocks it. Uses a REAL `p:modifyVerifier` hash built via core's
 * `createModifyVerifier`, so `checkModifyPassword` runs the actual ECMA-376
 * digest check, not a stub.
 */
import { createModifyVerifier, PptxHandler } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPptxViewer } from './PptxViewer';
import type { PptxViewerInstance } from './types';

let active: PptxViewerInstance[] = [];

function mount(): { container: HTMLElement; viewer: PptxViewerInstance } {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const viewer = createPptxViewer(container, { editable: true });
	active.push(viewer);
	return { container, viewer };
}

afterEach(() => {
	for (const viewer of active) {
		viewer.destroy();
	}
	active = [];
	document.body.replaceChildren();
});

async function buildPasswordProtectedDeck(password: string): Promise<Uint8Array> {
	const verifier = await createModifyVerifier(password, { spinCount: 10 });
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides, { modifyVerifier: verifier });
	} finally {
		handler.dispose();
	}
}

describe('vanilla read-only recommendation password prompt', () => {
	it('locks editing and shows the banner for a password-protected deck', async () => {
		const { container, viewer } = mount();
		await viewer.loadFile(await buildPasswordProtectedDeck('right-password'));

		const banner = container.querySelector<HTMLElement>('[data-testid="pptx-readonly-banner"]');
		expect(banner?.hidden).toBeFalsy();
		expect(banner?.dataset.kind).toBe('modifyVerifier');
		expect(container.querySelector('.pptxv')?.classList.contains('pptxv-editable')).toBeFalsy();
	});

	it('"Edit anyway" opens the password prompt instead of unlocking', async () => {
		const { container, viewer } = mount();
		await viewer.loadFile(await buildPasswordProtectedDeck('right-password'));

		container
			.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-edit-anyway"]')!
			.click();

		const form = container.querySelector<HTMLElement>(
			'[data-testid="pptx-readonly-password-form"]',
		);
		expect(form?.hidden).toBeFalsy();
		expect(container.querySelector('.pptxv')?.classList.contains('pptxv-editable')).toBeFalsy();
	});

	it('a wrong password stays read-only and reports the error', async () => {
		const { container, viewer } = mount();
		await viewer.loadFile(await buildPasswordProtectedDeck('right-password'));
		container
			.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-edit-anyway"]')!
			.click();

		const input = container.querySelector<HTMLInputElement>(
			'[data-testid="pptx-readonly-password-input"]',
		)!;
		input.value = 'wrong-password';
		container
			.querySelector<HTMLFormElement>('[data-testid="pptx-readonly-password-form"]')!
			.dispatchEvent(new Event('submit', { cancelable: true }));

		await vi.waitFor(() => {
			const error = container.querySelector('[data-testid="pptx-readonly-password-error"]');
			expect((error as HTMLElement | null)?.hidden).toBeFalsy();
		});
		expect(container.querySelector('.pptxv')?.classList.contains('pptxv-editable')).toBeFalsy();
		expect(
			container.querySelector<HTMLElement>('[data-testid="pptx-readonly-password-form"]')?.hidden,
		).toBeFalsy();
	});

	it('the correct password unlocks editing and closes the prompt', async () => {
		const { container, viewer } = mount();
		await viewer.loadFile(await buildPasswordProtectedDeck('right-password'));
		container
			.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-edit-anyway"]')!
			.click();

		const input = container.querySelector<HTMLInputElement>(
			'[data-testid="pptx-readonly-password-input"]',
		)!;
		input.value = 'right-password';
		container
			.querySelector<HTMLFormElement>('[data-testid="pptx-readonly-password-form"]')!
			.dispatchEvent(new Event('submit', { cancelable: true }));

		await vi.waitFor(() => {
			expect(container.querySelector('.pptxv')?.classList.contains('pptxv-editable')).toBeTruthy();
		});
		expect(
			container.querySelector<HTMLElement>('[data-testid="pptx-readonly-banner"]')?.hidden,
		).toBeTruthy();
	});
});
