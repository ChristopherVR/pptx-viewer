import { MERGE_SHAPES_HINT_KEY } from './merge-shapes/merge-shapes-menu';
import { control, pills, strip, text } from './ribbon-home-family-helpers';
import {
	HOME_CROP_ITEMS,
	HOME_DRAWING_ARRANGE_ITEMS,
	HOME_FONT_SIZE_ITEMS,
	HOME_MERGE_ITEMS,
	HOME_SHAPE_ITEMS,
} from './ribbon-home-menus';
import type { RibbonHomeFamilySpec } from './ribbon-home-spec';

const ALIGN_PARTS = [
	['left', 'pptx.ribbon.alignLeft', 'Align Left'],
	['centerH', 'pptx.ribbon.alignCenter', 'Center'],
	['right', 'pptx.ribbon.alignRight', 'Align Right'],
	['top', 'pptx.ribbon.alignTop', 'Align Top'],
	['middle', 'pptx.ribbon.alignMiddle', 'Align Middle'],
	['bottom', 'pptx.ribbon.alignBottom', 'Align Bottom'],
] as const;

const alignControl = ([part, key, fallback]: (typeof ALIGN_PARTS)[number]) =>
	control('home.arrange.align', key, fallback, undefined, {
		part,
		icon: `home.arrange.align.${part === 'centerH' ? 'center' : part}`,
	});

/** Slides, Drawing, Arrange and the Font picker: the object-level Home families. */
export const RIBBON_HOME_OBJECT_FAMILIES: Readonly<
	Record<
		| 'slides'
		| 'drawing'
		| 'arrange-align'
		| 'arrange-flip'
		| 'arrange-order'
		| 'arrange-edit'
		| 'font-picker'
		| 'arrange-painter'
		| 'arrange-shape',
		RibbonHomeFamilySpec
	>
