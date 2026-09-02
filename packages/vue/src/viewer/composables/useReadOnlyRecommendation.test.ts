import type { PptxCustomProperty, PptxModifyVerifier } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useReadOnlyRecommendation } from './useReadOnlyRecommendation';

function useHarness(
	modifyVerifierValue?: PptxModifyVerifier,
	customPropertiesValue: PptxCustomProperty[] = [],
) {
	const modifyVerifier = ref<PptxModifyVerifier | undefined>(modifyVerifierValue);
	const customProperties = ref<PptxCustomProperty[]>(customPropertiesValue);
	const result = useReadOnlyRecommendation({ modifyVerifier, customProperties });
	return { result, modifyVerifier, customProperties };
}

describe('useReadOnlyRecommendation', () => {
	it('shows no banner and stays unlocked for a plain deck', () => {
		const { result } = useHarness();
		expect(result.showBanner.value).toBeFalsy();
		expect(result.locked.value).toBeFalsy();
	});

	it('recommends read-only and locks editing for a modifyVerifier deck', () => {
		const { result } = useHarness({ hashData: 'abc', algorithmName: 'SHA-512' });
		expect(result.recommendation.value.kind).toBe('modifyVerifier');
		expect(result.showBanner.value).toBeTruthy();
		expect(result.locked.value).toBeTruthy();
	});

	it('recommends read-only for a Mark as Final deck', () => {
		const { result } = useHarness(undefined, [
			{ name: '_MarkAsFinal', value: 'true', type: 'bool' },
		]);
		expect(result.recommendation.value.kind).toBe('markedFinal');
		expect(result.locked.value).toBeTruthy();
	});

	it('"edit anyway" lifts the lock and hides the banner', () => {
		const { result } = useHarness({ hashData: 'abc' });
		result.editAnyway();
		expect(result.locked.value).toBeFalsy();
		expect(result.showBanner.value).toBeFalsy();
	});

	it('"dismiss" hides the banner but keeps the lock', () => {
		const { result } = useHarness({ hashData: 'abc' });
		result.dismiss();
		expect(result.showBanner.value).toBeFalsy();
		expect(result.locked.value).toBeTruthy();
	});

	it('reset() re-arms the banner and the lock for a newly loaded document', () => {
		const { result } = useHarness({ hashData: 'abc' });
		result.editAnyway();
		result.reset();
		expect(result.showBanner.value).toBeTruthy();
		expect(result.locked.value).toBeTruthy();
	});
});
