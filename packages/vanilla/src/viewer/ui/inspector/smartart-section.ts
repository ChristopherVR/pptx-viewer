import type { PptxSmartArtData, SmartArtColorScheme, SmartArtLayoutType } from 'pptx-viewer-core';
import { SWITCHABLE_LAYOUT_TYPES, updateSmartArtNodeText } from 'pptx-viewer-core';
import {
	addSiblingAfter,
	canRemoveTopLevelNode,
	countTopLevel,
	demote,
	promote,
	removeEmptyNode,
	schemaLabel,
	SMARTART_COLOR_SCHEME_LABEL_KEYS,
	SMARTART_LAYOUT_LABEL_KEYS,
} from 'pptx-viewer-shared';

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
		// Same key the hand-built template produced, but routed through the shared
		// map so a layout family missing from the dictionary shows its own name
		// rather than a de-camel-cased key tail.
		button.textContent = schemaLabel(SMARTART_LAYOUT_LABEL_KEYS, layout, t);
		button.addEventListener('click', () => handlers.setSmartArtLayout(layout));
		layoutButtons.set(layout, button);
		layoutGrid.appendChild(button);
	}
	el.appendChild(layoutGrid);

	const colorScheme = makeSelectField(doc, {
		label: t('pptx.smartart.colorScheme'),
		// The `dgm:colorsDef` family name is what core stores, so it stays the
		// option value; the caption is spelled from the shared map instead of
		// showing the user `monochromatic2`.
		options: COLOR_SCHEMES.map((scheme) => ({
			value: scheme,
			label: schemaLabel(SMARTART_COLOR_SCHEME_LABEL_KEYS, scheme, t),
		})),
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
	const addNode = doc.createElement('button');
	addNode.type = 'button';
	addNode.textContent = t('pptx.smartart.addItem');
	addNode.addEventListener('click', () => handlers.mutateSmartArtNode('', 'add'));
	el.append(addNode, nodes);

	/**
	 * Text-pane keyboard editing, matching React/Vue/Angular/Svelte: Enter
	 * inserts a sibling after the current node, Backspace/Delete on an empty
	 * node removes it, Tab demotes, Shift+Tab promotes. All four go through the
	 * shared smartart-node-pane-handlers builders (same as Svelte) so the
	 * behaviour, and its focus-follows-edit affordance, can't drift.
	 */
	let latestData: PptxSmartArtData | undefined;
	let pendingFocusNodeId: string | null = null;
	function handleNodeKeydown(event: KeyboardEvent, nodeId: string): void {
		const data = latestData;
		if (!data) {
			return;
		}
		const node = data.nodes.find((n) => n.id === nodeId);
		// The input commits via `change` (blur-triggered), so `data` can be
		// stale while the user is still typing: the emptiness check reads the
		// live DOM value directly, and Enter/Tab/Shift+Tab commit it into a
		// fresh copy of `data` first, since each of those keys fires the
		// mutation WITHOUT the browser ever blurring the input (a demote/promote
		// that ran on stale data silently dropped whatever the user had just
		// typed).
		const liveValue = (event.currentTarget as HTMLInputElement).value;
		const isEmpty = !liveValue;
		// `updateSmartArtNodeText` always returns a NEW object (even when the
		// text is unchanged), so a plain reference check cannot tell "nothing to
		// commit" from "committed"; compare against the last-known text instead,
		// and only fold the edit in when a structural op no-ops (demoting the
		// very first node has nothing to nest under) so a bare Tab press cannot
		// still push a no-op history entry.
		const committed = updateSmartArtNodeText(data, nodeId, liveValue);
		const textChanged = liveValue !== node?.text;

		if (event.key === 'Enter') {
			event.preventDefault();
			const result = addSiblingAfter(committed, nodeId);
			if (result) {
				pendingFocusNodeId = result.focusNodeId ?? null;
				handlers.replaceSmartArtData(result.data);
			} else if (textChanged) {
				handlers.replaceSmartArtData(committed);
			}
		} else if ((event.key === 'Backspace' || event.key === 'Delete') && isEmpty) {
			const isTop = !node?.parentId;
			if (isTop && !canRemoveTopLevelNode(data.resolvedLayoutType, countTopLevel(data))) {
				return;
			}
			event.preventDefault();
			const result = removeEmptyNode(data, nodeId);
			if (result) {
				pendingFocusNodeId = result.focusNodeId ?? null;
				handlers.replaceSmartArtData(result.data);
			}
		} else if (event.key === 'Tab' && !event.shiftKey) {
			event.preventDefault();
			const next = demote(committed, nodeId);
			if (next) {
				pendingFocusNodeId = nodeId;
				handlers.replaceSmartArtData(next);
			} else if (textChanged) {
				handlers.replaceSmartArtData(committed);
			}
		} else if (event.key === 'Tab' && event.shiftKey) {
			event.preventDefault();
			const next = promote(committed, nodeId);
			if (next) {
				pendingFocusNodeId = nodeId;
				handlers.replaceSmartArtData(next);
			} else if (textChanged) {
				handlers.replaceSmartArtData(committed);
			}
		}
	}

	let nodeSignature = '';
	const rebuildNodes = (state: InspectorState): void => {
		const data = state.smartArtData;
		latestData = data;
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
			input.dataset.nodeId = node.id;
			input.setAttribute('aria-label', `${t('pptx.smartart.item')} ${index + 1}`);
			input.value = node.text;
			input.addEventListener('change', () => handlers.setSmartArtNodeText(node.id, input.value));
			input.addEventListener('keydown', (event) => handleNodeKeydown(event, node.id));
			const fill = doc.createElement('input');
			fill.type = 'color';
			fill.value = node.style?.fillColor ?? '#3b82f6';
			fill.title = t('pptx.inspector.fill');
			fill.addEventListener('input', () =>
				handlers.setSmartArtNodeStyle(node.id, { fillColor: fill.value }),
			);
			// B6: push into the "Recent colours" MRU list once the picker commits.
			fill.addEventListener('change', () => handlers.pushRecentColor(fill.value));
			const font = doc.createElement('input');
			font.type = 'color';
			font.value = node.style?.fontColor ?? '#ffffff';
			font.title = t('pptx.table.color');
			font.addEventListener('input', () =>
				handlers.setSmartArtNodeStyle(node.id, { fontColor: font.value }),
			);
			font.addEventListener('change', () => handlers.pushRecentColor(font.value));
			const bold = doc.createElement('button');
			bold.type = 'button';
			bold.textContent = 'B';
			bold.addEventListener('click', () =>
				handlers.setSmartArtNodeStyle(node.id, { bold: !node.style?.bold }),
			);
			const italic = doc.createElement('button');
			italic.type = 'button';
			italic.textContent = 'I';
			italic.addEventListener('click', () =>
				handlers.setSmartArtNodeStyle(node.id, { italic: !node.style?.italic }),
			);
			const hierarchy = createEl(doc, 'span', 'pptxv-smartart-hierarchy');
			for (const [action, labelKey] of [
				['addChild', 'pptx.smartArt.addSubItem'],
				['promote', 'pptx.smartart.promote'],
				['demote', 'pptx.smartart.demote'],
				['remove', 'pptx.common.delete'],
			] as const) {
				const button = doc.createElement('button');
				button.type = 'button';
				button.textContent = t(labelKey);
				button.addEventListener('click', () => handlers.mutateSmartArtNode(node.id, action));
				hierarchy.appendChild(button);
			}
			label.append(caption, input, fill, font, bold, italic, hierarchy);
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
			addNode.disabled = !state.isSmartArt;
			rebuildNodes(state);
			if (pendingFocusNodeId) {
				const id = pendingFocusNodeId;
				pendingFocusNodeId = null;
				nodes
					.querySelector<HTMLInputElement>(
						`[data-testid="smartart-node-text"][data-node-id="${id}"]`,
					)
					?.focus();
			}
		},
	};
}
