import { viewLabel } from '../render';
import type {
	RibbonControlId,
	RibbonViewCommand,
	RibbonViewIntent,
	RibbonViewOption,
	RibbonViewState,
} from '../render';

type Label = [key: string, fallback: string];
interface CommandSpec {
	id: RibbonControlId;
	icon: string;
	label: Label;
	title?: Label;
	command?: RibbonViewCommand;
	option?: RibbonViewOption;
	compact?: boolean;
	placeholder?: boolean;
}

const spec = (value: CommandSpec): CommandSpec => value;
const VIEWS = [
	spec({
		id: 'view.presentationViews.normal',
		icon: 'panelTop',
		command: 'normal',
		label: ['pptx.view.normal', 'Normal'],
		title: ['pptx.statusBar.normalView', 'Normal view'],
	}),
	spec({
		id: 'view.presentationViews.slideSorter',
		icon: 'layoutGrid',
		command: 'slideSorter',
		label: ['pptx.slideSorter.title', 'Slide Sorter'],
		title: ['pptx.view.slideSorterTooltip', 'Slide Sorter view'],
	}),
	spec({
		id: 'view.presentationViews.outline',
		icon: 'indent',
		command: 'outline',
		label: ['pptx.view.outlineView', 'Outline View'],
		title: ['pptx.view.outlineViewTooltip', 'Outline view: edit the deck as indented text'],
	}),
	spec({
		id: 'view.presentationViews.readingView',
		icon: 'book',
		command: 'readingView',
		label: ['pptx.view.readingView', 'Reading View'],
	}),
];
const MASTERS = [
	spec({
		id: 'view.masterViews.slideMaster',
		icon: 'presentation',
		command: 'slideMaster',
		label: ['pptx.master.title', 'Slide Master'],
		title: ['pptx.view.slideMasterTooltip', 'Edit slide masters and layouts'],
	}),
	spec({
		id: 'view.masterViews.handoutMaster',
		icon: 'grid',
		placeholder: true,
		label: ['pptx.master.handoutMasterTitle', 'Handout Master'],
	}),
	spec({
		id: 'view.masterViews.notesMaster',
		icon: 'stickyNote',
		placeholder: true,
		label: ['pptx.master.notesMasterTitle', 'Notes Master'],
	}),
];
const TOGGLES: { id: RibbonControlId; option: RibbonViewOption; label: Label; title?: Label }[] = [
	{ id: 'view.show.ruler', option: 'showRulers', label: ['pptx.ruler.rulers', 'Rulers'] },
	{
		id: 'view.show.gridlines',
		option: 'showGrid',
		label: ['pptx.grid.grid', 'Grid'],
		title: ['pptx.grid.toggleGrid', 'Toggle Grid'],
	},
	{
		id: 'view.show.guides',
		option: 'showGuides',
		label: ['pptx.view.guides', 'Guides'],
		title: ['pptx.ribbon.toggleGuides', 'Toggle center guide lines'],
	},
	{
		id: 'view.show.snapToGrid',
		option: 'snapToGrid',
		label: ['pptx.grid.snapToGrid', 'Snap to Grid'],
		title: ['pptx.ribbon.snapToGridTitle', 'Snap elements to grid while moving'],
	},
];
const SHOW = [
	spec({
		id: 'view.show.selectionPane',
		icon: 'list',
		command: 'selectionPane',
		compact: true,
		label: ['pptx.view.selection', 'Selection'],
		title: ['pptx.selectionPane.title', 'Selection Pane'],
	}),
	spec({
		id: 'view.show.eyedropper',
		icon: 'pipette',
		command: 'eyedropper',
		compact: true,
		label: ['pptx.ribbon.eyedropper', 'Eyedropper'],
		title: ['pptx.view.eyedropperTooltip', 'Eyedropper: sample a colour from the slide'],
	}),
	spec({
		id: 'view.show.snapToShape',
		icon: 'grid',
		option: 'snapToShape',
		compact: true,
		label: ['pptx.grid.snapToShape', 'Snap to Shape'],
	}),
];
const ZOOM = [
	spec({
		id: 'view.zoom.zoom',
		icon: 'zoomIn',
		placeholder: true,
		label: ['pptx.slideSorter.zoom', 'Zoom'],
	}),
	spec({
		id: 'view.zoom.fitToWindow',
		icon: 'maximize',
		command: 'zoomToFit',
		label: ['pptx.view.zoomToFit', 'Zoom to Fit'],
		title: ['pptx.view.zoomToFitTooltip', 'Zoom to fit slide in window'],
	}),
];
const MACROS = spec({
	id: 'view.window.macros',
	icon: 'code',
	placeholder: true,
	label: ['pptx.view.macros', 'Macros'],
});

