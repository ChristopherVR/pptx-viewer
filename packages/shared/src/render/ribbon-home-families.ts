import type { RibbonControlId } from './customization/ribbon-control-ids';
import type {
	RibbonHomeClusterSpec,
	RibbonHomeControlSpec,
	RibbonHomeFamily,
	RibbonHomeFamilySpec,
} from './ribbon-home-spec';

const control = (
	id: RibbonControlId,
	labelKey: string,
	fallback: string,
	testId?: string,
	extra: Partial<RibbonHomeControlSpec> = {},
): RibbonHomeControlSpec => ({ id, labelKey, fallback, testId, ...extra });

const strip = (...controls: RibbonHomeControlSpec[]): RibbonHomeClusterSpec => ({ controls });
const pills = (chrome: string | undefined, ...controls: RibbonHomeControlSpec[]) => ({
	controls,
	free: true,
	chrome,
});
const text = (key: string, fallback: string) => ({ key, fallback });

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

export const RIBBON_HOME_FAMILIES: Readonly<Record<RibbonHomeFamily, RibbonHomeFamilySpec>> = {
	clipboard: {
		group: { id: 'home.clipboard', captionKey: 'pptx.ribbon.clipboard', fallback: 'Clipboard' },
		clusters: [
			strip(
				control('home.clipboard.paste', 'pptx.arrange.paste', 'Paste'),
				control('home.clipboard.cut', 'pptx.arrange.cut', 'Cut'),
				control('home.clipboard.copy', 'pptx.arrange.copy', 'Copy'),
				control(
					'home.clipboard.formatPainter',
					'pptx.arrange.formatPainter',
					'Format Painter',
					'format-painter-toggle',
				),
			),
		],
	},
	font: {
		clusters: [
			strip(
				control('home.font.bold', 'pptx.textPanel.bold', 'Bold'),
				control('home.font.italic', 'pptx.textPanel.italic', 'Italic'),
				control('home.font.underline', 'pptx.textPanel.underline', 'Underline'),
				control('home.font.strikethrough', 'pptx.textPanel.strikethrough', 'Strikethrough'),
			),
			strip(control('home.font.shadow', 'pptx.textEffects.shadow', 'Text Shadow')),
			strip(
				control('home.font.increaseFontSize', 'pptx.text.increaseFontSize', 'Increase Font Size'),
				control('home.font.decreaseFontSize', 'pptx.text.decreaseFontSize', 'Decrease Font Size'),
				control('home.font.clearFormatting', 'pptx.text.clearFormatting', 'Clear Formatting'),
			),
		],
	},
	paragraph: {
		clusters: [
			strip(
				control('home.paragraph.decreaseIndent', 'pptx.text.decreaseIndent', 'Decrease Indent'),
				control('home.paragraph.increaseIndent', 'pptx.text.increaseIndent', 'Increase Indent'),
			),
			strip(
				control('home.paragraph.alignLeft', 'pptx.ribbon.alignLeft', 'Align Left'),
				control('home.paragraph.alignCenter', 'pptx.ribbon.alignCenter', 'Center'),
				control('home.paragraph.alignRight', 'pptx.ribbon.alignRight', 'Align Right'),
				control('home.paragraph.justify', 'pptx.ribbon.justify', 'Justify'),
			),
		],
	},
	editing: {
		clusters: [
			strip(
				control('home.editing.find', 'pptx.editing.find', 'Find'),
				control('home.editing.replace', 'pptx.ribbon.replace', 'Replace'),
			),
		],
	},
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
					caret: { labelKey: 'pptx.home.chooseLayout', fallback: 'Choose layout' },
				}),
				control(
					'home.slides.slideTemplates',
					'pptx.home.slideTemplates',
					'Slide templates',
					undefined,
					{
						text: text('pptx.home.slideTemplates', 'Slide templates'),
					},
				),
				control('home.slides.layout', 'pptx.master.layout', 'Layout', undefined, {
					text: text('pptx.master.layout', 'Layout'),
					popup: true,
				}),
				control('home.slides.reset', 'pptx.sections.resetSlideTitle', 'Reset slide', undefined, {
					text: text('pptx.animations.reset', 'Reset'),
				}),
				control('home.slides.section', 'pptx.sections.addSection', 'Add section', undefined, {
					text: text('pptx.sections.sectionButtonLabel', 'Section'),
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
					popup: true,
				}),
				control('home.drawing.arrange', 'pptx.ribbon.arrange', 'Arrange', undefined, {
					text: text('pptx.ribbon.arrange', 'Arrange'),
					popup: true,
				}),
				control('home.drawing.shapeFill', 'pptx.drawing.shapeFill', 'Shape Fill', undefined, {
					popup: true,
				}),
				control(
					'home.drawing.shapeOutline',
					'pptx.drawing.shapeOutline',
					'Shape Outline',
					undefined,
					{
						popup: true,
					},
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
};
