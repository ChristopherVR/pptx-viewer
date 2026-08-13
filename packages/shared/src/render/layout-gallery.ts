/**
 * layout-gallery.ts: which layouts the New Slide / Layout menus offer.
 *
 * A deck's `layoutOptions` lists every layout in the package, including the
 * near-identical sets contributed by masters that arrived with an imported
 * theme. PowerPoint only offers the layouts belonging to the active slide's
 * own master, so the menus have to scope the list before rendering it.
 *
 * This lived in React only, which is why the other four bindings offered every
 * layout in the file (Angular derived its own list from the masters instead,
 * and Vue, Svelte and Vanilla did no scoping at all).
 *
 * @module render/layout-gallery
 */

/** The parts of a layout option this module needs. */
export interface GalleryLayoutOption {
	path: string;
	name: string;
	/** ZIP path of the owning slide master, when core could resolve it. */
	masterPath?: string;
}

/**
 * Restrict layout options to the active slide's master.
 *
 * Falls back to the full list whenever scoping cannot be established: no
 * active layout, no master metadata on any option, or an active layout whose
 * master is unknown. Showing too many layouts is recoverable; showing none is
 * not.
 *
 * Within the chosen master, options are de-duplicated by display name, keeping
 * document order and preferring the slide's current layout when two entries
 * share a name.
 *
 * @param options - Every layout in the presentation.
 * @param activeLayoutPath - `layoutPath` of the slide being edited.
 * @returns The layouts to offer, in document order. The input array itself is
 *   returned when no scoping applies, so callers memoising on the result keep
 *   a stable reference and do not re-render the menu on every pass.
 */
export function scopeLayoutOptionsToSlide<T extends GalleryLayoutOption>(
	options: T[],
	activeLayoutPath: string | undefined,
): T[] {
	if (!activeLayoutPath || !options.some((option) => option.masterPath)) {
		return options;
	}

	const activeMaster = options.find((option) => option.path === activeLayoutPath)?.masterPath;
	if (!activeMaster) {
		return options;
	}

	const scoped = options.filter((option) => option.masterPath === activeMaster);

	// Choose one option per display name first, so the pass that preserves
	// document order knows which duplicate survived.
	const chosenByName = new Map<string, T>();
	for (const option of scoped) {
		const isActive = option.path === activeLayoutPath;
		if (isActive || !chosenByName.has(option.name)) {
			chosenByName.set(option.name, option);
		}
	}

	const chosenPaths = new Set([...chosenByName.values()].map((option) => option.path));
	const emitted = new Set<string>();
	const result: T[] = [];
	for (const option of scoped) {
		if (!chosenPaths.has(option.path) || emitted.has(option.name)) {
			continue;
		}
		emitted.add(option.name);
		result.push(option);
	}
	return result;
}

/**
 * Whether a gallery entry is the layout the slide currently uses.
 *
 * Trivial on its own, but it keeps every binding comparing the same two
 * fields rather than each inventing its own "is this the active one" rule.
 */
export function isCurrentLayout(
	option: Pick<GalleryLayoutOption, 'path'>,
	activeLayoutPath: string | undefined,
): boolean {
	return Boolean(activeLayoutPath) && option.path === activeLayoutPath;
}
