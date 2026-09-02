import type { PptxViewProperties } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createInitialViewerState } from '../state';
import {
	isDeckViewToggleOption,
	patchViewPropertiesForToggle,
	seedDeckViewPreferences,
} from './editor-view-preferences';

describe('isDeckViewToggleOption', () => {
	it('accepts the three round-trippable toggles', () => {
		expect(isDeckViewToggleOption('showGuides')).toBeTruthy();
		expect(isDeckViewToggleOption('snapToGrid')).toBeTruthy();
		expect(isDeckViewToggleOption('snapToShape')).toBeTruthy();
	});

	it('rejects toggles with no p:viewPr equivalent', () => {
		expect(isDeckViewToggleOption('showGrid')).toBeFalsy();
		expect(isDeckViewToggleOption('showRulers')).toBeFalsy();
	});
});

describe('seedDeckViewPreferences', () => {
	it('seeds all three toggles from the deck view properties', () => {
		const state = createInitialViewerState();
		const viewProperties: PptxViewProperties = {
			slideViewPr: { snapToGrid: true, snapToObjects: false, showGuides: false },
		};

		const seeded = seedDeckViewPreferences(state, viewProperties);

		expect(seeded).toStrictEqual({ snapToGrid: true, snapToShape: false, showGuides: false });
	});

	it('falls back to the current state for a field the deck did not author', () => {
		const state = { ...createInitialViewerState(), snapToGrid: true, showGuides: false };

		const seeded = seedDeckViewPreferences(state, { slideViewPr: { snapToObjects: false } });

		expect(seeded.snapToGrid).toBeTruthy();
		expect(seeded.showGuides).toBeFalsy();
		expect(seeded.snapToShape).toBeFalsy();
	});

	it('falls back entirely to the current state when the deck has no view properties', () => {
		const state = {
			...createInitialViewerState(),
			snapToGrid: true,
			showGuides: false,
			snapToShape: false,
		};

		const seeded = seedDeckViewPreferences(state, undefined);

		expect(seeded).toStrictEqual({ snapToGrid: true, snapToShape: false, showGuides: false });
	});
});

describe('patchViewPropertiesForToggle', () => {
	it('writes the flipped toggle into slideViewPr, preserving the others', () => {
		const state = {
			...createInitialViewerState(),
			snapToGrid: false,
			showGuides: true,
			snapToShape: true,
			viewProperties: { slideViewPr: { snapToGrid: false, snapToObjects: true, showGuides: true } },
		};

		const next = patchViewPropertiesForToggle(state, 'snapToGrid', true);

		expect(next.slideViewPr).toStrictEqual({
			snapToGrid: true,
			snapToObjects: true,
			showGuides: true,
		});
	});

	it('preserves existing grid spacing when patching a toggle', () => {
		const state = {
			...createInitialViewerState(),
			viewProperties: { gridSpacing: { cx: 914400, cy: 914400 } },
		};

		const next = patchViewPropertiesForToggle(state, 'showGuides', true);

		expect(next.gridSpacing).toStrictEqual({ cx: 914400, cy: 914400 });
	});
});
