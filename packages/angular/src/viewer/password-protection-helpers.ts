/**
 * password-protection-helpers.ts: Pure helpers backing the password-protection
 * dialog. Framework-free (no Angular / DOM) so the strength scoring, its
 * colour/label lookup, and the submit validation are unit testable in
 * isolation.
 *
 * `getStrengthLabel` / `validatePassword` accept an optional `TranslateService`
 * so callers with access to one get translated text; callers without one
 * (e.g. plain unit tests) still get the English fallback.
 */

import type { TranslateService } from '@ngx-translate/core';

// Password strength scoring is shared, so every binding grades a password the
// same way.
import { getPasswordStrength } from '../internal/shared';

export { getPasswordStrength };

/** Bar colours indexed by strength score (0-4). */
export const STRENGTH_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

/** English fallback labels indexed by strength score (0-4), used when no `translate` is passed. */
export const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

/** Translation keys mirroring {@link STRENGTH_LABELS}, indexed by strength score (0-4). */
const STRENGTH_LABEL_KEYS = [
	'pptx.password.strengthVeryWeak',
	'pptx.password.strengthWeak',
	'pptx.password.strengthFair',
	'pptx.password.strengthStrong',
	'pptx.password.strengthVeryStrong',
];

/** Human-readable label for a strength score (0-4), translated when `translate` is supplied. */
export function getStrengthLabel(strength: number, translate?: TranslateService): string {
	if (translate) {
		return translate.instant(STRENGTH_LABEL_KEYS[strength] ?? STRENGTH_LABEL_KEYS[0]);
	}
	return STRENGTH_LABELS[strength] ?? STRENGTH_LABELS[0];
}

/**
 * Validate the two password fields for the submit action. Returns an error
 * message (translated when `translate` is supplied, English otherwise), or
 * the empty string when the pair is acceptable. Mirrors the React dialog's
 * inline checks (non-empty, matching, >= 4 chars).
 */
export function validatePassword(
	password: string,
	confirmPassword: string,
	translate?: TranslateService,
): string {
	if (!password) {
		return translate ? translate.instant('pptx.password.errorEnter') : 'Please enter a password.';
	}
	if (password !== confirmPassword) {
		return translate ? translate.instant('pptx.password.errorMismatch') : 'Passwords do not match.';
	}
	if (password.length < 4) {
		return translate
			? translate.instant('pptx.password.errorTooShort')
			: 'Password must be at least 4 characters.';
	}
	return '';
}
