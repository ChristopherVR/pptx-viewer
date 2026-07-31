/**
 * What a ribbon tab actually offers, in a shape five bindings can be diffed on.
 *
 * `ribbon-tab-parity` measures how TALL each tab is, which catches a stacking
 * regression but says nothing about content: a tab that has quietly lost half
 * its buttons is short, tidy, and passes. This module reads the other axis, the
 * controls themselves, so a binding that never shipped Handout Master or that
 * leaves a button live while the reference disables it is named out loud.
 *
 * Two decisions keep the reading framework-neutral:
 *
 *  - The tab's controls are everything interactive inside the toolbar that sits
 *    BELOW the tablist. The bindings do not agree on a wrapper element or a
 *    `role="tabpanel"` for the content row, but they all lay the ribbon out as
 *    header, then tabs, then content, so the tablist's own bottom edge is a
 *    contract they already share. Anything above it is the tab-invariant header
 *    chrome, which is not this comparison's business.
 *  - A tab that opens the full-screen backstage instead of a content row (File)
 *    is read from the `role="dialog"` it opens, which every binding labels with
 *    the tab's own name. Measuring the toolbar in that state reports zero
 *    controls everywhere and hides real drift behind a fake agreement.
 *
 * Accessible names are computed here rather than taken from Playwright's role
 * engine because we need to enumerate rather than query, and because a `select`
 * must not be named after the concatenation of its options. The algorithm is
 * applied identically to all five bindings, so it is the diff that has to be
 * trustworthy, not the absolute name.
 *
 * Comparing two of these readings is `./ribbon-diff`.
 *
 * @module e2e/support/ribbon-controls
 */
import type { Page } from '@playwright/test';

import { ribbonTab } from './deck';

/** One interactive control offered by a ribbon tab. */
export interface RibbonControl {
	/** Accessible name, as rendered. */
	name: string;
	/** True when the binding renders it unavailable (`disabled` or `aria-disabled`). */
	disabled: boolean;
}

/** Every control one tab offers, or the fact that the tab does not exist. */
export interface RibbonTabInventory {
	tab: string;
	/** False when the binding's ribbon has no such tab at all. */
	present: boolean;
	controls: RibbonControl[];
}

/** A binding's whole ribbon, tab by tab. */
export type RibbonInventory = RibbonTabInventory[];

/**
 * The tabs walked by default, in ribbon order.
 *
 * File is readable (the backstage rule below handles it) but deliberately not
 * walked: its Home screen lists recently opened presentations, which is session
 * data, labelled with a relative timestamp, and present or absent depending on
 * whether the binding has finished persisting the deck when the overlay opens.
 * A control set that changes between two runs of the same commit is not a
 * parity signal. Pass it explicitly if you want to compare a backstage.
 */
export const RIBBON_TABS: readonly string[] = [
	'Home',
	'Insert',
	'Draw',
	'Design',
	'Transitions',
	'Animations',
	'Slide Show',
	'Record',
	'Review',
	'View',
	'Help',
];

