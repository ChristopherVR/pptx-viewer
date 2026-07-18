import type { ToolbarActionId } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
/**
 * Comprehensive end-to-end tests for the Toolbar component.
 *
 * Uses react-dom/server renderToStaticMarkup to render components with hooks,
 * then validates the resulting HTML output.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import type { ToolbarProps } from './toolbar-types';

// Mock react-i18next since some sub-components use useTranslation
// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const translations: Record<string, string | ((o: Record<string, unknown>) => string)> = {
				// ToolbarPrimaryRow
				'pptx.toolbar.toggleSlidesPanel': 'Toggle slides panel',
				'pptx.toolbar.undo': 'Undo',
				'pptx.toolbar.undoAction': (o: Record<string, unknown>) => `Undo: ${o.action}`,
				'pptx.toolbar.redo': 'Redo',
				'pptx.toolbar.redoAction': (o: Record<string, unknown>) => `Redo: ${o.action}`,
				'pptx.findReplace.title': 'Find and Replace',
				'pptx.toolbar.comments': 'Comments',
				'pptx.toolbar.share': 'Share',
				'pptx.toolbar.sharingUsers': (o: Record<string, unknown>) =>
					`Sharing with ${o.count} users`,
				'pptx.toolbar.sharingCount': (o: Record<string, unknown>) => `${o.count}`,
				'pptx.toolbar.toggleInspector': 'Toggle inspector panel',
				'pptx.toolbar.settingsShortcuts': 'Settings & Shortcuts',
				'pptx.toolbar.settings': 'Settings',
				'pptx.toolbar.readOnly': 'Read-only',
				// TitleBar
				'pptx.titleBar.autoSave': 'AutoSave',
				'pptx.titleBar.autoSaveOn': 'On',
				'pptx.titleBar.autoSaveOff': 'Off',
				'pptx.titleBar.toggleAutoSave': 'Toggle AutoSave',
				'pptx.titleBar.save': 'Save',
				'pptx.titleBar.savedToThisPc': 'Saved to this PC',
				'pptx.titleBar.defaultFileName': 'Presentation',
				'pptx.titleBar.search': 'Search',
				'pptx.titleBar.searchPlaceholder': 'Tell me what you want to do',
				'pptx.titleBar.searchCommands': 'Actions',
				'pptx.titleBar.searchContent': 'Find in Slides',
				'pptx.titleBar.searchNoResults': 'No results',
				'pptx.titleBar.record': 'Record',
				'pptx.statusBar.unsavedChanges': 'Unsaved changes',
				// AnimationsSection
				'pptx.animations.previewTooltip': 'Preview animation on selected element',
				'pptx.animations.preview': 'Preview',
				'pptx.animations.addTooltip': 'Add animation to selected element',
				'pptx.animations.addAnimation': 'Add Animation',
				'pptx.animations.removeTooltip': 'Remove animation from selected element',
				'pptx.animations.remove': 'Remove',
				'pptx.animations.openPanelTooltip': 'Open Animation Panel in Inspector',
				'pptx.animations.animationPanel': 'Animation Panel',
				'pptx.animations.applyAnimation': (o: Record<string, unknown>) =>
					`Apply ${o.name} animation`,
				'pptx.animations.group.entrance': 'Entrance',
				'pptx.animations.group.emphasis': 'Emphasis',
				'pptx.animations.group.exit': 'Exit',
				'pptx.animations.preset.appear': 'Appear',
				'pptx.animations.preset.fadeIn': 'Fade In',
				'pptx.animations.preset.flyIn': 'Fly In',
				'pptx.animations.preset.pulse': 'Pulse',
				'pptx.animations.preset.spin': 'Spin',
				'pptx.animations.preset.disappear': 'Disappear',
				'pptx.animations.preset.fadeOut': 'Fade Out',
				// ArrangeSection
				'pptx.arrange.align': (o: Record<string, unknown>) => `Align ${o.direction}`,
				'pptx.arrange.copy': 'Copy',
				'pptx.arrange.cut': 'Cut',
				'pptx.arrange.paste': 'Paste',
				'pptx.arrange.formatPainter': 'Format Painter',
				'pptx.arrange.format': 'Format',
				'pptx.arrange.flipHorizontally': 'Flip horizontally',
				'pptx.arrange.flipH': 'Flip H',
				'pptx.arrange.flipVertically': 'Flip vertically',
				'pptx.arrange.flipV': 'Flip V',
				'pptx.arrange.sendBackward': 'Send backward',
				'pptx.arrange.bringForward': 'Bring forward',
				'pptx.arrange.sendToBack': 'Send to back',
				'pptx.arrange.back': 'Back',
				'pptx.arrange.bringToFront': 'Bring to front',
				'pptx.arrange.front': 'Front',
				'pptx.arrange.duplicate': 'Duplicate',
				'pptx.arrange.delete': 'Delete',
				// Ribbon tab bar
				'pptx.ribbon.tab.file': 'File',
				'pptx.ribbon.tab.home': 'Home',
				'pptx.ribbon.tab.insert': 'Insert',
				'pptx.ribbon.tab.text': 'Text',
				'pptx.ribbon.tab.draw': 'Draw',
				'pptx.ribbon.tab.arrange': 'Arrange',
				'pptx.ribbon.tab.design': 'Design',
				'pptx.ribbon.tab.transitions': 'Transitions',
				'pptx.ribbon.tab.animations': 'Animations',
				'pptx.ribbon.tab.slideShow': 'Slide Show',
				'pptx.ribbon.tab.record': 'Record',
				'pptx.ribbon.tab.review': 'Review',
				'pptx.ribbon.tab.view': 'View',
				'pptx.ribbon.tab.help': 'Help',
				'pptx.ribbon.collapseRibbon': 'Collapse the ribbon',
				'pptx.ribbon.expandRibbon': 'Expand the ribbon',
				// DrawSection
				'pptx.ribbon.tool.select': 'Select',
				'pptx.ribbon.tool.pen': 'Pen',
				'pptx.ribbon.tool.highlighter': 'Highlighter',
				'pptx.ribbon.tool.eraser': 'Eraser',
				'pptx.ribbon.tool.freeform': 'Freeform',
				'pptx.ribbon.penColour': 'Pen colour',
				'pptx.ribbon.colour': 'Colour',
				'pptx.ribbon.strokeWidth': 'Stroke width',
				'pptx.ribbon.width': 'Width',
				// TextSection formatting/alignment
				'pptx.textPanel.bold': 'Bold',
				'pptx.textPanel.italic': 'Italic',
				'pptx.textPanel.underline': 'Underline',
				'pptx.textPanel.strikethrough': 'Strikethrough',
				'pptx.ribbon.alignLeft': 'Align left',
				'pptx.ribbon.alignCenter': 'Align center',
				'pptx.ribbon.alignRight': 'Align right',
				'pptx.ribbon.justify': 'Justify',
				// Help tab / OverflowMenu
				'pptx.ribbon.exportPng': 'Export as PNG',
				'pptx.ribbon.exportPdf': 'Export as PDF',
				'pptx.ribbon.exportVideo': 'Export as Video',
				'pptx.ribbon.exportGif': 'Export as GIF',
				'pptx.file.packageTooltip': 'Package for Sharing',
				'pptx.file.saveAsPptxTooltip': 'Save as Presentation (.pptx)',
				'pptx.file.saveAsPpsxTooltip': 'Save as Slide Show (.ppsx)',
				'pptx.file.saveAsPptmTooltip': 'Save as Macro-Enabled (.pptm)',
				'pptx.file.copyImageTooltip': 'Copy Slide as Image',
				'pptx.print.printButton': 'Print',
				'pptx.ribbon.accessibilityCheck': 'Accessibility Check',
				'pptx.settings.keyboardShortcuts': 'Keyboard Shortcuts',
				'pptx.ribbon.versionHistory': 'Version History',
				'pptx.ribbon.documentProperties': 'Document Properties',
				'pptx.security.protectPresentation': 'Protect Presentation',
				'pptx.ribbon.embedFonts': 'Embed Fonts',
				'pptx.viewer.digitalSignatures': 'Digital Signatures',
				'pptx.ribbon.moreActions': 'More actions',
				'pptx.overflow.closeMenu': 'Close menu',
				// Shortcut reference
				'pptx.shortcuts.title': 'Keyboard shortcuts',
				'pptx.shortcuts.close': 'Close',
				'pptx.shortcuts.action.copyElement': 'Copy selected element',
				'pptx.shortcuts.action.cutElement': 'Cut selected element',
				'pptx.shortcuts.action.pasteElement': 'Paste element',
				'pptx.shortcuts.action.duplicateElement': 'Duplicate selected element',
				'pptx.shortcuts.action.deleteElement': 'Delete selected element',
				'pptx.shortcuts.action.nudgeElement': 'Nudge selected element',
				'pptx.shortcuts.action.nudgeElementLarge': 'Nudge selected element (large)',
				'pptx.shortcuts.action.zoomCanvas': 'Zoom canvas',
				'pptx.shortcuts.action.commitTextEdit': 'Commit inline text edit',
				'pptx.shortcuts.action.cancelTextEdit': 'Cancel inline text / close menus',
				// HomeSection - Clipboard
				'pptx.ribbon.clipboard': 'Clipboard',
				// InsertSection
				'pptx.insert.addTextBox': 'Add text box',
				'pptx.insert.addShape': 'Add shape',
				'pptx.insert.insertTable': 'Insert table',
				'pptx.insert.insertSmartArt': 'Insert SmartArt',
				'pptx.insert.insertEquation': 'Insert Equation',
				'pptx.insert.shape': 'Shape',
				'pptx.insert.shapeType': 'Shape type',
				'pptx.ribbon.textBox': 'Text Box',
				'pptx.ribbon.image': 'Image',
				'pptx.ribbon.insertImage': 'Insert image',
				'pptx.ribbon.media': 'Media',
				'pptx.ribbon.insertMedia': 'Insert audio or video',
				'pptx.ribbon.table': 'Table',
				'pptx.ribbon.insertTable': 'Insert 3x3 table',
				'pptx.ribbon.smartArt': 'SmartArt',
				'pptx.ribbon.insertSmartArt': 'Insert SmartArt diagram',
				'pptx.ribbon.chart': 'Chart',
				'pptx.ribbon.chartType': 'Chart type',
				'pptx.ribbon.insertChart': 'Insert chart',
				'pptx.ribbon.equation': 'Equation',
				'pptx.ribbon.insertEquation': 'Insert equation',
				'pptx.ribbon.action': 'Action',
				'pptx.ribbon.insertActionButton': 'Insert action button',
				'pptx.headerFooter.title': 'Header & Footer',
				// DesignSection
				'pptx.ribbon.browseThemes': 'Browse Themes',
				'pptx.ribbon.browseThemesTitle': 'Browse and apply built-in themes',
				'pptx.ribbon.editTheme': 'Edit Theme',
				'pptx.ribbon.editThemeTitle': 'Edit theme - theme editor not yet ported',
				'pptx.ribbon.slideSize': 'Slide Size',
				'pptx.ribbon.slideSizeTitle': 'Slide size / document properties',
				'pptx.ribbon.formatBackground': 'Format Background',
				'pptx.ribbon.formatBackgroundTitle': 'Format slide background - opens the Inspector',
				// TransitionsSection
				'pptx.ribbon.previewTransition': 'Preview transition',
				'pptx.ribbon.preview': 'Preview',
				'pptx.ribbon.transition.none': 'None',
				'pptx.ribbon.transition.fade': 'Fade',
				'pptx.ribbon.transition.push': 'Push',
				'pptx.ribbon.transition.wipe': 'Wipe',
				'pptx.ribbon.transition.split': 'Split',
				'pptx.ribbon.transition.reveal': 'Reveal',
				'pptx.ribbon.transition.cut': 'Cut',
				'pptx.ribbon.transition.cover': 'Cover',
				'pptx.ribbon.transition.uncover': 'Uncover',
				'pptx.ribbon.transitionTitle': (o: Record<string, unknown>) => `${o.name} transition`,
				'pptx.ribbon.duration': 'Duration:',
				'pptx.ribbon.transitionDurationTitle': 'Transition duration in seconds',
				'pptx.ribbon.applyTransitionToAll': 'Apply transition to all slides',
				'pptx.ribbon.advanceSlide': 'Advance Slide',
				'pptx.ribbon.onMouseClick': 'On Mouse Click',
				'pptx.ribbon.afterDuration': 'After:',
				'pptx.ribbon.advanceAfterSeconds': 'Advance after specified duration',
				'pptx.ribbon.sound': 'Sound:',
				'pptx.ribbon.soundNone': '[No Sound]',
				'pptx.ribbon.inspector': 'Inspector',
				'pptx.ribbon.openInspectorTransitions': 'Open Inspector for full transition options',
				'pptx.headerFooter.applyToAll': 'Apply to All',
				// SlideShowSection
				'pptx.slideShow.fromBeginningTooltip': 'Start slide show from beginning',
				'pptx.slideShow.fromBeginning': 'From Beginning',
				'pptx.slideShow.fromCurrentTooltip': 'Start slide show from current slide',
				'pptx.slideShow.fromCurrent': 'From Current Slide',
				'pptx.slideShow.presenterViewTooltip': 'Presenter view',
				'pptx.slideShow.presenterView': 'Presenter View',
				'pptx.slideShow.rehearseTimingsTooltip': 'Rehearse timings',
				'pptx.slideShow.rehearseTimings': 'Rehearse Timings',
				'pptx.slideShow.setUpTooltip': 'Set up slide show',
				'pptx.slideShow.setUp': 'Set Up Slide Show',
				'pptx.slideShow.broadcastTooltip': 'Broadcast slide show',
				'pptx.slideShow.broadcast': 'Broadcast',
				'pptx.slideShow.subtitlesTooltip': 'Toggle subtitles',
				'pptx.slideShow.subtitles': 'Subtitles',
				// ReviewSection
				'pptx.review.toggleComments': 'Toggle comments panel',
				'pptx.review.spelling': 'Spelling',
				'pptx.review.toggleSpellCheck': 'Toggle spell check',
				'pptx.ribbon.compare': 'Compare',
				'pptx.ribbon.compareTitle': 'Compare with another presentation',
				// ViewSection
				'pptx.statusBar.normalView': 'Normal view',
				'pptx.view.normal': 'Normal',
				'pptx.view.slideSorterTooltip': 'Slide Sorter view',
				'pptx.slideSorter.title': 'Slide Sorter',
				'pptx.view.readingView': 'Reading View',
				'pptx.view.presentationViews': 'Presentation Views',
				'pptx.view.slideMasterTooltip': 'Edit slide masters and layouts',
				'pptx.master.title': 'Slide Master',
				'pptx.view.masterViews': 'Master Views',
				'pptx.view.zoomToFitTooltip': 'Zoom to fit slide in window',
				'pptx.view.zoomToFit': 'Zoom to Fit',
				'pptx.slideSorter.zoom': 'Zoom',
				'pptx.view.templateEditingTooltip': 'Toggle template/master element editing',
				'pptx.ribbon.templatesOn': 'Templates On',
				'pptx.ribbon.templatesOff': 'Templates Off',
				'pptx.selectionPane.title': 'Selection Pane',
				'pptx.view.selection': 'Selection',
				'pptx.view.eyedropperTooltip': 'Eyedropper: sample a colour from the slide',
				'pptx.ribbon.eyedropper': 'Eyedropper',
				'pptx.grid.toggleGrid': 'Toggle grid',
				'pptx.grid.grid': 'Grid',
				'pptx.ruler.toggleRulers': 'Toggle rulers',
				'pptx.ruler.rulers': 'Rulers',
				'pptx.grid.snapToGrid': 'Snap to grid',
				'pptx.grid.snapToShape': 'Snap to shape',
				'pptx.view.addHorizontalGuide': 'Add horizontal guide',
				'pptx.view.hGuide': 'H Guide',
				'pptx.view.addVerticalGuide': 'Add vertical guide',
				'pptx.view.vGuide': 'V Guide',
				'pptx.view.toggleSpellCheck': 'Toggle spell check',
				'pptx.view.spell': 'Spell',
			};
			const v = translations[key];
			if (typeof v === 'function') {
				return v(opts ?? {});
			}
			if (typeof v === 'string') {
				return v;
			}
			const fallback = translationsEn[key];
			if (fallback === undefined) {
				return key;
			}
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render a React element to HTML and return it for assertion. */
function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

