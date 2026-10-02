/**
 * Every `button` under `root`, including those inside the open shadow roots of
 * `pptx-ui-dialog-footer`. Dialog tests use it to find footer actions by label.
 */
export function allButtons(root: ParentNode): HTMLButtonElement[] {
	const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
	for (const footer of Array.from(root.querySelectorAll('pptx-ui-dialog-footer'))) {
		found.push(...Array.from(footer.shadowRoot?.querySelectorAll('button') ?? []));
	}
	return found;
}
