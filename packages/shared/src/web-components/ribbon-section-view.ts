import type { RibbonCommandView, RibbonGroupView } from '../render/ribbon-command-view';

interface GroupNode {
	el: HTMLElement;
	columns: Map<number, HTMLElement>;
}

function setBoolean(el: HTMLElement, name: string, value?: boolean): void {
	el.toggleAttribute(name, Boolean(value));
}

function setOptionalBoolean(el: HTMLElement, name: string, value?: boolean): void {
	if (value === undefined) {
		el.removeAttribute(name);
	} else {
		el.setAttribute(name, String(value));
	}
}

function syncCommand(el: HTMLElement, command: RibbonCommandView): void {
	el.setAttribute('data-ribbon-control', command.id);
	el.setAttribute('label', command.label);
	el.setAttribute('title', command.title ?? command.label);
	el.setAttribute('icon', command.icon);
	if (command.badge) {
		el.setAttribute('badge', String(command.badge));
	} else {
		el.removeAttribute('badge');
	}
	for (const attr of ['disabled', 'active', 'compact', 'hidden'] as const) {
		setBoolean(el, attr, command[attr]);
	}
	setOptionalBoolean(el, 'pressed', command.pressed);
	setOptionalBoolean(el, 'expanded', command.expanded);
}

/** Keyed updates preserve the focused native button and every customization ID. */
export function createRibbonSectionView(root: HTMLElement) {
	const groups = new Map<string, GroupNode>();
	const commands = new Map<string, HTMLElement>();
	return (model: readonly RibbonGroupView[]): void => {
		const wantedGroups = new Set(model.map((group) => group.id));
		const wantedCommands = new Set(
			model.flatMap((group) => group.commands.map((command) => command.id)),
		);
		for (const [id, el] of commands) {
			if (!wantedCommands.has(id as RibbonCommandView['id'])) {
				el.remove();
				commands.delete(id);
			}
		}
		for (const [id, group] of groups) {
			if (!wantedGroups.has(id as RibbonGroupView['id'])) {
				group.el.remove();
				groups.delete(id);
			}
		}
		for (const [index, group] of model.entries()) {
			let node = groups.get(group.id);
			if (!node) {
				node = { el: root.ownerDocument.createElement('pptx-ui-ribbon-group'), columns: new Map() };
				groups.set(group.id, node);
			}
			node.el.setAttribute('data-ribbon-group', group.id);
			node.el.setAttribute('label', group.label);
			if (root.children[index] !== node.el) {
				root.insertBefore(node.el, root.children[index] ?? null);
			}
			const offsets = new Map<HTMLElement, number>();
			for (const command of group.commands) {
				let parent: HTMLElement = node.el;
				if (command.column !== undefined) {
					let column = node.columns.get(command.column);
					if (!column) {
						column = root.ownerDocument.createElement('div');
						Object.assign(column.style, { display: 'flex', flexDirection: 'column', gap: '2px' });
						node.columns.set(command.column, column);
						node.el.append(column);
					}
					parent = column;
				}
				let el = commands.get(command.id);
				if (!el) {
					el = root.ownerDocument.createElement('pptx-ui-ribbon-command');
					commands.set(command.id, el);
				}
				syncCommand(el, command);
				const offset = offsets.get(parent) ?? 0;
				if (parent.children[offset] !== el) {
					parent.insertBefore(el, parent.children[offset] ?? null);
				}
				offsets.set(parent, offset + 1);
			}
		}
	};
}
