import { DRAW_RIBBON_TOOLS, DRAW_WIDTH_PRESETS, OFFICE_COLOR_SWATCHES, drawLabel } from '../render';
import type { RibbonDrawIntent, RibbonDrawViewState } from '../render';

/** All Draw markup lives here. The host only reflects state and routes native intents. */
export function createRibbonDrawView(doc: Document, request: (intent: RibbonDrawIntent) => void) {
	const group = doc.createElement('pptx-ui-ribbon-group');
	group.dataset.ribbonGroup = 'draw.tools';
	const root = doc.createElement('div');
	root.className = 'tools';
	const tools = DRAW_RIBBON_TOOLS.map((tool) => {
		const command = doc.createElement('pptx-ui-ribbon-command');
		command.dataset.ribbonControl = `draw.tools.${tool.id}`;
		command.setAttribute('compact', '');
		command.setAttribute('icon-only', '');
		command.setAttribute('icon', tool.icon);
		command.addEventListener('command-request', (event) => {
			event.stopPropagation();
			request({ kind: 'tool', value: tool.id });
		});
		root.append(command);
		return command;
	});
	const settings = doc.createElement('div');
	settings.className = 'settings';
	const colors = doc.createElement('details');
	colors.dataset.ribbonControl = 'draw.tools.penColor';
	const trigger = doc.createElement('summary');
	trigger.dataset.pptxCompact = '';
	const preview = doc.createElement('span');
	preview.className = 'preview';
	preview.setAttribute('aria-hidden', 'true');
	const colorLabel = doc.createElement('span');
	trigger.append(preview, colorLabel);
	const palette = doc.createElement('div');
	palette.className = 'palette';
	const standard = doc.createElement('div');
	standard.className = 'swatches';
	const recent = doc.createElement('div');
	recent.className = 'swatches';
	recent.dataset.testid = 'pptx-color-recent';
	const swatch = (hex: string, name: string) => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'swatch';
		button.dataset.pptxCompact = '';
		button.dataset.drawColor = hex;
		button.title = name;
		button.setAttribute('aria-label', name);
		button.style.backgroundColor = hex;
		button.addEventListener('click', () => {
			request({ kind: 'color', value: hex, committed: true });
			colors.open = false;
			trigger.focus();
		});
		return button;
	};
	standard.append(...OFFICE_COLOR_SWATCHES.map((color) => swatch(color.hex, color.label)));
	const customLabel = doc.createElement('label');
	const customText = doc.createElement('span');
	const colorInput = doc.createElement('input');
	colorInput.type = 'color';
	colorInput.addEventListener('input', () =>
		request({ kind: 'color', value: colorInput.value, committed: false }),
	);
	colorInput.addEventListener('change', () =>
		request({ kind: 'color', value: colorInput.value, committed: true }),
	);
	customLabel.append(customText, colorInput);
	palette.append(standard, recent, customLabel);
	colors.append(trigger, palette);
	const widthLabel = doc.createElement('label');
	widthLabel.dataset.ribbonControl = 'draw.tools.penWidth';
	const widthText = doc.createElement('span');
	const range = doc.createElement('input');
	range.type = 'range';
	range.min = '1';
	range.max = '16';
	range.step = '1';
	range.addEventListener('input', () => request({ kind: 'width', value: Number(range.value) }));
	const presets = doc.createElement('select');
	const customWidth = doc.createElement('option');
	for (const width of DRAW_WIDTH_PRESETS) {
		const option = doc.createElement('option');
		option.value = String(width);
		option.textContent = `${width} px`;
		presets.append(option);
	}
	presets.addEventListener('change', () =>
		request({ kind: 'width', value: Number(presets.value) }),
	);
	widthLabel.append(widthText, range, presets);
	settings.append(colors, widthLabel);
	group.append(root, settings);
	const placePalette = () => {
		if (!colors.open) {
			return;
		}
		const rect = trigger.getBoundingClientRect();
		const viewport = doc.defaultView;
		const width = viewport?.innerWidth ?? 1024;
		const height = viewport?.innerHeight ?? 768;
		const box = palette.getBoundingClientRect();
		palette.style.left = `${Math.max(8, Math.min(rect.left, width - box.width - 8))}px`;
		palette.style.top = `${Math.max(8, Math.min(rect.bottom + 4, height - box.height - 8))}px`;
	};
	colors.addEventListener('toggle', placePalette);
	let recentKey = '';
	const sync = (state: RibbonDrawViewState) => {
		group.setAttribute('label', drawLabel(state, 'pptx.ribbon.draw', 'Draw'));
		tools.forEach((command, index) => {
			const tool = DRAW_RIBBON_TOOLS[index];
			const label = drawLabel(state, tool.key, tool.fallback);
			command.setAttribute('label', label);
			command.setAttribute('title', label);
			command.setAttribute('pressed', String(state.tool === tool.id));
			command.toggleAttribute('active', state.tool === tool.id);
			command.toggleAttribute('disabled', !state.editable);
		});
		colorLabel.textContent = drawLabel(state, 'pptx.ribbon.colour', 'Colour');
		customText.textContent = drawLabel(state, 'pptx.ribbon.customColour', 'Custom colour');
		widthText.textContent = drawLabel(state, 'pptx.ribbon.width', 'Width');
		trigger.title = drawLabel(state, 'pptx.ribbon.penColour', 'Pen colour');
		trigger.setAttribute('aria-disabled', String(!state.editable));
		trigger.tabIndex = state.editable ? 0 : -1;
		preview.style.backgroundColor = state.color;
		colorInput.value = state.color;
		range.value = String(state.width);
		range.setAttribute('aria-label', widthText.textContent);
		presets.setAttribute('aria-label', widthText.textContent);
		if (!DRAW_WIDTH_PRESETS.some((width) => width === state.width)) {
			customWidth.value = String(state.width);
			customWidth.textContent = `${state.width} px`;
			presets.append(customWidth);
		} else {
			customWidth.remove();
		}
		presets.value = String(state.width);
		colorInput.disabled = range.disabled = presets.disabled = !state.editable;
		for (const button of standard.querySelectorAll('button')) {
			button.disabled = !state.editable;
			button.setAttribute(
				'aria-pressed',
				String(button.dataset.drawColor?.toLowerCase() === state.color.toLowerCase()),
			);
		}
		const nextKey = `${state.editable}:${state.recentColors?.join(',') ?? ''}`;
		if (recentKey !== nextKey) {
			recent.replaceChildren(
				...(state.recentColors ?? [])
					.filter((hex) => /^#[\da-f]{6}$/iu.test(hex))
					.map((hex) => {
						const button = swatch(hex, hex);
						button.disabled = !state.editable;
						return button;
					}),
			);
			recentKey = nextKey;
		}
		for (const button of recent.querySelectorAll('button')) {
			button.setAttribute(
				'aria-pressed',
				String(button.dataset.drawColor?.toLowerCase() === state.color.toLowerCase()),
			);
		}
		if (!state.editable) {
			colors.open = false;
		}
	};
	return { group, sync, colors, trigger, placePalette };
}
