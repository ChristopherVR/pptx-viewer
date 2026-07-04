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

/**
 * Windows terminals that aren't Windows Terminal (plain conhost, old cmd.exe,
 * some CI runners) frequently lack the code page / font support to render box-
 * drawing and dingbat glyphs, turning them into mojibake. Mirrors the check
 * used by clack/is-unicode-supported: everywhere except legacy Windows consoles
 * gets the nicer glyphs; legacy Windows consoles get plain ASCII.
 */
function isUnicodeSupported(): boolean {
	if (process.platform !== 'win32') {
		return true;
	}
	return (
		Boolean(process.env.CI) ||
		Boolean(process.env.WT_SESSION) ||
		Boolean(process.env.ConEmuTask) ||
		process.env.TERM_PROGRAM === 'vscode' ||
		process.env.TERM === 'xterm-256color'
	);
}

export const symbols = isUnicodeSupported()
	? { pointer: '❯', check: '✔', cross: '✘', radioOn: '◉', radioOff: '◯', bullet: '·' }
	: { pointer: '>', check: '√', cross: '×', radioOn: '(*)', radioOff: '( )', bullet: '*' };

/** Whether ANSI escape codes will actually render, for callers that branch on it (e.g. cursor control). */
export function colorEnabled(): boolean {
	return isColorEnabled;
}