// ---------------------------------------------------------------------------
// Mock ToolbarProps factory
// ---------------------------------------------------------------------------

function createMockToolbarProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
	return {
		mode: 'edit',
		canEdit: true,
		isNarrowViewport: false,
		isSidebarCollapsed: false,
		isInspectorPaneOpen: false,
		isCompactToolbarOpen: false,
		toolbarSection: 'home',
		scale: 1,
		canUndo: false,
		canRedo: false,
		undoLabel: undefined,
		redoLabel: undefined,
		findReplaceOpen: false,
		selectedElement: null,
		editTemplateMode: false,
		newShapeType: 'rect',
		activeTool: 'select',
		drawingColor: '#000000',
		drawingWidth: 2,
		clipboardPayload: null,
		onSetMode: vi.fn<() => void>(),
		onToggleSidebar: vi.fn<() => void>(),
		onToggleInspector: vi.fn<() => void>(),
		onToggleCompactToolbar: vi.fn<() => void>(),
		onSetToolbarSection: vi.fn<() => void>(),
		onZoomIn: vi.fn<() => void>(),
		onZoomOut: vi.fn<() => void>(),
		onZoomToFit: vi.fn<() => void>(),
		onUndo: vi.fn<() => void>(),
		onRedo: vi.fn<() => void>(),
		onToggleFindReplace: vi.fn<() => void>(),
		onSetNewShapeType: vi.fn<() => void>(),
		onAddTextBox: vi.fn<() => void>(),
		onAddShape: vi.fn<() => void>(),
		onAddTable: vi.fn<() => void>(),
		onAddSmartArt: vi.fn<() => void>(),
		onAddEquation: vi.fn<() => void>(),
		onAddActionButton: vi.fn<() => void>(),
		onInsertField: vi.fn<() => void>(),
		onOpenImagePicker: vi.fn<() => void>(),
		onOpenMediaPicker: vi.fn<() => void>(),
		onSetActiveTool: vi.fn<() => void>(),
		onSetDrawingColor: vi.fn<() => void>(),
		onSetDrawingWidth: vi.fn<() => void>(),
		onSetEditTemplateMode: vi.fn<() => void>(),
		spellCheckEnabled: false,
		showGrid: false,
		showRulers: false,
		snapToGrid: false,
		snapToShape: false,
		onSetSpellCheckEnabled: vi.fn<() => void>(),
		onSetShowGrid: vi.fn<() => void>(),
		onSetShowRulers: vi.fn<() => void>(),
		onSetSnapToGrid: vi.fn<() => void>(),
		onSetSnapToShape: vi.fn<() => void>(),
		onAddGuide: vi.fn<() => void>(),
		onAlignElements: vi.fn<() => void>(),
		onCopy: vi.fn<() => void>(),
		onCut: vi.fn<() => void>(),
		onPaste: vi.fn<() => void>(),
		onFlip: vi.fn<() => void>(),
		onMoveLayer: vi.fn<() => void>(),
		onMoveLayerToEdge: vi.fn<() => void>(),
		onDuplicate: vi.fn<() => void>(),
		onDelete: vi.fn<() => void>(),
		onCreatePresentation: vi.fn<(templateId: string) => void>(),
		onExportPng: vi.fn<() => void>(),
		onExportPdf: vi.fn<() => void>(),
		onExportVideo: vi.fn<() => void>(),
		onExportGif: vi.fn<() => void>(),
		onPackageForSharing: vi.fn<() => void>(),
		onSaveAsPptx: vi.fn<() => void>(),
		onSaveAsPpsx: vi.fn<() => void>(),
		onSaveAsPptm: vi.fn<() => void>(),
		hasMacros: false,
		onCopySlideAsImage: vi.fn<() => void>(),
		onPrint: vi.fn<() => void>(),
		onToggleShortcuts: vi.fn<() => void>(),
		onRunAccessibilityCheck: vi.fn<() => void>(),
		onToggleSlideSorter: vi.fn<() => void>(),
		onUpdateTextStyle: vi.fn<() => void>(),
		onTransformTextCase: vi.fn<() => void>(),
		isOverflowMenuOpen: false,
		onSetOverflowMenuOpen: vi.fn<() => void>(),
		layoutOptions: [{ path: 'layout1', name: 'Title Slide' }],
		onInsertSlideFromLayout: vi.fn<() => void>(),
		customShows: [],
		activeCustomShowId: null,
		onSetActiveCustomShowId: vi.fn<() => void>(),
		onCreateCustomShow: vi.fn<() => void>(),
		onRenameActiveCustomShow: vi.fn<() => void>(),
		onDeleteActiveCustomShow: vi.fn<() => void>(),
		onToggleCurrentSlideInActiveShow: vi.fn<() => void>(),
		isCurrentSlideInActiveShow: false,
		onToggleVersionHistory: vi.fn<() => void>(),
		onOpenPasswordProtection: vi.fn<() => void>(),
		onOpenDocumentProperties: vi.fn<() => void>(),
		onOpenFontEmbedding: vi.fn<() => void>(),
		onOpenDigitalSignatures: vi.fn<() => void>(),
		onEnterMasterView: vi.fn<() => void>(),
		onCloseMasterView: vi.fn<() => void>(),
		onEnterPresenterView: vi.fn<() => void>(),
		onEnterRehearsalMode: vi.fn<() => void>(),
		onToggleThemeEditor: vi.fn<() => void>(),
		isThemeEditorOpen: false,
		onToggleThemeGallery: vi.fn<() => void>(),
		isThemeGalleryOpen: false,
		onCompare: vi.fn<() => void>(),
		onToggleComments: vi.fn<() => void>(),
		isCommentsPanelOpen: false,
		spellCheckActive: false,
		slideCommentCount: 0,
		formatPainterActive: false,
		onToggleFormatPainter: vi.fn<() => void>(),
		isSelectionPaneOpen: false,
		onToggleSelectionPane: vi.fn<() => void>(),
		eyedropperActive: false,
		onToggleEyedropper: vi.fn<() => void>(),
		onOpenSetUpSlideShow: vi.fn<() => void>(),
		onOpenBroadcastDialog: vi.fn<() => void>(),
		onToggleSubtitles: vi.fn<() => void>(),
		showSubtitles: false,
		...overrides,
	};
}

