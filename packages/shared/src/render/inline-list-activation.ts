import { readEditableText } from './inline-text-extract';

/** Capture the old DOM before the explicit plain-to-list render replaces it. */
export function readListActivationSelection(root: HTMLElement, body: string) {
	if (readEditableText(root) !== body) {
		return undefined;
	}
	const selection = root.ownerDocument.defaultView?.getSelection();
	if (!selection?.rangeCount) {
		return undefined;
	}
	const range = selection.getRangeAt(0);
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
		return undefined;
	}
	const offset = (node: Node, position: number) => {
		const prefix = root.ownerDocument.createRange();
		prefix.selectNodeContents(root);
		prefix.setEnd(node, position);
		return Math.min(body.length, readEditableText(prefix.cloneContents()).length);
	};
	return {
		start: offset(range.startContainer, range.startOffset),
		end: offset(range.endContainer, range.endOffset),
	};
}
