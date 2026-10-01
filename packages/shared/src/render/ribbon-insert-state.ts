import { ACTION_BUTTON_PRESETS } from './action-buttons';
import { INSERT_CHART_TYPES } from './insert-chart';
import { SHAPE_PRESET_DEFS } from './shape-preset-catalog';

export type RibbonInsertCommand =
	| 'textBox'
	| 'table'
	| 'image'
	| 'media'
	| 'smartArt'
	| 'equation'
	| 'link'
	| 'headerFooter';

export type RibbonInsertField = 'slidenum' | 'datetime' | 'header' | 'footer';

/**
 * Controlled Insert tab state. Native viewers own the selections, every document
 * mutation, the file/shape/SmartArt/equation/hyperlink dialogs and history.
 */
export interface RibbonInsertState {
	editable: boolean;
	/** A hyperlink always attaches to something, so Link tracks the selection. */
	hasSelection: boolean;
	/** The shape preset staged in the Shape picker. */
	shapeType: string;
	/** The chart entry staged in the Chart picker. */
	chartKind: string;
	/** The armed Freeform: Shape / Curve tool. */
	activeFreeformTool?: string | null;
	/** Visible Freeform tools; empty hides the buttons (host customization). */
	freeformTools?: readonly string[];
	/** Hosts without these capabilities hide the control instead of showing a dead one. */
	chartAvailable?: boolean;
	fieldAvailable?: boolean;
	headerFooterAvailable?: boolean;
	translate?: (key: string) => string;
}

export type RibbonInsertIntent =
	| { kind: 'command'; value: RibbonInsertCommand }
	| { kind: 'shapeType'; value: string }
	| { kind: 'shape'; value: string }
	| { kind: 'chartType'; value: string }
	| { kind: 'chart'; value: string }
	| { kind: 'freeform'; value: string | null }
	| { kind: 'actionButton'; value: string }
	| { kind: 'field'; value: RibbonInsertField };

export type InsertLabel = [key: string, fallback: string];

export interface InsertCommandSpec {
	command: RibbonInsertCommand;
	group: string;
	/** Public customization id; Header & Footer has none in the catalogue. */
	control?: string;
	icon: string;
	label: InsertLabel;
	title: InsertLabel;
}

const spec = (value: InsertCommandSpec): InsertCommandSpec => value;

export const INSERT_COMMANDS: readonly InsertCommandSpec[] = [
	spec({
		command: 'table',
		group: 'insert.tables',
		control: 'insert.tables.table',
		icon: 'table',
		label: ['pptx.ribbon.table', 'Table'],
		title: ['pptx.insert.insertTable', 'Insert table'],
	}),
	spec({
		command: 'image',
		group: 'insert.images',
		control: 'insert.images.pictures',
		icon: 'image',
		label: ['pptx.ribbon.image', 'Image'],
		title: ['pptx.ribbon.insertImage', 'Insert image'],
	}),
	spec({
		command: 'smartArt',
		group: 'insert.illustrations',
		control: 'insert.illustrations.smartArt',
		icon: 'layers',
		label: ['pptx.ribbon.smartArt', 'SmartArt'],
		title: ['pptx.insert.insertSmartArt', 'Insert SmartArt'],
	}),
	spec({
		command: 'link',
		group: 'insert.links',
		control: 'insert.links.link',
		icon: 'link',
		label: ['pptx.hyperlinkDialog.title', 'Hyperlink'],
		title: ['pptx.hyperlinkDialog.title', 'Hyperlink'],
	}),
	spec({
		command: 'textBox',
		group: 'insert.text',
		control: 'insert.text.textBox',
		icon: 'textBox',
		label: ['pptx.ribbon.textBox', 'Text Box'],
		title: ['pptx.insert.addTextBox', 'Add text box'],
	}),
	spec({
		command: 'headerFooter',
		group: 'insert.text',
		icon: 'headerFooter',
		label: ['pptx.headerFooter.title', 'Header & Footer'],
		title: ['pptx.headerFooter.title', 'Header & Footer'],
	}),
	spec({
		command: 'equation',
		group: 'insert.symbols',
		control: 'insert.symbols.equation',
		icon: 'equation',
		label: ['pptx.ribbon.equation', 'Equation'],
		title: ['pptx.insert.insertEquation', 'Insert Equation'],
	}),
	spec({
		command: 'media',
		group: 'insert.media',
		control: 'insert.media.media',
		icon: 'video',
		label: ['pptx.ribbon.media', 'Media'],
		title: ['pptx.ribbon.insertMedia', 'Insert audio or video'],
	}),
];

export const INSERT_FIELDS: readonly { id: RibbonInsertField; label: InsertLabel }[] = [
	{ id: 'slidenum', label: ['pptx.field.slideNumber', 'Slide Number'] },
	{ id: 'datetime', label: ['pptx.field.dateTime', 'Date/Time'] },
	{ id: 'header', label: ['pptx.field.header', 'Header'] },
	{ id: 'footer', label: ['pptx.field.footer', 'Footer'] },
];

export const INSERT_GROUP_CAPTIONS: Readonly<Record<string, InsertLabel>> = {
	'insert.tables': ['pptx.insert.groupTables', 'Tables'],
	'insert.images': ['pptx.insert.groupImages', 'Images'],
	'insert.illustrations': ['pptx.insert.groupIllustrations', 'Illustrations'],
	'insert.links': ['pptx.insert.groupLinks', 'Links'],
	'insert.text': ['pptx.insert.groupText', 'Text'],
	'insert.symbols': ['pptx.insert.groupSymbols', 'Symbols'],
	'insert.media': ['pptx.insert.groupMedia', 'Media'],
};

export function insertLabel(state: RibbonInsertState, label: InsertLabel): string {
	const value = state.translate?.(label[0]);
	return value && value !== label[0] ? value : label[1];
}

/** Reject malformed programmatic intents as well as disabled pointer/keyboard picks. */
export function canRequestInsert(state: RibbonInsertState, intent: RibbonInsertIntent): boolean {
	switch (intent.kind) {
		case 'command':
			if (!INSERT_COMMANDS.some((item) => item.command === intent.value)) {
				return false;
			}
			return intent.value === 'link' ? state.hasSelection : state.editable;
		case 'shapeType':
		case 'shape':
			return state.editable && SHAPE_PRESET_DEFS.some((item) => item.type === intent.value);
		case 'chartType':
		case 'chart':
			return (
				state.editable &&
				state.chartAvailable !== false &&
				INSERT_CHART_TYPES.some((item) => item.id === intent.value)
			);
		case 'freeform':
			return (
				state.editable &&
				(intent.value === null || (state.freeformTools ?? []).includes(intent.value))
			);
		case 'actionButton':
			return (
				state.editable && ACTION_BUTTON_PRESETS.some((item) => item.shapeType === intent.value)
			);
		case 'field':
			return (
				state.editable &&
				state.fieldAvailable !== false &&
				INSERT_FIELDS.some((item) => item.id === intent.value)
			);
	}
}
