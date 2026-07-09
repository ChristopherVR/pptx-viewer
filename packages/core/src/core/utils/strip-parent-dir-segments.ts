/**
 * Remove every `../` segment from `path`, looping until no more remain.
 *
 * A single non-overlapping global-regex pass is not enough to fully
 * sanitize this: removing a match can splice its neighbouring characters
 * together into a *new* `../` sequence (e.g. `....//` has one `../` in the
 * middle; deleting it leaves the surrounding `..` and `/` adjacent, forming
 * a fresh `../`). Looping to a fixed point closes that reconstruction gap,
 * so no `../` can survive no matter how the input is crafted.
 */
export function stripParentDirSegments(path: string): string {
	let result = path;
	let previous: string;
	do {
		previous = result;
		result = previous.replace(/\.\.\//g, '');
	} while (result !== previous);
	return result;
}