// Lazy-import the components after mocking
const { Toolbar } = await import('../Toolbar');
const { HomeSection } = await import('./HomeSection');
const { FileSection } = await import('./FileSection');
const { InsertSection } = await import('./InsertSection');
const { DrawSection } = await import('./DrawSection');
const { DesignSection, TransitionsSection } = await import('./DesignTransitionsReviewSection');
const { ReviewSection } = await import('./ReviewSection');
const { AnimationsSection } = await import('./AnimationsSection');
const { SlideShowSection } = await import('./SlideShowSection');
const { TextSection } = await import('./TextSection');
const { ViewSection } = await import('./ViewSection');
const { ToolbarPrimaryRow } = await import('./ToolbarPrimaryRow');
const { ArrangeSection } = await import('./ArrangeSection');
const { TitleBar } = await import('./TitleBar');

// ---------------------------------------------------------------------------
// Mock TitleBarProps factory
// ---------------------------------------------------------------------------

function createTitleBarProps(
	overrides: Partial<import('./TitleBar').TitleBarProps> = {},
): import('./TitleBar').TitleBarProps {
	return {
		mode: 'edit',
		canEdit: true,
		isDirty: false,
		autosaveEnabled: true,
		onToggleAutosave: vi.fn<() => void>(),
		canUndo: true,
		canRedo: true,
		onUndo: vi.fn<() => void>(),
		onRedo: vi.fn<() => void>(),
		findReplaceOpen: false,
		onToggleFindReplace: vi.fn<() => void>(),
		...overrides,
	};
}

