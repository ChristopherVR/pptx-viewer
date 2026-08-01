import { PRESENTER_CONSOLE_CONTROLS } from 'pptx-viewer-shared';
import type { PresentationPointerTool, PresentationSnapshot } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createIcon } from '../ui/icons';
import type { IconName } from '../ui/icons';

/**
 * The presenter console's control strip, built from the shared inventory.
 *
 * Every label is a translated `aria-label` + `title`, never bare text. The old
 * vanilla console wrote English `textContent` into fourteen buttons, which made
 * the console untranslatable and left the two blackout switches announcing
 * themselves to a screen reader as the letters "B" and "W".
 *
 * @module viewer/presenter/presenter-strip
 */

/** Everything the strip needs to read and drive. */
export interface PresenterStripOptions {
	doc: Document;
	t: Translator;
	getSnapshot: () => PresentationSnapshot;
	/** Whether the audience display window is currently open. */
	isAudienceOpen: () => boolean;
	toggleTimer: () => void;
	resetTimer: () => void;
	showAllSlides: () => void;
	stepZoom: (direction: 1 | -1) => void;
	resetZoom: () => void;
	setPointerTool: (tool: PresentationPointerTool) => void;
	setBlackout: (value: 'black' | 'white') => void;
	toggleCaptions: () => void;
	toggleAudience: () => void;
	swapDisplays: () => void;
	end: () => void;
}

/** A mounted strip: its root node plus a refresh hook for snapshot changes. */
export interface PresenterStrip {
	root: HTMLElement;
	/** Re-read the snapshot and repaint pressed states and swapped labels. */
	sync: () => void;
}

/**
 * Map the shared inventory's kebab-case lucide names onto this binding's own
 * inline icon set. A lookup rather than a cast so a name the vanilla icon table
 * does not carry fails at the type level instead of rendering an empty square.
 */
const ICONS: Record<string, IconName> = {
	'circle-pause': 'circle-pause',
	'circle-play': 'circle-play',
	'rotate-ccw': 'rotate-ccw',
	'grid-2x2': 'grid-2x2',
	'zoom-in': 'zoom-in',
	'zoom-out': 'zoom-out',
	scan: 'scan',
	'mouse-pointer-2': 'mouse-pointer-2',
	'pen-tool': 'pen',
	highlighter: 'highlighter',
	eraser: 'eraser',
	captions: 'captions',
	monitor: 'monitor',
	'monitor-off': 'monitor-off',
	'arrow-left-right': 'arrow-left-right',
	x: 'close',
};

/** The pointer tools the strip toggles, by control id. */
const POINTER_TOOLS: Record<string, PresentationPointerTool> = {
	laser: 'laser',
	pen: 'pen',
	highlighter: 'highlighter',
	eraser: 'eraser',
};

/** Whether a control should currently render as pressed. */
function isActive(id: string, snapshot: PresentationSnapshot, audienceOpen: boolean): boolean {
	const tool = POINTER_TOOLS[id];
	if (tool) {
		return (snapshot.pointer?.tool ?? 'none') === tool;
	}
	switch (id) {
		case 'blackout-black':
			return snapshot.blackout === 'black';
		case 'blackout-white':
			return snapshot.blackout === 'white';
		case 'captions':
			return snapshot.subtitlesVisible === true;
		case 'audience':
			return audienceOpen;
		default:
			return false;
	}
}

/** Resolve a control's click handler from the option bag. */
function handlerFor(id: string, options: PresenterStripOptions): (() => void) | undefined {
	const tool = POINTER_TOOLS[id];
	if (tool) {
		return () => {
			const current = options.getSnapshot().pointer?.tool ?? 'none';
			options.setPointerTool(current === tool ? 'none' : tool);
		};
	}
	const handlers: Record<string, () => void> = {
		'timer-toggle': options.toggleTimer,
		'timer-reset': options.resetTimer,
		'all-slides': options.showAllSlides,
		'zoom-in': () => options.stepZoom(1),
		'zoom-out': () => options.stepZoom(-1),
		'zoom-reset': options.resetZoom,
		'blackout-black': () => options.setBlackout('black'),
		'blackout-white': () => options.setBlackout('white'),
		captions: options.toggleCaptions,
		audience: options.toggleAudience,
		'swap-displays': options.swapDisplays,
		end: options.end,
	};
	return handlers[id];
}

export function buildPresenterStrip(options: PresenterStripOptions): PresenterStrip {
	const { doc, t } = options;
	const root = doc.createElement('div');
	root.className = 'pptxv-presenter-strip';
	/** Per-control refresh closures, run by {@link PresenterStrip.sync}. */
	const refreshers: Array<() => void> = [];

	for (const control of PRESENTER_CONSOLE_CONTROLS) {
		if (control.kind === 'divider') {
			const divider = doc.createElement('span');
			divider.className = 'pptxv-presenter-strip-divider';
			divider.setAttribute('aria-hidden', 'true');
			root.append(divider);
			continue;
		}
		if (control.kind === 'spacer') {
			const spacer = doc.createElement('span');
			spacer.className = 'pptxv-presenter-strip-spacer';
			root.append(spacer);
			continue;
		}

		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'pptxv-presenter-strip-btn';
		button.dataset.pptxPresenterControl = control.id;
		const handler = handlerFor(control.id, options);
		if (handler) {
			button.addEventListener('click', handler);
		}
		// The B / W glyphs are decoration, not a name: the aria-label below is
		// what a screen reader announces.
		if (control.glyph) {
			const glyph = doc.createElement('span');
			glyph.textContent = control.glyph;
			glyph.setAttribute('aria-hidden', 'true');
			button.append(glyph);
		}
		const iconHost = doc.createElement('span');
		iconHost.className = 'pptxv-presenter-strip-icon';
		iconHost.setAttribute('aria-hidden', 'true');
		button.append(iconHost);

		const refresh = (): void => {
			const snapshot = options.getSnapshot();
			const active = isActive(control.id, snapshot, options.isAudienceOpen());
			// Only the audience slot and the timer toggle genuinely rename or
			// re-icon themselves; everything else keeps one name in both states.
			const paused = snapshot.paused === true;
			const useActive = control.id === 'timer-toggle' ? paused : active;
			const labelKey =
				useActive && control.activeLabelKey ? control.activeLabelKey : control.labelKey;
			const label = labelKey ? t(labelKey) : '';
			button.setAttribute('aria-label', label);
			button.title = label;
			if (control.kind === 'toggle') {
				button.setAttribute('aria-pressed', String(active));
			}
			button.classList.toggle('is-active', active);
			const iconName = useActive && control.activeIcon ? control.activeIcon : control.icon;
			iconHost.replaceChildren();
			const resolved = iconName === undefined ? undefined : ICONS[iconName];
			if (resolved) {
				iconHost.append(createIcon(doc, resolved));
			}
		};
		refresh();
		refreshers.push(refresh);
		root.append(button);
	}

	return {
		root,
		sync: () => {
			for (const refresh of refreshers) {
				refresh();
			}
		},
	};
}
