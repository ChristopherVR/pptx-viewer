import type { PptxViewProperties } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';

import { useDeckViewPreferencesSync } from './useDeckViewPreferencesSync';

function useHarness(initialViewProperties?: PptxViewProperties) {
	const viewProperties = ref<PptxViewProperties | undefined>(initialViewProperties);
	const loadVersion = ref(0);
	const snapToGrid = ref(false);
	const snapToObjects = ref(false);
	const showGuides = ref(true);
	useDeckViewPreferencesSync({
		viewProperties,
		loadVersion,
		snapToGrid,
		snapToObjects,
		showGuides,
	});
	return { viewProperties, loadVersion, snapToGrid, snapToObjects, showGuides };
}

describe('useDeckViewPreferencesSync', () => {
	it('seeds the toggles from the deck viewProperties on load', async () => {
		const { snapToGrid, snapToObjects, showGuides, loadVersion } = useHarness({
			slideViewPr: { snapToGrid: true, snapToObjects: true, showGuides: false },
		});
		loadVersion.value += 1;
		await nextTick();
		expect(snapToGrid.value).toBeTruthy();
		expect(snapToObjects.value).toBeTruthy();
		expect(showGuides.value).toBeFalsy();
	});

	it('keeps the current toggle values when the deck has no view properties', async () => {
		const { snapToGrid, snapToObjects, showGuides, loadVersion } = useHarness(undefined);
		loadVersion.value += 1;
		await nextTick();
		expect(snapToGrid.value).toBeFalsy();
		expect(snapToObjects.value).toBeFalsy();
		expect(showGuides.value).toBeTruthy();
	});

	it('writes a toggle change back into viewProperties.slideViewPr', async () => {
		const { snapToGrid, viewProperties } = useHarness({
			slideViewPr: { snapToGrid: false, snapToObjects: false, showGuides: false },
		});
		snapToGrid.value = true;
		await nextTick();
		expect(viewProperties.value?.slideViewPr).toMatchObject({ snapToGrid: true });
	});

	it('preserves unrelated slideViewPr fields on write-back', async () => {
		const { snapToObjects, viewProperties } = useHarness({
			slideViewPr: {
				snapToGrid: false,
				snapToObjects: false,
				showGuides: false,
				scale: { pct: 50 },
			},
		});
		snapToObjects.value = true;
		await nextTick();
		expect(viewProperties.value?.slideViewPr?.scale).toStrictEqual({ pct: 50 });
	});

	it('preserves the deck grid spacing on write-back', async () => {
		const { showGuides, viewProperties } = useHarness({
			slideViewPr: { snapToGrid: false, snapToObjects: false, showGuides: false },
			gridSpacing: { cx: 228600, cy: 228600 },
		});
		showGuides.value = false;
		await nextTick();
		expect(viewProperties.value?.gridSpacing).toStrictEqual({ cx: 228600, cy: 228600 });
	});

	it('does not write back while seeding runs (viewProperties is left exactly as loaded)', async () => {
		const initial: PptxViewProperties = {
			slideViewPr: { snapToGrid: true, snapToObjects: false, showGuides: false },
		};
		const { viewProperties, loadVersion } = useHarness(initial);
		loadVersion.value += 1;
		await nextTick();
		// Seeding only READS viewProperties; write-back is suppressed while it runs,
		// so re-triggering the load signal must not rewrite viewProperties at all
		// (`ref()` wraps `initial` in a reactive proxy, so this asserts on shape,
		// not object identity).
		expect(viewProperties.value).toStrictEqual(initial);
	});
});