// ===========================================================================
// 1. Tab Navigation Tests
// ===========================================================================

describe('toolbar - tab navigation', () => {
	it('renders the toolbar with role="toolbar"', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps()));
		expect(html).toContain('role="toolbar"');
		expect(html).toContain('aria-label="Presentation toolbar"');
	});

	it('renders all 12 tab buttons when mode is edit', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps({ mode: 'edit' })));
		const expectedLabels = [
			'File',
			'Home',
			'Insert',
			'Draw',
			'Design',
			'Transitions',
			'Animations',
			'Slide Show',
			'Record',
			'Review',
			'View',
			'Help',
		];
		for (const label of expectedLabels) {
			expect(html, `Tab "${label}" should be rendered`).toContain(`>${label}</button>`);
		}
		expect(expectedLabels).toHaveLength(12);
	});

	it('does not render tabs when mode is present', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps({ mode: 'present' })));
		// In present mode, the ribbon tab bar should not render
		expect(html).not.toContain('>Home</button>');
		expect(html).not.toContain('>Insert</button>');
		expect(html).not.toContain('>Design</button>');
	});

	it('renders tabs when mode is master', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps({ mode: 'master' })));
		expect(html).toContain('>Home</button>');
		expect(html).toContain('>View</button>');
	});

	it('file tab has special primary styling', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps()));
		// File tab should have bg-primary in its class
		expect(html).toMatch(/bg-primary[^"]*">File<\/button>/u);
	});

	it('active tab has the after pseudo-element indicator class', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'insert' })),
		);
		// Active tab (Insert) should have after:bg-primary
		expect(html).toMatch(/after:bg-primary[^"]*">Insert<\/button>/u);
	});

	it('inactive tabs have muted text styling', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'home' })),
		);
		// Draw tab (not active) should have text-muted-foreground
		expect(html).toMatch(/text-muted-foreground[^"]*">Draw<\/button>/u);
	});
});

// ===========================================================================
// 2. Home Tab Tests
// ===========================================================================

describe('toolbar - Home tab', () => {
	it('renders clipboard group with Paste, Cut, Copy, Format Painter', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				formatPainterActive: false,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				onToggleFormatPainter: vi.fn<() => void>(),
				layoutOptions: [{ path: 'l1', name: 'Title' }],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Paste"');
		expect(html).toContain('title="Cut"');
		expect(html).toContain('title="Copy"');
		expect(html).toContain('title="Format Painter"');
	});

	it('renders Clipboard group label', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Clipboard');
	});

	it('renders New Slide button', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [{ path: 'l1', name: 'Title' }],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="New Slide"');
		expect(html).toContain('New Slide');
	});

	it('font family display shows default value', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Segoe UI');
	});

	it('font size display shows default value', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('>24</span>');
	});

	it('paste is disabled when no clipboard payload', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/disabled[^>]*title="Paste"/u);
	});

	it('font group label is present', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('>Font</span>');
	});
});

// ===========================================================================
// 3. File Tab Tests
// ===========================================================================

describe('toolbar - File tab', () => {
	const createFileProps = (overrides = {}) => ({
		onClose: vi.fn<() => void>(),
		onCreatePresentation: vi.fn<(templateId: string) => void>(),
		onSaveAsPptx: vi.fn<() => void>(),
		onExportPng: vi.fn<() => void>(),
		onExportPdf: vi.fn<() => void>(),
		onExportVideo: vi.fn<() => void>(),
		onExportGif: vi.fn<() => void>(),
		onPackageForSharing: vi.fn<() => void>(),
		onSaveAsPpsx: vi.fn<() => void>(),
		onSaveAsPptm: vi.fn<() => void>(),
		hasMacros: false,
		onCopySlideAsImage: vi.fn<() => void>(),
		onPrint: vi.fn<() => void>(),
		onOpenDocumentProperties: vi.fn<() => void>(),
		onOpenPasswordProtection: vi.fn<() => void>(),
		onOpenFontEmbedding: vi.fn<() => void>(),
		onOpenDigitalSignatures: vi.fn<() => void>(),
		...overrides,
	});

	it('renders the complete PowerPoint-style backstage navigation', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		for (const label of [
			'Home',
			'New',
			'Open',
			'Info',
			'Save',
			'Save As',
			'Print',
			'Share',
			'Export',
			'Close',
			'Account',
			'Options',
		]) {
			expect(html).toContain(label);
		}
	});

	it('renders templates and IndexedDB-backed recent section', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('Blank Presentation');
		expect(html).toContain('Warm Welcome');
		expect(html).toContain('Search recent presentations');
		expect(html).toContain('Date modified');
	});

	it('is a modal surface with a presentation back action', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-modal="true"');
		expect(html).toContain('aria-label="Back to presentation"');
	});
});

