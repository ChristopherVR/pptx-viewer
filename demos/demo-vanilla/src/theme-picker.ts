import { t } from './demo-i18n';
import type { FloatingPicker, IconPart, PickerColors } from './floating-picker';
import { createFloatingPicker } from './floating-picker';
import { themeKeys, themes } from './themes';

/**
 * Floating theme picker, ported from demos/demo-vue/src/ThemePicker.vue: a
 * fixed pill (bottom-right on desktop, top-right on mobile) opening a menu of
 * every preset with a color swatch each.
 */

const SUN_ICON: IconPart[] = [
	{ tag: 'circle', attrs: { cx: '12', cy: '12', r: '4' } },
	{ tag: 'path', attrs: { d: 'M12 2v2' } },
	{ tag: 'path', attrs: { d: 'M12 20v2' } },
	{ tag: 'path', attrs: { d: 'm4.93 4.93 1.41 1.41' } },
	{ tag: 'path', attrs: { d: 'm17.66 17.66 1.41 1.41' } },
	{ tag: 'path', attrs: { d: 'M2 12h2' } },
	{ tag: 'path', attrs: { d: 'M20 12h2' } },
	{ tag: 'path', attrs: { d: 'm6.34 17.66-1.41 1.41' } },
	{ tag: 'path', attrs: { d: 'm19.07 4.93-1.41 1.41' } },
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

export function createThemePicker(
	current: () => string,
	onChange: (key: string) => void,
): FloatingPicker {
	return createFloatingPicker({
		className: 'theme-picker',
		icon: SUN_ICON,
		title: () => t('demo.pickers.switchTheme'),
		buttonLabel: () => (themes[current()] ?? themes.dark).label,
		items: () =>
			themeKeys.map((key) => ({
				key,
				label: themes[key].label,
				swatch: {
					background: themes[key].theme.colors?.primary ?? '#6366f1',
					border: themes[key].theme.colors?.border ?? '#374151',
				},
			})),
		activeKey: current,
		colors: () => presetColors(current()),
		onPick: onChange,
	});
}
