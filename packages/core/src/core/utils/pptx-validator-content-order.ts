import { directChildren } from './pptx-validator-conformance-xml';
import type { ValidationIssue } from './pptx-validator-types';

/** Push one ECMA-376 rule issue for `path`. */
export function issue(
	issues: ValidationIssue[],
	path: string,
	code: string,
	message: string,
	severity: ValidationIssue['severity'] = 'error',
): void {
	issues.push({ severity, code, message, path });
}

/**
 * Report the first direct child of `xml` that appears before a child it must
 * follow in `allowed`. Children not listed in `allowed` are SKIPPED, so a
 * missing or misspelt token silently disables the check for that element
 * rather than producing a false positive; keep the tables verified against
 * the spec.
 */
export function validateOrder(
	xml: string,
	allowed: string[],
	path: string,
	context: string,
	issues: ValidationIssue[],
): void {
	let last = -1;
	for (const child of directChildren(xml)) {
		const index = allowed.indexOf(child);
		if (index < 0) {
			continue;
		}
		if (index < last) {
			issue(
				issues,
				path,
				'INVALID_CONTENT_ORDER',
				`${context} child <${child}> is out of ECMA-376 sequence order`,
			);
			return;
		}
		last = index;
	}
}
