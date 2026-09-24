/** Accept native form controls and the shared custom controls during migration. */
export function isSelectControl(
	target: EventTarget | null,
): target is HTMLSelectElement | (HTMLElement & { value: string }) {
	return (
		target instanceof HTMLSelectElement ||
		(target instanceof HTMLElement && target.localName === 'pptx-ui-select')
	);
}

export function isCheckboxControl(
	target: EventTarget | null,
): target is HTMLInputElement | (HTMLElement & { checked: boolean }) {
	return (
		target instanceof HTMLInputElement ||
		(target instanceof HTMLElement && target.localName === 'pptx-ui-checkbox')
	);
}
