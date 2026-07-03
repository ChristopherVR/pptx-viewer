/**
 * Minimal, dependency-free ANSI colour helpers. Respects `NO_COLOR` and
 * disables itself automatically when stdout isn't a TTY (piped output, CI
 * logs), so plain-text output never gets escape codes mixed into it.
 */
const isColorEnabled =
	process.env.NO_COLOR === undefined &&
	(process.env.FORCE_COLOR !== undefined || Boolean(process.stdout.isTTY));

function wrap(open: number, close: number): (text: string) => string {
	return (text: string) => (isColorEnabled ? `[${open}m${text}[${close}m` : text);
}

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const blue = wrap(34, 39);
export const magenta = wrap(35, 39);
export const cyan = wrap(36, 39);
export const gray = wrap(90, 39);

export const symbols = {
	pointer: '❯',
	check: '✔',
	cross: '✘',
	radioOn: '◉',
	radioOff: '◯',
	bullet: '·',
};

/** Whether ANSI escape codes will actually render, for callers that branch on it (e.g. cursor control). */
export function colorEnabled(): boolean {
	return isColorEnabled;
}
