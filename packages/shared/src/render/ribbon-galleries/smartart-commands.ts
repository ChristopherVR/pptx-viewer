/**
 * SmartArt Design > Create Graphic and Reset: PowerPoint's command buttons,
 * expressed as one-item gallery modules so every binding renders and dispatches
 * them through the gallery path it already has (descriptor, `gallery-pick`,
 * element patch + history). Entries the engine cannot back yet are present but
 * disabled and say why in their tooltip, never silently inert.
 *
 * - Add Shape / Add Bullet run the core node edits (`addSmartArtNode`,
 *   `addSmartArtNodeAsChild`) on the last top-level node.
 * - Reset Graphic restores the default colours and style (content and layout stay).
 * - Promote, Demote, Move Up and Move Down need a selected node; the ribbon has no
 *   node selection (nodes are chosen in the Inspector's text pane), so they stay
 *   disabled here. Text Pane, Right to Left and Convert have no engine support.
 *
 * @module render/ribbon-galleries/smartart-commands
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { addSmartArtNode, addSmartArtNodeAsChild } from 'pptx-viewer-core';

import type { RibbonGalleryModule } from './gallery-module';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryId,
} from './gallery-types';
import { SMARTART_COLORS_GALLERY } from './smartart-colors-gallery';
import { smartArtElementPatch } from './smartart-gallery-patch';
import { SMARTART_STYLES_GALLERY } from './smartart-styles-gallery';

interface CommandSpec {
	id: RibbonGalleryId;
	labelKey: string;
	label: string;
	iconPath: string;
	large?: boolean;
	/** Why the command is unavailable; its presence disables it. */
	unavailable?: { key: string; text: string };
	run?: (data: PptxSmartArtData, ctx: RibbonGalleryContext) => RibbonGalleryApplyResult | null;
}

const NEEDS_NODE = {
	key: 'pptx.gallery.smartArtCommand.needsNode',
	text: 'Select a shape in the SmartArt text pane (Inspector) to use this command',
};
const NO_ENGINE = {
	key: 'pptx.gallery.smartArtCommand.unsupported',
	text: 'Not available yet in this viewer',
};

function lastTopLevelId(data: PptxSmartArtData): string | undefined {
	const top = data.nodes.filter((node) => !node.parentId);
	return top.at(-1)?.id;
}

function viaData(
	element: PptxElement | null,
	next: PptxSmartArtData | undefined,
	current: PptxSmartArtData,
): RibbonGalleryApplyResult | null {
	if (!next || next === current) {
		return null;
	}
	const patch = smartArtElementPatch(element, next);
	return patch ? { kind: 'element', ...patch } : null;
}

