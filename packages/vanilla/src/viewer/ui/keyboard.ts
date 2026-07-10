export interface KeyboardHandlers {
	next(): void;
	prev(): void;
	first(): void;
	last(): void;
	/** Invoked on Escape (used to exit presentation mode). */
	escape(): void;
}

/**
 * Attach slideshow keyboard navigation to the viewer root:
 * Arrow Right/Down, PageDown, Space -> next; Arrow Left/Up, PageUp -> prev;
 * Home -> first; End -> last; Escape -> exit presentation.
 *
 * Returns a detach function. Keys originating from form fields are ignored.
 */
export function attachKeyboardNavigation(
	root: HTMLElement,
	handlers: KeyboardHandlers,
): () => void {
	const onKeyDown = (event: KeyboardEvent) => {
		const target = event.target as HTMLElement | null;
		if (target && /^(?:INPUT|TEXTAREA|SELECT)$/u.test(target.tagName)) {
			return;
		}
		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowDown':
			case 'PageDown':
			case ' ':
				handlers.next();
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
			case 'PageUp':
				handlers.prev();
				break;
			case 'Home':
				handlers.first();
				break;
			case 'End':
				handlers.last();
				break;
			case 'Escape':
				handlers.escape();
				break;
			default:
				return;
		}
		event.preventDefault();
	};

	root.addEventListener('keydown', onKeyDown);
	return () => {
		root.removeEventListener('keydown', onKeyDown);
	};
}