// ===========================================================================
// 4. Insert Tab Tests
// ===========================================================================

describe('toolbar - Insert tab', () => {
	const createInsertProps = (overrides = {}) => ({
		canEdit: true,
		newShapeType: 'rect' as const,
		onSetNewShapeType: vi.fn<() => void>(),
		onAddTextBox: vi.fn<() => void>(),
		onAddShape: vi.fn<() => void>(),
		onAddTable: vi.fn<() => void>(),
		onAddSmartArt: vi.fn<() => void>(),
		onAddEquation: vi.fn<() => void>(),
		onAddActionButton: vi.fn<() => void>(),
		onInsertField: vi.fn<() => void>(),
		onOpenImagePicker: vi.fn<() => void>(),
		onOpenMediaPicker: vi.fn<() => void>(),
		...overrides,
	});

	it('renders Text, Shape, Image, Media, Table buttons', () => {
		const html = render(React.createElement(InsertSection, createInsertProps()));
		expect(html).toContain('title="Add text box"');
		expect(html).toContain('title="Add shape"');
		expect(html).toContain('title="Insert image"');
		expect(html).toContain('title="Insert audio or video"');
		expect(html).toContain('title="Insert table"');
	});

	it('renders SmartArt and Equation buttons', () => {
		const html = render(React.createElement(InsertSection, createInsertProps()));
		expect(html).toContain('title="Insert SmartArt"');
		expect(html).toContain('title="Insert Equation"');
	});

	it('renders Action button', () => {
		const html = render(React.createElement(InsertSection, createInsertProps()));
		expect(html).toContain('title="Insert action button"');
		expect(html).toContain('>Action');
	});

	it('renders Field button when onInsertField is provided', () => {
		const html = render(
			React.createElement(InsertSection, createInsertProps({ onInsertField: vi.fn<() => void>() })),
		);
		expect(html).toContain('title="Insert Field"');
	});

	it('does not render Field button when onInsertField is undefined', () => {
		const html = render(
			React.createElement(InsertSection, createInsertProps({ onInsertField: undefined })),
		);
		expect(html).not.toContain('title="Insert Field"');
	});

	it('renders Header & Footer when a host callback is provided', () => {
		const html = render(
			React.createElement(
				InsertSection,
				createInsertProps({ onOpenHeaderFooter: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('Header &amp; Footer');
	});

	it('buttons are disabled when canEdit is false', () => {
		const html = render(React.createElement(InsertSection, createInsertProps({ canEdit: false })));
		expect(html).toMatch(/disabled[^>]*title="Add text box"/u);
	});
});

// ===========================================================================
// 5. Draw Tab Tests
// ===========================================================================

describe('toolbar - Draw tab', () => {
	it('renders five drawing tool buttons (Select, Pen, Highlighter, Eraser, Freeform)', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'select',
				drawingColor: '#000000',
				drawingWidth: 2,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Select"');
		expect(html).toContain('title="Pen"');
		expect(html).toContain('title="Highlighter"');
		expect(html).toContain('title="Eraser"');
		expect(html).toContain('title="Freeform"');
	});

	it('active tool has highlight styling', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'pen',
				drawingColor: '#000000',
				drawingWidth: 2,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		// The pen button should have bg-accent class since pen is active
		expect(html).toMatch(/bg-accent[^"]*"[^>]*title="Pen"/u);
	});

	it('renders color picker input', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'select',
				drawingColor: '#ff0000',
				drawingWidth: 2,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('type="color"');
		expect(html).toContain('value="#ff0000"');
	});

	it('renders width range control', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'select',
				drawingColor: '#000000',
				drawingWidth: 5,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('type="range"');
		expect(html).toContain('value="5"');
	});

	it('renders Colour and Width labels', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'select',
				drawingColor: '#000000',
				drawingWidth: 2,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Colour');
		expect(html).toContain('Width');
	});
});

// ===========================================================================
// 6. Design Tab Tests
// ===========================================================================

describe('toolbar - Design tab', () => {
	it('renders Browse Themes button', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
				onOpenDocumentProperties: vi.fn<() => void>(),
				onToggleInspector: vi.fn<() => void>(),
				isInspectorPaneOpen: false,
			}),
		);
		expect(html).toContain('Browse Themes');
	});

	it('renders Edit Theme button', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
			}),
		);
		expect(html).toContain('Edit Theme');
	});

	it('renders Slide Size button', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
				onOpenDocumentProperties: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Slide Size');
	});

	it('renders Format Background button', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
				onToggleInspector: vi.fn<() => void>(),
				isInspectorPaneOpen: false,
			}),
		);
		expect(html).toContain('Format Background');
	});

	it('theme gallery button has active styling when open', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: true,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
			}),
		);
		// The browse themes button should have bg-primary
		expect(html).toMatch(/bg-primary[^"]*"[^>]*title="Browse and apply built-in themes"/u);
	});

	it('does not render Slide Size when handler is undefined', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
			}),
		);
		expect(html).not.toContain('Slide Size');
	});
});

// ===========================================================================
// 7. Transitions Tab Tests
// ===========================================================================

describe('toolbar - Transitions tab', () => {
	it('renders Preview button', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Preview transition"');
		expect(html).toContain('>Preview</button>');
	});

	it('renders transition presets (None, Fade, Push, Wipe, etc.)', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		const presets = ['None', 'Fade', 'Push', 'Wipe', 'Split', 'Reveal', 'Cut', 'Cover', 'Uncover'];
		for (const preset of presets) {
			expect(html, `Preset "${preset}" should be rendered`).toContain(`>${preset}</button>`);
		}
		expect(presets).toHaveLength(9);
	});

	it('renders Duration input', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Duration:');
		expect(html).toContain('title="Transition duration in seconds"');
	});

	it('renders Apply to All button', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Apply transition to all slides"');
		expect(html).toContain('Apply to All');
	});

	it('renders Inspector button', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Open Inspector for full transition options"');
		expect(html).toContain('>Inspector</button>');
	});

	it('inspector button has active styling when pane is open', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: true,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(
			/bg-primary[^"]*"[^>]*title="Open Inspector for full transition options"/u,
		);
	});
});

// ===========================================================================
// 8. Animations Tab Tests
// ===========================================================================

describe('toolbar - Animations tab', () => {
	it('renders Preview button', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Preview animation on selected element"');
		expect(html).toContain('>Preview</span>');
	});

	it('renders Add Animation dropdown', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Add animation to selected element"');
		expect(html).toContain('Add Animation');
	});

	it('renders Remove button', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Remove animation from selected element"');
		expect(html).toContain('>Remove</span>');
	});

	it('renders Animation Panel button', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Open Animation Panel in Inspector"');
		expect(html).toContain('Animation Panel');
	});

	it('buttons are disabled when no element is selected', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/title="Preview animation on selected element"[^>]*disabled/u);
		expect(html).toContain('title="Add animation to selected element"');
		expect(html).toMatch(/title="Remove animation from selected element"[^>]*disabled/u);
	});

	it('animation Panel button shows active state when inspector is open', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: true,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('bg-primary/15');
		expect(html).toContain('title="Open Animation Panel in Inspector"');
	});

	it('animation presets list includes Entrance, Emphasis, and Exit groups', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Entrance');
		expect(html).toContain('Emphasis');
		expect(html).toContain('Exit');
	});
});

