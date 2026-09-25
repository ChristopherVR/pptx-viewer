/**
 * `clampedMenuPosition` keeps the right-click menus on screen. Both Angular
 * menus used to bind the raw cursor position, so a right-click near the
 * bottom edge painted the lower commands below the fold.
 *
 * `afterNextRender` needs a live ApplicationRef; it is replaced with an
 * immediate call so the measurement runs synchronously in the test.
 */
import { ElementRef, signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clampedMenuPosition } from './context-menu-position';

vi.mock(import('@angular/core'), async (importOriginal) => ({
	...(await importOriginal()),
	afterNextRender: (run: () => void) => run(),
}));

function hostWithMenu(width: number, height: number): ElementRef<HTMLElement> {
	const host = document.createElement('div');
	const menu = document.createElement('ul');
	menu.setAttribute('role', 'menu');
	menu.getBoundingClientRect = () => ({ width, height }) as DOMRect;
	host.appendChild(menu);
	return new ElementRef(host);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('clampedMenuPosition', () => {
	it('pulls a menu opened near the bottom-right corner back inside the window', () => {
		vi.stubGlobal('innerWidth', 1000);
		vi.stubGlobal('innerHeight', 800);
		const position = clampedMenuPosition(hostWithMenu(200, 300), signal(950), signal(700));
		expect(position.left()).toBe(1000 - 200 - 8);
		expect(position.top()).toBe(800 - 300 - 8);
	});

	it('leaves a menu that already fits at the cursor', () => {
		vi.stubGlobal('innerWidth', 1000);
		vi.stubGlobal('innerHeight', 800);
		const position = clampedMenuPosition(hostWithMenu(200, 300), signal(100), signal(120));
		expect(position.left()).toBe(100);
		expect(position.top()).toBe(120);
	});
});
