/**
 * Slide-show right-click menu: shared item structure for every binding.
 *
 * PowerPoint shows a minimal Next/Previous/See All Slides/Presenter View menu
 * (plus pointer tools, blank-screen and End Presentation) when you right-click
 * during a slide show and Options > Advanced > "Show menu on right mouse
 * click" is on. React built the full menu first (`PresentationContextMenu`);
 * this module gives Vue/Angular/Svelte/Vanilla the same item order, grouping
 * and i18n keys instead of each hand-porting React's JSX structure and
 * drifting. A binding maps `getPresentationContextMenuSections` onto its own
 * menu component and wires each action id to whatever handler it already
 * uses for its toolbar's equivalent button; a capability the binding lacks
 * (e.g. no "See All Slides" grid) is simply left out of `capabilities`, and
 * the section/item is omitted rather than rendered disabled.
 */

/** One selectable action in the slide-show right-click menu. */
export type PresentationContextMenuActionId =
	| 'next'
	| 'previous'
	| 'seeAllSlides'
	| 'presenterView'
	| 'pointerArrow'
	| 'pointerPen'
	| 'pointerHighlighter'
	| 'pointerLaser'
	| 'eraseInk'
	| 'blankBlack'
	| 'blankWhite'
	| 'endShow';

export interface PresentationContextMenuItem {
	id: PresentationContextMenuActionId;
	labelKey: string;
}

export interface PresentationContextMenuSection {
	id: string;
	/** i18n key for a small group heading (e.g. "Pointer Options"); omitted for plain groups. */
	headingKey?: string;
	items: PresentationContextMenuItem[];
}

/** What the calling binding can actually do; an unset flag omits its item(s) entirely. */
export interface PresentationContextMenuCapabilities {
	/** PowerPoint's "See All Slides" grid navigator. */
	seeAllSlides?: boolean;
	/** Switch to the presenter console. */
	presenterView?: boolean;
	/** Pointer tool submenu (arrow/pen/highlighter/laser). */
	pointerTools?: boolean;
	/** "Erase All Ink on Slide", shown alongside the pointer tools. */
	eraseInk?: boolean;
	/** Black-screen blank toggle. */
	blankBlack?: boolean;
	/** White-screen blank toggle. */
	blankWhite?: boolean;
}

/**
 * Build the menu's sections for the given capabilities. Next/Previous/End
 * Presentation are always present (every binding can do those); everything
 * else is opt-in via `capabilities` so a binding missing the underlying
 * feature (e.g. Vue and Vanilla have no all-slides grid, Vue's toolbar only
 * supports a black screen) omits that item cleanly instead of rendering a
 * dead control.
 */
export function getPresentationContextMenuSections(
	capabilities: PresentationContextMenuCapabilities,
): PresentationContextMenuSection[] {
	const navItems: PresentationContextMenuItem[] = [
		{ id: 'next', labelKey: 'pptx.presenter.nextSlide' },
		{ id: 'previous', labelKey: 'pptx.presenter.previousSlide' },
	];
	if (capabilities.seeAllSlides) {
		navItems.push({ id: 'seeAllSlides', labelKey: 'pptx.presenter.seeAllSlides' });
	}
	if (capabilities.presenterView) {
		navItems.push({ id: 'presenterView', labelKey: 'pptx.presenter.presenterView' });
	}

	const sections: PresentationContextMenuSection[] = [{ id: 'nav', items: navItems }];

	if (capabilities.pointerTools) {
		const pointerItems: PresentationContextMenuItem[] = [
			{ id: 'pointerArrow', labelKey: 'pptx.presenter.pointerArrow' },
			{ id: 'pointerPen', labelKey: 'pptx.presenter.pointerPen' },
			{ id: 'pointerHighlighter', labelKey: 'pptx.presenter.pointerHighlighter' },
			{ id: 'pointerLaser', labelKey: 'pptx.presentation.laserPointer' },
		];
		if (capabilities.eraseInk) {
			pointerItems.push({ id: 'eraseInk', labelKey: 'pptx.presenter.eraseAllInk' });
		}
		sections.push({
			id: 'pointer',
			headingKey: 'pptx.presentation.pointerTools',
			items: pointerItems,
		});
	}

	if (capabilities.blankBlack || capabilities.blankWhite) {
		const blankItems: PresentationContextMenuItem[] = [];
		if (capabilities.blankBlack) {
			blankItems.push({ id: 'blankBlack', labelKey: 'pptx.presenter.blackScreen' });
		}
		if (capabilities.blankWhite) {
			blankItems.push({ id: 'blankWhite', labelKey: 'pptx.presenter.whiteScreen' });
		}
		sections.push({ id: 'screen', headingKey: 'pptx.presenter.screen', items: blankItems });
	}

	sections.push({
		id: 'end',
		items: [{ id: 'endShow', labelKey: 'pptx.presenter.endPresentation' }],
	});

	return sections;
}
