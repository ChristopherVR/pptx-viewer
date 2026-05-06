/**
 * Safe ZIP-relative path resolution for the PPTX save pipeline.
 *
 * PPTX relationships frequently use relative `Target` strings (e.g. `../media/image1.png`).
 * Naive concatenation lets a malicious deck escape the package root and clobber arbitrary
 * entries (zip-slip on write). {@link safeResolveZipPath} normalises `.`/`..` segments and
 * rejects any result that escapes `basePath`.
 *
 * @module safe-path
 */

/**
 * Resolve a relationship target against a base path.
 *
 * Behaviour:
 * - When `target` starts with `'/'` it is treated as an absolute path inside the package
 *   (the leading slash is stripped).
 * - Otherwise the target is appended to `basePath` and `.`/`..` segments are normalised.
 * - Returns `null` when the resolved path escapes the package root, or when the inputs
 *   are not strings.
 *
 * @param basePath - Directory inside the ZIP package to resolve against (e.g. `ppt/slides`).
 * @param target   - Relationship `Target` value.
 * @returns The normalised path, or `null` when the target escapes the package.
 */
export function safeResolveZipPath(basePath: string, target: string): string | null {
	if (typeof basePath !== 'string' || typeof target !== 'string') {
		return null;
	}

	const trimmedTarget = target.trim();
	if (trimmedTarget.length === 0) {
		return null;
	}

	// Absolute (package-rooted) target: strip leading slash.
	if (trimmedTarget.startsWith('/')) {
		return normaliseSegments(trimmedTarget.slice(1).replace(/\\/g, '/'));
	}

	// Relative target: stitch onto base.
	const baseParts = basePath
		.replace(/\\/g, '/')
		.split('/')
		.filter((p) => p.length > 0);
	const targetParts = trimmedTarget.replace(/\\/g, '/').split('/');

	const stack: string[] = [...baseParts];
	for (const part of targetParts) {
		if (part === '' || part === '.') {
			continue;
		}
		if (part === '..') {
			if (stack.length === 0) {
				// Attempted escape above the package root.
				return null;
			}
			stack.pop();
			continue;
		}
		stack.push(part);
	}

	return stack.join('/');
}

function normaliseSegments(input: string): string | null {
	const parts = input.split('/');
	const stack: string[] = [];
	for (const part of parts) {
		if (part === '' || part === '.') {
			continue;
		}
		if (part === '..') {
			if (stack.length === 0) {
				return null;
			}
			stack.pop();
			continue;
		}
		stack.push(part);
	}
	return stack.join('/');
}