// ===========================================================================
// 9. Slide Show Tab Tests
// ===========================================================================

describe('toolbar - Slide Show tab', () => {
	const createSlideShowProps = () => ({
		onPresent: vi.fn<() => void>(),
		onSetMode: vi.fn<() => void>() as (mode: 'edit' | 'present' | 'preview' | 'master') => void,
		onEnterPresenterView: vi.fn<() => void>(),
		onEnterRehearsalMode: vi.fn<() => void>(),
		onOpenSetUpSlideShow: vi.fn<() => void>(),
		onOpenBroadcastDialog: vi.fn<() => void>(),
		onToggleSubtitles: vi.fn<() => void>(),
		showSubtitles: false,
	});

	it('renders From Beginning button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Start slide show from beginning"');
		expect(html).toContain('From Beginning');
	});

	it('renders From Current Slide button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Start slide show from current slide"');
		expect(html).toContain('From Current Slide');
	});

	it('renders Presenter View button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Presenter view"');
		expect(html).toContain('Presenter View');
	});

	it('renders Rehearse Timings button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Rehearse timings"');
		expect(html).toContain('Rehearse Timings');
	});

	it('renders Set Up Slide Show button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Set up slide show"');
		expect(html).toContain('Set Up Slide Show');
	});

	it('renders Broadcast button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Broadcast slide show"');
		expect(html).toContain('Broadcast');
	});

	it('renders Subtitles button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Toggle subtitles"');
		expect(html).toContain('Subtitles');
	});

	it('subtitles button has active styling when showSubtitles is true', () => {
		const props = createSlideShowProps();
		props.showSubtitles = true;
		const html = render(React.createElement(SlideShowSection, props));
		expect(html).toContain('bg-primary/15');
		expect(html).toContain('title="Toggle subtitles"');
	});
});

// ===========================================================================
// 10. Review Tab Tests
// ===========================================================================

describe('toolbar - Review tab', () => {
	it('renders Comments button', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: false,
				slideCommentCount: 0,
				onCompare: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Toggle comments panel"');
		expect(html).toContain('Comments');
	});

	it('renders Spelling button', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: false,
				onCompare: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Toggle spell check"');
		expect(html).toContain('Spelling');
	});

	it('renders Compare button', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onCompare: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Compare with another presentation"');
		expect(html).toContain('Compare');
	});

	it('shows comment count badge when > 0', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: false,
				slideCommentCount: 5,
			}),
		);
		expect(html).toContain('>5</span>');
	});

	it('does not render comment badge when count is 0', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: false,
				slideCommentCount: 0,
			}),
		);
		// No badge with rounded-full class should exist
		expect(html).not.toMatch(/rounded-full[^"]*"[^>]*>[0-9]+<\/span>/u);
	});

	it('comments button has active styling when panel is open', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: true,
			}),
		);
		expect(html).toContain('bg-primary/15');
		expect(html).toContain('title="Toggle comments panel"');
	});

	it('spelling button has active styling when enabled', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: true,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('bg-primary/15');
		expect(html).toContain('title="Toggle spell check"');
	});

	it('does not render Comments if onToggleComments is undefined', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
			}),
		);
		expect(html).not.toContain('title="Toggle comments panel"');
	});

	it('does not render Compare if onCompare is undefined', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
			}),
		);
		expect(html).not.toContain('title="Compare with another presentation"');
	});
});

// ===========================================================================
// 11. View Tab Tests
// ===========================================================================

