/**
 * usePresentationKeyboard: the running slide show's window-level key handling.
 *
 * The key-to-action mapping itself is shared (`mapPresentationKey`) so every
 * binding honours the same PowerPoint keymap, including the digit buffer behind
 * "type a slide number, then Enter". What is Vue-specific, and all that lives
 * here, is the listener lifecycle and dispatching each mapped action.
 */
import {
	acceptsPresentationInput,
	createPresentationKeyBuffer,
	createWheelStepBuffer,
	mapPresentationKey,
	mapPresentationWheel,
} from 'pptx-viewer-shared';
import type { Ref } from 'vue';
import { onBeforeUnmount, onMounted } from 'vue';

import type { PresentationTool } from './usePresentationAnnotations';

export interface UsePresentationKeyboardOptions {
	slideCount: () => number;
	next: () => void;
	prev: () => void;
	goTo: (index: number) => void;
	/** Home / End resolve through the show order, not the raw deck bounds. */
	firstSlideIndex: () => number;
	lastSlideIndex: () => number;
	/** Leave the show (may open the keep-annotations prompt first). */
	requestClose: () => void;
	setPresentationTool: (tool: PresentationTool) => void;
	clearAnnotations: () => void;
	/** Ctrl+M: hide ink markup without discarding the strokes. */
	inkMarkupVisible: Ref<boolean>;
	/** PowerPoint's bare `J`: live captions on or off. */
	subtitlesOn: Ref<boolean>;
	toolbarVisible: Ref<boolean>;
	setToolbarVisible: (visible: boolean) => void;
	/** B / W: blank the audience display to black or white. */
	setBlackout: (value: 'black' | 'white') => void;
	/** Ctrl+S "All Slides": open the presenter view's slide picker. */
	showAllSlides: () => void;
}

export function usePresentationKeyboard(options: UsePresentationKeyboardOptions): void {
	const keyBuffer = createPresentationKeyBuffer();

	function handleKeyDown(event: KeyboardEvent): void {
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
			case 'end':
				options.requestClose();
				return;
			case 'next':
				options.next();
				return;
			case 'previous':
				options.prev();
				return;
			case 'first':
				options.goTo(options.firstSlideIndex());
				return;
			case 'last':
				options.goTo(options.lastSlideIndex());
				return;
			case 'goto': {
				const index = mapped.slideNumber - 1;
				if (index >= 0 && index < options.slideCount()) {
					options.goTo(index);
				}
				return;
			}
			case 'pointerTool':
				// PowerPoint's Ctrl+A "arrow" is the plain pointer: no active tool.
				options.setPresentationTool(mapped.tool === 'arrow' ? 'none' : mapped.tool);
				return;
			case 'eraseAnnotations':
				options.clearAnnotations();
				return;
			case 'toggleInkMarkup':
				options.inkMarkupVisible.value = !options.inkMarkupVisible.value;
				return;
			case 'toggleChrome':
				options.setToolbarVisible(!options.toolbarVisible.value);
				return;
			case 'toggleBlackScreen':
				options.setBlackout('black');
				return;
			case 'toggleWhiteScreen':
				options.setBlackout('white');
				return;
			case 'showAllSlides':
				options.showAllSlides();
				break;
			case 'toggleSubtitles':
				// Captions used to be hand-matched above this switch on "c", a key
				// PowerPoint does not use, which is why the other four bindings had
				// no captions shortcut at all. The map now resolves the documented
				// `J` for all five.
				options.subtitlesOn.value = !options.subtitlesOn.value;
				break;
			// A pending slide number and the context-menu key are consumed above so
			// the browser does not act on them; nothing further to do.
			default:
				break;
		}
	}

	// PowerPoint navigates a running show on the wheel: down advances, up goes
	// back. The step buffer keeps one trackpad flick to one slide.
	const wheelBuffer = createWheelStepBuffer();
	function handleWheel(event: WheelEvent): void {
		const mapped = mapPresentationWheel(event, wheelBuffer);
		if (mapped.intent === 'next-slide') {
			event.preventDefault();
			options.next();
		} else if (mapped.intent === 'previous-slide') {
			event.preventDefault();
			options.prev();
		}
	}

	onMounted(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('wheel', handleWheel, { passive: false });
	});
	onBeforeUnmount(() => {
		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('wheel', handleWheel);
	});
}
