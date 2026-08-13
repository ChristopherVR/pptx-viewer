import { Injectable, signal } from '@angular/core';

/**
 * Families the user registered from a local font file this session
 * (File > Options > Fonts, off by default).
 *
 * A service rather than a chain of inputs because two unrelated parts of the
 * UI need the same list: the Options pane that adds to it and the Home tab's
 * font dropdown that offers it. It is also deliberately not persisted, so
 * nothing survives a reload; the font binary is the user's, not ours to store.
 *
 * Provided per viewer instance (alongside the other viewer services), so two
 * viewers on one page keep their own lists.
 */
@Injectable()
export class CustomFontsService {
	private readonly families = signal<readonly string[]>([]);

	/** The registered families, in the order they were added. */
	readonly registeredFamilies = this.families.asReadonly();

	/** Record a newly registered family, ignoring one already present. */
	register(family: string): void {
		const trimmed = family.trim();
		if (!trimmed) {
			return;
		}
		this.families.update((current) =>
			current.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())
				? current
				: [...current, trimmed],
		);
	}
}