describe('toolbar - View tab', () => {
	const createViewProps = (overrides = {}) => ({
		canEdit: true,
		editTemplateMode: false,
		onSetEditTemplateMode: vi.fn<() => void>(),
		spellCheckEnabled: false,
		onSetSpellCheckEnabled: vi.fn<() => void>(),
		showGrid: false,
		showRulers: false,
		snapToGrid: false,
		snapToShape: false,
		onSetShowGrid: vi.fn<() => void>(),
		onSetShowRulers: vi.fn<() => void>(),
		onSetSnapToGrid: vi.fn<() => void>(),
		onSetSnapToShape: vi.fn<() => void>(),
		onAddGuide: vi.fn<() => void>(),
		onEnterMasterView: vi.fn<() => void>(),
		isSelectionPaneOpen: false,
		onToggleSelectionPane: vi.fn<() => void>(),
		eyedropperActive: false,
		onToggleEyedropper: vi.fn<() => void>(),
		onToggleSlideSorter: vi.fn<() => void>(),
		onZoomToFit: vi.fn<() => void>(),
		...overrides,
	});

	it('renders Presentation Views group (Normal, Slide Sorter, Reading View)', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('title="Normal view"');
		expect(html).toContain('title="Slide Sorter view"');
		expect(html).toContain('title="Reading View"');
		expect(html).toContain('Presentation Views');
	});

	it('renders Master Views group (Slide Master)', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('title="Edit slide masters and layouts"');
		expect(html).toContain('Slide Master');
		expect(html).toContain('Master Views');
	});

	it('renders Grid button', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('>Grid<');
	});

	it('renders Rulers button', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('>Rulers<');
	});

	it('renders Snap controls', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('>Snap to grid<');
		expect(html).toContain('>Snap to shape<');
	});

	it('renders guide buttons', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('title="Add horizontal guide"');
		expect(html).toContain('title="Add vertical guide"');
	});

	it('grid button has active styling when showGrid is true', () => {
		const html = render(React.createElement(ViewSection, createViewProps({ showGrid: true })));
		expect(html).toContain('bg-primary/15');
		expect(html).toContain('title="Toggle grid"');
	});

	it('renders Selection pane button', () => {
		const html = render(
			React.createElement(
				ViewSection,
				createViewProps({ onToggleSelectionPane: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('title="Selection Pane"');
		expect(html).toContain('Selection');
	});

	it('renders Eyedropper button', () => {
		const html = render(
			React.createElement(
				ViewSection,
				createViewProps({ onToggleEyedropper: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('Eyedropper');
	});

	it('renders Zoom to Fit button', () => {
		const html = render(
			React.createElement(ViewSection, createViewProps({ onZoomToFit: vi.fn<() => void>() })),
		);
		expect(html).toContain('Zoom to Fit');
	});

	it('slide Master is disabled when canEdit is false', () => {
		const html = render(React.createElement(ViewSection, createViewProps({ canEdit: false })));
		expect(html).toMatch(/disabled[^>]*title="Edit slide masters and layouts"/u);
	});

	// The template-mode toggle's accessible name is the e2e/UX contract shared
	// with every other binding: it must read "Templates Off" while the mode is
	// off and "Templates On" while it is on (e2e/template-editing.spec.ts
	// queries the button by exactly that name). A static "Template Editing"
	// label regressed the whole template-editing e2e flow for React once.
	it('template-mode toggle reads "Templates Off" when the mode is off', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('>Templates Off<');
		expect(html).not.toContain('>Templates On<');
		expect(html).toContain('title="Toggle template/master element editing"');
	});

	it('template-mode toggle reads "Templates On" with active styling when on', () => {
		const html = render(
			React.createElement(ViewSection, createViewProps({ editTemplateMode: true })),
		);
		expect(html).toContain('>Templates On<');
		expect(html).not.toContain('>Templates Off<');
		expect(html).toMatch(/title="Toggle template\/master element editing"[^>]*bg-primary\/15/u);
	});

	it('template-mode toggle is disabled when canEdit is false', () => {
		const html = render(React.createElement(ViewSection, createViewProps({ canEdit: false })));
		expect(html).toMatch(/disabled[^>]*title="Toggle template\/master element editing"/u);
	});
});

// ===========================================================================
// 12. Quick Access Bar (ToolbarPrimaryRow) Tests
// ===========================================================================

describe('toolbar - Quick Access Bar (ToolbarPrimaryRow)', () => {
	it('renders Undo and Redo buttons in the title bar', () => {
		const html = render(React.createElement(TitleBar, createTitleBarProps()));
		expect(html).toContain('aria-label="Undo"');
		expect(html).toContain('aria-label="Redo"');
	});

	it('undo button is disabled when canUndo is false', () => {
		const html = render(React.createElement(TitleBar, createTitleBarProps({ canUndo: false })));
		expect(html).toMatch(/disabled[^>]*aria-label="Undo"/u);
	});

	it('redo button is disabled when canRedo is false', () => {
		const html = render(React.createElement(TitleBar, createTitleBarProps({ canRedo: false })));
		expect(html).toMatch(/disabled[^>]*aria-label="Redo"/u);
	});

	it('renders sidebar toggle button', () => {
		const html = render(React.createElement(ToolbarPrimaryRow, createMockToolbarProps()));
		expect(html).toContain('aria-label="Toggle slides panel"');
	});

	it('renders inspector toggle button', () => {
		const html = render(React.createElement(ToolbarPrimaryRow, createMockToolbarProps()));
		expect(html).toContain('aria-label="Toggle inspector panel"');
	});

	it('omits the AI assistant toggle when the ai prop is absent', () => {
		const html = render(React.createElement(ToolbarPrimaryRow, createMockToolbarProps()));
		expect(html).not.toContain('aria-label="Toggle AI assistant"');
	});

	it('renders the AI assistant toggle only when aiEnabled', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ aiEnabled: true })),
		);
		expect(html).toContain('aria-label="Toggle AI assistant"');
	});

	it('hides the AI assistant toggle in present mode even when aiEnabled', () => {
		const html = render(
			React.createElement(
				ToolbarPrimaryRow,
				createMockToolbarProps({ aiEnabled: true, mode: 'present' }),
			),
		);
		expect(html).not.toContain('aria-label="Toggle AI assistant"');
	});

	it('renders the search box that opens Find and Replace', () => {
		const html = render(React.createElement(TitleBar, createTitleBarProps()));
		expect(html).toContain('aria-label="Search"');
		expect(html).toContain('placeholder="');
	});

	it('search box has foreground text when Find and Replace is open', () => {
		const html = render(
			React.createElement(TitleBar, createTitleBarProps({ findReplaceOpen: true })),
		);
		expect(html).toContain('text-foreground');
	});

	it('shows Read-only badge when canEdit is false', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ canEdit: false })),
		);
		expect(html).toContain('Read-only');
	});

	it('does not show Read-only badge when canEdit is true', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ canEdit: true })),
		);
		expect(html).not.toContain('Read-only');
	});

	it('undo button title shows label when provided', () => {
		const html = render(
			React.createElement(TitleBar, createTitleBarProps({ undoLabel: 'Delete shape' })),
		);
		expect(html).toContain('title="Undo: Delete shape"');
	});

	it('redo button title shows label when provided', () => {
		const html = render(
			React.createElement(TitleBar, createTitleBarProps({ redoLabel: 'Add text' })),
		);
		expect(html).toContain('title="Redo: Add text"');
	});

	it('renders the AutoSave switch reflecting its state', () => {
		const on = render(React.createElement(TitleBar, createTitleBarProps()));
		expect(on).toContain('role="switch"');
		expect(on).toContain('aria-checked="true"');
		const off = render(
			React.createElement(TitleBar, createTitleBarProps({ autosaveEnabled: false })),
		);
		expect(off).toContain('aria-checked="false"');
	});

	it('shows the file name and saved-to-this-PC status when clean', () => {
		const html = render(
			React.createElement(TitleBar, createTitleBarProps({ fileName: 'deck.pptx' })),
		);
		expect(html).toContain('deck.pptx');
		expect(html).toContain('Saved to this PC');
	});

	it('shows unsaved-changes status when dirty', () => {
		const html = render(React.createElement(TitleBar, createTitleBarProps({ isDirty: true })));
		expect(html).toContain('Unsaved changes');
	});

	it('hides edit-only controls when canEdit is false', () => {
		const html = render(React.createElement(TitleBar, createTitleBarProps({ canEdit: false })));
		expect(html).not.toContain('role="switch"');
		expect(html).not.toContain('aria-label="Undo"');
	});

	it('does not render sidebar toggle in present mode', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ mode: 'present' })),
		);
		expect(html).not.toContain('aria-label="Toggle slides panel"');
	});

	it('does not render inspector toggle in present mode', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ mode: 'present' })),
		);
		expect(html).not.toContain('aria-label="Toggle inspector panel"');
	});
});

// ===========================================================================
// Arrange Tab Tests
// ===========================================================================

describe('toolbar - Arrange tab', () => {
	const createArrangeProps = (overrides = {}) => ({
		canEdit: true,
		selectedElement: { type: 'shape', id: 'test', x: 0, y: 0, width: 100, height: 100 } as never,
		clipboardPayload: null,
		onAlignElements: vi.fn<() => void>(),
		onCopy: vi.fn<() => void>(),
		onCut: vi.fn<() => void>(),
		onPaste: vi.fn<() => void>(),
		onFlip: vi.fn<() => void>(),
		onMoveLayer: vi.fn<() => void>(),
		onMoveLayerToEdge: vi.fn<() => void>(),
		onDuplicate: vi.fn<() => void>(),
		onDelete: vi.fn<() => void>(),
		formatPainterActive: false,
		onToggleFormatPainter: vi.fn<() => void>(),
		...overrides,
	});

	it('renders alignment buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Align left"');
		expect(html).toContain('title="Align center"');
		expect(html).toContain('title="Align right"');
		expect(html).toContain('title="Align top"');
		expect(html).toContain('title="Align middle"');
		expect(html).toContain('title="Align bottom"');
	});

	it('renders Copy, Cut, Paste buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Copy"');
		expect(html).toContain('title="Cut"');
		expect(html).toContain('title="Paste"');
	});

	it('renders Flip H and Flip V buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Flip horizontally"');
		expect(html).toContain('title="Flip vertically"');
	});

	it('renders layer ordering buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Send backward"');
		expect(html).toContain('title="Bring forward"');
		expect(html).toContain('title="Send to back"');
		expect(html).toContain('title="Bring to front"');
	});

	it('renders Duplicate and Delete buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Duplicate"');
		expect(html).toContain('title="Delete"');
	});

	it('renders Format Painter button', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Format Painter"');
	});

	it('alignment buttons are disabled when no element is selected', () => {
		const html = render(
			React.createElement(ArrangeSection, createArrangeProps({ selectedElement: null })),
		);
		expect(html).toMatch(/disabled[^>]*title="Align left"/u);
	});

	it('delete button has red styling', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toMatch(/bg-red[^"]*"[^>]*title="Delete"/u);
	});
});

