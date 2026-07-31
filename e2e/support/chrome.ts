/**
 * Measuring the application chrome (title bar, status bar, quick access).
 *
 * The chrome is the one surface a user sees on every deck, in every binding,
 * before they touch anything, and it is the surface with the weakest guard:
 * React/Vue/Angular render it from `TITLE_BAR_CLASSES` in `pptx-viewer-shared`
 * while Vanilla and Svelte hand-port the same look into their own CSS. A
 * hand-port drifts silently, because every functional test still passes when a
 * bar is two pixels shorter or a logo is the wrong shade of red.
 *
 * So this module measures rather than clicks: computed style and bounding
 * boxes, keyed by contracts all five bindings emit (`[data-pptx-title-bar]`,
 * `role="switch"`, the accessible names of the status-bar controls). Comparing
 * those measurements is `support/chrome-parity`'s job.
 *
 * @module e2e/support/chrome
 */
import type { Locator, Page } from '@playwright/test';

/** Everything this module measures about one binding's chrome. */
export interface ChromeMeasurement {
	titleBarPresent: boolean;
	statusBarPresent: boolean;
	/** Numeric/colour chrome metrics, keyed by `support/chrome-parity`'s tables. */
	metrics: Record<string, number | string | null>;
	/** Accessible names of the quick-access buttons (the AutoSave switch aside). */
	quickAccess: string[];
	/** Accessible names of the title bar's text fields (the command search). */
	searchFields: string[];
	/** "Slide n of m", or null when the status bar does not report it. */
	counterText: string | null;
	/** The dirty/saved indicator text, or null when there is none. */
	saveText: string | null;
	/** Every non-empty leaf text in the status bar, in DOM order. */
	statusTexts: string[];
	/** Accessible names of the status-bar buttons, in DOM order. */
	statusButtons: string[];
	statusBarRole: string | null;
	statusBarName: string | null;
	/** Labels of `role="toolbar"` regions named after a control they contain. */
	ambiguousToolbars: string[];
}

/** The status bar's zoom-in control (bottom-most match: the ribbon has one too). */
export function zoomInButton(page: Page): Locator {
	return page.getByTitle(/^zoom in$/iu).last();
}

/** The status bar's zoom-out control. */
export function zoomOutButton(page: Page): Locator {
	return page.getByTitle(/^zoom out$/iu).last();
}

/** On-screen width of the painted slide stage. */
export async function stageWidth(page: Page): Promise<number> {
	const box = await page.locator('[aria-roledescription="slide"]').first().boundingBox();
	return box ? Math.round(box.width * 10) / 10 : 0;
}

/**
 * Measure the chrome, entirely inside the page.
 *
 * The status bar has no attribute of its own in any binding, so it is found
 * structurally: the nearest ancestor of the "Slide n of m" counter that also
 * owns a zoom-to-fit control. That is true of all five and of nothing else.
 */
