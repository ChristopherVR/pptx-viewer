/** Explicit editor-only DOM is omitted by both raster export strategies. */
export function isExportIgnoredElement(element: Element): boolean {
	return element.getAttribute('data-export-ignore') === 'true';
}

/**
 * Prepare a detached capture clone, never the live slide. Inline selection
 * decoration can share the authored element's node, so renderers record its
 * original paint instead of asking export to guess which shadows are editor UI.
 */
export function prepareExportClone(root: HTMLElement): void {
	for (const overlay of root.querySelectorAll('[data-export-ignore="true"]')) {
		overlay.remove();
	}
	for (const element of [root, ...root.querySelectorAll<HTMLElement | SVGElement>('*')]) {
		for (const property of ['outline', 'outline-offset', 'box-shadow']) {
			const original = element.getAttribute(`data-export-original-${property}`);
			if (original !== null) {
				element.style.setProperty(property, original);
			}
		}
	}
}
