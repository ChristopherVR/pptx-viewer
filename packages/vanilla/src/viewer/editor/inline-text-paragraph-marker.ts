function isCaretPlaceholder(element: HTMLElement): boolean {
	const content = Array.from(element.childNodes).filter((child) => {
		if (child.nodeType === 3) {
			return (child.nodeValue ?? '').length > 0;
		}
		return child instanceof HTMLElement && !child.hasAttribute('data-pptx-bullet-marker');
	});
	if (content.length !== 1 || !(content[0] instanceof HTMLElement)) {
		return false;
	}
	return content[0].tagName === 'BR' || isCaretPlaceholder(content[0]);
}

function firstEditableRunIndex(element: HTMLElement): string | undefined {
	const run =
		element.matches('[data-seg-idx]') && !element.hasAttribute('data-pptx-bullet-marker')
			? element
			: element.querySelector<HTMLElement>('[data-seg-idx]:not([data-pptx-bullet-marker])');
	return run?.dataset.segIdx;
}

/** Mark Chromium's inserted rich-run paragraph boundary. */
export function markInsertedParagraph(doc: Document, surface: HTMLElement): void {
	const selection = doc.getSelection();
	const anchor = selection?.anchorNode;
	const anchorElement =
		anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as HTMLElement) : anchor?.parentElement;
	const insertedRun = anchorElement?.closest<HTMLElement>('[data-seg-idx]');
	if (!insertedRun || !surface.contains(insertedRun)) {
		return;
	}
	const block = insertedRun.closest<HTMLElement>('div, p');
	const caretParagraph =
		block && block !== surface && surface.contains(block) ? block : insertedRun;
	const previous = caretParagraph.previousElementSibling;
	const paragraph =
		previous instanceof HTMLElement &&
		firstEditableRunIndex(previous) === insertedRun.dataset.segIdx &&
		isCaretPlaceholder(previous)
			? previous
			: caretParagraph;
	paragraph.dataset.pptxParagraphStart = '';
}
