/**
 * Generates the "Reference" section of `docs/guide/customization.md` from the
 * runtime catalogues, so the docs list every id the model accepts and cannot
 * fall out of date: `customization-reference.test.ts` fails when the committed
 * docs differ from this output, and `bun run docs:customization` (root
 * `scripts/sync-customization-docs.ts`) rewrites the section.
 *
 * Deliberately NOT exported from the render barrel: it pulls in the English
 * dictionary for labels, which no runtime path needs.
 *
 * @module render/customization/customization-reference
 */
import { translationsEn } from '../../i18n/translations-en';
import { BACKSTAGE_NAV } from '../backstage';
import { BACKSTAGE_CARDS } from '../backstage-cards';
import { canvasContextMenuLabelKey } from '../canvas-context-menu-commands';
import { contextMenuLabelKey } from '../context-menu-commands';
import { editPointsCommandLabelKey } from '../edit-points/edit-points-menu';
import { FREEFORM_TOOL_LABEL_KEYS } from '../edit-points/freeform-tool-geometry';
import { DEFAULT_VIEWER_OPTIONS } from '../options/viewer-options';
import type { ViewerOptionsGroupId } from '../options/viewer-options';
import { VIEWER_OPTIONS_TABS } from '../options/viewer-options-schema';
import { RIBBON_CONTEXTUAL_TABS, TOOLBAR_TABS } from '../toolbar-actions';
import {
	CANVAS_CONTEXT_MENU_COMMAND_IDS,
	DRAWING_TOOL_IDS,
	EDIT_POINTS_MENU_COMMAND_IDS,
	EDITOR_SHORTCUT_ACTION_IDS,
	ELEMENT_CONTEXT_MENU_COMMAND_IDS,
	OPTIONS_SETTING_IDS,
	TOOLBAR_BUTTON_IDS,
	VIEWER_DIALOG_IDS,
	VIEWER_EXPORT_FORMAT_IDS,
	VIEWER_FEATURE_IDS,
	VIEWER_PANEL_IDS,
} from './customization-catalog';
import {
	EDITOR_SHORTCUT_DESCRIPTIONS,
	TOOLBAR_BUTTON_DESCRIPTIONS,
	VIEWER_DIALOG_DESCRIPTIONS,
	VIEWER_EXPORT_FORMAT_DESCRIPTIONS,
	VIEWER_FEATURE_DESCRIPTIONS,
	VIEWER_PANEL_DESCRIPTIONS,
} from './customization-descriptions';
import { RIBBON_GROUPS } from './ribbon-control-ids';

export const REFERENCE_START_MARKER = '<!-- customization-reference:start -->';
export const REFERENCE_END_MARKER = '<!-- customization-reference:end -->';

function label(key: string): string {
	return (translationsEn[key] ?? key).replaceAll('|', '\\|');
}

