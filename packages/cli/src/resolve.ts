import { TARGETS } from './targets';
import type { Target } from './targets';

/** Split a comma-separated `--target` value into trimmed, deduplicated ids. */
export function parseTargetIds(csv: string): string[] {
	return [
		...new Set(
			csv
				.split(',')
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean),
		),
	];
}

/** Look up each id in TARGETS; throws naming the first unknown id it finds. */
export function findTargetsByIds(ids: string[]): Target[] {
	return ids.map((id) => {
		const match = TARGETS.find((t) => t.id === id);
		if (!match) {
			throw new Error(
				`Unknown target "${id}". Choose one of: ${TARGETS.map((t) => t.id).join(', ')}`,
			);
		}
		return match;
	});
}

/** Dedupe package names across multiple targets' install lists, preserving first-seen order. */
export function mergePackages(targets: Target[]): string[] {
	const seen = new Set<string>();
	const merged: string[] = [];
	for (const target of targets) {
		for (const pkg of target.packages) {
			if (!seen.has(pkg)) {
				seen.add(pkg);
				merged.push(pkg);
			}
		}
	}
	return merged;
}
