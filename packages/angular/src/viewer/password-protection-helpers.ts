/**
 * password-protection-helpers.ts: Pure helpers backing the password-protection
 * dialog. Framework-free (no Angular / DOM) so the strength scoring, its
 * colour/label lookup, and the submit validation are unit testable in
 * isolation.
 */

/** Returns a strength score 0-4 for a password. Ported verbatim from React. */
export function getPasswordStrength(password: string): number {
	if (!password) {
		return 0;
	}
	let score = 0;
	if (password.length >= 8) {
		score++;
	}
	if (password.length >= 12) {
		score++;
	}
	if (/[A-Z]/u.test(password) && /[a-z]/u.test(password)) {
		score++;
	}
	if (/\d/u.test(password)) {
		score++;
	}
	if (/[^A-Za-z0-9]/u.test(password)) {
		score++;
	}
	return Math.min(score, 4);
}

/** Bar colours indexed by strength score (0-4). */
export const STRENGTH_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

/** Human-readable labels indexed by strength score (0-4). */
export const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

/**
 * Validate the two password fields for the submit action. Returns an English
 * error message, or the empty string when the pair is acceptable. Mirrors the
 * React dialog's inline checks (non-empty, matching, >= 4 chars).
 */
export function validatePassword(password: string, confirmPassword: string): string {
	if (!password) {
		return 'Please enter a password.';
	}
	if (password !== confirmPassword) {
		return 'Passwords do not match.';
	}
	if (password.length < 4) {
		return 'Password must be at least 4 characters.';
	}
	return '';
}
