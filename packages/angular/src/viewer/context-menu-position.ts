/**
 * Viewport clamping for the Angular right-click menus.
 *
 * Both `EditorContextMenuComponent` and `SlideCanvasContextMenuComponent`
 * were placed at the raw cursor position, so a right-click near the bottom or
 * right edge of the window painted part of the menu off-screen, where its
 * lower commands could not be clicked. Svelte and Vanilla already clamped
 * through the shared `clampFlyoutPosition`; this wires the same decision to
 * Angular signals.
 */
import { afterNextRender, computed, signal } from '@angular/core';
import type { ElementRef, Signal } from '@angular/core';

import { clampFlyoutPosition } from '../internal/shared';

/** The clamped top-left corner of a menu, as signals the host style binds. */
export interface ClampedMenuPosition {
	readonly left: Signal<number>;
	readonly top: Signal<number>;
}

/**
 * Must be called from an injection context (a component field initializer):
 * the menu is measured once after its first render.
 */
export function clampedMenuPosition(
	host: ElementRef<HTMLElement>,
	x: Signal<number>,
	y: Signal<number>,
): ClampedMenuPosition {
	const size = signal({ width: 0, height: 0 });
	afterNextRender(() => {
		const menu = host.nativeElement.querySelector('[role="menu"]') ?? host.nativeElement;
		const rect = menu.getBoundingClientRect();
		size.set({ width: rect.width, height: rect.height });
	});
	const position = computed(() =>
		clampFlyoutPosition({
			x: x(),
			y: y(),
			width: size().width,
			height: size().height,
			viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth,
			viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
		}),
	);
	return {
		left: computed(() => position().left),
		top: computed(() => position().top),
	};
}
