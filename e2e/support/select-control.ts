import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Drive either a native select or the shared Web Component through its visible UI. */
export async function chooseSelectValue(
	page: Page,
	control: Locator,
	value: string,
): Promise<void> {
	if (await control.evaluate((element) => element.tagName === 'SELECT')) {
		await control.selectOption(value);
		return;
	}
	const label = await control.evaluate((element, requested) => {
		const root = element.getRootNode();
		const host = root instanceof ShadowRoot ? root.host : element;
		return [...host.querySelectorAll('option')].find((option) => option.value === requested)?.label;
	}, value);
	if (!label) {
		throw new Error(`Select option ${value} was not found`);
	}
	await control.click();
	await page.getByRole('option', { name: label, exact: true }).click();
}

/** Read the public value property on either control, including across shadow DOM. */
export async function expectSelectValue(control: Locator, value: string): Promise<void> {
	await expect
		.poll(() =>
			control.evaluate((element) => {
				const root = element.getRootNode();
				const host = root instanceof ShadowRoot ? root.host : element;
				return (host as HTMLSelectElement).value;
			}),
		)
		.toBe(value);
}
