/**
 * `inline-text-extract` - read the plain text of a contenteditable inline-edit
 * surface back out, translating `<br>` and block-element boundaries into `\n`
 * (contenteditable normalises Enter into nested blocks or `<br>` depending on
 * the browser). Extracted from the byte-for-byte-equivalent Svelte
 * (`editor/inline-text.ts`) and Vanilla (`editor/inline-text-editor.ts`)
 * copies of `readEditableText` / `walk`.
 */

/**
 * Read the plain text of a contenteditable back out, translating `<br>` and
 * block-element boundaries into `\n` (contenteditable normalises Enter into
 * nested blocks or `<br>` depending on the browser).
 */
function hasOnlyCaretPlaceholder(element: HTMLElement): boolean {
	const content = Array.from(element.childNodes).filter((child) => {
		if (child.nodeType === 3) {
			return (child.nodeValue ?? '').length > 0;
		}
		return child instanceof HTMLElement && !child.hasAttribute('data-pptx-bullet-marker');
	});
	if (content.length !== 1 || !(content[0] instanceof HTMLElement)) {
		return false;
	}
	return content[0].tagName === 'BR' || hasOnlyCaretPlaceholder(content[0]);
}

export function readEditableText(root: Node): string {
	let out = '';
	const walk = (node: Node): void => {
		for (const child of Array.from(node.childNodes)) {
			if (child.nodeType === 3) {
				out += child.nodeValue ?? '';
				continue;
			}
			if (!(child instanceof HTMLElement)) {
				continue;
			}
			// A list marker is presentation chrome, not authored paragraph text.
			// React renders it inside the contenteditable so edit mode matches view
			// mode; excluding the annotated node prevents a semantic bullet from
			// being committed as literal text (for example, "1.Item").
			if (child.hasAttribute('data-pptx-bullet-marker')) {
				continue;
			}
			const isAnnotatedParagraph = child.hasAttribute('data-pptx-paragraph-start');
			if (isAnnotatedParagraph) {
				out += '\n';
			}
			// Chromium leaves a BR placeholder, sometimes below a cloned run span,
			// until the user types. The annotation already contributed exactly one
			// paragraph break, so presentation-only markers and that BR add nothing.
			if (isAnnotatedParagraph && hasOnlyCaretPlaceholder(child)) {
				continue;
			}
			// Vanilla gives the final empty run of a list paragraph a BR solely so
			// the caret can enter it. It is not authored text and disappears on type.
			if (
				child.hasAttribute('data-pptx-empty-run') &&
				child.childNodes.length === 1 &&
				child.firstChild?.nodeName === 'BR'
			) {
				continue;
			}
			if (child.tagName === 'BR') {
				out += '\n';
				continue;
			}
			const isBlock = child.tagName === 'DIV' || child.tagName === 'P';
			if (isBlock && out.length > 0 && !out.endsWith('\n')) {
				out += '\n';
			}
			walk(child);
		}
	};
	walk(root);
	return out;
}
