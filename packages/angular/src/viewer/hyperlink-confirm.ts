/**
 * Trust Center > "Confirm before opening external hyperlinks" gate for a
 * text-run hyperlink click. `confirm` is `viewerOpts?.confirmExternalHyperlink`
 * (absent outside a `PowerPointViewerComponent` host, where a click is never
 * vetoed); returns `true` when the browser's default navigation must be
 * prevented.
 *
 * Pure and framework-free (no Angular imports) so `SlideTextRunComponent`
 * (the mirror's and the live renderer's shared hyperlink run) and
 * `ElementRendererComponent` can both import it without creating a circular
 * dependency between the two component files - `ElementRendererComponent`
 * used to own this function and export it for `SlideTextRunComponent` to
 * import back, which would have made each file depend on the other.
 */
export function shouldPreventHyperlinkNavigation(
	confirm: ((href: string) => boolean) | undefined,
	href: string,
): boolean {
	return confirm !== undefined && !confirm(href);
}
