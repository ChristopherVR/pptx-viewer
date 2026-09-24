import type { DOMWrapper } from '@vue/test-utils';

/** Drive the same committed change event for native and shared form controls. */
export async function setControlValue(
	wrapper: DOMWrapper<Element>,
	value: string | number | boolean,
): Promise<void> {
	const element = wrapper.element as HTMLElement & { value?: string; checked?: boolean };
	if (element.localName === 'pptx-ui-select') {
		element.value = String(value);
		await wrapper.trigger('change');
		return;
	}
	if (element.localName === 'pptx-ui-checkbox') {
		element.checked = Boolean(value);
		await wrapper.trigger('change');
		return;
	}
	await wrapper.setValue(value);
}
