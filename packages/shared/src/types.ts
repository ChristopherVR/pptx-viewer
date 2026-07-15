/**
 * Framework-agnostic public types shared by the viewer bindings.
 *
 * These were duplicated in the React (`types-ui.ts`) and Vue (`viewer/types.ts`)
 * packages; this is the canonical copy. Each binding layers its own
 * framework-specific prop/event/handle types on top of these.
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

/** Canvas dimensions in pixels. */
export interface CanvasSize {
	width: number;
	height: number;
}

// ---------------------------------------------------------------------------
// Viewer mode
// ---------------------------------------------------------------------------

/** Viewer interaction mode: read-only, edit, presentation, or master-view. */
export type ViewerMode = 'preview' | 'edit' | 'present' | 'master';

// ---------------------------------------------------------------------------
// Imperative viewer API
// ---------------------------------------------------------------------------

/**
 * Framework-agnostic imperative API contract for the PowerPoint viewer.
 *
 * Each binding (React `forwardRef` handle, Vue `defineExpose`, Angular public
 * methods) implements this interface so consumers get a consistent progressive
 * API regardless of framework.
 */
export interface PowerPointViewerAPI {
	// -- Serialisation --
	/** Serialise the current presentation to `.pptx` bytes. */
	getContent: () => Promise<Uint8Array>;

	// -- Navigation --
	/** Navigate to a specific slide by zero-based index. */
	goTo: (slideIndex: number) => void;
	/** Navigate to the previous slide. */
	goPrev: () => void;
	/** Navigate to the next slide. */
	goNext: () => void;

	// -- Undo / redo --
	/** Undo the last editing action. No-op when nothing to undo. */
	undo: () => void;
	/** Redo the last undone action. No-op when nothing to redo. */
	redo: () => void;
	/** Whether an undo action is available. */
	canUndo: () => boolean;
	/** Whether a redo action is available. */
	canRedo: () => boolean;

	// -- Zoom --
	/** Get the current zoom level (1 = 100%). */
	getZoom: () => number;
	/** Set the zoom level (clamped to min/max bounds). */
	setZoom: (level: number) => void;
	/** Zoom in by one step. */
	zoomIn: () => void;
	/** Zoom out by one step. */
	zoomOut: () => void;
	/** Reset zoom to 100%. */
	zoomReset: () => void;

	// -- Mode --
	/** Get the current viewer mode. */
	getMode: () => ViewerMode;
	/** Switch the viewer mode (e.g. 'edit', 'preview', 'present'). */
	setMode: (mode: ViewerMode) => void;

	// -- Active slide --
	/** Get the zero-based active slide index. */
	getActiveSlideIndex: () => number;
	/** Set the active slide by zero-based index (alias of goTo). */
	setActiveSlideIndex: (index: number) => void;
	/** Get the total number of slides. */
	getSlideCount: () => number;
	/** Whether the document has unsaved changes. */
	isDirty: () => boolean;

	// -- Slide access --
	/**
	 * Get the full slide array. Returns the actual `PptxSlide[]` from the
	 * internal model with full type information (elements, notes, transitions,
	 * animations, etc.). The returned reference is a snapshot; mutations are
	 * not reflected back unless done via the manipulation methods.
	 */
	getSlides: () => readonly PptxSlide[];
	/** Get a single slide by zero-based index, or undefined if out of range. */
	getSlide: (index: number) => PptxSlide | undefined;
	/** Get the currently active slide. */
	getActiveSlide: () => PptxSlide | undefined;

	// -- Slide manipulation --
	/** Add a blank slide after the given index (or at end if omitted). */
	addSlide: (afterIndex?: number) => void;
	/** Delete slides at the given zero-based indexes. At least one slide is kept. */
	deleteSlides: (indexes: number[]) => void;
	/** Duplicate slides at the given zero-based indexes. */
	duplicateSlides: (indexes: number[]) => void;
	/** Move a slide from one position to another. */
	moveSlide: (fromIndex: number, toIndex: number) => void;
	/** Toggle the hidden flag on slides at the given indexes. */
	toggleHideSlides: (indexes: number[]) => void;

	// -- Element access --
	/**
	 * Get the elements on a slide. Defaults to the active slide when
	 * `slideIndex` is omitted. Returns the full `PptxElement[]` with
	 * all type-specific properties intact.
	 */
	getElements: (slideIndex?: number) => readonly PptxElement[];
	/** Get a single element by ID from the active slide (or a specified slide). */
	getElementById: (elementId: string, slideIndex?: number) => PptxElement | undefined;

