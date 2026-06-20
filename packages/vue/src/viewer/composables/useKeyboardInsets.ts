import {
	computeKeyboardInset,
	computeScrollDelta,
	isKeyboardOpen as isOpen,
	readViewportMetrics,
} from 'pptx-viewer-shared';
import { onMounted, onScopeDispose, readonly, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * `useKeyboardInsets`: track the on-screen-keyboard inset on touch devices and
 * keep the focused editable visible when the keyboard opens.
 *
 * The virtual keyboard shrinks the `VisualViewport` without changing the layout
 * viewport. This composable listens to `visualViewport` resize/scroll, derives
 * the covered pixels via the shared {@link computeKeyboardInset}, and:
 *   - exposes `keyboardInset` / `isKeyboardOpen` so the fixed mobile bottom bar
 *     can lift above the keyboard, and
 *   - scrolls the focused input / textarea / contenteditable into the area above
 *     the keyboard via the shared {@link computeScrollDelta}.
 *
 * SSR / desktop safe: with no `VisualViewport` no listener is wired and
 * `keyboardInset` stays 0 (nothing scrolls, the bar is not offset).
 *
 * @returns `{ keyboardInset, isKeyboardOpen }` as read-only refs.
 */
export interface UseKeyboardInsetsResult {
	/** CSS pixels the on-screen keyboard currently covers (0 when closed). */
	keyboardInset: Readonly<Ref<number>>;
	/** True while the inset is large enough to count as an open keyboard. */
	isKeyboardOpen: Readonly<Ref<boolean>>;
}

function isEditable(node: Element | null): node is HTMLElement {
	if (!(node instanceof HTMLElement)) {
		return false;
	}
	const tag = node.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable;
}

function scrollFocusedIntoView(keyboardInset: number): void {
	if (keyboardInset <= 0 || typeof document === 'undefined') {
		return;
	}
	const active = document.activeElement;
	if (!isEditable(active)) {
		return;
	}
	const rect = active.getBoundingClientRect();
	const delta = computeScrollDelta(
		{ top: rect.top, bottom: rect.bottom },
		window.innerHeight,
		keyboardInset,
	);
	if (delta !== 0) {
		window.scrollBy({ top: delta, behavior: 'smooth' });
	}
}

export function useKeyboardInsets(): UseKeyboardInsetsResult {
	const keyboardInset = ref(0);
	const keyboardOpen = ref(false);

	onMounted(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const vv = window.visualViewport;
		if (!vv) {
			return;
		}

		const update = (): void => {
			const metrics = readViewportMetrics(window);
			const inset = metrics ? computeKeyboardInset(metrics) : 0;
			keyboardInset.value = inset;
			keyboardOpen.value = isOpen(inset);
			if (inset > 0) {
				window.requestAnimationFrame(() => scrollFocusedIntoView(inset));
			}
		};

		const onFocusIn = (): void => {
			window.requestAnimationFrame(() => {
				const metrics = readViewportMetrics(window);
				const inset = metrics ? computeKeyboardInset(metrics) : 0;
				if (inset > 0) {
					scrollFocusedIntoView(inset);
				}
			});
		};

		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		document.addEventListener('focusin', onFocusIn);

		onScopeDispose(() => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
			document.removeEventListener('focusin', onFocusIn);
		});
	});

	return { keyboardInset: readonly(keyboardInset), isKeyboardOpen: readonly(keyboardOpen) };
}
