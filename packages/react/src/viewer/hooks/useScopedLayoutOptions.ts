/**
 * Scope the list of available layout options to the active slide's master.
 *
 * The full `layoutOptions` list returned by the core load pipeline
 * contains every layout in the deck, including duplicates from
 * additional masters imported by themes. The Slides dropdown only
 * needs the layouts that belong to the same master as the currently
 * selected slide.
 *
 * If `masterPath` metadata is missing on the options (older core
 * versions, or layouts whose master couldn't be resolved), the input
 * list is returned unchanged.
 */
import type { PptxLayoutOption, PptxSlide } from 'pptx-viewer-core';

export function scopeLayoutOptionsToActiveSlide(
	options: PptxLayoutOption[],
	activeSlide: PptxSlide | undefined,
): PptxLayoutOption[] {
	if (!activeSlide?.layoutPath) {
		return options;
	}

	const hasAnyMasterInfo = options.some((o) => o.masterPath);
	if (!hasAnyMasterInfo) {
		return options;
	}

	const activeOption = options.find((o) => o.path === activeSlide.layoutPath);
	const activeMaster = activeOption?.masterPath;
	if (!activeMaster) {
		return options;
	}

	const scoped = options.filter((o) => o.masterPath === activeMaster);

	// Dedupe within the master by display name, preferring the active
	// slide's own layout for its own name.
	const seen = new Map<string, PptxLayoutOption>();
	for (const opt of scoped) {
		const isActive = opt.path === activeSlide.layoutPath;
		const existing = seen.get(opt.name);
		if (!existing || isActive) {
			seen.set(opt.name, opt);
		}
	}

	// Preserve the original order while applying the dedup choice.
	const chosen = new Set(Array.from(seen.values()).map((o) => o.path));
	const result: PptxLayoutOption[] = [];
	const usedNames = new Set<string>();
	for (const opt of scoped) {
		if (!chosen.has(opt.path)) {
			continue;
		}
		if (usedNames.has(opt.name)) {
			continue;
		}
		usedNames.add(opt.name);
		result.push(opt);
	}
	return result;
}
