import {
	ANIMATION_RIBBON_CATEGORIES,
	animationsGated,
	animationsLabel,
	animationPresetLabelKey,
	DEFAULT_MOTION_PATH_PRESET_ID,
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from '../render';
import type {
	RibbonAnimationsCommand,
	RibbonAnimationsIntent,
	RibbonAnimationsViewState,
} from '../render';
import { createAnimationsGalleryView } from './ribbon-animations-gallery-view';
import type { AnimationsGalleryColumn } from './ribbon-animations-gallery-view';
import { createAnimationsTimingView } from './ribbon-animations-timing-view';

type Label = [key: string, fallback: string];
interface CommandSpec {
	id?: string;
	icon: string;
	label: Label;
	title?: Label;
	command?: RibbonAnimationsCommand;
	add?: { group: 'exit' | 'motionPath'; preset: string };
	compact?: boolean;
	placeholder?: boolean;
	/** Always available, even without a selection (the pane is not an element edit). */
	ungated?: boolean;
}

const spec = (value: CommandSpec): CommandSpec => value;
const humanize = (id: string) =>
	id.replace(/([a-z\d])([A-Z])/gu, '$1 $2').replace(/^./u, (c) => c.toUpperCase());

const PREVIEW = spec({
	id: 'animations.preview.preview',
	icon: 'play',
	command: 'preview',
	label: ['pptx.animations.preview', 'Preview'],
	title: ['pptx.animations.previewTooltip', 'Preview animation on selected element'],
});
const EXIT = spec({
	id: 'animations.advancedAnimation.addAnimation',
	icon: 'star',
	add: { group: 'exit', preset: 'fadeOut' },
	label: ['pptx.animations.exitEffects', 'Exit Effects'],
});
const PATH = spec({
	icon: 'moveRight',
	// One-click default path (Lines: Right), not an entrance preset.
	add: { group: 'motionPath', preset: DEFAULT_MOTION_PATH_PRESET_ID },
	label: ['pptx.animations.pathAnimation', 'Path Animation'],
});
const OPTIONS = spec({
	id: 'animations.animation.effectOptions',
	icon: 'sparkles',
	command: 'effectOptions',
	compact: true,
	label: ['pptx.animations.effectOptions', 'Effect Options'],
});
const PANE = spec({
	id: 'animations.advancedAnimation.animationPane',
	icon: 'panelRight',
	command: 'animationPane',
	compact: true,
	ungated: true,
	label: ['pptx.animations.animationPanel', 'Animation Panel'],
	title: ['pptx.animations.openPanelTooltip', 'Open Animation Panel in Inspector'],
});
const TRIGGER = spec({
	id: 'animations.advancedAnimation.trigger',
	icon: 'pointerClick',
	command: 'trigger',
	compact: true,
	label: ['pptx.animations.trigger', 'Trigger'],
});
const PAINTER = spec({
	id: 'animations.advancedAnimation.animationPainter',
	icon: 'paintbrush',
	compact: true,
	placeholder: true,
	label: ['pptx.animations.painter', 'Animation Painter'],
});
const REMOVE = spec({
	id: 'animations.advancedAnimation.remove',
	icon: 'trash',
	command: 'remove',
	label: ['pptx.animations.remove', 'Remove'],
	title: ['pptx.animations.removeTooltip', 'Remove animation from selected element'],
});

const PRESET_COLUMNS: AnimationsGalleryColumn[] = ANIMATION_RIBBON_CATEGORIES.map((category) => ({
	key: category.group,
	labelKey: category.labelKey,
	fallback: category.fallback,
	tone: category.group,
	items: category.presets.map((preset) => ({
		value: preset,
		labelKey: animationPresetLabelKey(preset),
		fallback: humanize(preset),
	})),
}));
const PATH_COLUMNS: AnimationsGalleryColumn[] = MOTION_PATH_FAMILIES.map((family) => ({
	key: family,
	labelKey: motionPathFamilyLabelKey(family),
	fallback: humanize(family),
	tone: 'path',
	items: motionPathPresetsByFamily(family).map((preset) => ({
		value: preset.id,
		labelKey: motionPathPresetLabelKey(preset.id),
		fallback: humanize(preset.id),
	})),
}));
const CAPTIONS: Record<string, Label> = {
	'animations.preview': ['pptx.animations.preview', 'Preview'],
	'animations.animation': ['pptx.animations.animation', 'Animation'],
	'animations.motionPath': ['pptx.animation.motionPath', 'Motion Paths'],
	'animations.advancedAnimation': ['pptx.animations.advanced', 'Advanced Animation'],
	'animations.timing': ['pptx.animations.timing', 'Timing'],
};

/** All Animations markup lives here. The host only reflects state and routes native intents. */
export function createRibbonAnimationsView(
	doc: Document,
	request: (intent: RibbonAnimationsIntent) => void,
) {
	const groups = new Map<string, HTMLElement>();
	const group = (id: string, ...children: HTMLElement[]) => {
		const el = doc.createElement('pptx-ui-ribbon-group');
		el.dataset.ribbonGroup = id;
		el.append(...children);
		groups.set(id, el);
		return el;
	};
	const stack = (...children: HTMLElement[]) => {
		const el = doc.createElement('div');
		el.className = 'stack';
		el.append(...children);
		return el;
	};
	const dispatch = (item: CommandSpec) => {
		if (item.command) {
			request({ kind: 'command', value: item.command });
		} else if (item.add) {
			request({ kind: 'add', group: item.add.group, preset: item.add.preset });
		}
	};
	const commands: { el: HTMLElement; spec: CommandSpec }[] = [];
	const command = (item: CommandSpec) => {
		const el = doc.createElement('pptx-ui-ribbon-command');
		if (item.id) {
			el.dataset.ribbonControl = item.id;
		}
		el.setAttribute('icon', item.icon);
		el.toggleAttribute('compact', Boolean(item.compact));
		el.addEventListener('command-request', (event) => {
			event.stopPropagation();
			dispatch(item);
		});
		// Path Animation has no customization id, so the command never emits its own request.
		el.addEventListener('click', () => {
			if (!item.id && !el.hasAttribute('disabled')) {
				dispatch(item);
			}
		});
		commands.push({ el, spec: item });
		return el;
	};
	const presets = createAnimationsGalleryView(
		doc,
		'animations.animation.gallery',
		['pptx.animations.galleryAria', 'Animation effects: Entrance, Emphasis, and Exit'],
		PRESET_COLUMNS,
		(key, preset) =>
			request({ kind: 'add', group: key as 'entrance' | 'emphasis' | 'exit', preset }),
	);
	const paths = createAnimationsGalleryView(
		doc,
		'animations.motionPath.gallery',
		[
			'pptx.animations.motionPathGalleryAria',
			'Motion Paths: Lines, Arcs, Turns, Shapes, and Loops',
		],
		PATH_COLUMNS,
		(_key, preset) => request({ kind: 'add', group: 'motionPath', preset }),
	);
	const timing = createAnimationsTimingView(doc);
	const root: HTMLElement[] = [
		group('animations.preview', command(PREVIEW)),
		group('animations.animation', presets.el),
		group('animations.motionPath', paths.el),
		group(
			'animations.advancedAnimation',
			command(EXIT),
			command(PATH),
			stack(command(OPTIONS), command(PANE)),
			stack(command(TRIGGER), command(PAINTER)),
			command(REMOVE),
		),
		group('animations.timing', timing.el),
	];
	const sync = (state: RibbonAnimationsViewState) => {
		const text = (label: Label) => animationsLabel(state, label[0], label[1]);
		for (const [id, el] of groups) {
			el.setAttribute('label', text(CAPTIONS[id]));
		}
		const gated = animationsGated(state);
		for (const { el, spec: item } of commands) {
			el.setAttribute('label', text(item.label));
			el.setAttribute('title', text(item.title ?? item.label));
			el.toggleAttribute('disabled', Boolean(item.placeholder) || (gated && !item.ungated));
			if (item.command === 'animationPane') {
				el.setAttribute('pressed', String(Boolean(state.paneOpen)));
			}
			const active =
				item.command === 'animationPane'
					? state.paneOpen
					: item.command === 'preview'
						? state.previewActive
						: false;
			el.toggleAttribute('active', Boolean(active));
		}
		presets.sync(state);
		paths.sync(state);
		timing.sync(state);
	};
	return { groups: root, sync };
}