// ===========================================================================
// Text Tab Tests
// ===========================================================================

describe('toolbar - Text tab', () => {
	it('renders formatting buttons (Bold, Italic, Underline, Strikethrough)', () => {
		const html = render(
			React.createElement(TextSection, {
				canEdit: true,
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Bold"');
		expect(html).toContain('title="Italic"');
		expect(html).toContain('title="Underline"');
		expect(html).toContain('title="Strikethrough"');
	});

	it('renders text alignment buttons', () => {
		const html = render(
			React.createElement(TextSection, {
				canEdit: true,
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Align left"');
		expect(html).toContain('title="Align center"');
		expect(html).toContain('title="Align right"');
		expect(html).toContain('title="Justify"');
	});

	it('renders Font color button', () => {
		const html = render(
			React.createElement(TextSection, {
				canEdit: true,
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Font Color"');
	});

	it('formatting buttons are disabled when no element is selected', () => {
		const html = render(
			React.createElement(TextSection, {
				canEdit: true,
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/disabled[^>]*title="Bold"/u);
	});
});

// ===========================================================================
// Main Toolbar integration: section rendering
// ===========================================================================

describe('toolbar - section content rendering', () => {
	it('renders HomeSection content when toolbarSection is home', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'home' })),
		);
		expect(html).toContain('New Slide');
		expect(html).toContain('Clipboard');
	});

	it('renders FileSection content when toolbarSection is file', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'file' })),
		);
		expect(html).toContain('Good evening');
		expect(html).toContain('Blank Presentation');
		expect(html).toContain('Search recent presentations');
	});

	it('renders InsertSection content when toolbarSection is insert', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'insert' })),
		);
		expect(html).toContain('SmartArt');
		expect(html).toContain('Equation');
	});

	it('renders DrawSection content when toolbarSection is draw', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'draw' })),
		);
		expect(html).toContain('Colour');
		expect(html).toContain('type="range"');
	});

	it('renders DesignSection content when toolbarSection is design', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'design' })),
		);
		expect(html).toContain('Browse Themes');
		expect(html).toContain('Edit Theme');
	});

	it('renders TransitionsSection content when toolbarSection is transitions', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'transitions' })),
		);
		expect(html).toContain('>Preview</button>');
		expect(html).toContain('Apply to All');
	});

	it('renders AnimationsSection content when toolbarSection is animations', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'animations' })),
		);
		expect(html).toContain('Add Animation');
		expect(html).toContain('Animation Panel');
	});

	it('renders SlideShowSection when toolbarSection is slideShow', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'slideShow' })),
		);
		expect(html).toContain('From Beginning');
		expect(html).toContain('From Current Slide');
	});

	it('renders ReviewSection when toolbarSection is review', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'review' })),
		);
		expect(html).toContain('Spelling');
	});

	it('renders ViewSection when toolbarSection is view', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'view' })),
		);
		expect(html).toContain('Normal');
		expect(html).toContain('Slide Master');
	});

	it('home section also renders TextSection content (B/I/U/S)', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'home' })),
		);
		expect(html).toContain('title="Bold"');
		expect(html).toContain('title="Italic"');
	});

	it('text section renders TextSection content', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'text' })),
		);
		expect(html).toContain('title="Bold"');
		expect(html).toContain('title="Underline"');
	});

	// Narrow-viewport rendering moved to <MobileToolbar /> (see Toolbar.tsx
	// short-circuit at the top of the component). The expand/collapse button
	// was part of the old in-Toolbar compact mode and no longer exists.
	// MobileToolbar has its own test coverage for the mobile-first UI.
});

// ===========================================================================
// 12. hiddenActions (issue #64: per-button/tab toolbar visibility)
// ===========================================================================

function createHiddenActionsFileProps(hiddenActions?: ToolbarActionId[]) {
	return {
		onClose: vi.fn<() => void>(),
		onCreatePresentation: vi.fn<(templateId: string) => void>(),
		onSaveAsPptx: vi.fn<() => void>(),
		onExportPng: vi.fn<() => void>(),
		onExportPdf: vi.fn<() => void>(),
		onExportVideo: vi.fn<() => void>(),
		onExportGif: vi.fn<() => void>(),
		onPackageForSharing: vi.fn<() => void>(),
		onSaveAsPpsx: vi.fn<() => void>(),
		onSaveAsPptm: vi.fn<() => void>(),
		hasMacros: false,
		onCopySlideAsImage: vi.fn<() => void>(),
		onPrint: vi.fn<() => void>(),
		onOpenDocumentProperties: vi.fn<() => void>(),
		onOpenPasswordProtection: vi.fn<() => void>(),
		onOpenFontEmbedding: vi.fn<() => void>(),
		onOpenDigitalSignatures: vi.fn<() => void>(),
		hiddenActions,
	};
}

describe('toolbar - hiddenActions', () => {
	it('renders every ribbon tab when hiddenActions is omitted (backward compatible)', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps()));
		expect(html).toContain('>File</button>');
		expect(html).toContain('>Review</button>');
	});

	it('omits a ribbon tab listed in hiddenActions', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ hiddenActions: ['review'] })),
		);
		expect(html).not.toContain('>Review</button>');
		expect(html).toContain('>Home</button>');
	});

	it('omits the Share button when "share" is hidden', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ hiddenActions: ['share'] })),
		);
		expect(html).not.toContain('aria-label="Share"');
	});

	it('renders the Share button when hiddenActions is omitted', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps()));
		expect(html).toContain('aria-label="Share"');
	});

	it('omits the Broadcast command when "broadcast" is hidden', () => {
		const html = render(
			React.createElement(
				Toolbar,
				createMockToolbarProps({ toolbarSection: 'slideShow', hiddenActions: ['broadcast'] }),
			),
		);
		expect(html).not.toContain('title="Broadcast slide show"');
	});

	it('renders the Broadcast command when hiddenActions is omitted', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'slideShow' })),
		);
		expect(html).toContain('title="Broadcast slide show"');
	});

	it('omits Export from the File backstage nav when "export" is hidden', () => {
		const html = render(React.createElement(FileSection, createHiddenActionsFileProps(['export'])));
		expect(html).not.toContain('>Export<');
	});

	it('renders Export in the File backstage nav when hiddenActions is omitted', () => {
		const html = render(React.createElement(FileSection, createHiddenActionsFileProps()));
		expect(html).toContain('>Export<');
	});

	it('omits the Undo/Redo quick buttons independently when hidden', () => {
		const htmlUndoHidden = render(
			React.createElement(TitleBar, createTitleBarProps({ hiddenActions: ['undo'] })),
		);
		expect(htmlUndoHidden).not.toContain('aria-label="Undo"');
		expect(htmlUndoHidden).toContain('aria-label="Redo"');

		const htmlRedoHidden = render(
			React.createElement(TitleBar, createTitleBarProps({ hiddenActions: ['redo'] })),
		);
		expect(htmlRedoHidden).toContain('aria-label="Undo"');
		expect(htmlRedoHidden).not.toContain('aria-label="Redo"');
	});

	it('renders Undo/Redo when hiddenActions is omitted', () => {
		const html = render(React.createElement(TitleBar, createTitleBarProps()));
		expect(html).toContain('aria-label="Undo"');
		expect(html).toContain('aria-label="Redo"');
	});
});