	// -- Element manipulation --
	/**
	 * Update one or more properties of an element by ID on the active slide.
	 * Accepts a `Partial<PptxElement>` patch (e.g. `{ x: 100, width: 300 }`).
	 */
	updateElement: (elementId: string, updates: Partial<PptxElement>) => void;
	/** Delete elements by their IDs from the active slide. */
	deleteElements: (elementIds: string[]) => void;
	/**
	 * Duplicate an element on the active slide.
	 * Returns the new element's ID, or undefined if the source was not found.
	 */
	duplicateElement: (elementId: string) => string | undefined;

	// -- Selection --
	/** Get the IDs of currently selected elements. */
	getSelectedElementIds: () => string[];
	/** Programmatically select elements by their IDs. */
	selectElements: (ids: string[]) => void;
	/** Clear the current selection. */
	clearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/**
 * Union of all events the viewer can emit. Used by the `on()` / `off()`
 * subscription API when a binding supports it, and as documentation of what
 * callback props / emits are available.
 */
export interface ViewerEventMap {
	/** Active slide changed. */
	'active-slide-change': number;
	/** Dirty state toggled. */
	'dirty-change': boolean;
	/** Content changed (serialised bytes). */
	'content-change': Uint8Array;
	/** Viewer mode changed. */
	'mode-change': ViewerMode;
	/** Zoom level changed. */
	'zoom-change': number;
	/** Element selection changed. */
	'selection-change': string[];
	/** Total slide count changed. */
	'slide-count-change': number;
	/** A slide was added (index of new slide). */
	'slide-added': number;
	/** Slides were deleted (indexes that were removed). */
	'slides-deleted': number[];
	/** A slide was moved (from, to). */
	'slide-moved': { from: number; to: number };
	/** An element was updated (element ID). */
	'element-updated': string;
	/** Elements were deleted (element IDs). */
	'elements-deleted': string[];
	/** An element was added (element ID). */
	'element-added': string;
	/** Presentation mode started. */
	'present-start': void;
	/** Presentation mode ended. */
	'present-end': void;
}

/** Collaboration role within a session. */
export type CollaborationRole = 'owner' | 'collaborator' | 'viewer';

/**
 * Collaboration transport.
 *
 * - `'websocket'` (default): y-websocket against `serverUrl`.
 * - `'webrtc'`: y-webrtc peer-to-peer; needs no document server. Peers meet
 *   through the `signaling` servers (WebRTC signaling only, no document data)
 *   and same-browser tabs additionally sync via BroadcastChannel even without
 *   any signaling server, which makes this mode usable from static hosting.
 */
export type CollaborationTransport = 'websocket' | 'webrtc';

/** How the local user entered a collaboration session. */
export type CollaborationSessionIntent = 'create' | 'join';

/**
 * Real-time collaboration configuration.
 *
 * The same shape is accepted by every framework binding.
 */
export interface CollaborationConfig {
	/** Unique identifier for the collaboration room (alphanumeric, hyphens, underscores). */
	roomId: string;
	/**
	 * WebSocket server URL for the Yjs provider (e.g. "wss://collab.example.com").
	 * Ignored (may be empty) when `transport` is `'webrtc'`.
	 */
	serverUrl: string;
	/** Transport to use. Defaults to `'websocket'`. */
	transport?: CollaborationTransport;
	/**
	 * WebRTC signaling server URLs (only used when `transport` is `'webrtc'`).
	 * Defaults to y-webrtc's built-in public signaling list. Same-browser tabs
	 * sync via BroadcastChannel regardless of signaling availability.
	 */
	signaling?: string[];
	/** Display name for the local user. */
	userName: string;
	/** Avatar URL for the local user (optional). */
	userAvatar?: string;
	/** Hex colour for the local user's cursor/presence indicator. */
	userColor?: string;
	/** Optional authentication token sent with the WebSocket handshake. */
	authToken?: string;
	/** Role in the session; defaults to `'collaborator'`. */
	role?: CollaborationRole;
	/**
	 * Whether this client created the room or joined an existing room. Providers
	 * do not use this value, but hosts can use it to avoid publishing local file
	 * bytes when handling a join request. Omitted values retain the legacy
	 * create-session behaviour.
	 */
	sessionIntent?: CollaborationSessionIntent;
	/**
	 * Elected-writer write-back callback (Area 3 of the C3 hardening plan).
	 *
	 * When the local user has `role: 'owner'`, the binding debounces changes and
	 * serializes the current Y.Doc state to a PPTX byte array, then calls this
	 * callback so the host can persist the snapshot. Only one writer (the owner)
	 * does this; other collaborators never trigger write-back, eliminating the
	 * last-save-wins problem.
	 */
	onWriteBack?: (bytes: Uint8Array) => void;
	/**
	 * Debounce delay (ms) between the last Y.Doc change and the write-back
	 * invocation. Defaults to 5000 ms. Set to 0 to write back on every change
	 * (not recommended for large documents).
	 */
	writeBackDebounceMs?: number;
}
