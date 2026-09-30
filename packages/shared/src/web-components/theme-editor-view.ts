import { THEME_COLOR_SCHEME_KEYS } from 'pptx-viewer-core';

import {
	buildThemeColorGrid,
	COMMON_FONTS,
	PRESET_THEMES,
	THEME_EDITOR_COLOR_LABELS,
	themeEditorHex,
} from '../render';
import type { ThemeEditorEdit, ThemeEditorLabels } from '../render';

interface Actions {
	edit: (update: (draft: ThemeEditorEdit) => ThemeEditorEdit) => void;
	apply: () => void;
	reset: () => void;
	close: () => void;
}

/** Build once; repaint values without replacing focused controls. All labels are text. */
export function createThemeEditorView(root: ShadowRoot, actions: Actions) {
	const doc = root.ownerDocument;
	const panel = doc.createElement('div');
	panel.className = 'panel';
	panel.setAttribute('role', 'dialog');
	const texts = new Map<string, HTMLElement[]>();
	function caption(key: string, node: HTMLElement): void {
		texts.set(key, [...(texts.get(key) ?? []), node]);
	}
	function button(key: string, action: () => void, className = ''): HTMLButtonElement {
		const node = doc.createElement('button');
		node.type = 'button';
		node.className = className;
		caption(key, node);
		node.addEventListener('click', action);
		return node;
	}
	const header = doc.createElement('header');
	const heading = doc.createElement('h3');
	caption('title', heading);
	const close = button('close', actions.close, 'close');
	header.append(heading, close);
	const content = doc.createElement('div');
	content.className = 'content';
	function section(key: string): HTMLElement {
		const node = doc.createElement('section');
		const title = doc.createElement('h4');
		caption(key, title);
		node.append(title);
		content.append(node);
		return node;
	}
	function field(key: string): HTMLLabelElement {
		const label = doc.createElement('label');
		const span = doc.createElement('span');
		caption(key, span);
		label.append(span);
		return label;
	}
	const name = doc.createElement('input');
	name.type = 'text';
	name.addEventListener('input', () => actions.edit((draft) => ({ ...draft, name: name.value })));
	const nameSection = section('themeName');
	nameSection.append(name);
	const presets = section('presetThemes');
	const presetGrid = doc.createElement('div');
	presetGrid.className = 'presets';
	const presetButtons = PRESET_THEMES.map((preset) => {
		const node = doc.createElement('button');
		node.type = 'button';
		node.className = 'preset';
		node.setAttribute('aria-label', preset.name);
		const swatches = doc.createElement('span');
		swatches.className = 'swatches';
		for (const key of ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const) {
			const swatch = doc.createElement('span');
			swatch.style.backgroundColor = preset.colorScheme[key] ?? '';
			swatches.append(swatch);
		}
		node.append(swatches, doc.createTextNode(preset.name));
		node.addEventListener('click', () =>
			actions.edit((draft) => ({
				...draft,
				name: preset.name,
				colorScheme: { ...preset.colorScheme },
				fontScheme: {
					...draft.fontScheme,
					majorFont: { ...draft.fontScheme.majorFont, latin: preset.majorFont },
					minorFont: { ...draft.fontScheme.minorFont, latin: preset.minorFont },
				},
			})),
		);
		presetGrid.append(node);
		return node;
	});
	presets.append(presetGrid);
	const colors = section('colorScheme');
	const colorGrid = doc.createElement('div');
	colorGrid.className = 'colors';
	const colorFields = THEME_COLOR_SCHEME_KEYS.map((slot) => {
		const label = field(THEME_EDITOR_COLOR_LABELS[slot]);
		const row = doc.createElement('div');
		row.className = 'color-row';
		const picker = doc.createElement('input');
		picker.type = 'color';
		const hex = doc.createElement('input');
		hex.type = 'text';
		hex.maxLength = 7;
		const edit = (value: string): void => {
			if (/^#[\da-f]{6}$/iu.test(value)) {
				actions.edit((draft) => ({
					...draft,
					colorScheme: { ...draft.colorScheme, [slot]: value },
				}));
			}
		};
		picker.addEventListener('input', () => edit(picker.value));
		hex.addEventListener('input', () => edit(hex.value));
		row.append(picker, hex);
		label.append(row);
		colorGrid.append(label);
		return { slot, picker, hex };
	});
	colors.append(colorGrid);
	const previewSection = section('preview');
	const shades = doc.createElement('div');
	shades.style.cssText = 'display:grid;grid-template-columns:repeat(12,1fr);gap:1px';
	previewSection.append(shades);
	const fonts = doc.createElement('div');
	fonts.className = 'font-fields';
	const fontFields = (['majorFont', 'minorFont'] as const).map((key, i) => {
		const label = field(i === 0 ? 'headingFont' : 'bodyFont');
		const select = doc.createElement('pptx-ui-select');
		select.addEventListener('change', () =>
			actions.edit((draft) => ({
				...draft,
				fontScheme: {
					...draft.fontScheme,
					[key]: { ...draft.fontScheme[key], latin: select.value },
				},
			})),
		);
		label.append(select);
		fonts.append(label);
		return { key, select };
	});
	previewSection.append(fonts);
	const preview = doc.createElement('div');
	preview.className = 'preview';
	const previewHeading = doc.createElement('span');
	const previewBody = doc.createElement('span');
	caption('headingSample', previewHeading);
	caption('bodySample', previewBody);
	preview.append(previewHeading, previewBody);
	previewSection.append(preview);
	const footer = doc.createElement('div');
	footer.className = 'actions';
	footer.append(
		button('applyToPresentation', actions.apply, 'apply'),
		button('reset', actions.reset),
	);
	panel.append(header, content, footer);
	root.append(panel);

	return {
		focus: () => name.focus(),
		paint(draft: ThemeEditorEdit, labels: ThemeEditorLabels, disabled: boolean): void {
			for (const [key, nodes] of texts) {
				for (const node of nodes) {
					node.textContent = labels[key] ?? key;
				}
			}
			panel.setAttribute('aria-label', labels.title ?? 'Edit Theme');
			close.setAttribute('aria-label', labels.close ?? 'Close');
			name.setAttribute('aria-label', labels.themeName ?? 'Theme name');
			name.placeholder = labels.themeNamePlaceholder ?? '';
			name.value = draft.name;
			colorFields.forEach(({ slot, picker, hex }) => {
				const text = labels[THEME_EDITOR_COLOR_LABELS[slot]] ?? slot;
				picker.setAttribute('aria-label', text);
				hex.setAttribute('aria-label', `${text} hex`);
				picker.value = themeEditorHex(draft.colorScheme[slot]);
				hex.value = draft.colorScheme[slot] ?? '';
			});
			fontFields.forEach(({ key, select }, i) => {
				const value = draft.fontScheme[key]?.latin ?? '';
				const options = [...new Set([value, ...COMMON_FONTS])].filter(Boolean);
				if (
					Array.from(select.options)
						.map((item) => item.value)
						.join('|') !== options.join('|')
				) {
					select.replaceChildren(
						...options.map((font) => {
							const option = doc.createElement('option');
							option.value = font;
							option.textContent = font;
							return option;
						}),
					);
				}
				select.value = value;
				select.setAttribute('aria-label', labels[i === 0 ? 'headingFont' : 'bodyFont'] ?? key);
				select.disabled = disabled;
			});
			presetButtons.forEach((node, i) =>
				node.setAttribute('aria-pressed', String(draft.name === PRESET_THEMES[i].name)),
			);
			shades.replaceChildren(
				...(buildThemeColorGrid(draft.colorScheme, (key) => labels[key] ?? key) ?? [])
					.flat()
					.map((cell) => {
						const swatch = doc.createElement('span');
						swatch.style.cssText = `height:10px;background:${cell.hex}`;
						swatch.title = `${cell.colLabel}: ${cell.rowLabel}`;
						return swatch;
					}),
			);
			preview.style.backgroundColor = themeEditorHex(draft.colorScheme.lt1);
			Object.assign(previewHeading.style, {
				color: themeEditorHex(draft.colorScheme.dk2),
				fontFamily: draft.fontScheme.majorFont?.latin,
			});
			Object.assign(previewBody.style, {
				color: themeEditorHex(draft.colorScheme.dk1),
				fontFamily: draft.fontScheme.minorFont?.latin,
			});
			panel
				.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')
				.forEach((node) => {
					node.disabled = node !== close && disabled;
				});
		},
	};
}
