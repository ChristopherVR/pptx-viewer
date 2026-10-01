export type RibbonDrawTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

export interface RibbonDrawViewState {
	tool: RibbonDrawTool;
	color: string;
	width: number;
	editable: boolean;
	recentColors?: readonly string[];
	translate?: (key: string) => string;
}

export type RibbonDrawIntent =
	| { kind: 'tool'; value: RibbonDrawTool }
	| { kind: 'width'; value: number }
	| { kind: 'color'; value: string; committed: boolean };

export const DRAW_RIBBON_TOOLS: readonly {
	id: RibbonDrawTool;
	icon: string;
	key: string;
	fallback: string;
}[] = [
	{ id: 'select', icon: 'cursor', key: 'pptx.ribbon.tool.select', fallback: 'Select' },
	{ id: 'pen', icon: 'pencil', key: 'pptx.ribbon.tool.pen', fallback: 'Pen' },
	{
		id: 'highlighter',
		icon: 'highlighter',
		key: 'pptx.ribbon.tool.highlighter',
		fallback: 'Highlighter',
	},
	{ id: 'eraser', icon: 'eraser', key: 'pptx.ribbon.tool.eraser', fallback: 'Eraser' },
	{ id: 'freeform', icon: 'spline', key: 'pptx.ribbon.tool.freeform', fallback: 'Freeform' },
];

export const DRAW_WIDTH_PRESETS = [1, 2, 3, 4, 6, 8, 12, 16] as const;

export function drawLabel(state: RibbonDrawViewState, key: string, fallback: string): string {
	const value = state.translate?.(key);
	return value && value !== key ? value : fallback;
}

/** Reject malformed programmatic intents as well as disabled pointer/keyboard picks. */
export function canRequestDraw(state: RibbonDrawViewState, intent: RibbonDrawIntent): boolean {
	if (!state.editable) {
		return false;
	}
	switch (intent.kind) {
		case 'tool':
			return DRAW_RIBBON_TOOLS.some((tool) => tool.id === intent.value);
		case 'width':
			return Number.isFinite(intent.value) && intent.value >= 1 && intent.value <= 16;
		case 'color':
			return /^#[\da-f]{6}$/iu.test(intent.value);
	}
}
