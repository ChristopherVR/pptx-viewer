/**
 * The Angular viewer's conformance to the cross-binding `PowerPointViewerAPI`.
 *
 * React (`types-ui.ts`), Vue (`PowerPointViewer.vue`), Svelte (`deck-api.ts`)
 * and Vanilla (`PptxViewerInstance extends PowerPointViewerAPI`) all state their
 * imperative surface in terms of the shared contract. Angular stated none, so
 * nothing stopped a member from being renamed, retyped or dropped here while the
 * other four kept it: its `getMode()` / `setMode()` had already widened to
 * `string`, which is not the shared `ViewerMode`.
 *
 * The class now declares `implements PowerPointViewerAPI`, so the compiler is
 * the real guard. This spec pins the declaration itself (a source-text check,
 * since this package has no TestBed) and enumerates the members, so deleting the
 * clause to "fix" a build fails loudly instead of silently.
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';

const source = componentSource(import.meta.dirname, 'power-point-viewer.component.ts');

/** Every member of the shared `PowerPointViewerAPI`, in declaration order. */
const API_MEMBERS = [
	'getContent',
	'goTo',
	'goPrev',
	'goNext',
	'undo',
	'redo',
	'canUndo',
	'canRedo',
	'getZoom',
	'setZoom',
	'zoomIn',
	'zoomOut',
	'zoomReset',
	'getMode',
	'setMode',
	'getActiveSlideIndex',
	'setActiveSlideIndex',
	'getSlideCount',
	'isDirty',
	'getSlides',
	'getSlide',
	'getActiveSlide',
	'addSlide',
	'deleteSlides',
	'duplicateSlides',
	'moveSlide',
	'toggleHideSlides',
	'getElements',
	'getElementById',
	'updateElement',
	'deleteElements',
	'duplicateElement',
	'getSelectedElementIds',
	'selectElements',
	'clearSelection',
] as const;

describe('powerPointViewerComponent API conformance', () => {
	it('declares the shared contract, so the compiler checks it', () => {
		expect(source).toContain(
			'export class PowerPointViewerComponent implements PowerPointViewerAPI',
		);
	});

	it('implements every member of the contract as a public method', () => {
		const missing = API_MEMBERS.filter(
			(member) => !new RegExp(`\\n\\t(?:async )?${member}\\(`, 'u').test(source),
		);
		expect(missing).toStrictEqual([]);
	});

	// The one thing the declaration turned up: both mode accessors were typed
	// `string`, so a caller could set a mode the union does not contain and the
	// `modeChange` output told hosts nothing about which values to expect.
	it('types the mode accessors and the mode output as ViewerMode', () => {
		expect(source).toContain('getMode(): ViewerMode {');
		expect(source).toContain('setMode(mode: ViewerMode): void {');
		expect(source).toContain('readonly modeChange = output<ViewerMode>();');
	});
});
