/**
 * power-point-viewer.providers.ts: the `@Injectable` orchestration services
 * `PowerPointViewerComponent` provides at the component level, extracted into
 * a standalone constant so consumers composing their own custom viewer host
 * (e.g. `<pptx-ribbon>` + `<pptx-slide-canvas>` without
 * `PowerPointViewerComponent`) can get the same shared DI state without
 * hand-listing every service:
 *
 * ```ts
 * @Component({
 *   selector: 'my-custom-viewer',
 *   providers: [...POWER_POINT_VIEWER_PROVIDERS],
 *   template: `<pptx-ribbon ...bindings /><pptx-slide-canvas ...bindings />`,
 * })
 * export class MyCustomViewerComponent { ... }
 * ```
 *
 * Each of these services is `providedIn: 'root'`-free and designed to be
 * scoped to a single viewer instance (see {@link EditorStateService}'s doc
 * comment for the pattern this generalizes). Keep this list in sync with
 * `PowerPointViewerComponent`'s own `providers: [...]` array, which now
 * spreads this constant instead of repeating it.
 */
import { AccessibilityService } from './accessibility.service';
import { AutosaveService } from './autosave.service';
import { ChartPartSelectionService } from './chart-part-selection.service';
import { CollaborationService } from './collaboration.service';
import { EditorStateService } from './editor-state.service';
import { EmbeddedFontsService } from './embedded-fonts.service';
import { ExportService } from './export.service';
import { FieldContextService } from './field-context.service';
import { IsMobileService } from './is-mobile';
import { LoadContentService } from './load-content.service';
import { PrintService } from './print.service';
import { SmartArt3DService } from './smart-art-3d.service';
import { TableSelectionService } from './table-selection.service';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';
import { ViewerCollabCursorService } from './viewer-collab-cursor.service';
import { ViewerCollaborationSessionService } from './viewer-collaboration-session.service';
import { ViewerCompareService } from './viewer-compare.service';
import { ViewerCustomShowsService } from './viewer-custom-shows.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerDocumentPropertiesService } from './viewer-document-properties.service';
import { ViewerExportService } from './viewer-export.service';
import { ViewerFileIOService } from './viewer-file-io.service';
import { ViewerFindReplaceService } from './viewer-find-replace.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';
import { ViewerInspectorPanelService } from './viewer-inspector-panel.service';
import { ViewerKeyboardService } from './viewer-keyboard.service';
import { ViewerMobileSheetService } from './viewer-mobile-sheet.service';
import { ViewerOptionsService } from './viewer-options.service';
import { ViewerPresentationModeService } from './viewer-presentation-mode.service';
import { ViewerThemeGalleryService } from './viewer-theme-gallery.service';
import { ViewerTouchGesturesService } from './viewer-touch-gestures.service';
import { ViewerZoomService } from './viewer-zoom.service';
import { ZoomTargetService } from './zoom-target.service';

/**
 * The full set of DI services `PowerPointViewerComponent` provides at the
 * component level. Spread this into a custom host's own `providers: [...]`
 * array to get the same shared editor/export/collaboration/etc. state that
 * `PowerPointViewerComponent`'s children (ribbon, slide canvas, inspector,
 * dialogs, ...) rely on via `inject()`.
 */
export const POWER_POINT_VIEWER_PROVIDERS = [
	LoadContentService,
	ExportService,
	EditorStateService,
	ChartPartSelectionService,
	TableSelectionService,
	EmbeddedFontsService,
	CollaborationService,
	AccessibilityService,
	AutosaveService,
	PrintService,
	IsMobileService,
	SmartArt3DService,
	FieldContextService,
	ZoomTargetService,
	ViewerDialogsService,
	ViewerCompareService,
	ViewerExportService,
	ViewerFindReplaceService,
	ViewerCustomShowsService,
	ViewerCollaborationSessionService,
	ViewerCanvasEditingService,
	ViewerCollabCursorService,
	ViewerDocumentPropertiesService,
	ViewerFileIOService,
	ViewerFormatPainterService,
	ViewerInspectorPanelService,
	ViewerKeyboardService,
	ViewerMobileSheetService,
	ViewerOptionsService,
	ViewerPresentationModeService,
	ViewerThemeGalleryService,
	ViewerTouchGesturesService,
	ViewerZoomService,
] as const;
