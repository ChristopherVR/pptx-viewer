/**
 * Rail control id -> accessible-name key, derived from the shared inventory so the
 * presenter rail's prev/next/font-size buttons cannot drift from it. (The console
 * strip itself is the shared `pptx-ui-presenter-console`; `PresenterControlStrip.vue`
 * only adapts it.)
 */
import { PRESENTER_RAIL_CONTROLS } from 'pptx-viewer-shared';

export const PRESENTER_RAIL_CONTROL_LABEL_KEYS: Record<string, string> = Object.fromEntries(
	PRESENTER_RAIL_CONTROLS.map((control) => [control.id, control.labelKey]),
);