async function readTabControls(page: Page, tab: string): Promise<RibbonControl[]> {
	return page.evaluate((tabName: string) => {
		const collapse = (value: string): string => value.replace(/\s+/gu, ' ').trim();

		const toolbar = document.querySelector('[role="toolbar"][aria-label="Presentation toolbar"]');
		if (!(toolbar instanceof HTMLElement)) {
			throw new Error('no presentation toolbar on the page');
		}
		const tablist = toolbar.querySelector('[role="tablist"]');
		if (!(tablist instanceof HTMLElement)) {
			throw new Error('the presentation toolbar exposes no tablist');
		}

		// A tab that opened a same-named overlay is read from the overlay.
		const backstage = [...document.querySelectorAll('[role="dialog"]')].find(
			(node) =>
				collapse(node.getAttribute('aria-label') ?? '') === tabName &&
				node.getBoundingClientRect().width > 0,
		);
		const root = backstage ?? toolbar;
		const floor = backstage ? Number.NEGATIVE_INFINITY : tablist.getBoundingClientRect().bottom - 4;

		/**
		 * Label text with the control it wraps, and the value it renders, removed.
		 *
		 * A wrapping label is read as `Duration: [00.50] s` or `Width [3]`, so the
		 * live value and its unit have to come off or the control is named after
		 * the state of the deck rather than after itself. The caption before the
		 * colon is the part that is stable and that a user would call it.
		 */
		const labelText = (label: Element): string => {
			const copy = label.cloneNode(true) as Element;
			for (const nested of copy.querySelectorAll('select, option, input, textarea')) {
				nested.remove();
			}
			const text = collapse(copy.textContent ?? '');
			return (text.includes(':') ? text.slice(0, text.indexOf(':')) : text)
				.replace(/[•]+$/u, '')
				.replace(/\s*\d+(?:\.\d+)?$/u, '')
				.trim();
		};

		const selector = [
			'button',
			'select',
			'textarea',
			'input',
			'[role="button"]',
			'[role="checkbox"]',
			'[role="switch"]',
			'[role="combobox"]',
			'[role="menuitem"]',
			'[role="menuitemcheckbox"]',
			'[role="radio"]',
			'[role="slider"]',
			'[role="link"]',
		].join(', ');

		const controls: { name: string; disabled: boolean }[] = [];
		for (const node of root.querySelectorAll(selector)) {
			if (node.getAttribute('role') === 'tab' || node.closest('[role="tablist"]')) {
				continue;
			}
			if (!backstage && node.closest('[role="dialog"]')) {
				continue;
			}
			const rect = node.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0 || rect.top < floor) {
				continue;
			}

			const formish =
				node instanceof HTMLSelectElement ||
				node instanceof HTMLInputElement ||
				node instanceof HTMLTextAreaElement;
			const labelledBy = node.getAttribute('aria-labelledby');
			const owned = labelledBy
				? collapse(
						labelledBy
							.split(/\s+/u)
							.map((id) => document.getElementById(id)?.textContent ?? '')
							.join(' '),
					)
				: '';
			const wrapping = node.closest('label');
			const associated = node.id
				? document.querySelector(`label[for="${CSS.escape(node.id)}"]`)
				: null;

			const name =
				collapse(node.getAttribute('aria-label') ?? '') ||
				owned ||
				(wrapping ? labelText(wrapping) : '') ||
				(associated ? labelText(associated) : '') ||
				(formish ? '' : collapse(node.textContent ?? '')) ||
				collapse(node.getAttribute('title') ?? '') ||
				collapse(node.getAttribute('placeholder') ?? '') ||
				collapse(node.getAttribute('name') ?? '') ||
				`<unnamed ${node.tagName.toLowerCase()}>`;

			const unavailable =
				((node instanceof HTMLButtonElement ||
					node instanceof HTMLSelectElement ||
					node instanceof HTMLInputElement ||
					node instanceof HTMLTextAreaElement) &&
					node.disabled) ||
				node.getAttribute('aria-disabled') === 'true';

			controls.push({ name: name.slice(0, 60), disabled: unavailable });
		}
		return controls;
	}, tab);
}

/** Close a backstage-style overlay a tab may have opened, so the next tab reads clean. */
async function dismissOverlay(page: Page, tab: string): Promise<void> {
	const overlay = page.getByRole('dialog', { name: tab, exact: true });
	if ((await overlay.count()) > 0 && (await overlay.first().isVisible())) {
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);
	}
}

/** Walk every tab of the ribbon on `page` and record what each one offers. */
export async function collectRibbonInventory(
	page: Page,
	tabs: readonly string[] = RIBBON_TABS,
): Promise<RibbonInventory> {
	const inventory: RibbonInventory = [];
	for (const tab of tabs) {
		const trigger = ribbonTab(page, tab);
		if ((await trigger.count()) === 0) {
			inventory.push({ tab, present: false, controls: [] });
			continue;
		}
		await trigger.first().click();
		await page.waitForTimeout(250);
		inventory.push({ tab, present: true, controls: await readTabControls(page, tab) });
		await dismissOverlay(page, tab);
	}
	return inventory;
}
