/**
 * The Home, Insert, Draw and Design tabs of `RIBBON_CONTROL_CATALOG` (split only to keep files short).
 *
 * @module render/customization/ribbon-control-catalog-core
 */
import type { TabEntry } from './ribbon-control-catalog-types';

export const RIBBON_CATALOG_CORE_TABS = {
	home: {
		clipboard: {
			label: 'Clipboard',
			controls: { paste: 'Paste', cut: 'Cut', copy: 'Copy', formatPainter: 'Format Painter' },
		},
		slides: {
			label: 'Slides',
			controls: {
				newSlide: 'New Slide',
				layout: 'Layout',
				reset: 'Reset',
				section: 'Section',
				slideTemplates: 'Slide templates',
			},
		},
		font: {
			label: 'Font',
			controls: {
				fontFamily: 'Font',
				fontSize: 'Font Size',
				increaseFontSize: 'Increase Font Size',
				decreaseFontSize: 'Decrease Font Size',
				clearFormatting: 'Clear All Formatting',
				bold: 'Bold',
				italic: 'Italic',
				underline: 'Underline',
				strikethrough: 'Strikethrough',
				shadow: 'Text Shadow',
				characterSpacing: 'Character Spacing',
				changeCase: 'Change Case',
				fontColor: 'Font Color',
				highlightColor: 'Text Highlight Color',
				superscript: 'Superscript',
				subscript: 'Subscript',
			},
		},
		paragraph: {
			label: 'Paragraph',
			controls: {
				bullets: 'Bullets (toggle and gallery)',
				numbering: 'Numbering (toggle and gallery)',
				decreaseIndent: 'Decrease List Level',
				increaseIndent: 'Increase List Level',
				lineSpacing: 'Line Spacing',
				alignLeft: 'Align Left',
				alignCenter: 'Center',
				alignRight: 'Align Right',
				justify: 'Justify',
				columns: 'Columns',
				textDirection: 'Text Direction',
				alignText: 'Align Text',
			},
		},
		drawing: {
			label: 'Drawing',
			controls: {
				shapes: 'Shapes',
				arrange: 'Arrange',
				quickStyles: 'Quick Styles (Shape Styles gallery)',
				shapeFill: 'Shape Fill',
				shapeOutline: 'Shape Outline',
				shapeEffects: 'Shape Effects gallery',
			},
		},
		arrange: {
			label: 'Arrange',
			controls: {
				bringForward: 'Bring Forward',
				sendBackward: 'Send Backward',
				bringToFront: 'Bring to Front',
				sendToBack: 'Send to Back',
				flipHorizontal: 'Flip Horizontal',
				flipVertical: 'Flip Vertical',
				duplicate: 'Duplicate',
				delete: 'Delete',
				group: 'Group',
				ungroup: 'Ungroup',
				align: 'Align',
				mergeShapes: 'Merge Shapes',
				crop: 'Crop',
				outlineWidth: 'Outline width',
			},
		},
		editing: {
			label: 'Editing',
			controls: { find: 'Find', replace: 'Replace', select: 'Select' },
		},
	},
	insert: {
		slides: { label: 'Slides', controls: { newSlide: 'New Slide' } },
		tables: { label: 'Tables', controls: { table: 'Table' } },
		images: { label: 'Images', controls: { pictures: 'Pictures' } },
		illustrations: {
			label: 'Illustrations',
			controls: { shapes: 'Shapes', smartArt: 'SmartArt', chart: 'Chart' },
		},
		links: { label: 'Links', controls: { link: 'Link', action: 'Action button' } },
		comments: { label: 'Comments', controls: { comment: 'Comment' } },
		text: {
			label: 'Text',
			controls: { textBox: 'Text Box', field: 'Header, date, slide number field' },
		},
		symbols: { label: 'Symbols', controls: { equation: 'Equation', symbol: 'Symbol' } },
		media: { label: 'Media', controls: { media: 'Video / Audio' } },
	},
	draw: {
		tools: {
			label: 'Drawing Tools',
			controls: {
				select: 'Select',
				pen: 'Pen',
				highlighter: 'Highlighter',
				eraser: 'Eraser',
				penColor: 'Pen colour',
				penWidth: 'Pen width',
			},
		},
		convert: { label: 'Convert', controls: { inkToShape: 'Ink to Shape' } },
	},
	design: {
		themes: {
			label: 'Themes',
			controls: { browseThemes: 'Themes gallery', editTheme: 'Edit theme' },
		},
		variants: {
			label: 'Variants',
			controls: { colors: 'Variants: Colors gallery', fonts: 'Variants: Fonts gallery' },
		},
		customize: {
			label: 'Customize',
			controls: { slideSize: 'Slide Size', formatBackground: 'Format Background' },
		},
	},
} as const satisfies Readonly<Record<string, TabEntry>>;