/** All View markup lives here. The host only reflects state and routes native intents. */
export function createRibbonViewView(doc: Document, request: (intent: RibbonViewIntent) => void) {
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
	const commands = new Map<string, { el: HTMLElement; spec: CommandSpec }>();
	const command = (item: CommandSpec, id = true) => {
		const el = doc.createElement('pptx-ui-ribbon-command');
		if (id) {
			el.dataset.ribbonControl = item.id;
		}
		el.setAttribute('icon', item.icon);
		el.toggleAttribute('compact', Boolean(item.compact));
		if (item.command !== undefined || item.option !== undefined) {
			el.addEventListener('command-request', (event) => {
				event.stopPropagation();
				if (item.command) {
					request({ kind: 'command', value: item.command });
				} else if (item.option) {
					request({ kind: 'option', value: item.option, enabled: !el.hasAttribute('active') });
				}
			});
		}
		commands.set(item.id, { el, spec: item });
		return el;
	};
	const toggles = TOGGLES.map((item) => {
		const el = doc.createElement('pptx-ui-ribbon-toggle');
		el.dataset.ribbonControl = item.id;
		el.addEventListener('toggle-request', (event) => {
			event.stopPropagation();
			request({
				kind: 'option',
				value: item.option,
				enabled: (event as CustomEvent<{ checked: boolean }>).detail.checked,
			});
		});
		return { el, item };
	});
	const guideAxis = (axis: 'h' | 'v') => {
		const el = doc.createElement('pptx-ui-ribbon-command');
		el.setAttribute('compact', '');
		el.setAttribute('icon', 'ruler');
		el.addEventListener('click', () => request({ kind: 'guide', axis }));
		return el;
	};
	const horizontal = guideAxis('h');
	const vertical = guideAxis('v');
	const guides = doc.createElement('span');
	guides.className = 'guides';
	guides.dataset.ribbonControl = 'view.show.addGuide';
	guides.append(horizontal, vertical);
	const templates = command({
		id: 'view.window.templateEditing',
		icon: 'panelTop',
		option: 'templateEditing',
		label: ['pptx.ribbon.templatesOff', 'Templates Off'],
	});
	templates.dataset.testid = 'template-edit-toggle';
	const root: HTMLElement[] = [
		group('view.presentationViews', ...VIEWS.map((item) => command(item))),
		group('view.masterViews', ...MASTERS.map((item) => command(item))),
		group(
			'view.show',
			stack(...toggles.map(({ el }) => el)),
			stack(...SHOW.map((item) => command(item)), guides),
		),
		group('view.zoom', ...ZOOM.map((item) => command(item))),
		group('view.window', templates, command(MACROS)),
	];
	const captions: Record<string, Label> = {
		'view.presentationViews': ['pptx.view.presentationViews', 'Presentation Views'],
		'view.masterViews': ['pptx.view.masterViews', 'Master Views'],
		'view.show': ['pptx.view.show', 'Show'],
		'view.zoom': ['pptx.slideSorter.zoom', 'Zoom'],
		'view.window': ['pptx.view.window', 'Window'],
	};
	const sync = (state: RibbonViewState) => {
		const text = (label: Label) => viewLabel(state, label[0], label[1]);
		for (const [id, el] of groups) {
			el.setAttribute('label', text(captions[id]));
		}
		const active: Record<string, boolean | undefined> = {
			snapToShape: state.snapToShape,
			templateEditing: state.templateEditing,
			selectionPane: state.selectionPaneOpen,
			eyedropper: state.eyedropperActive,
		};
		for (const { el, spec: item } of commands.values()) {
			const key = item.option ?? item.command ?? '';
			el.setAttribute(
				'label',
				item.option === 'templateEditing' && state.templateEditing
					? text(['pptx.ribbon.templatesOn', 'Templates On'])
					: text(item.label),
			);
			el.setAttribute('title', text(item.title ?? item.label));
			if (key in active) {
				el.setAttribute('pressed', String(Boolean(active[key])));
				el.toggleAttribute('active', Boolean(active[key]));
			}
			const editOnly = ['slideMaster', 'eyedropper', 'templateEditing'].includes(key);
			el.toggleAttribute('disabled', Boolean(item.placeholder) || (editOnly && !state.editable));
			el.toggleAttribute(
				'hidden',
				(key === 'selectionPane' && state.selectionPaneAvailable === false) ||
					(key === 'eyedropper' && state.eyedropperAvailable === false),
			);
		}
		for (const { el, item } of toggles) {
			el.setAttribute('label', text(item.label));
			el.setAttribute('title', text(item.title ?? item.label));
			if (state[item.option as keyof RibbonViewState]) {
				el.setAttribute('checked', '');
			} else {
				el.removeAttribute('checked');
			}
		}
		horizontal.setAttribute('label', text(['pptx.view.hGuide', 'H Guide']));
		horizontal.setAttribute(
			'title',
			text(['pptx.view.addHorizontalGuide', 'Add horizontal guide']),
		);
		vertical.setAttribute('label', text(['pptx.view.vGuide', 'V Guide']));
		vertical.setAttribute('title', text(['pptx.view.addVerticalGuide', 'Add vertical guide']));
	};
	/** Hosts without zoom support drop the Zoom group from the DOM entirely. */
	const layout = (state: RibbonViewState) =>
		root.filter((el) => el.dataset.ribbonGroup !== 'view.zoom' || state.zoomAvailable !== false);
	return { layout, sync };
}
