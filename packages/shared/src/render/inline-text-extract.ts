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
