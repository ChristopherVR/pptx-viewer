import { themes } from './themes';

/**
 * Floating theme picker hovering above the viewer, mirroring the Vue demo's
 * ThemePicker component as a plain DOM `<select>`.
 */
export function createThemePicker(current: string, onChange: (key: string) => void): HTMLElement {
	const wrap = document.createElement('div');
	wrap.className = 'demo-theme-picker';

	const select = document.createElement('select');
	select.setAttribute('aria-label', 'Theme');
	for (const [key, preset] of Object.entries(themes)) {
		const option = document.createElement('option');
		option.value = key;
		option.textContent = preset.label;
		option.selected = key === current;
		select.append(option);
	}
	select.addEventListener('change', () => {
		onChange(select.value);
	});

	wrap.append(select);
	return wrap;
}
