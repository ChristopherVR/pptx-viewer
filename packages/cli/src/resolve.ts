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

/**
 * React, Vue, and Angular bindings are separate, framework-specific packages,
 * not meant to be installed into the same project together. Throws naming the
 * conflicting targets if more than one `group`-sharing target was picked.
 */
export function assertSingleFramework(targets: Target[]): void {
	const grouped = new Map<string, Target[]>();
	for (const target of targets) {
		if (!target.group) {
			continue;
		}
		const mates = grouped.get(target.group) ?? [];
		mates.push(target);
		grouped.set(target.group, mates);
	}
	for (const mates of grouped.values()) {
		if (mates.length > 1) {
			throw new Error(
				`${mates.map((t) => t.label).join(', ')} can't be selected together; pick a single UI framework.`,
			);
		}
	}
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
