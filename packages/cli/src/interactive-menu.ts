import { emitKeypressEvents } from 'node:readline';

import { bold, cyan, dim, gray, green, symbols } from './colors';

export interface MenuChoice {
	label: string;
	description: string;
	/** Choices sharing a `group` are mutually exclusive in a multi-select checklist (e.g. pick one UI framework). */
	group?: string;
}

interface KeypressEvent {
	name?: string;
	ctrl?: boolean;
}

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_LINE = '\x1b[2K';
const ERASE_DOWN = '\x1b[0J';

function moveUp(lines: number): string {
	return lines > 0 ? `\x1b[${lines}A` : '';
}

/** Enter arrives as `key.name === 'return'` on most terminals, but some Windows consoles and piped
 * shells only surface it as a raw `\r`/`\n` sequence with no parsed `key` at all, so check both. */
function isEnterKey(str: string, key: KeypressEvent | undefined): boolean {
	return key?.name === 'return' || key?.name === 'enter' || str === '\r' || str === '\n';
}

function renderChoice(choice: MenuChoice, isCursor: boolean, checked: boolean | null): string {
	const pointer = isCursor ? cyan(symbols.pointer) : ' ';
	const box =
		checked === null ? '' : `${checked ? green(symbols.radioOn) : gray(symbols.radioOff)} `;
	const label = isCursor ? bold(choice.label) : choice.label;
	return `${pointer} ${box}${label} ${dim(`- ${choice.description}`)}`;
}

/** Every other index sharing `index`'s group, so toggling one on can uncheck the rest. */
function groupMatesOf(choices: MenuChoice[], index: number): number[] {
	const group = choices[index].group;
	if (!group) {
		return [];
	}
	return choices.flatMap((c, i) => (i !== index && c.group === group ? [i] : []));
}

/**
 * Render an arrow-key-navigable menu (single or multi select) using raw
 * terminal input. Resolves `null` when raw keyboard input isn't available
 * (piped stdin, some CI shells) so callers can fall back to a numbered
 * text prompt instead.
 */
export function runMenu(choices: MenuChoice[], multi: boolean): Promise<number[] | null> {
	return new Promise((resolve) => {
		if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
			resolve(null);
			return;
		}

		let cursor = 0;
		const checked = new Set<number>();
		let statusMessage = '';
		let settled = false;

		const hint = multi
			? dim('(↑/↓ move, space toggle, a select all, enter confirm)')
			: dim('(↑/↓ move, enter confirm)');
		const totalLines = choices.length + 2; // hint + one line per choice + status
		process.stdout.write(HIDE_CURSOR);

		function draw(first: boolean): void {
			if (!first) {
				process.stdout.write(moveUp(totalLines));
			}
			process.stdout.write(`${CLEAR_LINE}${hint}\n`);
			for (const [i, choice] of choices.entries()) {
				const checkedState = multi ? checked.has(i) : null;
				process.stdout.write(`${CLEAR_LINE}${renderChoice(choice, i === cursor, checkedState)}\n`);
			}
			process.stdout.write(`${CLEAR_LINE}${statusMessage}\n`);
		}

		/** Wipes the whole rendered widget (hint, choices, status line) so the caller can print a clean one-line result in its place. */
		function eraseWidget(): void {
			process.stdout.write(moveUp(totalLines));
			process.stdout.write(ERASE_DOWN);
		}

		function cleanup(): void {
			process.stdin.setRawMode?.(false);
			process.stdin.removeListener('keypress', onKeypress);
			process.stdin.pause();
			eraseWidget();
			process.stdout.write(SHOW_CURSOR);
		}

		function finish(result: number[] | null): void {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(result);
		}

		function check(index: number): void {
			for (const mate of groupMatesOf(choices, index)) {
				checked.delete(mate);
			}
			checked.add(index);
		}

		function toggleSelectAll(): void {
			// Choices in an exclusive group can't all be checked at once, so "select
			// all" only applies to ungrouped choices; grouped ones must be picked one at a time.
			const selectable = choices.flatMap((c, i) => (c.group ? [] : [i]));
			const allSelected = selectable.every((i) => checked.has(i));
			for (const i of selectable) {
				if (allSelected) {
					checked.delete(i);
				} else {
					checked.add(i);
				}
			}
		}

		function onKeypress(str: string, key: KeypressEvent | undefined): void {
			if (key?.ctrl && key.name === 'c') {
				finish(null);
				process.exit(130);
				return;
			}
			statusMessage = '';
			if (key?.name === 'up') {
				cursor = (cursor - 1 + choices.length) % choices.length;
				draw(false);
			} else if (key?.name === 'down') {
				cursor = (cursor + 1) % choices.length;
				draw(false);
			} else if (multi && key?.name === 'space') {
				if (checked.has(cursor)) {
					checked.delete(cursor);
				} else {
					check(cursor);
				}
				draw(false);
			} else if (multi && key?.name === 'a') {
				toggleSelectAll();
				draw(false);
			} else if (isEnterKey(str, key)) {
				if (multi) {
					if (checked.size > 0) {
						finish([...checked].sort((a, b) => a - b));
					} else {
						statusMessage = dim('Select at least one option with space, then press enter.');
						draw(false);
					}
				} else {
					finish([cursor]);
				}
			}
		}

		emitKeypressEvents(process.stdin);
		process.stdin.setRawMode(true);
		process.stdin.on('keypress', onKeypress);
		process.stdin.resume();
		draw(true);
	});
}
