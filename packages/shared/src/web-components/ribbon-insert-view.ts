import {
	ACTION_BUTTON_PRESETS,
	FREEFORM_TOOL_IDS,
	FREEFORM_TOOL_LABEL_KEYS,
	INSERT_CHART_TYPES,
	INSERT_COMMANDS,
	INSERT_FIELDS,
	INSERT_GROUP_CAPTIONS,
	SHAPE_PRESET_DEFS,
	insertLabel,
} from '../render';
import type { InsertLabel, RibbonInsertIntent, RibbonInsertState } from '../render';
import { createInsertCluster } from './ribbon-insert-cluster';
import { createInsertMenu } from './ribbon-insert-dom';
import {
	INSERT_SHAPE_GLYPH_PATHS,
	RIBBON_INSERT_ICON_PATHS,
	insertGlyphTransform,
} from './ribbon-insert-icons';

const FREEFORM_ICONS: Record<string, string> = { freeformShape: 'penTool', curve: 'spline' };
const FREEFORM_FALLBACKS: Record<string, string> = {
	freeformShape: 'Freeform: Shape',
	curve: 'Curve',
};

/** All Insert markup lives here. The host only reflects state and routes native intents. */
export function createRibbonInsertView(
	doc: Document,
	request: (intent: RibbonInsertIntent) => void,
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
	const command = (icon: string, compact: boolean, run: () => void, control?: string) => {
		const el = doc.createElement('pptx-ui-ribbon-command');
		if (control) {
			el.dataset.ribbonControl = control;
		}
		el.setAttribute('icon', icon);
		el.toggleAttribute('compact', compact);
		// Controls without a catalogue id cannot emit command-request, so use the click.
		el.addEventListener('command-request', (event) => event.stopPropagation());
		el.addEventListener('click', () => {
			if (!el.hasAttribute('disabled')) {
				run();
			}
		});
		return el;
	};
	const commands = INSERT_COMMANDS.map((spec) => ({
		spec,
		el: command(
			spec.icon,
			true,
			() => request({ kind: 'command', value: spec.command }),
			spec.control,
		),
	}));
	const byCommand = (name: string) => commands.find(({ spec }) => spec.command === name)!.el;
	let shapeType = '';
	let chartKind = '';
	const shapes = createInsertCluster(
		doc,
		'insert.illustrations.shapes',
		(value) => request({ kind: 'shapeType', value }),
		() => request({ kind: 'shape', value: shapeType }),
	);
	const charts = createInsertCluster(
		doc,
		'insert.illustrations.chart',
		(value) => request({ kind: 'chartType', value }),
		() => request({ kind: 'chart', value: chartKind }),
	);
	let armed: string | null = null;
	const freeform = FREEFORM_TOOL_IDS.map((tool) => {
		const el = command(FREEFORM_ICONS[tool], true, () =>
			request({ kind: 'freeform', value: armed === tool ? null : tool }),
		);
		el.dataset.pptxDrawingTool = tool;
		return { tool, el };
	});
	const freeformStack = stack(...freeform.map(({ el }) => el));
	const actions = createInsertMenu(doc, 'insert.links.action', 'action', (value) =>
		request({ kind: 'actionButton', value }),
	);
	const fields = createInsertMenu(doc, 'insert.text.field', 'field', (value) =>
		request({ kind: 'field', value: value as 'slidenum' }),
	);
	const root = [
		group('insert.tables', byCommand('table')),
		group('insert.images', byCommand('image')),
		group('insert.illustrations', shapes.el, freeformStack, charts.el, byCommand('smartArt')),
		group('insert.links', stack(byCommand('link'), actions.el)),
		group('insert.text', stack(byCommand('textBox'), fields.el, byCommand('headerFooter'))),
		group('insert.symbols', byCommand('equation')),
		group('insert.media', byCommand('media')),
	];
	const sync = (state: RibbonInsertState) => {
		const text = (label: InsertLabel) => insertLabel(state, label);
		shapeType = state.shapeType;
		chartKind = state.chartKind;
		armed = state.activeFreeformTool ?? null;
		const disabled = !state.editable;
		for (const [id, el] of groups) {
			el.setAttribute('label', text(INSERT_GROUP_CAPTIONS[id]));
		}
		for (const { spec, el } of commands) {
			el.setAttribute('label', text(spec.label));
			el.setAttribute('title', text(spec.title));
			el.toggleAttribute('disabled', spec.command === 'link' ? !state.hasSelection : disabled);
		}
		byCommand('headerFooter').toggleAttribute('hidden', state.headerFooterAvailable === false);
		const preset =
			SHAPE_PRESET_DEFS.find((item) => item.type === state.shapeType) ?? SHAPE_PRESET_DEFS[0];
		shapes.sync({
			choices: SHAPE_PRESET_DEFS.map((item) => ({
				value: item.type,
				label: text([item.i18nKey, item.label]),
			})),
			value: preset.type,
			selectLabel: text(['pptx.insert.shapeType', 'Shape type']),
			buttonLabel: text(['pptx.insert.shape', 'Shape']),
			buttonTitle: text(['pptx.insert.addShape', 'Add shape']),
			disabled,
			glyph: {
				path: INSERT_SHAPE_GLYPH_PATHS[preset.glyph],
				viewBox: '0 0 16 16',
				transform: insertGlyphTransform(preset.glyphClass),
			},
		});
		charts.el.hidden = state.chartAvailable === false;
		charts.sync({
			choices: INSERT_CHART_TYPES.map((item) => ({
				value: item.id,
				label: text([item.labelKey, item.label]),
			})),
			value: state.chartKind,
			selectLabel: text(['pptx.ribbon.chartType', 'Chart type']),
			buttonLabel: text(['pptx.ribbon.chart', 'Chart']),
			buttonTitle: text(['pptx.ribbon.insertChart', 'Insert chart']),
			disabled,
			glyph: { path: RIBBON_INSERT_ICON_PATHS.chart, viewBox: '0 0 20 20', transform: 'none' },
		});
		const visible = state.freeformTools ?? [];
		freeformStack.hidden = visible.length === 0;
		for (const { tool, el } of freeform) {
			const label = text([FREEFORM_TOOL_LABEL_KEYS[tool], FREEFORM_FALLBACKS[tool]]);
			el.setAttribute('label', label);
			el.setAttribute('title', label);
			el.hidden = !visible.includes(tool);
			el.setAttribute('pressed', String(armed === tool));
			el.toggleAttribute('active', armed === tool);
			el.toggleAttribute('disabled', disabled);
		}
		const actionTitle = text(['pptx.ribbon.insertActionButton', 'Insert action button']);
		actions.sync(
			text(['pptx.ribbon.action', 'Action']),
			actionTitle,
			ACTION_BUTTON_PRESETS.map((item) => ({
				id: item.shapeType,
				label: item.label,
				glyph: item.iconPath,
			})),
			disabled,
			actionTitle,
		);
		fields.el.hidden = state.fieldAvailable === false;
		const fieldTitle = text(['pptx.field.insertField', 'Insert Field']);
		fields.sync(
			text(['pptx.field.field', 'Field']),
			fieldTitle,
			INSERT_FIELDS.map((item) => ({ id: item.id, label: text(item.label) })),
			disabled,
			fieldTitle,
		);
	};
	return { root, sync, menus: [actions, fields] };
}
