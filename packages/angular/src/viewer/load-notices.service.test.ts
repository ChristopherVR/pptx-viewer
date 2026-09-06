/**
 * load-notices.service.test.ts: the read-only recommendation half of
 * `LoadNoticesService`, in particular the modify-password unlock prompt.
 *
 * Bare injector (no TestBed): the service's only dependency,
 * `LoadContentService`, is provided as a minimal stub exposing just
 * `parsedData` (the one signal `LoadNoticesService` reads).
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { PptxData } from 'pptx-viewer-core';
import { createModifyVerifier } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { LoadContentService } from './load-content.service';
import { LoadNoticesService } from './load-notices.service';

function createService(parsedData: PptxData | undefined): LoadNoticesService {
	const injector = Injector.create({
		providers: [
			{
				provide: LoadContentService,
				useValue: { parsedData: signal(parsedData), slides: signal([]) },
			},
		],
	});
	return runInInjectionContext(injector, () => new LoadNoticesService());
}

describe('loadNoticesService', () => {
	it('shows no banner and stays unlocked without a recommendation', () => {
		const service = createService(undefined);
		expect(service.bannerActive()).toBeFalsy();
		expect(service.lockActive()).toBeFalsy();
	});

	it('recommends read-only and locks editing for a modifyVerifier deck', () => {
		const service = createService({
			modifyVerifier: { hashData: 'abc', algorithmName: 'SHA-512' },
		} as unknown as PptxData);
		expect(service.recommendation().kind).toBe('modifyVerifier');
		expect(service.bannerActive()).toBeTruthy();
		expect(service.lockActive()).toBeTruthy();
	});

	describe('password-protected modifyVerifier', () => {
		it('editAnyway opens the password prompt instead of unlocking', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			const service = createService({ modifyVerifier: verifier } as unknown as PptxData);
			expect(service.recommendation().requiresPassword).toBeTruthy();

			service.editAnyway();

			expect(service.passwordPromptOpen()).toBeTruthy();
			expect(service.lockActive()).toBeTruthy();
			expect(service.bannerActive()).toBeTruthy();
		});

		it('submitPassword with the correct password unlocks and closes the prompt', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			const service = createService({ modifyVerifier: verifier } as unknown as PptxData);
			service.editAnyway();

			await service.submitPassword('right-password');

			expect(service.lockActive()).toBeFalsy();
			expect(service.passwordPromptOpen()).toBeFalsy();
			expect(service.passwordError()).toBeNull();
			expect(service.bannerActive()).toBeFalsy();
		});

		it('submitPassword with a wrong password stays locked and reports wrong-password', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			const service = createService({ modifyVerifier: verifier } as unknown as PptxData);
			service.editAnyway();

			await service.submitPassword('wrong-password');

			expect(service.lockActive()).toBeTruthy();
			expect(service.passwordPromptOpen()).toBeTruthy();
			expect(service.passwordError()).toBe('wrong-password');
		});

		it('cancelPasswordPrompt closes the prompt without unlocking', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			const service = createService({ modifyVerifier: verifier } as unknown as PptxData);
			service.editAnyway();

			service.cancelPasswordPrompt();

			expect(service.passwordPromptOpen()).toBeFalsy();
			expect(service.lockActive()).toBeTruthy();
			expect(service.bannerActive()).toBeTruthy();
		});

		it('resetForLoad re-arms the password prompt state for a newly loaded document', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			const service = createService({ modifyVerifier: verifier } as unknown as PptxData);
			service.editAnyway();
			await service.submitPassword('wrong-password');
			expect(service.passwordError()).toBe('wrong-password');

			service.resetForLoad();

			expect(service.passwordPromptOpen()).toBeFalsy();
			expect(service.passwordError()).toBeNull();
		});
	});
});
