import { computed } from 'vue';

import { injectRecentColors } from '../../composables/recent-colors-context';
import { injectThemeColorMap } from '../../composables/theme-color-map-context';

/**
 * Deck theme colours and the recent-colour list that feed the shared colour
 * popovers, plus the one place a picked colour is folded into that list.
 */
export function useHomeColours() {
	const themeColorMap = injectThemeColorMap();
	const recentColors = injectRecentColors();
	return {
		themeColors: computed(() => themeColorMap?.value),
		recent: computed(() => recentColors?.recent.value),
		push: (hex: string): void => recentColors?.push(hex),
	};
}
