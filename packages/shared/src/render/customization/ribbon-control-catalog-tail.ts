/**
 * The Transitions to Help tabs and the contextual tabs of `RIBBON_CONTROL_CATALOG` (split only to keep files short).
 *
 * @module render/customization/ribbon-control-catalog-tail
 */
import type { TabEntry } from './ribbon-control-catalog-types';

export const RIBBON_CATALOG_TAIL_TABS = {
	transitions: {
		preview: { label: 'Preview', controls: { preview: 'Preview' } },
		transitionToThisSlide: {
			label: 'Transition to This Slide',
			controls: { gallery: 'Transition gallery', effectOptions: 'Effect Options' },
		},
		timing: {
			label: 'Timing',
			controls: {
				sound: 'Sound',
				duration: 'Duration',
				applyToAll: 'Apply To All',
				advanceOnClick: 'On Mouse Click',
				advanceAfter: 'After',
			},
		},
	},
	animations: {
		preview: { label: 'Preview', controls: { preview: 'Preview' } },
		animation: {
			label: 'Animation',
			controls: { gallery: 'Animation gallery', effectOptions: 'Effect Options' },
		},
		motionPath: { label: 'Motion Paths', controls: { gallery: 'Motion path gallery' } },
		advancedAnimation: {
			label: 'Advanced Animation',
			controls: {
				addAnimation: 'Add Animation',
				animationPane: 'Animation Pane',
				trigger: 'Trigger',
				animationPainter: 'Animation Painter',
				remove: 'Remove animation',
			},
		},
		timing: {
			label: 'Timing',
			controls: { start: 'Start', duration: 'Duration', delay: 'Delay', reorder: 'Reorder' },
		},
	},
	slideShow: {
		startSlideShow: {
			label: 'Start Slide Show',
			controls: {
				fromBeginning: 'From Beginning',
				fromCurrent: 'From Current Slide',
				customShow: 'Custom Slide Show',
			},
		},
		present: {
			label: 'Present',
			controls: { presenterView: 'Presenter View', broadcast: 'Present Online' },
		},
		setUp: {
			label: 'Set Up',
			controls: {
				setUpSlideShow: 'Set Up Slide Show',
				hideSlide: 'Hide Slide',
				rehearseTimings: 'Rehearse Timings',
				record: 'Record',
				rehearseWithCoach: 'Rehearse with Coach',
			},
		},
		captions: {
			label: 'Captions & Subtitles',
			controls: { subtitles: 'Always Use Subtitles', subtitleSettings: 'Subtitle Settings' },
		},
	},
	record: {
		camera: { label: 'Camera', controls: { cameo: 'Cameo' } },
		record: {
			label: 'Record',
			controls: { fromBeginning: 'From Beginning', fromCurrent: 'From Current Slide' },
		},
		manage: { label: 'Manage', controls: { clear: 'Clear', reset: 'Reset to Cameo' } },
		help: { label: 'Help', controls: { learnMore: 'Learn more' } },
	},
	review: {
		proofing: { label: 'Proofing', controls: { spelling: 'Spelling', thesaurus: 'Thesaurus' } },
		accessibility: { label: 'Accessibility', controls: { check: 'Check Accessibility' } },
		language: { label: 'Language', controls: { translate: 'Translate' } },
		comments: {
			label: 'Comments',
			controls: {
				newComment: 'New Comment',
				delete: 'Delete',
				previous: 'Previous',
				next: 'Next',
				showComments: 'Show Comments',
			},
		},
		compare: { label: 'Compare', controls: { compare: 'Compare', markAllRead: 'Mark all read' } },
		protect: {
			label: 'Protect',
			controls: { readOnly: 'Read-only', restrictPermission: 'Restrict Permission' },
		},
		ink: { label: 'Ink', controls: { hideInk: 'Hide Ink' } },
	},
	view: {
		presentationViews: {
			label: 'Presentation Views',
			controls: {
				normal: 'Normal',
				outline: 'Outline View',
				slideSorter: 'Slide Sorter',
				notesPage: 'Notes Page',
				readingView: 'Reading View',
			},
		},
		masterViews: {
			label: 'Master Views',
			controls: {
				slideMaster: 'Slide Master',
				handoutMaster: 'Handout Master',
				notesMaster: 'Notes Master',
			},
		},
		show: {
			label: 'Show',
			controls: {
				ruler: 'Ruler',
				gridlines: 'Gridlines',
				guides: 'Guides',
				snapToGrid: 'Snap to Grid',
				snapToShape: 'Snap to Shape',
				addGuide: 'Add horizontal / vertical guide',
				selectionPane: 'Selection Pane',
				eyedropper: 'Eyedropper',
				notes: 'Notes',
			},
		},
		zoom: { label: 'Zoom', controls: { zoom: 'Zoom', fitToWindow: 'Fit to Window' } },
		window: {
			label: 'Window',
			controls: { templateEditing: 'Edit template elements', macros: 'Macros' },
		},
	},
	help: {
		help: {
			label: 'Help',
			controls: {
				options: 'Options',
				keyboardShortcuts: 'Keyboard shortcuts',
				accessibility: 'Accessibility checker',
			},
		},
	},
	shapeFormat: {
		shapeStyles: {
			label: 'Shape Styles',
			controls: { gallery: 'Shape Styles gallery', shapeEffects: 'Shape Effects gallery' },
		},
		wordArtStyles: { label: 'WordArt Styles', controls: { gallery: 'WordArt Styles gallery' } },
	},
	pictureFormat: {
		pictureStyles: {
			label: 'Picture Styles',
			controls: { gallery: 'Picture Styles gallery', pictureEffects: 'Picture Effects gallery' },
		},
	},
	tableDesign: {
		tableStyles: { label: 'Table Styles', controls: { gallery: 'Table Styles gallery' } },
	},
	chartDesign: {
		chartLayouts: { label: 'Chart Layouts', controls: { quickLayout: 'Quick Layout gallery' } },
		chartStyles: {
			label: 'Chart Styles',
			controls: { changeColors: 'Change Colors gallery', gallery: 'Chart Styles gallery' },
		},
	},
	smartArtDesign: {
		smartArtStyles: {
			label: 'SmartArt Styles',
			controls: { changeColors: 'Change Colors gallery', gallery: 'SmartArt Styles gallery' },
		},
	},
} as const satisfies Readonly<Record<string, TabEntry>>;
