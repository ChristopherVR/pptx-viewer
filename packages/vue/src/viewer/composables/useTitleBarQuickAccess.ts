import { DEFAULT_VIEWER_OPTIONS, isPanelVisible } from 'pptx-viewer-shared';
import type { ViewerQuickAccessOptions } from 'pptx-viewer-shared';
import { computed, inject } from 'vue';
import type { ComputedRef } from 'vue';

import { useResolvedCustomization } from './useViewerCustomization';
import { ScreenTipKey, ViewerOptionsKey } from './useViewerOptionsStore';

/**
 * The options-driven Quick Access inputs the shared `pptx-ui-title-bar` needs,
 * resolved once for the title bar and the below-ribbon row: the live options
 * (hidden entirely when the host removes the `quickAccessToolbar` panel) and the
 * ScreenTip rule.
 */
export function useTitleBarQuickAccess(): {
	quickAccess: ComputedRef<ViewerQuickAccessOptions>;
	screenTip: (label: string) => string | undefined;
} {
	const options = inject(ViewerOptionsKey, undefined);
	const customization = useResolvedCustomization();
	const tip = inject(ScreenTipKey, (label: string) => label);
	const quickAccess = computed(() => {
		const live = options?.value.quickAccess ?? DEFAULT_VIEWER_OPTIONS.quickAccess;
		return isPanelVisible(customization.value, 'quickAccessToolbar')
			? live
			: { ...live, visible: false };
	});
	return { quickAccess, screenTip: (label) => tip(label) };
}
