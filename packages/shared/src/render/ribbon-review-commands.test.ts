import { describe, expect, it } from 'vitest';

import { RIBBON_CONTROL_CATALOG } from './customization';
import { buildReviewRibbon } from './ribbon-review-commands';

describe('review command contract', () => {
	it('assigns every command to a customization group, including Language and Ink', () => {
		const groups = buildReviewRibbon((key) => key, { editable: true, spellCheck: false });
		expect(groups).toHaveLength(7);
		for (const group of groups) {
			for (const command of group.commands) {
				expect(command.id.startsWith(`${group.id}.`)).toBeTruthy();
			}
		}
		expect(RIBBON_CONTROL_CATALOG.review.language.controls.language).toBe('Language');
	});

	it('keeps read-only proofing and inspection available while guarding mutations', () => {
		const commands = buildReviewRibbon((key) => key, {
			editable: false,
			spellCheck: true,
			canAccessibility: true,
			canLanguage: true,
			canCompare: true,
			canComments: true,
		}).flatMap((group) => group.commands);
		expect(commands.find((command) => command.id === 'review.proofing.spelling')).toMatchObject({
			pressed: true,
			disabled: false,
		});
		expect(
			commands.find((command) => command.id === 'review.compare.compare')?.disabled,
		).toBeTruthy();
		expect(
			commands.find((command) => command.id === 'review.accessibility.check')?.disabled,
		).toBeFalsy();
	});
});
