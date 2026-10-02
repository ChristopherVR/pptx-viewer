import {
	formatElapsed,
	formatSlideCounter,
	HIGHLIGHTER_COLORS,
	PEN_COLORS,
	PRESENT_TOOLBAR_CONTROLS,
	presentToolbarBlackboardActive,
} from '../render';
import type {
	ChromeTranslate,
	PresentToolbarIntent,
	PresentToolbarTool,
	PresentToolbarViewState,
} from '../render';
import { createLucideIcon } from './lucide-icon';
import type { LucideIconName } from './lucide-icon';

type PaletteTool = 'pen' | 'highlighter';
const PALETTES: Record<PaletteTool, readonly string[]> = {
	pen: PEN_COLORS,
	highlighter: HIGHLIGHTER_COLORS,
};
const identity: ChromeTranslate = (key) => key;

export interface PresentToolbarView {
	bar: HTMLElement;
	render(state: PresentToolbarViewState): void;
	/** Update the elapsed readout; ticks call this once a second. */
	renderElapsed(startTime: number | null): void;
	closePalettes(): void;
}

/** Build the show toolbar DOM once from the shared inventory; `render` only patches. */
export function createPresentToolbarView(
	doc: Document,
	emit: (intent: PresentToolbarIntent) => void,
): PresentToolbarView {
	const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '') => {
		const node = doc.createElement(tag);
		node.className = className;
		return node;
	};
	const buttons = new Map<string, HTMLButtonElement>();
	const labelled: [HTMLElement, string][] = [];
	const bar = el('div', 'bar');
	bar.setAttribute('part', 'bar');
	// A click on the bar must not advance the slide underneath it.
	bar.addEventListener('click', (event) => event.stopPropagation());
	let counter!: HTMLElement;
	let elapsed!: HTMLElement;
	const bars = new Map<PaletteTool, HTMLElement>();
	const palettes = new Map<PaletteTool, { box: HTMLElement; swatches: HTMLButtonElement[] }>();
	let open: PaletteTool | null = null;
	const syncPalettes = (): void => {
		for (const [tool, { box }] of palettes) {
			box.hidden = open !== tool;
		}
	};
	const closePalettes = (): void => {
		open = null;
		syncPalettes();
	};
	const togglePalette = (tool: PaletteTool): void => {
		open = open === tool ? null : tool;
		syncPalettes();
	};
	const button = (id: string, className: string, icon: LucideIconName, labelKey: string) => {
		const node = el('button', className);
		node.type = 'button';
		node.dataset.pptxPresentControl = id;
		node.append(createLucideIcon(doc, icon));
		buttons.set(id, node);
		labelled.push([node, labelKey]);
		return node;
	};
	let group: HTMLElement | null = null;
	for (const control of PRESENT_TOOLBAR_CONTROLS) {
		const icon = control.icon as LucideIconName | undefined;
		const labelKey = control.labelKey ?? '';
		let node: HTMLElement;
		if (control.kind === 'divider') {
			node = el('div', 'divider');
			node.dataset.pptxPresentControl = control.id;
		} else if (control.kind === 'counter') {
			node = counter = el('span', 'counter');
			node.dataset.pptxPresentControl = control.id;
		} else if (control.kind === 'timer') {
			node = el('div', 'timer');
			node.dataset.pptxPresentControl = control.id;
			elapsed = el('span');
			node.append(createLucideIcon(doc, icon as LucideIconName), elapsed);
			labelled.push([node, labelKey]);
		} else {
			const id = control.id;
			node = button(id, control.kind === 'caret' ? 'caret' : id, icon as LucideIconName, labelKey);
			if (id === 'previous' || id === 'next') {
				node.addEventListener('click', () =>
					emit({ id: 'move', direction: id === 'next' ? 1 : -1 }),
				);
			} else if (id === 'pen' || id === 'highlighter') {
				const tool: PaletteTool = id;
				const swatch = el('span', 'swatch-bar');
				bars.set(tool, swatch);
				node.append(swatch);
				node.addEventListener('click', () => {
					closePalettes();
					emit({ id: 'tool', tool });
				});
				node.addEventListener('contextmenu', (event) => {
					event.preventDefault();
					togglePalette(tool);
				});
			} else if (id === 'pen-color' || id === 'highlighter-color') {
				const tool: PaletteTool = id === 'pen-color' ? 'pen' : 'highlighter';
				node.addEventListener('click', () => togglePalette(tool));
			} else if (id === 'laser' || id === 'eraser') {
				node.addEventListener('click', () => {
					closePalettes();
					emit({ id: 'tool', tool: id satisfies PresentToolbarTool });
				});
			} else if (id === 'blackboard') {
				node.addEventListener('click', () => {
					closePalettes();
					emit({ id: 'blackboard' });
				});
			} else if (id === 'clear') {
				node.addEventListener('click', () => emit({ id: 'clear' }));
			} else if (id === 'presenter-view') {
				node.addEventListener('click', () => emit({ id: 'presenterView' }));
			} else if (id === 'end') {
				node.addEventListener('click', () => emit({ id: 'end' }));
			}
		}
		if (control.id === 'pen' || control.id === 'highlighter') {
			group = el('div', 'group');
			group.append(node);
			bar.append(group);
		} else if ((control.id === 'pen-color' || control.id === 'highlighter-color') && group) {
			const tool: PaletteTool = control.id === 'pen-color' ? 'pen' : 'highlighter';
			const box = el('div', 'palette');
			box.hidden = true;
			const swatches = PALETTES[tool].map((color) => {
				const swatch = el('button', 'swatch');
				swatch.type = 'button';
				swatch.dataset.color = color;
				swatch.style.backgroundColor = color;
				swatch.addEventListener('click', () => {
					closePalettes();
					emit({ id: 'color', tool, color });
				});
				return swatch;
			});
			box.append(...swatches);
			palettes.set(tool, { box, swatches });
			group.append(node, box);
			group = null;
		} else {
			bar.append(node);
		}
	}
	const get = (id: string) => buttons.get(id)!;
	const renderElapsed = (startTime: number | null): void => {
		elapsed.textContent = formatElapsed(startTime ? Math.max(0, Date.now() - startTime) : 0);
	};
	return {
		bar,
		closePalettes,
		renderElapsed,
		render(state) {
			const t = state.translate ?? identity;
			for (const [node, key] of labelled) {
				const text = t(key);
				node.setAttribute('aria-label', text);
				node.title = text;
			}
			counter.textContent = formatSlideCounter(state.current, state.total);
			get('previous').disabled = state.current <= 0;
			get('next').disabled = state.current >= state.total - 1;
			get('clear').disabled = !state.hasAnnotations;
			const press = (id: string, on: boolean) => get(id).setAttribute('aria-pressed', String(on));
			for (const tool of ['laser', 'pen', 'highlighter', 'eraser'] as const) {
				press(tool, state.tool === tool);
			}
			press('blackboard', presentToolbarBlackboardActive(state));
			press('presenter-view', state.presenterViewActive === true);
			// Absent (not merely hidden) when the host cannot open a presenter view.
			const presenterView = get('presenter-view');
			if (state.presenterViewVisible !== true) {
				presenterView.remove();
			} else if (!presenterView.isConnected) {
				bar.insertBefore(presenterView, get('end'));
			}
			bars.get('pen')!.style.backgroundColor = state.penColor;
			bars.get('highlighter')!.style.backgroundColor = state.highlighterColor;
			for (const [tool, { swatches }] of palettes) {
				const current = tool === 'pen' ? state.penColor : state.highlighterColor;
				for (const swatch of swatches) {
					swatch.setAttribute('aria-pressed', String(swatch.dataset.color === current));
					swatch.setAttribute(
						'aria-label',
						t(
							tool === 'pen'
								? 'pptx.presentationToolbar.penColorValue'
								: 'pptx.presentationToolbar.highlighterColorValue',
							{ color: swatch.dataset.color ?? '' },
						),
					);
				}
			}
			renderElapsed(state.startTime);
		},
	};
}
