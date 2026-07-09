/**
 * Linear-time PEM block extraction helpers.
 *
 * These locate `-----BEGIN <label>----- ... -----END <label>-----` blocks
 * using `String.prototype.indexOf` marker scans instead of a single regular
 * expression spanning the whole block (e.g. `BEGIN[\s\S]*?END`). A regex of
 * that shape is applied by the engine at every possible start position, so
 * input with many unterminated `BEGIN` markers (no matching `END`) makes it
 * re-scan the remaining text from each one, a quadratic-time blowup on
 * adversarial input. `indexOf`-based scanning stays linear: each call
 * starts searching where the previous one left off, so the total work is
 * bounded by the length of `text`.
 */

interface PemBlockMatch {
	index: number;
	block: string;
}

/** Find the first `-----BEGIN <label>----- ... -----END <label>-----` block for one label. */
function firstPemBlockForLabel(text: string, label: string): PemBlockMatch | undefined {
	const begin = `-----BEGIN ${label}-----`;
	const end = `-----END ${label}-----`;
	const beginIndex = text.indexOf(begin);
	if (beginIndex === -1) {
		return undefined;
	}
	const endIndex = text.indexOf(end, beginIndex + begin.length);
	if (endIndex === -1) {
		return undefined;
	}
	return { index: beginIndex, block: text.slice(beginIndex, endIndex + end.length) };
}

/**
 * Extract every `-----BEGIN <label>----- ... -----END <label>-----` block
 * from `text`, in order of appearance.
 */
export function extractPemBlocks(text: string, label: string): string[] {
	const begin = `-----BEGIN ${label}-----`;
	const end = `-----END ${label}-----`;
	const blocks: string[] = [];
	let searchFrom = 0;
	for (;;) {
		const beginIndex = text.indexOf(begin, searchFrom);
		if (beginIndex === -1) {
			break;
		}
		const contentStart = beginIndex + begin.length;
		const endIndex = text.indexOf(end, contentStart);
		if (endIndex === -1) {
			break;
		}
		blocks.push(text.slice(beginIndex, endIndex + end.length));
		searchFrom = endIndex + end.length;
	}
	return blocks;
}

/**
 * Extract the earliest PEM block in `text` matching any of `labels`
 * (e.g. the `RSA PRIVATE KEY` / `EC PRIVATE KEY` / `ENCRYPTED PRIVATE KEY` /
 * `PRIVATE KEY` label variants for a private key).
 */
export function extractFirstPemBlock(text: string, labels: string[]): string | undefined {
	let best: PemBlockMatch | undefined;
	for (const label of labels) {
		const found = firstPemBlockForLabel(text, label);
		if (found && (!best || found.index < best.index)) {
			best = found;
		}
	}
	return best?.block;
}
