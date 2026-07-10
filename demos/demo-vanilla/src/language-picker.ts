import { getLanguage, t } from './demo-i18n';
import type { FloatingPicker, IconPart, PickerColors } from './floating-picker';
import { createFloatingPicker } from './floating-picker';
import type { LanguageCode } from './languages';
import { languages } from './languages';
import { themes } from './themes';

/**
 * Floating language picker, ported from demos/demo-vue/src/LanguagePicker.vue
 * and styled to match the theme picker. Stacked directly above the theme
 * picker (same fixed corner) so the two never collide.
 */

const GLOBE_ICON: IconPart[] = [
	{ tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
	{ tag: 'path', attrs: { d: 'M2 12h20' } },
	{
		tag: 'path',
		attrs: {
			d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z',
		},
	},
];

function presetColors(themeKey: string): PickerColors {
	const preset = themes[themeKey] ?? themes.dark;
	return {
		bg: preset.theme.colors?.card ?? '#111827',
		border: preset.theme.colors?.border ?? '#374151',
		fg: preset.theme.colors?.mutedForeground ?? '#9ca3af',
		primary: preset.theme.colors?.primary ?? '#6366f1',
	};
}

export function createLanguagePicker(
	themeKey: () => string,
	onChange: (code: LanguageCode) => void,
): FloatingPicker {
	return createFloatingPicker({
		className: 'language-picker',
		icon: GLOBE_ICON,
		title: () => t('demo.pickers.switchLanguage'),
		buttonLabel: () =>
			(languages.find((language) => language.code === getLanguage()) ?? languages[0]).label,
		items: () => languages.map((language) => ({ key: language.code, label: language.label })),
		activeKey: getLanguage,
		colors: () => presetColors(themeKey()),
		onPick: (key) => onChange(key as LanguageCode),
	});
}
