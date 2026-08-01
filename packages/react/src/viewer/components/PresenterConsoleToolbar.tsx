import type {
	PresentationPointerTool,
	PresentationSnapshot,
	PresenterControl,
} from 'pptx-viewer-shared';
import { PRESENTER_CONSOLE_CLASSES, PRESENTER_CONSOLE_CONTROLS } from 'pptx-viewer-shared';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import {
	LuArrowLeftRight,
	LuCaptions,
	LuCirclePause,
	LuCirclePlay,
	LuEraser,
	LuGrid2X2,
	LuHighlighter,
	LuMonitor,
	LuMonitorOff,
	LuMousePointer2,
	LuPenTool,
	LuRotateCcw,
	LuScan,
	LuX,
	LuZoomIn,
	LuZoomOut,
} from 'react-icons/lu';

export interface PresenterConsoleToolbarProps {
	snapshot: PresentationSnapshot;
	audienceOpen: boolean;
	onToggleAudience: () => void;
	onSwapDisplays: () => void;
	onToggleTimer: () => void;
	onResetTimer: () => void;
	onShowSlides: () => void;
	onStepZoom: (direction: 1 | -1) => void;
	onResetZoom: () => void;
	onBlackout: (value: PresentationSnapshot['blackout']) => void;
	onPointerTool: (tool: PresentationPointerTool) => void;
	onToggleSubtitles: () => void;
	onExit: () => void;
}

/**
 * The inventory names its icons in kebab-case so the four other bindings can map
 * them onto their own icon sets; this is React's half of that contract, and the
 * only place a `Lu*` component is chosen for the presenter console.
 */
const CONSOLE_ICONS: Record<string, IconType> = {
	'arrow-left-right': LuArrowLeftRight,
	captions: LuCaptions,
	'circle-pause': LuCirclePause,
	'circle-play': LuCirclePlay,
	eraser: LuEraser,
	'grid-2x2': LuGrid2X2,
	highlighter: LuHighlighter,
	monitor: LuMonitor,
	'monitor-off': LuMonitorOff,
	'mouse-pointer-2': LuMousePointer2,
	'pen-tool': LuPenTool,
	'rotate-ccw': LuRotateCcw,
	scan: LuScan,
	x: LuX,
	'zoom-in': LuZoomIn,
	'zoom-out': LuZoomOut,
};

/** The four strip slots that select an annotation tool, by control id. */
const POINTER_TOOLS: Record<string, PresentationPointerTool> = {
	laser: 'laser',
	pen: 'pen',
	highlighter: 'highlighter',
	eraser: 'eraser',
};

/** What the console knows about one interactive slot at this moment. */
interface ConsoleSlotState {
	/** Drives the active styling, `aria-pressed`, and the active icon/label. */
	active: boolean;
	onClick: () => void;
	disabled?: boolean;
}

/**
 * Resolve a slot's behaviour from the snapshot.
 *
 * Kept beside the inventory rather than folded into it because the handlers are
 * the one genuinely per-binding part of the strip: everything else (order, ids,
 * label keys, icons, classes) comes from `pptx-viewer-shared`.
 */
function slotState(
	control: PresenterControl,
	props: PresenterConsoleToolbarProps,
): ConsoleSlotState {
	const snapshot = props.snapshot;
	const pointerTool = snapshot.pointer?.tool ?? 'none';
	const tool = POINTER_TOOLS[control.id];
	if (tool) {
		return {
			active: pointerTool === tool,
			onClick: () => props.onPointerTool(pointerTool === tool ? 'none' : tool),
		};
	}
	switch (control.id) {
		case 'timer-toggle':
			// "Active" here only picks the resume glyph; the slot is a button, so it
			// carries no `aria-pressed`.
			return { active: Boolean(snapshot.paused), onClick: props.onToggleTimer };
		case 'timer-reset':
			return { active: false, onClick: props.onResetTimer };
		case 'all-slides':
			return { active: false, onClick: props.onShowSlides };
		case 'zoom-in':
			return { active: (snapshot.zoom?.scale ?? 1) > 1, onClick: () => props.onStepZoom(1) };
		case 'zoom-out':
			return { active: false, onClick: () => props.onStepZoom(-1) };
		case 'zoom-reset':
			return { active: false, onClick: props.onResetZoom };
		case 'blackout-black':
			return {
				active: snapshot.blackout === 'black',
				onClick: () => props.onBlackout(snapshot.blackout === 'black' ? 'none' : 'black'),
			};
		case 'blackout-white':
			return {
				active: snapshot.blackout === 'white',
				onClick: () => props.onBlackout(snapshot.blackout === 'white' ? 'none' : 'white'),
			};
		case 'captions':
			return { active: Boolean(snapshot.subtitlesVisible), onClick: props.onToggleSubtitles };
		case 'audience':
			return { active: props.audienceOpen, onClick: props.onToggleAudience };
		case 'swap-displays':
			return { active: false, onClick: props.onSwapDisplays, disabled: !props.audienceOpen };
		case 'end':
			return { active: false, onClick: props.onExit };
		default:
			// A slot added to the shared inventory but not wired here renders inert
			// rather than firing someone else's handler; the strip's parity test
			// names every slot, so it shows up as a missing behaviour, not a wrong one.
			return { active: false, onClick: () => undefined };
	}
}

/**
 * PowerPoint's presenter-console strip.
 *
 * Rendered from the shared inventory rather than hand-written, because the
 * hand-written version hard-coded English `title` attributes and no accessible
 * names at all: the black-screen switch announced itself as the letter "B".
 */
export function PresenterConsoleToolbar(props: PresenterConsoleToolbarProps): ReactElement {
	const { t } = useTranslation();
	return (
		<div className={PRESENTER_CONSOLE_CLASSES.strip} data-pptx-presenter-toolbar>
			{PRESENTER_CONSOLE_CONTROLS.map((control) => {
				if (control.kind === 'divider' || control.kind === 'spacer') {
					return (
						<span
							key={control.id}
							data-pptx-presenter-control={control.id}
							className={
								control.kind === 'divider'
									? PRESENTER_CONSOLE_CLASSES.divider
									: PRESENTER_CONSOLE_CLASSES.spacer
							}
						/>
					);
				}
				const state = slotState(control, props);
				const labelKey =
					state.active && control.activeLabelKey ? control.activeLabelKey : control.labelKey;
				const iconName = state.active && control.activeIcon ? control.activeIcon : control.icon;
				const Icon = iconName === undefined ? undefined : CONSOLE_ICONS[iconName];
				const label = labelKey === undefined ? undefined : t(labelKey);
				return (
					<button
						key={control.id}
						type='button'
						data-pptx-presenter-control={control.id}
						className={
							state.active
								? PRESENTER_CONSOLE_CLASSES.controlActive
								: PRESENTER_CONSOLE_CLASSES.control
						}
						onClick={state.onClick}
						disabled={state.disabled}
						aria-label={label}
						title={label}
						aria-pressed={control.kind === 'toggle' ? state.active : undefined}
					>
						{Icon ? <Icon /> : null}
						{control.glyph}
					</button>
				);
			})}
		</div>
	);
}
