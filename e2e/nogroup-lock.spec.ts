/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `a:spLocks/@noGrp` ("Don't group this shape"): does the Group command
 * actually refuse a selection that includes a locked shape, in both places a
 * user can reach it - the ribbon's Arrange group and the right-click context
 * menu - and does it stay usable for an unlocked pair (the control)?
 *
 * `packages/shared/src/render/arrange-extras.ts`'s `canGroupSelection` folds
 * `@noGrp` in via `element-locks.ts`'s `groupable` field; this spec proves the
 * UI surfaces actually consult it rather than only gating the command itself
 * (a binding can wire the command correctly while leaving an ENABLED button
 * that silently does nothing, which is its own, separate class of bug).
 *
 * Fixture: `nogroup-lock.pptx` ("Locked A" carries `noGrp="1"`; "Free B" and
 * "Free C" carry no locks).
 *
 * Run: bunx playwright test nogroup-lock
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { commandNamed, GROUP_COMMAND, marqueeAcross, openMenuOn } from './support/context-menu';
import { fixture, loadDeckAt, ribbon, ribbonTab, slideElements, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('nogroup-lock.pptx');

async function openDeck(page: Page, origin: string): Promise<void> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

function shape(page: Page, label: string): Locator {
	return slideElements(page).filter({ hasText: label }).first();
}

/** The ribbon's Group button, wherever it lives (Home's Arrange group, or a dedicated Arrange tab). */
async function ribbonGroupButton(page: Page): Promise<Locator> {
	const home = ribbon(page).getByRole('button', { name: 'Group', exact: true });
	if ((await home.count()) > 0) {
		return home.first();
	}
	const arrangeTab = ribbonTab(page, 'Arrange');
	if ((await arrangeTab.count()) > 0) {
		await arrangeTab.click();
		await page.waitForTimeout(150);
	}
	return ribbon(page).getByRole('button', { name: 'Group', exact: true }).first();
}

interface GroupUiState {
	ribbonPresent: boolean;
	ribbonDisabled: boolean;
	menuPresent: boolean;
	menuDisabled: boolean;
}

async function readGroupState(
	page: Page,
	origin: string,
	labels: [string, string],
): Promise<GroupUiState> {
	await openDeck(page, origin);
	const first = shape(page, labels[0]);
	const second = shape(page, labels[1]);
	await marqueeAcross(page, slideStage(page), [first, second]);

	const ribbonButton = await ribbonGroupButton(page);
	const ribbonPresent = (await ribbonButton.count()) > 0;
	const ribbonDisabled = ribbonPresent ? await ribbonButton.isDisabled() : true;

	const menu = await openMenuOn(page, second);
	const command = commandNamed(menu, GROUP_COMMAND);

	return {
		ribbonPresent,
		ribbonDisabled,
		menuPresent: command !== null,
		menuDisabled: command?.disabled ?? true,
	};
}

test.describe('noGrp lock disables Group', () => {
	test('a selection including a locked shape disables Group in the ribbon and the context menu', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, (page, origin) =>
			readGroupState(page, origin, ['Locked A', 'Free B']),
		);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (value.ribbonPresent && !value.ribbonDisabled) {
				problems.push('ribbon Group button is enabled with a locked shape in the selection');
			}
			if (value.menuPresent && !value.menuDisabled) {
				problems.push('context-menu Group command is enabled with a locked shape in the selection');
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});

	test('control: a selection of two unlocked shapes keeps Group usable', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, (page, origin) =>
			readGroupState(page, origin, ['Free B', 'Free C']),
		);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (!value.ribbonPresent) {
				problems.push('no ribbon Group button found for an unlocked multi-selection');
			} else if (value.ribbonDisabled) {
				problems.push('ribbon Group button is disabled for two unlocked shapes');
			}
			if (!value.menuPresent) {
				problems.push('context menu offers no "group" command for an unlocked multi-selection');
			} else if (value.menuDisabled) {
				problems.push('context-menu Group command is disabled for two unlocked shapes');
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
