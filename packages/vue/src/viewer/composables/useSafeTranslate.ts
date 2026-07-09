/**
 * useSafeTranslate: a translate function that also works when there is no
 * active component instance.
 *
 * Composables normally call `useI18n()` once, synchronously, during a
 * component's `setup()` (its only valid call site per vue-i18n's Composition
 * API rules); that is how `ChartPanel.vue` and friends invoke
 * `useChartEditing`. But some composables are also exercised directly in
 * unit tests without mounting a component, where `useI18n()` throws
 * ("Must be called at the top of a `setup` function"). This resolves the
 * live `vue-i18n` composer when available and otherwise falls back to a
 * static English lookup with `{{name}}` interpolation, matching the shared
 * dictionary's placeholder syntax.
 */
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { getCurrentInstance } from 'vue';
import { useI18n } from 'vue-i18n';

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export function useSafeTranslate(): Translate {
	if (getCurrentInstance()) {
		// Vue's `useI18n()` is not a React hook; this branch guards a real "no
		// active component instance" case (e.g. this composable exercised
		// directly in a unit test), not a per-render conditional.
		// oxlint-disable-next-line react-hooks/rules-of-hooks
		const { t } = useI18n();
		return (key, params) => t(key, params ?? {});
	}
	return (key, params) => {
		let message = translationsEn[key] ?? key;
		if (params) {
			for (const [name, value] of Object.entries(params)) {
				message = message.replaceAll(`{{${name}}}`, String(value));
			}
		}
		return message;
	};
}