const SPECS: readonly CommandSpec[] = [
	{
		id: 'smartArtAddShape',
		labelKey: 'pptx.gallery.smartArtCommand.addShape',
		label: 'Add Shape',
		iconPath: 'M3 4h14v12H3zM10 7v6M7 10h6',
		run: (data, ctx) => viaData(ctx.element, addSmartArtNode(data, '', lastTopLevelId(data)), data),
	},
	{
		id: 'smartArtAddBullet',
		labelKey: 'pptx.gallery.smartArtCommand.addBullet',
		label: 'Add Bullet',
		iconPath: 'M4 6h.01M8 6h8M4 10h.01M8 10h8M4 14h.01M8 14h8',
		run: (data, ctx) =>
			viaData(ctx.element, addSmartArtNodeAsChild(data, lastTopLevelId(data), ''), data),
	},
	{
		id: 'smartArtTextPane',
		labelKey: 'pptx.gallery.smartArtCommand.textPane',
		label: 'Text Pane',
		iconPath: 'M3 3.5h14v13H3zM7 3.5v13M10 7h5M10 10h5',
		unavailable: {
			key: 'pptx.gallery.smartArtCommand.textPaneHint',
			text: 'Edit the shapes in the Inspector while the SmartArt is selected',
		},
	},
	{
		id: 'smartArtPromote',
		labelKey: 'pptx.gallery.smartArtCommand.promote',
		label: 'Promote',
		iconPath: 'M16 10H5M8 6.5 4.5 10 8 13.5',
		unavailable: NEEDS_NODE,
	},
	{
		id: 'smartArtDemote',
		labelKey: 'pptx.gallery.smartArtCommand.demote',
		label: 'Demote',
		iconPath: 'M4 10h11M12 6.5l3.5 3.5-3.5 3.5',
		unavailable: NEEDS_NODE,
	},
	{
		id: 'smartArtRightToLeft',
		labelKey: 'pptx.gallery.smartArtCommand.rightToLeft',
		label: 'Right to Left',
		iconPath: 'M4 7h12M13 4l3 3-3 3M16 13H4M7 10l-3 3 3 3',
		unavailable: NO_ENGINE,
	},
	{
		id: 'smartArtMoveUp',
		labelKey: 'pptx.gallery.smartArtCommand.moveUp',
		label: 'Move Up',
		iconPath: 'M10 16V5M6.5 8 10 4.5 13.5 8',
		unavailable: NEEDS_NODE,
	},
	{
		id: 'smartArtMoveDown',
		labelKey: 'pptx.gallery.smartArtCommand.moveDown',
		label: 'Move Down',
		iconPath: 'M10 4v11M6.5 12 10 15.5 13.5 12',
		unavailable: NEEDS_NODE,
	},
	{
		id: 'smartArtResetGraphic',
		labelKey: 'pptx.gallery.smartArtCommand.resetGraphic',
		label: 'Reset Graphic',
		iconPath: 'M4 10a6 6 0 1 0 2-4.5M4 3.5V7h3.5',
		large: true,
		run: (data, ctx) => {
			// Default colours first, then the default style, on the already-recoloured element.
			const element = ctx.element;
			const colors = SMARTART_COLORS_GALLERY.apply('colorful1', ctx);
			if (colors?.kind !== 'element' || element?.type !== 'smartArt') {
				return null;
			}
			const recoloured = {
				...element,
				...colors.patch,
			} as PptxElement;
			return (
				SMARTART_STYLES_GALLERY.apply('flat', { ...ctx, element: recoloured }) ??
				viaData(element, (colors.patch as { smartArtData?: PptxSmartArtData }).smartArtData, data)
			);
		},
	},
	{
		id: 'smartArtConvert',
		labelKey: 'pptx.gallery.smartArtCommand.convert',
		label: 'Convert',
		iconPath: 'M4 6h8l-2-2M16 14H8l2 2M4 6v3M16 14v-3',
		large: true,
		unavailable: NO_ENGINE,
	},
];

function moduleFor(spec: CommandSpec): RibbonGalleryModule {
	return {
		build(ctx) {
			const data = ctx.element?.type === 'smartArt' ? ctx.element.smartArtData : undefined;
			return {
				id: spec.id,
				labelKey: spec.labelKey,
				label: spec.label,
				disabled: !data || Boolean(spec.unavailable),
				command: {
					iconPath: spec.iconPath,
					large: spec.large,
					hintKey: spec.unavailable?.key,
					hint: spec.unavailable?.text,
				},
				sections: [
					{
						id: 'command',
						columns: 1,
						tileWidth: 0,
						tileHeight: 0,
						items: [
							{
								id: 'run',
								labelKey: spec.labelKey,
								label: spec.label,
								previewSvg: '',
								applied: false,
							},
						],
					},
				],
			};
		},
		apply(itemId, ctx) {
			const data = ctx.element?.type === 'smartArt' ? ctx.element.smartArtData : undefined;
			if (itemId !== 'run' || !data || spec.unavailable || !spec.run) {
				return null;
			}
			return spec.run(data, ctx);
		},
	};
}

/** Gallery ids that are SmartArt command buttons. */
export type SmartArtCommandGalleryId = Extract<
	RibbonGalleryId,
	| 'smartArtAddShape'
	| 'smartArtAddBullet'
	| 'smartArtTextPane'
	| 'smartArtPromote'
	| 'smartArtDemote'
	| 'smartArtRightToLeft'
	| 'smartArtMoveUp'
	| 'smartArtMoveDown'
	| 'smartArtResetGraphic'
	| 'smartArtConvert'
>;

/** The SmartArt command entries, keyed by gallery id, for the registry. */
export const SMARTART_COMMAND_MODULES = Object.fromEntries(
	SPECS.map((spec) => [spec.id, moduleFor(spec)]),
) as Record<SmartArtCommandGalleryId, RibbonGalleryModule>;
