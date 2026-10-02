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

/** The footer button for an action id (`data-action`), or undefined. */
export function footerAction(root: ParentNode, id: string): HTMLButtonElement | undefined {
	for (const footer of Array.from(root.querySelectorAll('pptx-ui-dialog-footer'))) {
		const button = footer.shadowRoot?.querySelector<HTMLButtonElement>(`[data-action="${id}"]`);
		if (button) {
			return button;
		}
	}
	return undefined;
}
