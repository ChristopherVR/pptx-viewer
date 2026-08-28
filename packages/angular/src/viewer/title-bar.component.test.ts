/**
 * title-bar.component.test.ts: the title bar's quick-access strip is
 * options-driven (File > Options > Quick Access Toolbar), and the strip's
 * contents are the one piece of chrome the five bindings disagreed on: four of
 * them hardcoded Save/Undo/Redo and ignored the options model entirely.
 *
 * No Angular TestBed in this package (see `action-settings-panel.component.test.ts`),
 * so the template's `@if (extraQat().commandIds.length > 0)` predicate is
 * factored into the pure `narrowToExtraQuickAccess` and asserted directly.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWER_OPTIONS } from '../internal/shared';
import type { ViewerQuickAccessOptions } from '../internal/shared';
import { narrowToExtraQuickAccess, resolveBelowRibbonQuickAccess } from './title-bar.component';

function quickAccess(over: Partial<ViewerQuickAccessOptions> = {}): ViewerQuickAccessOptions {
	return { ...DEFAULT_VIEWER_OPTIONS.quickAccess, ...over };
}

describe('narrowToExtraQuickAccess', () => {
	it('leaves the shipped default with exactly the one non-dedicated command', () => {
		// The default is [save, undo, redo, presentFromStart]; the first three are
		// rendered as dedicated buttons, so only the fourth reaches the strip.
		expect(narrowToExtraQuickAccess(quickAccess()).commandIds).toStrictEqual(['presentFromStart']);
	});

	it('keeps the configured order and drops unknown ids', () => {
		expect(
			narrowToExtraQuickAccess(quickAccess({ commandIds: ['zoomOut', 'save', 'print', 'nope'] }))
				.commandIds,
		).toStrictEqual(['zoomOut', 'print']);
	});

	it('renders nothing when the options hide the strip', () => {
		expect(narrowToExtraQuickAccess(quickAccess({ visible: false })).commandIds).toStrictEqual([]);
	});

	it('carries the rest of the options through, so labels/tooltips still apply', () => {
		const narrowed = narrowToExtraQuickAccess(quickAccess({ showCommandLabels: true }));
		expect(narrowed.showCommandLabels).toBeTruthy();
		expect(narrowed.visible).toBeTruthy();
	});
});

/**
 * Options > Quick Access Toolbar > Position "Below the Ribbon" used to be
 * stored and displayed by the pane but never actually moved anything: no
 * component read `position`, so every strip stayed in the title bar
 * regardless of what the pane showed as selected. `resolveBelowRibbonQuickAccess`
 * is the single decision both the below-ribbon row (PowerPointViewerComponent)
 * and the title bar's own inline strip key off, so they can never disagree
 * about where the configured commands render.
 */
describe('resolveBelowRibbonQuickAccess', () => {
	it('renders nothing above (the default position)', () => {
		expect(resolveBelowRibbonQuickAccess(quickAccess())).toBeNull();
	});

	it('renders the extra commands below when position is "below"', () => {
		const resolved = resolveBelowRibbonQuickAccess(
			quickAccess({ position: 'below', commandIds: ['save', 'undo', 'redo', 'zoomIn'] }),
		);
		expect(resolved?.commandIds).toStrictEqual(['zoomIn']);
	});

	it('renders nothing below when the strip is hidden entirely', () => {
		expect(
			resolveBelowRibbonQuickAccess(quickAccess({ position: 'below', visible: false })),
		).toBeNull();
	});

	it('renders nothing below when no commands are configured beyond the dedicated trio', () => {
		expect(
			resolveBelowRibbonQuickAccess(
				quickAccess({ position: 'below', commandIds: ['save', 'undo', 'redo'] }),
			),
		).toBeNull();
	});
});
