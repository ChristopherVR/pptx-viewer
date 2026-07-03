import { emitKeypressEvents } from 'node:readline';

import { bold, cyan, dim, gray, green, symbols } from './colors';

export interface MenuChoice {
	label: string;
	description: string;
}

interface KeypressEvent {
	name?: string;
	ctrl?: boolean;
}

const HIDE_CURSOR = '[?25l';
const SHOW_CURSOR = '[?25h';
const CLEAR_LINE = '[2K';

function moveUp(lines: number): string {
	return lines > 0 ? `[${lines}A` : '';
}

function renderChoice(choice: MenuChoice, isCursor: boolean, checked: boolean | null): string {
	const pointer = isCursor ? cyan(symbols.pointer) : ' ';
	const box =
		checked === null ? '' : `${checked ? green(symbols.radioOn) : gray(symbols.radioOff)} `;
	const label = isCursor ? bold(choice.label) : choice.label;
	return `${pointer} ${box}${label} ${dim(`- ${choice.description}`)}`;
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
		let settled = false;

		const hint = multi
			? dim('(↑/↓ move, space toggle, a select all, enter confirm)')
			: dim('(↑/↓ move, enter confirm)');
		console.log(hint);
		process.stdout.write(HIDE_CURSOR);

		function draw(first: boolean): void {
			if (!first) {
				process.stdout.write(moveUp(choices.length));
			}
			for (const [i, choice] of choices.entries()) {
				const checkedState = multi ? checked.has(i) : null;
				process.stdout.write(`${CLEAR_LINE}${renderChoice(choice, i === cursor, checkedState)}\n`);
			}
		}

		function cleanup(): void {
			process.stdin.setRawMode?.(false);
			process.stdin.removeListener('keypress', onKeypress);
			process.stdin.pause();
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

		function onKeypress(_str: string, key: KeypressEvent | undefined): void {
			if (key?.ctrl && key.name === 'c') {
				finish(null);
				process.exit(130);
				return;
			}
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
					checked.add(cursor);
				}
				draw(false);
			} else if (multi && key?.name === 'a') {
				if (checked.size === choices.length) {
					checked.clear();
				} else {
					choices.forEach((_, i) => checked.add(i));
				}
				draw(false);
			} else if (key?.name === 'return') {
				if (multi) {
					if (checked.size > 0) {
						finish([...checked].sort((a, b) => a - b));
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
