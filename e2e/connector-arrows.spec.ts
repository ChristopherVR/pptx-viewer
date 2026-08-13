/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Can a user reach, and change, a connector's arrowheads? Run against every
 * framework demo.
 *
 * Two defects hide behind one another here, and each binding had at least one.
 *
 * A connector's wrapper is `pointer-events: none` in every binding, because a
 * connector's bounding box is large and almost entirely empty, and letting it
 * take clicks would steal every press meant for the shapes it spans. Four
 * bindings then never re-enabled hit testing on the LINE, so no pointer route
 * reached a connector at all: it could only be selected from the inspector's
 * Elements list, and the arrowhead controls behind it were unreachable by
 * clicking. React alone carried a transparent, generously wide stroke along the
 * path for exactly this.
 *
 * Behind that, the card itself had drifted. A connector has SIX editable
 * arrowhead properties (`a:ln/a:headEnd` and `a:ln/a:tailEnd`, each with a
 * `type` plus a `w` width and `len` length step); two bindings offered only the
 * two type pickers, and one captioned all six in its own sentence case, so the
 * same control answered to a different accessible name depending on the
 * framework.
 *
 * The spec therefore selects by CLICKING THE LINE (never the Elements list),
 * then drives every control by its accessible name.
 *
 * Run: bunx playwright test connector-arrows
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { inspector, resetTabSession } from './support/deck';

const FIXTURE = resolve(
	fileURLToPath(new URL('./fixtures/connector-arrows.pptx', import.meta.url)),
);

/** Captions, in React's render order. These ARE the accessible names. */
const CONTROLS = [
	'Start Arrow',
	'End Arrow',
	'Start Width',
	'Start Length',
	'End Width',
	'End Length',
] as const;

/** One distinct value per control, so a write cannot be confused with a sibling. */
const PICKS: Record<(typeof CONTROLS)[number], string> = {
	'Start Arrow': 'stealth',
	'End Arrow': 'diamond',
	'Start Width': 'lg',
	'Start Length': 'sm',
	'End Width': 'sm',
	'End Length': 'lg',
};

/**
 * The fixture's first connector, on the live canvas.
 *
 * By element id rather than the accessibility contract: `aria-roledescription`
 * is the neutral per-type discriminator for most element types, but the
 * bindings do not all put it on a connector, so a roledescription locator finds
 * nothing in some of them for reasons unrelated to this feature. The id shape
 * (`<slide part>-conn-<n>`) comes from core and is identical everywhere.
 */
function connectorOnCanvas(page: Page) {
	return page.locator('[data-pptx-viewport] [data-element-id$="-conn-0"]').first();
}

async function loadFixture(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1500, height: 1000 });
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(FIXTURE);
	await connectorOnCanvas(page).waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
}

/**
 * Click the connector's LINE.
 *
 * The fixture's first connector is a straight `straightConnector1` spanning its
 * box corner to corner, so the box centre is a point ON the stroke and nowhere
 * near any other element. Clicking there selects the connector only if the
 * binding paints a hit target along the path; without one the press falls
 * through the `pointer-events: none` wrapper to the slide background.
 */
async function clickConnectorLine(page: Page): Promise<string> {
	const connector = connectorOnCanvas(page);
	const box = await connector.boundingBox();
	if (!box) {
		throw new Error('the connector has no bounding box');
	}
	const id = await connector.getAttribute('data-element-id');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	return id ?? '';
}

/**
 * One arrowhead dropdown, addressed the way a screen-reader user would: by ROLE
 * plus accessible name, which is the contract this spec exists to pin.
 */
function control(page: Page, caption: (typeof CONTROLS)[number]) {
	return inspector(page).getByRole('combobox', { name: caption, exact: true });
}

