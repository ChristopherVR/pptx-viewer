/**
 * presentation-context-menu.component.test.ts: guards for the slide-show
 * right-click menu (Options > Advanced > "Show menu on right mouse click").
 *
 * This package has no TestBed (see `vitest.config.ts`), so these are
 * source-text guards, the same technique `presentation-toolbar.component.test.ts`
 * uses: the wiring here is static markup/bindings, so it is fully decidable
 * from the source.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getPresentationContextMenuSections } from '../internal/shared';
import { componentSource } from './component-source.test-support';

const here = dirname(fileURLToPath(import.meta.url));
const menuSource = componentSource(here, 'presentation-context-menu.component.ts');
const overlaySource = componentSource(here, 'presentation-overlay.component.ts');
const toolbarSource = componentSource(here, 'presentation-toolbar.component.ts');

describe('presentation-context-menu.component', () => {
	it('renders every action id the shared descriptor produces (all capabilities on)', () => {
		// The shared element emits the chosen id; every item the shared descriptor can
		// produce reaches the same `action` output through request().
		expect(menuSource).toContain('presentationViewItems(this.sections(), this.t)');
		expect(menuSource).toContain('this.action.emit(');
		// The component itself declares every capability true, so it always
		// requests the fully-populated descriptor.
		expect(menuSource).toContain('seeAllSlides: true');
		expect(menuSource).toContain('presenterView: true');
		expect(menuSource).toContain('pointerTools: true');
		expect(menuSource).toContain('eraseInk: true');
		expect(menuSource).toContain('blankBlack: true');
		expect(menuSource).toContain('blankWhite: true');
	});

	it('renders through the shared element, above the presentation overlay', () => {
		expect(menuSource).toContain('<pptx-ui-context-menu');
		expect(menuSource).toContain('(menu-close)="closed.emit()"');
		expect(menuSource).toContain('CONTEXT_MENU_PRESENTATION_LAYER');
		expect(menuSource).toContain(`markers: ['data-pptx-presentation-menu']`);
		expect(menuSource).toContain(`this.t('pptx.presentation.menuLabel')`);
		expect(menuSource).not.toContain('HostListener');
	});
});

describe('presentation-overlay right-click gating', () => {
	it('routes the stage contextmenu event through onStageContextMenu, not a bare preventDefault', () => {
		expect(overlaySource).toContain('(contextmenu)="onStageContextMenu($event)"');
	});

	it('swallows the click and never opens the menu when the option is off', () => {
		expect(overlaySource).toContain('if (!this.showMenuOnRightClick())');
	});

	it('renders the menu component gated by contextMenuState', () => {
		expect(overlaySource).toContain('pptx-presentation-context-menu');
		expect(overlaySource).toContain('@if (contextMenuState(); as pos)');
	});

	it('maps every shared action id onto a real handler', () => {
		const sections = getPresentationContextMenuSections({
			seeAllSlides: true,
			presenterView: true,
			pointerTools: true,
			eraseInk: true,
			blankBlack: true,
			blankWhite: true,
		});
		for (const section of sections) {
			for (const item of section.items) {
				expect(overlaySource, `onContextMenuAction is missing a case for "${item.id}"`).toContain(
					`case '${item.id}':`,
				);
			}
		}
	});
});

describe('presentation toolbar popup gating', () => {
	it('never auto-reveals on mousemove when popupToolbarEnabled is false', () => {
		expect(toolbarSource).toContain('if (!this.popupToolbarEnabled())');
	});

	it('the overlay threads Options > Advanced > "Show popup toolbar" into the toolbar', () => {
		expect(overlaySource).toContain('[popupToolbarEnabled]="showPopupToolbar()"');
	});
});
