import type { SmartArtColorScheme, SmartArtLayoutType } from 'pptx-viewer-core';
import { SWITCHABLE_LAYOUT_TYPES } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeSelectField } from './controls-extra';
import type { InspectorHandlers, InspectorState } from './types';

const COLOR_SCHEMES: readonly SmartArtColorScheme[] = [
	'colorful1',
	'colorful2',
	'colorful3',
	'monochromatic1',
	'monochromatic2',
];

export interface SmartArtSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/** SmartArt layout, colour, and node-text controls aligned with React. */
export function createSmartArtSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
): SmartArtSection {
	const el = section(t('pptx.smartart.title'));
	const layoutLabel = createEl(doc, 'span', 'pptxv-smartart-label');
	layoutLabel.textContent = t('pptx.smartart.switchLayout');
	el.appendChild(layoutLabel);

	const layoutGrid = createEl(doc, 'div', 'pptxv-smartart-layout-grid');
	const layoutButtons = new Map<SmartArtLayoutType, HTMLButtonElement>();
	for (const layout of SWITCHABLE_LAYOUT_TYPES) {
		const button = createEl(doc, 'button', 'pptxv-smartart-layout-button');
		button.type = 'button';
		button.dataset.testid = `smartart-layout-${layout}`;
		button.textContent = t(`pptx.smartart.category.${layout}`);
		button.addEventListener('click', () => handlers.setSmartArtLayout(layout));
		layoutButtons.set(layout, button);
		layoutGrid.appendChild(button);
	}
	el.appendChild(layoutGrid);

	const colorScheme = makeSelectField(doc, {
		label: t('pptx.smartart.colorScheme'),
		options: COLOR_SCHEMES.map((scheme) => ({ value: scheme, label: scheme })),
		onChange: handlers.setSmartArtColorScheme,
	});
	const select = colorScheme.el.querySelector('select');
	if (select) {
		select.dataset.testid = 'smartart-color-scheme';
	}
	el.appendChild(colorScheme.el);

	const textLabel = createEl(doc, 'span', 'pptxv-smartart-label');
	textLabel.textContent = t('pptx.smartart.textPane');
	el.appendChild(textLabel);
	const nodes = createEl(doc, 'div', 'pptxv-smartart-nodes');
	el.appendChild(nodes);

	let nodeSignature = '';
	const rebuildNodes = (state: InspectorState): void => {
		const data = state.smartArtData;
		const signature = data?.nodes.map((node) => node.id).join('|') ?? '';
		if (signature === nodeSignature) {
			const inputs = nodes.querySelectorAll<HTMLInputElement>('[data-testid="smartart-node-text"]');
			data?.nodes.forEach((node, index) => {
				const input = inputs[index];
				if (input && doc.activeElement !== input) {
					input.value = node.text;
				}
			});
			return;
		}
		nodeSignature = signature;
		nodes.replaceChildren();
		for (const [index, node] of (data?.nodes ?? []).entries()) {
			const label = createEl(doc, 'label', 'pptxv-smartart-node');
			const caption = createEl(doc, 'span', 'pptxv-smartart-node-index');
			caption.textContent = String(index + 1);
			const input = doc.createElement('input');
			input.type = 'text';
			input.className = 'pptxv-smartart-node-input';
			input.dataset.testid = 'smartart-node-text';
			input.setAttribute('aria-label', `${t('pptx.smartart.item')} ${index + 1}`);
			input.value = node.text;
			input.addEventListener('change', () => handlers.setSmartArtNodeText(node.id, input.value));
			label.append(caption, input);
			nodes.appendChild(label);
		}
	};

	return {
		el,
		update(state) {
			el.hidden = !state.isSmartArt;
			const current = state.smartArtData?.resolvedLayoutType;
			for (const [layout, button] of layoutButtons) {
				button.disabled = !state.isSmartArt;
				button.classList.toggle('is-active', layout === current);
				button.setAttribute('aria-pressed', String(layout === current));
			}
			colorScheme.setValue(state.smartArtData?.colorScheme ?? 'colorful1');
			colorScheme.setDisabled(!state.isSmartArt);
			rebuildNodes(state);
		},
	};
}
