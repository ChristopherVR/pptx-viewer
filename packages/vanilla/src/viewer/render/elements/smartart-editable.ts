import type { SmartArtPptxElement } from 'pptx-viewer-core';
import { computeInlineEditorRect, findSmartArtNodeText, resolvePalette } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderContext } from '../types';

const NODE_SELECTOR = '[data-smartart-node-id]';

function nodeTarget(target: EventTarget | null): SVGGElement | null {
	return target instanceof Element ? target.closest<SVGGElement>(NODE_SELECTOR) : null;
}

/** Add React-parity inline text and palette-fill controls to a rendered diagram. */
export function enableSmartArtEditing(
	chrome: HTMLDivElement,
	element: SmartArtPptxElement,
	context: ElementRenderContext,
): void {
	const data = element.smartArtData;
	if (!data || (!context.onSmartArtNodeTextChange && !context.onSmartArtNodeFillChange)) {
		return;
	}

	let editor: HTMLTextAreaElement | null = null;
	let swatches: HTMLDivElement | null = null;

	const closeEditor = (): void => {
		editor?.remove();
		editor = null;
	};

	chrome.addEventListener('dblclick', (event) => {
		const target = nodeTarget(event.target);
		const nodeId = target?.dataset.smartartNodeId;
		if (!target || !nodeId || !context.onSmartArtNodeTextChange) {
			return;
		}
		event.stopPropagation();
		closeEditor();
		swatches?.remove();

		const textNode = target.querySelector('text');
		const textRect = textNode?.getBoundingClientRect();
		const source = textRect && textRect.width > 0 ? textRect : target.getBoundingClientRect();
		const rect = computeInlineEditorRect(source, chrome.getBoundingClientRect());
		editor = createEl(chrome.ownerDocument, 'textarea', 'pptxv-smartart-node-editor', {
			position: 'absolute',
			left: `${rect.left - 4}px`,
			top: `${rect.top - 4}px`,
			width: `${Math.max(48, rect.width + 8)}px`,
			height: `${Math.max(30, rect.height + 8)}px`,
			zIndex: '12',
			boxSizing: 'border-box',
			padding: '4px',
			resize: 'none',
			border: '2px solid #60a5fa',
			borderRadius: '4px',
			outline: 'none',
			background: 'rgba(255,255,255,0.96)',
			color: '#111827',
			textAlign: 'center',
		});
		editor.value = findSmartArtNodeText(data, nodeId) ?? '';
		const commit = (): void => {
			if (!editor) {
				return;
			}
			context.onSmartArtNodeTextChange?.(element, nodeId, editor.value);
			closeEditor();
		};
		editor.addEventListener('blur', commit, { once: true });
		editor.addEventListener('keydown', (keyEvent) => {
			if (keyEvent.key === 'Escape') {
				keyEvent.preventDefault();
				closeEditor();
			} else if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
				keyEvent.preventDefault();
				commit();
			}
		});
		editor.addEventListener('pointerdown', (pointerEvent) => pointerEvent.stopPropagation());
		chrome.appendChild(editor);
		editor.focus();
		editor.select();
	});

	chrome.addEventListener('mouseover', (event) => {
		const target = nodeTarget(event.target);
		const nodeId = target?.dataset.smartartNodeId;
		if (!target || !nodeId || !context.onSmartArtNodeFillChange || editor) {
			return;
		}
		swatches?.remove();
		const rect = computeInlineEditorRect(
			target.getBoundingClientRect(),
			chrome.getBoundingClientRect(),
		);
		swatches = createEl(chrome.ownerDocument, 'div', 'pptxv-smartart-node-swatches', {
			position: 'absolute',
			left: `${Math.max(0, rect.left)}px`,
			top: `${Math.max(0, rect.top - 26)}px`,
			zIndex: '11',
			display: 'flex',
			gap: '4px',
			padding: '4px',
			border: '1px solid rgba(148,163,184,0.7)',
			borderRadius: '6px',
			background: 'rgba(15,23,42,0.96)',
			boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
		});
		swatches.setAttribute('role', 'group');
		swatches.setAttribute('aria-label', context.t('pptx.smartArt.fillColor'));
		for (const color of resolvePalette(data).slice(0, 6)) {
			const button = createEl(chrome.ownerDocument, 'button', '', {
				width: '18px',
				height: '18px',
				padding: '0',
				border: '1px solid rgba(255,255,255,0.8)',
				borderRadius: '4px',
				background: color,
				cursor: 'pointer',
			});
			button.type = 'button';
			button.setAttribute('aria-label', `${context.t('pptx.smartArt.fillColor')} ${color}`);
			// eslint-disable-next-line no-loop-func
			button.addEventListener('click', (clickEvent) => {
				clickEvent.stopPropagation();
				context.onSmartArtNodeFillChange?.(element, nodeId, color);
				swatches?.remove();
				swatches = null;
			});
			swatches.appendChild(button);
		}
		swatches.addEventListener('mouseleave', () => {
			swatches?.remove();
			swatches = null;
		});
		chrome.appendChild(swatches);
	});
}
