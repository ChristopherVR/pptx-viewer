import type { PresentationPointerTool } from 'pptx-viewer-shared';
import {
	acceptsPresentationInput,
	createPresentationKeyBuffer,
	createWheelStepBuffer,
	mapPresentationKey,
	mapPresentationWheel,
} from 'pptx-viewer-shared';

export interface KeyboardHandlers {
	next(): void;
	prev(): void;
	first(): void;
	last(): void;
	/** Invoked on Escape (used to exit presentation mode). */
	escape(): void;
	/** True while a slide show is running; gates the show-only shortcuts. */
	isPresenting?(): boolean;
	/** Jump to a zero-based slide index (typed slide number during a show). */
	goToSlide?(index: number): void;
	/** Number of slides, so a typed slide number can be range-checked. */
	getSlideCount?(): number;
	/** Select a pointer tool (Ctrl+L / Ctrl+P / Ctrl+A / Ctrl+E). */
	setPointerTool?(tool: PresentationPointerTool): void;
	/** Erase the show's ink annotations (E). */
	eraseAnnotations?(): void;
	/** Show or hide ink markup (Ctrl+M). */
	toggleInkMarkup?(): void;
	/** Blank the screen black or white (B / W, or `.` / `,`). */
	toggleBlank?(value: 'black' | 'white'): void;
}

/**
 * Attach slideshow keyboard navigation to the viewer root.
 *
 * While a show is running the full PowerPoint shortcut set applies, resolved by
 * the shared slide-show map. Outside a show only the arrows, Page keys, Home,
 * End and Escape navigate: PowerPoint's bare-letter commands (N, P, B, W, E)
 * belong to the show, and binding them in the editor would hijack typing.
 *
 * Returns a detach function. Keys originating from form fields are ignored.
 */
export function attachKeyboardNavigation(
	root: HTMLElement,
	handlers: KeyboardHandlers,
): () => void {
	const keyBuffer = createPresentationKeyBuffer();

	const onKeyDown = (event: KeyboardEvent) => {
		const target = event.target as HTMLElement | null;
		if (target && /^(?:INPUT|TEXTAREA|SELECT)$/u.test(target.tagName)) {
			return;
		}

		if (handlers.isPresenting?.()) {
			handlePresentationKey(event, handlers, keyBuffer);
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

	// PowerPoint navigates a running show on the wheel: down advances, up goes
	// back. The step buffer keeps one trackpad flick to one slide.
	const wheelBuffer = createWheelStepBuffer();
	const onWheel = (event: WheelEvent): void => {
		// Only a running show navigates; the editor scrolls natively.
		if (!handlers.isPresenting?.() || !acceptsPresentationInput()) {
			return;
		}
		const mapped = mapPresentationWheel(event, wheelBuffer);
		if (mapped.intent === 'next-slide') {
			event.preventDefault();
			handlers.next();
		} else if (mapped.intent === 'previous-slide') {
			event.preventDefault();
			handlers.prev();
		}
	};

	root.addEventListener('keydown', onKeyDown);
	root.addEventListener('wheel', onWheel, { passive: false });
	return () => {
		root.removeEventListener('keydown', onKeyDown);
		root.removeEventListener('wheel', onWheel);
	};
}

/** Resolve and perform one slide-show shortcut. */
function handlePresentationKey(
	event: KeyboardEvent,
	handlers: KeyboardHandlers,
	keyBuffer: ReturnType<typeof createPresentationKeyBuffer>,
): void {
	// An audience display mirrors the presenter's screen. If its own keyboard
	// navigated, a stray key moved it off the presenter's slide and the next
	// snapshot yanked it back, which reads as the display refusing to advance.
	if (!acceptsPresentationInput()) {
		return;
	}
	const mapped = mapPresentationKey(event, keyBuffer);
	if (mapped.action === 'none') {
		return;
	}
	event.preventDefault();

	switch (mapped.action) {
		case 'next':
			handlers.next();
			return;
		case 'previous':
			handlers.prev();
			return;
		case 'first':
			handlers.first();
			return;
		case 'last':
			handlers.last();
			return;
		case 'goto': {
			const index = mapped.slideNumber - 1;
			const count = handlers.getSlideCount?.() ?? 0;
			if (index >= 0 && index < count) {
				handlers.goToSlide?.(index);
			}
			return;
		}
		case 'end':
			handlers.escape();
			return;
		case 'pointerTool':
			// PowerPoint's Ctrl+A "arrow" is the plain pointer: no active tool.
			handlers.setPointerTool?.(mapped.tool === 'arrow' ? 'none' : mapped.tool);
			return;
		case 'eraseAnnotations':
			handlers.eraseAnnotations?.();
			return;
		case 'toggleInkMarkup':
			handlers.toggleInkMarkup?.();
			return;
		case 'toggleBlackScreen':
			handlers.toggleBlank?.('black');
			return;
		case 'toggleWhiteScreen':
			handlers.toggleBlank?.('white');
			break;
		// A pending slide number and the context-menu key are consumed above so
		// the browser does not act on them; nothing further to do.
		default:
			break;
	}
}
