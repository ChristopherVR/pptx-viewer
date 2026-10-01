export type RibbonViewOption =
	| 'showRulers'
	| 'showGrid'
	| 'showGuides'
	| 'snapToGrid'
	| 'snapToShape'
	| 'templateEditing';

export type RibbonViewCommand =
	| 'normal'
	| 'slideSorter'
	| 'outline'
	| 'readingView'
	| 'slideMaster'
	| 'selectionPane'
	| 'eyedropper'
	| 'zoomToFit';

/** Controlled View tab state. Native viewers own the values and every side effect. */
export interface RibbonViewState {
	editable: boolean;
	showRulers: boolean;
	showGrid: boolean;
	showGuides: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	templateEditing: boolean;
	selectionPaneOpen?: boolean;
	eyedropperActive?: boolean;
	/** Hosts without these capabilities hide the control instead of showing a dead one. */
	selectionPaneAvailable?: boolean;
	eyedropperAvailable?: boolean;
	zoomAvailable?: boolean;
	translate?: (key: string) => string;
}

export type RibbonViewIntent =
	| { kind: 'command'; value: RibbonViewCommand }
	| { kind: 'option'; value: RibbonViewOption; enabled: boolean }
	| { kind: 'guide'; axis: 'h' | 'v' };

export const VIEW_EDITABLE_COMMANDS: readonly RibbonViewCommand[] = ['slideMaster', 'eyedropper'];
const COMMANDS: readonly RibbonViewCommand[] = [
	'normal',
	'slideSorter',
	'outline',
	'readingView',
	'slideMaster',
	'selectionPane',
	'eyedropper',
	'zoomToFit',
];
const OPTIONS: readonly RibbonViewOption[] = [
	'showRulers',
	'showGrid',
	'showGuides',
	'snapToGrid',
	'snapToShape',
	'templateEditing',
];

export function viewLabel(state: RibbonViewState, key: string, fallback: string): string {
	const value = state.translate?.(key);
	return value && value !== key ? value : fallback;
}

/** Reject malformed programmatic intents and edits the document cannot accept. */
export function canRequestView(state: RibbonViewState, intent: RibbonViewIntent): boolean {
	switch (intent.kind) {
		case 'command':
			return (
				COMMANDS.includes(intent.value) &&
				(state.editable || !VIEW_EDITABLE_COMMANDS.includes(intent.value))
			);
		case 'option':
			return (
				OPTIONS.includes(intent.value) &&
				typeof intent.enabled === 'boolean' &&
				(state.editable || intent.value !== 'templateEditing')
			);
		case 'guide':
			return intent.axis === 'h' || intent.axis === 'v';
	}
}
