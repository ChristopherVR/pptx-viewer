/**
 * Keeps the floating theme/language pickers and export bar clear of the
 * viewer's own bottom-docked speaker-notes panel (`.pptxv-notes`), which is
 * laid out in-flow at the bottom of the viewer chrome and grows from ~32px
 * (collapsed header only) up to ~230px when the user expands it to edit
 * notes. The pickers/export bar are fixed-position siblings living outside
 * the viewer (so they float above its stacking context), so a static
 * `bottom` offset can only clear the collapsed height: once notes are
 * expanded the fixed chrome would otherwise sit on top of the notes
 * textarea, visually clipping it and swallowing clicks meant for it.
 *
 * A ResizeObserver mirrors the panel's live height onto a `--demo-notes-h`
 * custom property on the root element; styles.css adds it to each floating
 * element's `bottom` offset.
 */
export function observeNotesHeight(notesEl: Element): () => void {
	const root = document.documentElement;

	const apply = (): void => {
		const height = notesEl.getBoundingClientRect().height;
		root.style.setProperty('--demo-notes-h', `${height}px`);
	};

	const observer = new ResizeObserver(apply);
	observer.observe(notesEl);
	apply();

	return () => {
		observer.disconnect();
		root.style.removeProperty('--demo-notes-h');
	};
}