function table(headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
	const head = `| ${headers.join(' | ')} |`;
	const rule = `| ${headers.map(() => '---').join(' | ')} |`;
	return [head, rule, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');
}

function code(id: string): string {
	return `\`${id}\``;
}

function describe<T extends string>(
	ids: readonly T[],
	descriptions: Record<T, string>,
): string[][] {
	return ids.map((id) => [code(id), descriptions[id]]);
}

function settingRows(): string[][] {
	const labels = new Map<string, string>();
	for (const tab of VIEWER_OPTIONS_TABS) {
		for (const section of tab.sections) {
			for (const control of section.controls) {
				labels.set(`${control.group}.${control.key}`, label(control.labelKey));
			}
		}
	}
	return OPTIONS_SETTING_IDS.map((id) => {
		const [group, key] = id.split('.') as [ViewerOptionsGroupId, string];
		const value = (DEFAULT_VIEWER_OPTIONS[group] as unknown as Record<string, unknown>)[key];
		const shown = typeof value === 'string' ? `'${value}'` : String(value);
		return [code(id), typeof value, code(shown), labels.get(id) ?? '(not shown in the dialog)'];
	});
}

/** The generated reference, WITHOUT the surrounding markers. */
export function buildCustomizationReference(): string {
	const parts: string[] = [
		'### Ribbon tabs (`ribbon.hiddenTabs`)',
		table(
			['Id', 'Tab'],
			[...TOOLBAR_TABS, ...RIBBON_CONTEXTUAL_TABS].map((tab) => [
				code(tab.id),
				label(tab.labelKey),
			]),
		),
		'### Ribbon groups (`ribbon.hiddenGroups`)',
		table(
			['Id', 'Group'],
			RIBBON_GROUPS.map((group) => [code(group.id), group.label]),
		),
		'### Ribbon controls (`ribbon.hiddenButtons`)',
		table(
			['Id', 'Control'],
			RIBBON_GROUPS.flatMap((group) =>
				group.controls.map((control) => [code(control.id), control.label]),
			),
		),
		'### Toolbar buttons (`ribbon.hiddenButtons`)',
		table(['Id', 'What it removes'], describe(TOOLBAR_BUTTON_IDS, TOOLBAR_BUTTON_DESCRIPTIONS)),
		'### Options pages (`options.hiddenPages`)',
		table(
			['Id', 'Page'],
			[
				...VIEWER_OPTIONS_TABS.map((tab) => [code(tab.id), label(tab.labelKey)]),
				[code('ai'), label('pptx.ai.settingsSectionTitle')],
			],
		),
		'### Options sections (`options.hiddenSections`)',
		table(
			['Id', 'Section'],
			VIEWER_OPTIONS_TABS.flatMap((tab) =>
				tab.sections.map((section) => [code(`${tab.id}.${section.id}`), label(section.titleKey)]),
			),
		),
		'### Settings (`options.hiddenSettings`, `options.locked`, `options.defaults`)',
		table(['Id', 'Type', 'Built-in default', 'Label'], settingRows()),
		'### File tab pages (`backstage.hiddenPages`)',
		table(
			['Id', 'Page'],
			BACKSTAGE_NAV.map((item) => [code(item.id), label(item.labelKey)]),
		),
		'### File tab cards (`backstage.hiddenCards`)',
		table(
			['Id', 'Card'],
			Object.values(BACKSTAGE_CARDS).map((card) => [code(card.id), label(card.titleKey)]),
		),
		'### Element context menu (`contextMenu.hiddenElementCommands`)',
		table(
			['Id', 'Entry'],
			ELEMENT_CONTEXT_MENU_COMMAND_IDS.map((id) => [code(id), label(contextMenuLabelKey(id))]),
		),
		'### Empty-canvas context menu (`contextMenu.hiddenCanvasCommands`)',
		table(
			['Id', 'Entry'],
			CANVAS_CONTEXT_MENU_COMMAND_IDS.map((id) => [code(id), label(canvasContextMenuLabelKey(id))]),
		),
		'### Edit Points menu (`contextMenu.hiddenEditPointsCommands`)',
		table(
			['Id', 'Entry'],
			EDIT_POINTS_MENU_COMMAND_IDS.map((id) => [code(id), label(editPointsCommandLabelKey(id))]),
		),
		'### Editor shortcuts (`keyboard.disabled`, `keyboard.remap`)',
		table(['Id', 'Command'], describe(EDITOR_SHORTCUT_ACTION_IDS, EDITOR_SHORTCUT_DESCRIPTIONS)),
		'### Panels (`hiddenPanels`)',
		table(['Id', 'Region'], describe(VIEWER_PANEL_IDS, VIEWER_PANEL_DESCRIPTIONS)),
		'### Features (`disabledFeatures`)',
		table(
			['Id', 'What it switches off'],
			describe(VIEWER_FEATURE_IDS, VIEWER_FEATURE_DESCRIPTIONS),
		),
		'### Dialogs (`hiddenDialogs`)',
		table(['Id', 'What it removes'], describe(VIEWER_DIALOG_IDS, VIEWER_DIALOG_DESCRIPTIONS)),
		'### Export formats (`hiddenExportFormats`)',
		table(['Id', 'Format'], describe(VIEWER_EXPORT_FORMAT_IDS, VIEWER_EXPORT_FORMAT_DESCRIPTIONS)),
		'### Drawing tools (`hiddenDrawingTools`)',
		table(
			['Id', 'Tool'],
			DRAWING_TOOL_IDS.map((id) => [code(id), label(FREEFORM_TOOL_LABEL_KEYS[id])]),
		),
	];
	return `${parts.join('\n\n')}\n`;
}

/**
 * `markdown` with table padding and blank-line runs collapsed, so a check can
 * compare the committed (oxfmt-aligned) docs against the raw generator output.
 */
export function normalizeReferenceMarkdown(markdown: string): string {
	return markdown
		.split(/\r?\n/u)
		.map((line) => {
			if (!line.startsWith('|')) {
				return line.trimEnd();
			}
			return line
				.split(/(?<!\\)\|/u)
				.map((cell) => cell.trim().replace(/^:?-{3,}:?$/u, '---'))
				.join('|');
		})
		.join('\n')
		.replace(/\n{3,}/gu, '\n\n')
		.trim();
}

/** `markdown` with the text between the reference markers replaced. */
export function replaceCustomizationReference(markdown: string): string {
	const start = markdown.indexOf(REFERENCE_START_MARKER);
	const end = markdown.indexOf(REFERENCE_END_MARKER);
	if (start < 0 || end < start) {
		throw new Error('customization reference markers not found');
	}
	return `${markdown.slice(0, start + REFERENCE_START_MARKER.length)}\n\n${buildCustomizationReference()}\n${markdown.slice(end)}`;
}
