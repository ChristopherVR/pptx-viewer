import { reconcileInlineListFormatting } from './inline-list-format';
import { inlineListPresentationCss } from './inline-list-presentation';
import { inlineListSession } from './inline-list-seed';
import { readInlineListSelection } from './inline-list-selection';
import type { InlineListSelectionResult } from './inline-list-selection';
import { readInlineListSnapshot } from './inline-list-snapshot';
import type { InlineListReadResult, InlineListSeed } from './inline-list-types';
import { readEditableText } from './inline-text-extract';
import { resolveAutoFitFontScale } from './text-style-helpers';

export interface InlineListControllerOptions {
	onRead?: (result: InlineListReadResult) => void;
	/** Observe successful explicit formatting before its caller writes the model. */
	onFormat?: (snapshot: import('./inline-list-types').InlineTextEditSnapshot) => void;
	/** Includes descriptor identity, not just the selected element ID. */
	isCurrent?: () => boolean;
}

export interface InlineListController {
	read(): InlineListReadResult;
	format(snapshot: import('./inline-list-types').InlineTextEditSnapshot): InlineListReadResult;
	readSelection(selection?: Selection | null): InlineListSelectionResult;
	refresh(): InlineListReadResult;
	dispose(): void;
}

const active = new WeakMap<HTMLElement, InlineListController>();
let nextScope = 0;

/** Undefined means the selection is not owned by a mounted list session. */
export function getActiveInlineListSelection(
	selection: Selection | null = typeof window === 'undefined' ? null : window.getSelection(),
): InlineListSelectionResult | undefined {
	for (const endpoint of [selection?.anchorNode, selection?.focusNode]) {
		let node: Node | null | undefined = endpoint;
		while (node) {
			const controller = active.get(node as HTMLElement);
			if (controller) {
				return controller.readSelection(selection);
			}
			node = node.parentNode;
		}
	}
	return undefined;
}

/** Selection-scoped convenience; toolbar adapters can retain their own controller instead. */
export function applyActiveInlineListFormatting(
	snapshot: import('./inline-list-types').InlineTextEditSnapshot,
	selection: Selection | null = typeof window === 'undefined' ? null : window.getSelection(),
): InlineListReadResult | undefined {
	for (const endpoint of [selection?.anchorNode, selection?.focusNode]) {
		let node: Node | null | undefined = endpoint;
		while (node) {
			const controller = active.get(node as HTMLElement);
			if (controller) {
				return controller.format(snapshot);
			}
			node = node.parentNode;
		}
	}
	return undefined;
}

/** Attach after initial descriptor bindings. Does not seed or rewrite editable children. */
export function attachInlineListController(
	root: HTMLElement,
	seed: InlineListSeed,
	options: InlineListControllerOptions = {},
): InlineListController {
	active.get(root)?.dispose();
	const previousScope = root.getAttribute('data-pptx-list-session');
	const scope = `list-${++nextScope}`;
	root.setAttribute('data-pptx-list-session', scope);
	const sheet = root.ownerDocument.createElement('style');
	sheet.dataset.pptxListPresentation = scope;
	const tree = root.getRootNode();
	if (tree.nodeType === 11) {
		tree.appendChild(sheet);
	} else {
		root.ownerDocument.head.append(sheet);
	}
	let disposed = false;
	let composing = false;
	const fallback = (reason: string): InlineListReadResult => ({
		kind: 'unsupported',
		reason,
		text: readEditableText(root),
	});
	const isCurrent = () =>
		!disposed && active.get(root) === controller && (options.isCurrent?.() ?? true);
	function read(): InlineListReadResult {
		if (!isCurrent()) {
			return fallback('inactive-session');
		}
		if (composing) {
			return fallback('composition-active');
		}
		return readInlineListSnapshot(seed, root);
	}
	function readSelection(selection?: Selection | null): InlineListSelectionResult {
		if (!isCurrent() || composing) {
			return { kind: 'unsupported', reason: composing ? 'composition-active' : 'inactive-session' };
		}
		return readInlineListSelection(seed, root, selection);
	}
	function format(
		snapshot: import('./inline-list-types').InlineTextEditSnapshot,
	): InlineListReadResult {
		if (!isCurrent() || composing) {
			return read();
		}
		const result = reconcileInlineListFormatting(seed, root, snapshot);
		if (result.kind === 'supported') {
			const current = refresh();
			if (current.kind === 'supported') {
				options.onFormat?.(snapshot);
			}
			return current;
		}
		return result;
	}
	function refresh(): InlineListReadResult {
		const result = read();
		if (!disposed && !composing) {
			const element = inlineListSession(seed)?.element;
			const fontScale = resolveAutoFitFontScale(
				element && 'textStyle' in element ? element.textStyle : undefined,
			);
			sheet.textContent =
				result.kind === 'supported'
					? inlineListPresentationCss(
							root.ownerDocument,
							scope,
							result.paragraphs,
							result.snapshot.textSegments ?? [],
							fontScale,
						)
					: inlineListPresentationCss(root.ownerDocument, scope, [], []);
		}
		if (isCurrent()) {
			options.onRead?.(result);
		}
		return result;
	}
	const startComposition = () => {
		composing = true;
		options.onRead?.(read());
	};
	const endComposition = () => {
		composing = false;
		refresh();
	};
	function dispose() {
		if (disposed) {
			return;
		}
		disposed = true;
		root.removeEventListener('input', refresh);
		root.removeEventListener('compositionstart', startComposition);
		root.removeEventListener('compositionend', endComposition);
		sheet.remove();
		if (active.get(root) === controller) {
			active.delete(root);
			if (previousScope === null) {
				root.removeAttribute('data-pptx-list-session');
			} else {
				root.setAttribute('data-pptx-list-session', previousScope);
			}
		}
	}
	const controller = { read, readSelection, format, refresh, dispose };
	active.set(root, controller);
	root.addEventListener('input', refresh);
	root.addEventListener('compositionstart', startComposition);
	root.addEventListener('compositionend', endComposition);
	refresh();
	return controller;
}
