import { createInterface } from 'node:readline/promises';

import { bold, cyan, dim, green } from './colors';
import { runMenu } from './interactive-menu';
import type { MenuChoice } from './interactive-menu';

/**
 * Parse a multi-select answer like `"1,3"`, `"1 3"`, or `"all"`/`"a"` into
 * zero-based, deduplicated indices. Returns `null` if any token is out of
 * range or unparseable, so the caller can re-prompt. Used as the fallback
 * text prompt when the arrow-key menu isn't available (piped stdin, some
 * CI shells).
 */
export function parseSelection(answer: string, count: number): number[] | null {
	const trimmed = answer.trim().toLowerCase();
	if (trimmed === 'all' || trimmed === 'a') {
		return Array.from({ length: count }, (_, i) => i);
	}
	const tokens = trimmed.split(/[,\s]+/u).filter(Boolean);
	if (tokens.length === 0) {
		return null;
	}
	const indices = new Set<number>();
	for (const token of tokens) {
		const n = Number.parseInt(token, 10);
		if (!Number.isInteger(n) || n < 1 || n > count) {
			return null;
		}
		indices.add(n - 1);
	}
	return [...indices].sort((a, b) => a - b);
}

function printOptions(options: MenuChoice[]): void {
	options.forEach((opt, i) => {
		console.log(`  ${cyan(`${i + 1})`)} ${bold(opt.label)} ${dim(`- ${opt.description}`)}`);
	});
}

/** Numbered text fallback for environments without raw-mode keyboard input. */
async function selectByNumber<T extends MenuChoice>(options: T[]): Promise<T> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		printOptions(options);
		for (;;) {
			const answer = (await rl.question(`\nEnter a number (1-${options.length}): `)).trim();
			const index = Number.parseInt(answer, 10) - 1;
			if (Number.isInteger(index) && index >= 0 && index < options.length) {
				return options[index];
			}
			console.log(`Please enter a number between 1 and ${options.length}.`);
		}
	} finally {
		rl.close();
	}
}

/** Numbered text fallback for environments without raw-mode keyboard input. */
async function selectManyByNumber<T extends MenuChoice>(options: T[]): Promise<T[]> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		printOptions(options);
		for (;;) {
			const answer = await rl.question(
				`\nEnter one or more numbers, comma-separated (e.g. "1,3"), or "all": `,
			);
			const indices = parseSelection(answer, options.length);
			if (indices && indices.length > 0) {
				return indices.map((i) => options[i]);
			}
			console.log(`Please enter at least one number between 1 and ${options.length}, or "all".`);
		}
	} finally {
		rl.close();
	}
}

/** Ask the user to pick one of `options` with an arrow-key menu (numbered fallback otherwise). */
export async function selectOption<T extends MenuChoice>(
	question: string,
	options: T[],
): Promise<T> {
	console.log(`\n${bold(question)}`);
	const picked = await runMenu(options, false);
	if (!picked) {
		return selectByNumber(options);
	}
	const choice = options[picked[0]];
	console.log(`${green('✔')} ${choice.label}`);
	return choice;
}

/** Ask the user to pick one or more of `options` with an arrow-key checklist (numbered fallback otherwise). */
export async function multiSelect<T extends MenuChoice>(
	question: string,
	options: T[],
): Promise<T[]> {
	console.log(`\n${bold(question)}`);
	const picked = await runMenu(options, true);
	if (!picked) {
		return selectManyByNumber(options);
	}
	const choices = picked.map((i) => options[i]);
	console.log(`${green('✔')} ${choices.map((c) => c.label).join(', ')}`);
	return choices;
}

/** Ask a yes/no question. Defaults to yes on an empty answer. */
export async function confirm(question: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = (await rl.question(`${bold(question)} ${dim('(Y/n)')} `)).trim().toLowerCase();
		return answer === '' || answer === 'y' || answer === 'yes';
	} finally {
		rl.close();
	}
}

/** Ask for a line of free text, falling back to `defaultValue` on an empty answer. */
export async function input(question: string, defaultValue: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = (await rl.question(`${bold(question)} ${dim(`(${defaultValue})`)} `)).trim();
		return answer === '' ? defaultValue : answer;
	} finally {
		rl.close();
	}
}
