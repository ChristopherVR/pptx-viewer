/**
 * toolbar-visibility.ts: thin per-component wrapper around the shared
 * `isActionHidden` helper (see `pptx-viewer-shared`'s `render/toolbar-actions`)
 * so templates can gate a button/tab with a single `toolbar.isHidden('id')`
 * call instead of repeating `isActionHidden(id, hiddenActions())` everywhere.
 *
 * Mirrors how other pure shared helpers are consumed in this package: assigned
 * straight onto the component as a `protected readonly` field (see
 * `ribbon-file-section.component.ts`'s `protected readonly date = formatBackstageDate;`).
 */
import type { Signal } from '@angular/core';

import { isActionHidden } from '../internal/shared';
import type { ToolbarActionId } from '../internal/shared';

export interface ToolbarVisibility {
	/** True when `id` is present in the host's `hiddenActions` list. */
	isHidden(id: ToolbarActionId): boolean;
}

/** Builds a {@link ToolbarVisibility} bound to a component's `hiddenActions` input signal. */
export function toolbarVisibility(
	hiddenActions: Signal<readonly ToolbarActionId[]>,
): ToolbarVisibility {
	return {
		isHidden: (id) => isActionHidden(id, hiddenActions()),
	};
}

/**
 * Union the host's own `hiddenActions` input with File > Options > Customize
 * Ribbon's `ribbon.hiddenTabIds`, so both reach the same filter every chrome
 * component already gates on. `ToolbarTabId` is a subtype of `ToolbarActionId`,
 * so a hidden tab id fits directly into the result.
 *
 * Without this, Customize Ribbon changed only what its own pane displayed:
 * nothing downstream (the ribbon's tab strip, the title bar, the mobile
 * toolbar/menu, the status bar) ever read `ribbon.hiddenTabIds`, so ticking a
 * tab off there left every one of them unchanged.
 */
export function mergeHiddenActions(
	hostHiddenActions: readonly ToolbarActionId[],
	ribbonHiddenTabIds: readonly ToolbarActionId[],
): ToolbarActionId[] {
	return [...hostHiddenActions, ...ribbonHiddenTabIds];
}