> = {
	slides: {
		group: {
			id: 'home.slides',
			captionKey: 'pptx.ribbon.slides',
			fallback: 'Slides',
			rowChrome: 'slides-controls',
		},
		clusters: [
			pills(
				undefined,
				control('home.slides.newSlide', 'pptx.home.newSlide', 'New Slide', undefined, {
					text: text('pptx.home.newSlide', 'New Slide'),
					large: true,
					kind: 'layout',
					caret: { labelKey: 'pptx.home.chooseLayout', fallback: 'Choose layout' },
				}),
				control(
					'home.slides.slideTemplates',
					'pptx.home.slideTemplates',
					'Slide templates',
					undefined,
					{
						text: text('pptx.home.slideTemplates', 'Slide templates'),
						large: true,
					},
				),
				control('home.slides.layout', 'pptx.master.layout', 'Layout', undefined, {
					text: text('pptx.master.layout', 'Layout'),
					large: true,
					kind: 'layout',
					popup: true,
				}),
				control('home.slides.reset', 'pptx.sections.resetSlideTitle', 'Reset slide', undefined, {
					text: text('pptx.animations.reset', 'Reset'),
					large: true,
				}),
				control('home.slides.section', 'pptx.sections.addSection', 'Add section', undefined, {
					text: text('pptx.sections.sectionButtonLabel', 'Section'),
					large: true,
				}),
			),
		],
	},
	drawing: {
		clusters: [
			pills(
				undefined,
				control('home.drawing.shapes', 'pptx.drawing.shapes', 'Shapes', undefined, {
					text: text('pptx.drawing.shapes', 'Shapes'),
					large: true,
					kind: 'menu',
					items: HOME_SHAPE_ITEMS,
					popup: true,
				}),
				control('home.drawing.arrange', 'pptx.ribbon.arrange', 'Arrange', undefined, {
					text: text('pptx.ribbon.arrange', 'Arrange'),
					large: true,
					kind: 'menu',
					items: HOME_DRAWING_ARRANGE_ITEMS,
					popup: true,
				}),
				control('home.drawing.shapeFill', 'pptx.drawing.shapeFill', 'Shape Fill', undefined, {
					text: text('pptx.drawing.shapeFill', 'Shape Fill'),
					chevron: true,
					kind: 'colour',
					popup: true,
					colour: { swatches: 'shape', theme: true, swatchLabelPrefix: 'Fill colour' },
				}),
				control(
					'home.drawing.shapeOutline',
					'pptx.drawing.shapeOutline',
					'Shape Outline',
					undefined,
					{
						text: text('pptx.drawing.shapeOutline', 'Shape Outline'),
						chevron: true,
						kind: 'colour',
						popup: true,
						colour: { swatches: 'shape', theme: true, swatchLabelPrefix: 'Outline colour' },
					},
				),
				control(
					'home.drawing.quickStyles',
					'pptx.gallery.shapeStyles.title',
					'Quick Styles',
					undefined,
					{ kind: 'gallery', gallery: { id: 'shapeStyles', icon: 'palette' } },
				),
				control(
					'home.drawing.shapeEffects',
					'pptx.gallery.shapeEffects.title',
					'Shape Effects',
					undefined,
					{ kind: 'gallery', gallery: { id: 'shapeEffects', icon: 'sparkles' } },
				),
			),
		],
	},
	'arrange-align': {
		wrapper: { id: 'home.arrange.align', chrome: 'align-controls' },
		clusters: [
			strip(...ALIGN_PARTS.map(alignControl)),
			{
				chrome: 'distribute-controls',
				controls: (['horizontal', 'vertical'] as const).map((axis) =>
					control(
						'home.arrange.align',
						axis === 'horizontal'
							? 'pptx.arrange.distributeHorizontal'
							: 'pptx.arrange.distributeVertical',
						axis === 'horizontal' ? 'Distribute Horizontally' : 'Distribute Vertically',
						undefined,
						{ part: `distribute-${axis}`, icon: `home.arrange.distribute.${axis}` },
					),
				),
			},
		],
	},
	'arrange-flip': {
		clusters: [
			{
				chrome: 'flip-controls',
				controls: [
					control(
						'home.arrange.flipHorizontal',
						'pptx.arrange.flipHorizontally',
						'Flip Horizontally',
						undefined,
						{ icon: false, text: text('pptx.arrange.flipH', 'Flip H') },
					),
					control(
						'home.arrange.flipVertical',
						'pptx.arrange.flipVertically',
						'Flip Vertically',
						undefined,
						{ icon: false, text: text('pptx.arrange.flipV', 'Flip V') },
					),
				],
			},
		],
	},
	'arrange-order': {
		clusters: [
			{
				chrome: 'order-controls',
				controls: [
					control('home.arrange.sendBackward', 'pptx.arrange.sendBackward', 'Send Backward'),
					control('home.arrange.bringForward', 'pptx.arrange.bringForward', 'Bring Forward'),
					control('home.arrange.sendToBack', 'pptx.arrange.sendToBack', 'Send to Back', undefined, {
						icon: false,
						text: text('pptx.arrange.back', 'Back'),
					}),
					control(
						'home.arrange.bringToFront',
						'pptx.arrange.bringToFront',
						'Bring to Front',
						undefined,
						{ icon: false, text: text('pptx.arrange.front', 'Front') },
					),
				],
			},
		],
	},
	'arrange-edit': {
		clusters: [
			pills(
				undefined,
				control('home.arrange.duplicate', 'pptx.arrange.duplicate', 'Duplicate', undefined, {
					text: text('pptx.arrange.duplicate', 'Duplicate'),
				}),
				control('home.arrange.delete', 'pptx.arrange.delete', 'Delete', undefined, {
					text: text('pptx.arrange.delete', 'Delete'),
					danger: true,
				}),
			),
		],
	},
	'font-picker': {
		group: {
			id: 'home.font',
			captionKey: 'pptx.ribbon.font',
			fallback: 'Font',
			rowChrome: 'font-picker-controls',
		},
		clusters: [
			{
				free: true,
				chrome: 'font-picker-fields',
				controls: [
					control('home.font.fontFamily', 'pptx.ribbon.fontFamily', 'Font family', undefined, {
						kind: 'select',
						select: { picker: 'family' },
					}),
					control('home.font.fontSize', 'pptx.ribbon.fontSize', 'Font size', undefined, {
						kind: 'select',
						select: { picker: 'size' },
						items: HOME_FONT_SIZE_ITEMS,
					}),
				],
			},
		],
	},
	'arrange-painter': {
		clusters: [
			pills(
				undefined,
				control(
					'home.clipboard.formatPainter',
					'pptx.arrange.formatPainter',
					'Format Painter',
					'format-painter-toggle',
					{ text: text('pptx.arrange.format', 'Format') },
				),
			),
		],
	},
	'arrange-shape': {
		clusters: [
			strip(
				control('home.arrange.group', 'pptx.contextMenu.group', 'Group'),
				control('home.arrange.ungroup', 'pptx.contextMenu.ungroup', 'Ungroup'),
			),
			pills(
				undefined,
				control('home.arrange.mergeShapes', 'pptx.shape.mergeShapes', 'Merge Shapes', undefined, {
					kind: 'menu',
					popup: true,
					chevron: true,
					items: HOME_MERGE_ITEMS,
					hintKey: MERGE_SHAPES_HINT_KEY,
					attrs: { 'data-pptx-ribbon-control': 'merge-shapes' },
				}),
				control('home.arrange.crop', 'pptx.image.crop', 'Crop', undefined, {
					kind: 'menu',
					popup: true,
					items: HOME_CROP_ITEMS,
					hintKey: 'pptx.image.cropHint',
					attrs: { 'data-pptx-ribbon-control': 'crop', 'data-pptx-chrome': 'crop-main' },
					caret: {
						labelKey: 'pptx.image.cropToAspectRatio',
						fallback: 'Crop to Aspect Ratio',
						attrs: { 'data-pptx-ribbon-control': 'crop-menu', 'data-pptx-chrome': 'crop-caret' },
					},
				}),
				control('home.arrange.outlineWidth', 'pptx.ribbon.strokeWidth', 'Stroke width', undefined, {
					kind: 'number',
					number: { min: 0, max: 120, step: 0.5 },
				}),
			),
		],
	},
};
