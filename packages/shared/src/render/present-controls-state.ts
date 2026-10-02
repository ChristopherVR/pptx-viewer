/**
 * Shared models for the slide-show chrome (#386): the floating show toolbar
 * (`pptx-ui-present-toolbar`) and the presenter console strip
 * (`pptx-ui-presenter-console`). Both were hand-built five times from the same
 * inventories (`PRESENT_TOOLBAR_CONTROLS`, `PRESENTER_CONSOLE_CONTROLS`). The
 * elements own markup, the colour palettes, the elapsed readout and gating; hosts
 * own every effect (navigation, tools, blackout, zoom, the audience window).
 */
import type { ChromeTranslate } from './chrome-controls-state';
import type { PresentationBlackout } from './presentation-blackboard';
import { isBlackboardActive } from './presentation-blackboard';
import type { PresentationPointerTool, PresentationSnapshot } from './presentation-session-types';

// ---------------------------------------------------------------------------
// Show toolbar
// ---------------------------------------------------------------------------

export type PresentToolbarTool = Exclude<PresentationPointerTool, 'none'>;

export interface PresentToolbarViewState {
	/** Zero-based slide on screen. */
	current: number;
	total: number;
	/** The armed annotation tool; `none` leaves every tool unpressed. */
	tool: PresentationPointerTool;
	penColor: string;
	highlighterColor: string;
	hasAnnotations: boolean;
	/** With the pen, marks the Blackboard toggle active (`isBlackboardActive`). */
	blackout: PresentationBlackout;
	/** Show the presenter-view toggle (default false). */
	presenterViewVisible?: boolean;
	presenterViewActive?: boolean;
	/** Epoch ms the show started. The element ticks the readout; null shows 00:00. */
	startTime: number | null;
	translate?: ChromeTranslate;
}

export type PresentToolbarIntent =
	| { id: 'move'; direction: 1 | -1 }
	/** The clicked tool; the host decides whether re-selecting it disarms it. */
	| { id: 'tool'; tool: PresentToolbarTool }
	/** A swatch pick; the host sets the colour and arms that tool. */
	| { id: 'color'; tool: 'pen' | 'highlighter'; color: string }
	| { id: 'blackboard' }
	| { id: 'clear' }
	| { id: 'presenterView' }
	| { id: 'end' };

/** Whether the Blackboard toggle reads as pressed for a toolbar state. */
export function presentToolbarBlackboardActive(
	state: Pick<PresentToolbarViewState, 'blackout' | 'tool'>,
): boolean {
	return isBlackboardActive(state.blackout, state.tool);
}

// ---------------------------------------------------------------------------
// Presenter console strip
// ---------------------------------------------------------------------------

export interface PresenterConsoleViewState {
	/** Ids of toggles that read as on (and the resume / close-window variants). */
	active: readonly string[];
	/** Ids of controls that are disabled. */
	disabled: readonly string[];
	translate?: ChromeTranslate;
}

export interface PresenterConsoleIntent {
	/** A `PRESENTER_CONSOLE_CONTROLS` id. */
	id: string;
}

const POINTER_TOOL_IDS = ['laser', 'pen', 'highlighter', 'eraser'] as const;

/**
 * Which console slots are on or disabled for a snapshot. One rule for all five
 * bindings: Zoom in reads active while zoomed past 100%, the blackout and tool
 * toggles follow the snapshot, and Swap displays needs the audience window.
 */
export function presenterConsoleViewState(
	snapshot: PresentationSnapshot,
	audienceOpen: boolean,
): Pick<PresenterConsoleViewState, 'active' | 'disabled'> {
	const active: string[] = [];
	const tool = snapshot.pointer?.tool ?? 'none';
	if ((POINTER_TOOL_IDS as readonly string[]).includes(tool)) {
		active.push(tool);
	}
	if (snapshot.paused) {
		active.push('timer-toggle');
	}
	if ((snapshot.zoom?.scale ?? 1) > 1) {
		active.push('zoom-in');
	}
	if (snapshot.blackout === 'black') {
		active.push('blackout-black');
	}
	if (snapshot.blackout === 'white') {
		active.push('blackout-white');
	}
	if (snapshot.subtitlesVisible) {
		active.push('captions');
	}
	if (audienceOpen) {
		active.push('audience');
	}
	return { active, disabled: audienceOpen ? [] : ['swap-displays'] };
}

/** What activating a console slot asks the host to do. */
export type PresenterConsoleAction =
	| {
			kind:
				| 'timer-toggle'
				| 'timer-reset'
				| 'all-slides'
				| 'zoom-reset'
				| 'captions'
				| 'audience'
				| 'swap-displays'
				| 'end';
	  }
	| { kind: 'zoom'; direction: 1 | -1 }
	/** The tool to arm, or `none` when the active tool was clicked again. */
	| { kind: 'pointer'; tool: PresentationPointerTool }
	/** The blackout to apply, or `none` when the active one was clicked again. */
	| { kind: 'blackout'; value: PresentationBlackout };

/** Resolve a console slot activation against the snapshot; null for an unknown id. */
export function presenterConsoleAction(
	id: string,
	snapshot: PresentationSnapshot,
): PresenterConsoleAction | null {
	const tool = snapshot.pointer?.tool ?? 'none';
	switch (id) {
		case 'laser':
		case 'pen':
		case 'highlighter':
		case 'eraser':
			return { kind: 'pointer', tool: tool === id ? 'none' : id };
		case 'blackout-black':
			return { kind: 'blackout', value: snapshot.blackout === 'black' ? 'none' : 'black' };
		case 'blackout-white':
			return { kind: 'blackout', value: snapshot.blackout === 'white' ? 'none' : 'white' };
		case 'zoom-in':
			return { kind: 'zoom', direction: 1 };
		case 'zoom-out':
			return { kind: 'zoom', direction: -1 };
		case 'timer-toggle':
		case 'timer-reset':
		case 'all-slides':
		case 'zoom-reset':
		case 'captions':
		case 'audience':
		case 'swap-displays':
		case 'end':
			return { kind: id };
		default:
			return null;
	}
}
