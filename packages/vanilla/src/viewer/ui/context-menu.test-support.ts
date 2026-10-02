/** Reading the shared `pptx-ui-context-menu` rows through its open shadow root. */

/** Shadow roots of every shared context menu mounted under `scope`. */
export function menuRoots(scope: ParentNode = document): ShadowRoot[] {
	return Array.from(scope.querySelectorAll('pptx-ui-context-menu'))
		.map((host) => host.shadowRoot)
		.filter((root): root is ShadowRoot => root !== null);
}

/** Every command button across the mounted shared menus, in DOM order. */
export function menuButtons(scope: ParentNode = document): HTMLButtonElement[] {
	return menuRoots(scope).flatMap((root) =>
		Array.from(root.querySelectorAll<HTMLButtonElement>('button')),
	);
}

/** The command button with the given item id, or null. */
export function menuItem(id: string, scope: ParentNode = document): HTMLButtonElement | null {
	return menuButtons(scope).find((button) => button.dataset.itemId === id) ?? null;
}
