/** Keep loaded font stylesheets intact when editing does not change their URL. */
export function syncGoogleWebfontStylesheet(
	doc: Document,
	id: string,
	href: string | null,
): HTMLLinkElement | null {
	const existing = doc.getElementById(id) as HTMLLinkElement | null;
	if (!href) {
		existing?.remove();
		return null;
	}
	// Even assigning the same href can make the browser reload a stylesheet.
	if (existing?.getAttribute('href') === href) {
		return existing;
	}
	const link = existing ?? doc.createElement('link');
	link.id = id;
	link.rel = 'stylesheet';
	link.href = href;
	if (!existing) {
		doc.head.appendChild(link);
	}
	return link;
}