/**
 * The same dropdown, addressed by LABEL text.
 *
 * This used to match nothing in any binding. Each wrapped its `<select>` inside
 * the `<label>` and left the naming to the wrapper, and Playwright's label
 * engine reads the label element's whole text content: with the options nested
 * inside it, the "label" of the Start Arrow picker was "Start Arrow None Arrow
 * Stealth Diamond Oval Triangle". The same defect once made a show-mode spec
 * match a transition picker (whose options include "Rotate") when it was
 * looking for a rotate handle. Every wrapped control now names itself, so an
 * exact label lookup resolves it, and a lookup for an OPTION word does not.
 */
function controlByLabel(page: Page, caption: (typeof CONTROLS)[number]) {
	return inspector(page).getByLabel(caption, { exact: true });
}

test.describe('connector arrowheads', () => {
	test('a click on the line selects the connector', async ({ page }) => {
		await loadFixture(page);

		const id = await clickConnectorLine(page);
		expect(id).not.toBe('');

		// The connector card only renders for a selected connector, so its presence
		// is the neutral evidence that the press landed on the line: no binding
		// exposes a selection flag all five agree on.
		await expect(control(page, 'Start Arrow')).toBeVisible();
	});

	test('every binding offers the same six controls', async ({ page }) => {
		await loadFixture(page);
		await clickConnectorLine(page);

		for (const caption of CONTROLS) {
			await expect(control(page, caption), caption).toHaveCount(1);
		}
	});

	test('every control names itself instead of borrowing its option list', async ({ page }) => {
		await loadFixture(page);
		await clickConnectorLine(page);

		for (const caption of CONTROLS) {
			// Resolvable by its caption alone...
			await expect(controlByLabel(page, caption), caption).toHaveCount(1);
		}

		// ...and NOT by the text of an option inside it. 'Stealth' is an arrowhead
		// type on the Start/End Arrow pickers; before the fix a label lookup for it
		// matched both of them, because the option text was part of the label.
		await expect(inspector(page).getByLabel('Stealth', { exact: true })).toHaveCount(0);
	});

	test('each control shows the schema default when the connector is silent', async ({ page }) => {
		await loadFixture(page);
		// The FIRST connector deliberately authors no `a:headEnd`/`a:tailEnd`.
		await clickConnectorLine(page);

		// An absent arrowhead means no head; an absent `@w`/`@len` means medium.
		await expect(control(page, 'Start Arrow')).toHaveValue('none');
		await expect(control(page, 'End Arrow')).toHaveValue('none');
		await expect(control(page, 'Start Width')).toHaveValue('med');
		await expect(control(page, 'End Length')).toHaveValue('med');
	});

	test('each control writes its own property, and the connector repaints', async ({ page }) => {
		await loadFixture(page);
		const id = await clickConnectorLine(page);
		const line = page.locator(`[data-pptx-viewport] [data-element-id="${id}"] svg`).first();
		const before = await line.innerHTML();

		for (const caption of CONTROLS) {
			await control(page, caption).selectOption(PICKS[caption]);
			// Re-select: several bindings rebuild the card from the patched element.
			await expect(control(page, caption)).toHaveValue(PICKS[caption]);
		}

		// Every control keeps its own value: a shared `shapeStyle` merge that
		// dropped siblings would show up here and nowhere else.
		for (const caption of CONTROLS) {
			await expect(control(page, caption), caption).toHaveValue(PICKS[caption]);
		}
		expect(await line.innerHTML()).not.toBe(before);
	});

	/*
	 * NOT covered here: undo.
	 *
	 * Angular, Svelte and Vanilla all record an arrowhead change as an undo step
	 * (each binding's own suite asserts it, and it was confirmed live through the
	 * ribbon's Undo). React does not, but not for any connector-specific reason:
	 * NO React inspector edit arms its Undo button, including a plain numeric
	 * geometry field, while a canvas drag does. That is a separate, pre-existing
	 * React history gap, and asserting undo here would fail the reference binding
	 * for a defect this feature neither introduced nor owns.
	 */
});
