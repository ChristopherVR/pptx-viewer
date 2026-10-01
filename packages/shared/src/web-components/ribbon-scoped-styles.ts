/** Light DOM keeps customization selectors effective; scope shadow-style rules to one tag. */
export function attachScopedRibbonStyles(
	doc: Document,
	id: string,
	tag: string,
	css: string,
): void {
	if (doc.getElementById(id)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = id;
	style.textContent = css.replace(/([^{}]+)\{/gu, (rule, selectors: string) => {
		if (selectors.trim().startsWith('@')) {
			return rule;
		}
		return `${selectors
			.split(',')
			.map((selector) => {
				const trimmed = selector.trim();
				return trimmed.startsWith(':host') ? trimmed.replace(':host', tag) : `${tag} ${trimmed}`;
			})
			.join(',')} {`;
	});
	doc.head.append(style);
}