export async function measureChrome(page: Page): Promise<ChromeMeasurement> {
	return page.evaluate(() => {
		const num = (value: string): number => {
			const parsed = Number.parseFloat(value);
			return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
		};
		const nameOf = (el: Element): string =>
			(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
				.replace(/\s+/gu, ' ')
				.trim();
		const leavesOf = (root: Element): Element[] =>
			[...root.querySelectorAll('*')].filter((el) => el.children.length === 0);

		const bar = document.querySelector('[data-pptx-title-bar]');
		const logo = bar?.firstElementChild ?? null;
		const toggle = bar?.querySelector('[role="switch"]') ?? null;
		const knob = toggle?.firstElementChild ?? null;
		const file = bar
			? (leavesOf(bar).find((el) => /\.pptx$/u.test((el.textContent ?? '').trim())) ?? null)
			: null;
		const trackBox = toggle?.getBoundingClientRect() ?? null;
		const knobBox = knob?.getBoundingClientRect() ?? null;

		const counter = leavesOf(document.body).find((el) =>
			/^Slide \d+ of \d+$/u.test((el.textContent ?? '').trim()),
		);
		let status: Element | null = null;
		let node = counter?.parentElement ?? null;
		while (node) {
			if ([...node.querySelectorAll('button')].some((b) => /^zoom to fit$/iu.test(nameOf(b)))) {
				status = node;
				break;
			}
			node = node.parentElement;
		}
		const statusStyle = status ? getComputedStyle(status) : null;
		const statusTexts = status
			? leavesOf(status)
					.map((el) => (el.textContent ?? '').replace(/\s+/gu, ' ').trim())
					.filter(Boolean)
			: [];

		const barStyle = bar ? getComputedStyle(bar) : null;
		return {
			titleBarPresent: Boolean(bar),
			statusBarPresent: Boolean(status),
			metrics: {
				barHeight: barStyle ? num(barStyle.height) : null,
				barGap: barStyle ? num(barStyle.columnGap) : null,
				barPadLeft: barStyle ? num(barStyle.paddingLeft) : null,
				barPadRight: barStyle ? num(barStyle.paddingRight) : null,
				barFontSize: barStyle ? num(barStyle.fontSize) : null,
				logoBackground: logo ? getComputedStyle(logo).backgroundColor : null,
				logoWidth: logo ? num(getComputedStyle(logo).width) : null,
				logoHeight: logo ? num(getComputedStyle(logo).height) : null,
				logoFontSize: logo ? num(getComputedStyle(logo).fontSize) : null,
				toggleChecked: toggle ? String(toggle.getAttribute('aria-checked')) : null,
				trackWidth: trackBox ? Math.round(trackBox.width * 100) / 100 : null,
				trackHeight: trackBox ? Math.round(trackBox.height * 100) / 100 : null,
				knobWidth: knobBox ? Math.round(knobBox.width * 100) / 100 : null,
				knobHeight: knobBox ? Math.round(knobBox.height * 100) / 100 : null,
				knobOffset: trackBox && knobBox ? Math.round((knobBox.x - trackBox.x) * 100) / 100 : null,
				fileFontSize: file ? num(getComputedStyle(file).fontSize) : null,
				fileWeight: file ? getComputedStyle(file).fontWeight : null,
				statusHeight: statusStyle ? num(statusStyle.height) : null,
				statusFontSize: statusStyle ? num(statusStyle.fontSize) : null,
			},
			quickAccess: [...(bar?.querySelectorAll('button') ?? [])]
				.filter((el) => el.getAttribute('role') !== 'switch')
				.map(nameOf)
				.filter(Boolean),
			searchFields: [...(bar?.querySelectorAll('input') ?? [])].map(nameOf),
			counterText: counter ? (counter.textContent ?? '').trim() : null,
			saveText: statusTexts.find((text) => /saved|saving|unsaved/iu.test(text)) ?? null,
			statusTexts,
			statusButtons: status ? [...status.querySelectorAll('button')].map(nameOf) : [],
			statusBarRole: status?.getAttribute('role') ?? null,
			statusBarName: status?.getAttribute('aria-label') ?? null,
			// An accessible name a region shares with a control inside it makes the
			// region unnameable in a screen reader's landmark list.
			ambiguousToolbars: [...document.querySelectorAll('[role="toolbar"]')]
				.filter((tb) => {
					const label = (tb.getAttribute('aria-label') ?? '').trim().toLowerCase();
					return (
						label.length > 0 &&
						[...tb.querySelectorAll('button,[role="button"]')].some(
							(control) => nameOf(control).toLowerCase() === label,
						)
					);
				})
				.map((tb) => tb.getAttribute('aria-label') ?? ''),
		} satisfies ChromeMeasurement;
	});
}

/** Stage widths seen while driving one binding's zoom controls. */
export interface ZoomProbe {
	fitted: number;
	zoomedIn: number;
	zoomedOut: number;
	refitted: number;
}
