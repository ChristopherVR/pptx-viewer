export type PasswordValidationError = 'required' | 'mismatch' | 'tooShort' | null;

/** Score a presentation password from 0 (very weak) to 4 (very strong). */
export function getPasswordStrength(password: string): number {
	if (!password) {
		return 0;
	}
	let score = 0;
	if (password.length >= 8) {
		score += 1;
	}
	if (password.length >= 12) {
		score += 1;
	}
	if (/[A-Z]/u.test(password) && /[a-z]/u.test(password)) {
		score += 1;
	}
	if (/\d/u.test(password)) {
		score += 1;
	}
	if (/[^A-Za-z0-9]/u.test(password)) {
		score += 1;
	}
	return Math.min(score, 4);
}

/** Validate the password pair used by the protection dialog. */
export function validatePasswordPair(
	password: string,
	confirmation: string,
): PasswordValidationError {
	if (!password) {
		return 'required';
	}
	if (password !== confirmation) {
		return 'mismatch';
	}
	if (password.length < 4) {
		return 'tooShort';
	}
	return null;
}
