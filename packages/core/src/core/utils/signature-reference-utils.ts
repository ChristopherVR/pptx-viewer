/**
 * Pure string utilities for resolving digital signature reference URIs
 * to ZIP part paths. Platform-agnostic (no Node dependencies).
 */

/** Normalize a ZIP part path: convert backslashes to forward slashes and strip leading slashes. */
export function normalizePartPath(partPath: string): string {
	return partPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Resolve a signature reference URI to a ZIP part path.
 * Returns `undefined` for empty URIs, fragment-only URIs (#...), or invalid input.
 */
export function resolveReferenceUriToPart(uri: string): string | undefined {
	const trimmed = uri.trim();
	if (trimmed.length === 0 || trimmed.startsWith('#')) {
		return undefined;
	}
	const decoded = decodeURIComponent(trimmed);
	return normalizePartPath(decoded.startsWith('/') ? decoded.slice(1) : decoded);
}
