<script setup lang="ts">
/**
 * PowerPointViewer — Vue port of the React `PowerPointViewer.tsx`.
 *
 * Top-level orchestrator that loads `.pptx` bytes and renders the slides with
 * navigation and zoom. This is the viewer-first milestone of the port: the
 * React component additionally composes a full editor (toolbar, inspector
 * panels, dialogs, presentation mode, collaboration, export). The roadmap and
 * per-area status live in `packages/vue/PORTING.md`.
 *
 * Conventions vs. React:
 *  - `forwardRef` handle  → `defineExpose` ({@link PowerPointViewerExpose}).
 *  - function-prop callbacks → emits ({@link PowerPointViewerEmits}).
 *  - `theme` context      → `provideViewerTheme` + `useThemeStyle`.
 */
import {
	cloneElement,
	createEditorId,
	createGroupElement,
	createShapeElement,
	createTextElement,
} from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import type { AlignEdge, DistributeAxis } from 'pptx-viewer-shared';
import { alignElements, distributeElements } from 'pptx-viewer-shared';
import { computed, nextTick, provide, ref, toRef, watch } from 'vue';

import { provideViewerTheme, useThemeStyle } from '../theme';
import AccessibilityPanel from './components/AccessibilityPanel.vue';
import AlignToolbar from './components/AlignToolbar.vue';
import AutosaveIndicator from './components/AutosaveIndicator.vue';
import BroadcastDialog from './components/BroadcastDialog.vue';
import CollaborationCursors from './components/CollaborationCursors.vue';
import CommentsPanel from './components/CommentsPanel.vue';
import ContextMenu from './components/ContextMenu.vue';
import type { ContextMenuItem } from './components/ContextMenu.vue';
import DocumentPropertiesDialog from './components/DocumentPropertiesDialog.vue';
import type { DocumentPropertiesSavePatch } from './components/DocumentPropertiesDialog.vue';
import EditorToolbar from './components/EditorToolbar.vue';
import type { ShapePreset } from './components/EditorToolbar.vue';
import ExportMenu from './components/ExportMenu.vue';
import FindReplaceBar from './components/FindReplaceBar.vue';
import HyperlinkDialog from './components/HyperlinkDialog.vue';
import InspectorPane from './components/inspector/InspectorPane.vue';
import MobileBottomBar from './components/MobileBottomBar.vue';
import NotesPanel from './components/NotesPanel.vue';
import PresentationMode from './components/PresentationMode.vue';
import PrintDialog from './components/PrintDialog.vue';
import SelectionOverlay from './components/SelectionOverlay.vue';
import ShareDialog from './components/ShareDialog.vue';
import ShortcutPanel from './components/ShortcutPanel.vue';
import SignaturesPanel from './components/SignaturesPanel.vue';
import SlideCanvas from './components/SlideCanvas.vue';
import SlideSorter from './components/SlideSorter.vue';
import SlidesPaneControls from './components/SlidesPaneControls.vue';
import SlideStage from './components/SlideStage.vue';
import SlideTransitionPanel from './components/SlideTransitionPanel.vue';
import { TableThemeKey } from './composables/table-theme';
import { useAccessibility } from './composables/useAccessibility';
import { useAutosave } from './composables/useAutosave';
import { useCollaboration } from './composables/useCollaboration';
import { useComments } from './composables/useComments';
import { useEditorHistory } from './composables/useEditorHistory';
import { useEditorOperations } from './composables/useEditorOperations';
import { useEmbeddedFonts } from './composables/useEmbeddedFonts';
import { useExport } from './composables/useExport';
import { useFindReplace } from './composables/useFindReplace';
import { useIsMobile } from './composables/useIsMobile';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts';
import { useLoadContent } from './composables/useLoadContent';
import { usePrint } from './composables/usePrint';
import { useSignatures } from './composables/useSignatures';
import { useSlideOperations } from './composables/useSlideOperations';
import type {
	CollaborationConfig,
	PowerPointViewerEmits,
	PowerPointViewerExpose,
	PowerPointViewerProps,
} from './types';

/** Geometry patch emitted by the selection overlay during a drag/resize/rotate. */
interface TransformPayload {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

const props = withDefaults(defineProps<PowerPointViewerProps>(), {
	canEdit: false,
});
const emit = defineEmits<PowerPointViewerEmits>();

// ── Theme ─────────────────────────────────────────────────────────────
const theme = toRef(props, 'theme');
provideViewerTheme(theme);
const themeStyle = useThemeStyle(theme);

// ── Load + parse content ──────────────────────────────────────────────
const {
	slides,
	canvasSize,
	mediaDataUrls,
	loading,
	error,
	isEncrypted,
	coreProperties,
	embeddedFonts,
	signatures,
	tableStyleMap,
	theme: pptxTheme,
	getContent,
} = useLoadContent(() => props.content);

// Expose the presentation colour scheme + parsed table-style map to table
// cells (banded/header colour resolution by table-style GUID) via
// provide/inject, avoiding theme prop-threading through the hot
// SlideStage → ElementRenderer chain.
provide(TableThemeKey, () => ({
	colorScheme: pptxTheme.value?.colorScheme,
	tableStyleMap: tableStyleMap.value,
}));

// Inject embedded fonts as @font-face (side effect; auto-cleaned on unmount).
useEmbeddedFonts(embeddedFonts);

// ── Navigation ────────────────────────────────────────────────────────
const activeSlideIndex = ref(0);
const slideCount = computed(() => slides.value.length);
const activeSlide = computed(() => slides.value[activeSlideIndex.value]);

watch(slides, () => {
	activeSlideIndex.value = 0;
	selectedElementIds.value = [];
	history.clearHistory();
});
watch(activeSlideIndex, (index) => {
	emit('active-slide-change', index);
	selectedElementIds.value = [];
});

function goTo(index: number): void {
	if (index < 0 || index >= slideCount.value) {
		return;
	}
	activeSlideIndex.value = index;
}
const goPrev = () => goTo(activeSlideIndex.value - 1);
const goNext = () => goTo(activeSlideIndex.value + 1);

// ── Touch swipe navigation (view mode only) ───────────────────────────
// On touch devices a horizontal swipe across the slide area changes slides.
// In edit mode the same gesture must drive element drag/resize, so swipe
// navigation is disabled while `canEdit` so it never hijacks an edit gesture.
const SWIPE_THRESHOLD = 50;
const touchStart = ref<{ x: number; y: number } | null>(null);

function onMainTouchStart(event: TouchEvent): void {
	if (props.canEdit) {
		touchStart.value = null;
		return;
	}
	const touch = event.changedTouches[0];
	touchStart.value = touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function onMainTouchEnd(event: TouchEvent): void {
	const start = touchStart.value;
	touchStart.value = null;
	if (!start) {
		return;
	}
	const touch = event.changedTouches[0];
	if (!touch) {
		return;
	}
	const dx = touch.clientX - start.x;
	const dy = touch.clientY - start.y;
	// Require a predominantly-horizontal gesture past the threshold.
	if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) {
		return;
	}
	if (dx < 0) {
		goNext();
	} else {
		goPrev();
	}
}

// ── Zoom ──────────────────────────────────────────────────────────────
const zoom = ref(1);
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;
const zoomIn = () => {
	zoom.value = Math.min(ZOOM_MAX, Number((zoom.value + ZOOM_STEP).toFixed(2)));
};
const zoomOut = () => {
	zoom.value = Math.max(ZOOM_MIN, Number((zoom.value - ZOOM_STEP).toFixed(2)));
};
const zoomReset = () => {
	zoom.value = 1;
};
const zoomPercent = computed(() => Math.round(zoom.value * 100));

// Auto-fit: the slide shrinks to fit small/mobile viewports without the user
// touching the zoom. `fitScale` (≤ 1) is reported by SlideCanvas after measuring
// its viewport; the effective on-screen scale folds it into the user zoom so the
// percentage still reads the user's chosen zoom (100% = "fit"). All scaled
// rendering and pointer→slide coordinate math must use `effectiveZoom`.
const fitScale = ref(1);
const effectiveZoom = computed(() => fitScale.value * zoom.value);

// ── Thumbnail previews ────────────────────────────────────────────────
const THUMB_WIDTH = 104; // px — matches the thumbnail rail content width
const thumbScale = computed(() => THUMB_WIDTH / Math.max(1, canvasSize.value.width));
const thumbHeight = computed(() => Math.round(canvasSize.value.height * thumbScale.value));

// ── Editing: selection, history, operations ───────────────────────────
// Composed unconditionally (cheap); the toolbar/overlay/handlers only act when
// `props.canEdit` is true. `slides` is the writable `ShallowRef` from
// `useLoadContent`, and `getContent` serialises it — so edits flow to export.
const selectedElementIds = ref<string[]>([]);
const history = useEditorHistory(slides);
const ops = useEditorOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
	selectedElementIds,
});
const hasSelection = computed(() => selectedElementIds.value.length > 0);
const selectedElements = computed<PptxElement[]>(() => {
	const elements = activeSlide.value?.elements ?? [];
	const ids = new Set(selectedElementIds.value);
	return elements.filter((el) => ids.has(el.id));
});

function selectElement(id: string, additive: boolean): void {
	if (additive) {
		selectedElementIds.value = selectedElementIds.value.includes(id)
			? selectedElementIds.value.filter((x) => x !== id)
			: [...selectedElementIds.value, id];
	} else {
		selectedElementIds.value = [id];
	}
}
function clearSelection(): void {
	selectedElementIds.value = [];
}

/** Click-to-select via event delegation (elements render `data-element-id`). */
function onCanvasPointerDown(event: PointerEvent): void {
	if (!props.canEdit) {
		return;
	}
	const target = event.target as HTMLElement | null;
	const host = target?.closest('[data-element-id]') as HTMLElement | null;
	const id = host?.dataset.elementId;
	if (id) {
		selectElement(id, event.shiftKey || event.ctrlKey || event.metaKey);
	} else {
		clearSelection();
	}
}

/** Patch one element's geometry on the active slide WITHOUT a history entry. */
function patchActiveElementGeometry(payload: TransformPayload): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	const nextElements = slide.elements.map((el) =>
		el.id === payload.id
			? {
					...el,
					x: payload.x,
					y: payload.y,
					width: payload.width,
					height: payload.height,
					rotation: payload.rotation,
				}
			: el,
	);
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}

// One history entry per gesture: snapshot on start, live-patch (no history)
// during the drag and on commit.
function onTransformStart(): void {
	history.pushHistory();
}
function onTransform(payload: TransformPayload): void {
	patchActiveElementGeometry(payload);
}
function onTransformEnd(payload: TransformPayload): void {
	patchActiveElementGeometry(payload);
}

/** Centre a newly-created element (default box) on the slide. */
function centreNewElement(el: PptxElement, width: number, height: number): void {
	el.width = width;
	el.height = height;
	el.x = Math.max(0, Math.round((canvasSize.value.width - width) / 2));
	el.y = Math.max(0, Math.round((canvasSize.value.height - height) / 2));
}

function addText(): void {
	const el = createTextElement('Text');
	centreNewElement(el, 320, 80);
	ops.addElement(el);
	selectedElementIds.value = [el.id];
}
function addShape(preset: ShapePreset): void {
	const el = createShapeElement(preset);
	centreNewElement(el, 240, 160);
	ops.addElement(el);
	selectedElementIds.value = [el.id];
}
function deleteSelected(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.removeElement(id);
	}
	clearSelection();
}
function duplicateSelected(): void {
	const next: string[] = [];
	for (const id of [...selectedElementIds.value]) {
		const newId = ops.duplicateElement(id);
		if (newId) {
			next.push(newId);
		}
	}
	if (next.length > 0) {
		selectedElementIds.value = next;
	}
}
function bringForward(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.bringForward(id);
	}
}

// Inspector targets a single selected element; multi-select hides it.
const inspectorElement = computed<PptxElement | undefined>(() =>
	selectedElements.value.length === 1 ? selectedElements.value[0] : undefined,
);
// Animations are stored on the slide (`slide.animations`, keyed by `elementId`),
// not on the element — surface this element's animations to the inspector by
// augmenting the element object the panels receive.
const inspectorElementForPanels = computed<PptxElement | undefined>(() => {
	const el = inspectorElement.value;
	if (!el) {
		return undefined;
	}
	const animations = (activeSlide.value?.animations ?? []).filter((a) => a.elementId === el.id);
	return { ...el, animations } as unknown as PptxElement;
});
function onInspectorUpdate(patch: Partial<PptxElement>): void {
	const el = inspectorElement.value;
	if (!el) {
		return;
	}
	// An `animations` patch belongs on the slide, not the element.
	if ('animations' in patch) {
		const { animations, ...rest } = patch as Partial<PptxElement> & {
			animations?: PptxSlide['animations'];
		};
		writeElementAnimations(el.id, animations ?? []);
		if (Object.keys(rest).length > 0) {
			ops.updateElement(el.id, rest);
		}
		return;
	}
	ops.updateElement(el.id, patch);
}
function writeElementAnimations(elementId: string, animations: PptxSlide['animations']): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const others = (slide.animations ?? []).filter((a) => a.elementId !== elementId);
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, animations: [...others, ...(animations ?? [])] };
	slides.value = nextSlides;
}

// ── Slide operations (add / duplicate / delete / reorder) ─────────────
const slideOps = useSlideOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});
const canDeleteSlide = computed(() => slides.value.length > 1);

// ── Clipboard (in-memory element copy/cut/paste) ──────────────────────
const clipboard = ref<PptxElement | null>(null);
const hasClipboard = computed(() => clipboard.value !== null);
function copyElement(id: string): void {
	const el = activeSlide.value?.elements.find((e) => e.id === id);
	if (el) {
		clipboard.value = cloneElement(el);
	}
}
function cutElement(id: string): void {
	copyElement(id);
	ops.removeElement(id);
	selectedElementIds.value = selectedElementIds.value.filter((x) => x !== id);
}
function pasteElement(): void {
	if (!clipboard.value) {
		return;
	}
	const copy = cloneElement(clipboard.value);
	copy.id = createEditorId('el');
	copy.x = (copy.x ?? 0) + 16;
	copy.y = (copy.y ?? 0) + 16;
	ops.addElement(copy);
	selectedElementIds.value = [copy.id];
}

// ── Presentation (slideshow) mode ─────────────────────────────────────
const presenting = ref(false);
function startPresenting(): void {
	presenting.value = true;
}
function onPresentClose(): void {
	presenting.value = false;
}
function onPresentSlideChange(index: number): void {
	activeSlideIndex.value = index;
}

// ── Element context menu ──────────────────────────────────────────────
const contextMenu = ref<{ open: boolean; x: number; y: number; elementId: string | null }>({
	open: false,
	x: 0,
	y: 0,
	elementId: null,
});
const contextItems = computed<ContextMenuItem[]>(() => [
	{ id: 'cut', label: 'Cut' },
	{ id: 'copy', label: 'Copy' },
	{ id: 'paste', label: 'Paste', disabled: !hasClipboard.value },
	{ id: 'sep1', label: '', separator: true },
	{ id: 'duplicate', label: 'Duplicate' },
	{ id: 'delete', label: 'Delete' },
	{ id: 'sep2', label: '', separator: true },
	{ id: 'bring-forward', label: 'Bring forward' },
	{ id: 'send-backward', label: 'Send backward' },
	{ id: 'sep3', label: '', separator: true },
	{ id: 'hyperlink', label: 'Hyperlink…' },
]);
function onCanvasContextMenu(event: MouseEvent): void {
	if (!props.canEdit) {
		return;
	}
	const host = (event.target as HTMLElement | null)?.closest(
		'[data-element-id]',
	) as HTMLElement | null;
	const id = host?.dataset.elementId;
	if (!id) {
		return;
	}
	event.preventDefault();
	if (!selectedElementIds.value.includes(id)) {
		selectedElementIds.value = [id];
	}
	contextMenu.value = { open: true, x: event.clientX, y: event.clientY, elementId: id };
}
function onContextSelect(actionId: string): void {
	const target = contextMenu.value.elementId;
	if (!target) {
		return;
	}
	switch (actionId) {
		case 'cut':
			cutElement(target);
			break;
		case 'copy':
			copyElement(target);
			break;
		case 'paste':
			pasteElement();
			break;
		case 'duplicate':
			ops.duplicateElement(target);
			break;
		case 'delete':
			ops.removeElement(target);
			selectedElementIds.value = selectedElementIds.value.filter((x) => x !== target);
			break;
		case 'bring-forward':
			ops.bringForward(target);
			break;
		case 'send-backward':
			ops.sendBackward(target);
			break;
		case 'hyperlink':
			openHyperlinkDialog(target);
			break;
	}
}

// ── Hyperlink dialog ──────────────────────────────────────────────────
const hyperlinkOpen = ref(false);
const hyperlinkTarget = ref<PptxElement | null>(null);
function openHyperlinkDialog(id: string): void {
	const el = activeSlide.value?.elements.find((e) => e.id === id);
	if (el) {
		hyperlinkTarget.value = el;
		hyperlinkOpen.value = true;
	}
}
function onHyperlinkSave(patch: Partial<PptxElement>): void {
	if (hyperlinkTarget.value) {
		ops.updateElement(hyperlinkTarget.value.id, patch);
	}
	hyperlinkOpen.value = false;
}

// ── Find & replace ────────────────────────────────────────────────────
const findOpen = ref(false);
const find = useFindReplace({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});

// ── Export (PNG / PDF) ────────────────────────────────────────────────
// An off-screen stage renders one slide at a time at scale 1; `rasterizeSlide`
// drives it and snapshots it with `html2canvas-pro`.
const exportStageRef = ref<HTMLElement | null>(null);
const exportIndex = ref(0);
const exportSlide = computed(() => slides.value[exportIndex.value]);

async function rasterizeSlide(index: number): Promise<HTMLCanvasElement> {
	exportIndex.value = index;
	await nextTick();
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});
	const stageEl = exportStageRef.value?.querySelector('.pptx-vue-stage') as HTMLElement | null;
	if (!stageEl) {
		throw new Error('Export stage not ready');
	}
	const { default: html2canvas } = await import('html2canvas-pro');
	return html2canvas(stageEl, {
		backgroundColor: '#ffffff',
		scale: 2,
		width: canvasSize.value.width,
		height: canvasSize.value.height,
		logging: false,
	});
}

const exporter = useExport({ slides, canvasSize, rasterizeSlide });
function onExportPng(): void {
	void exporter.exportSlidePng(activeSlideIndex.value);
}
function onExportPdf(): void {
	void exporter.exportPdf();
}

// ── Print (dialog + rasterised print window) ──────────────────────────
// Reuses the same off-screen `rasterizeSlide` the export path drives.
const printer = usePrint({ slides, activeSlideIndex, rasterizeSlide });

// ── Slide sorter (grid overview + drag reorder) ───────────────────────
const showSorter = ref(false);
function onSorterSelect(index: number): void {
	goTo(index);
	showSorter.value = false;
}
function onSorterReorder(from: number, to: number): void {
	slideOps.moveSlide(from, to);
}

// ── Accessibility checker ─────────────────────────────────────────────
const showA11y = ref(false);
const a11y = useAccessibility(slides);

// ── Speaker notes ─────────────────────────────────────────────────────
function onNotesUpdate(notes: string): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, notes };
	slides.value = nextSlides;
}

// ── Slide transition ──────────────────────────────────────────────────
function onTransitionUpdate(transition: PptxSlideTransition | undefined): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, transition };
	slides.value = nextSlides;
}

// ── Align / distribute / group ────────────────────────────────────────
const canGroup = computed(() => selectedElements.value.length >= 2);
const canUngroup = computed(
	() => selectedElements.value.length === 1 && selectedElements.value[0]?.type === 'group',
);

/** Apply a {id → {x?,y?}} position map to the active slide as one history entry. */
function applyPositionMap(map: Map<string, { x?: number; y?: number }>): void {
	if (map.size === 0) {
		return;
	}
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextElements = slide.elements.map((el) => {
		const pos = map.get(el.id);
		if (!pos) {
			return el;
		}
		return {
			...el,
			...(pos.x === undefined ? {} : { x: pos.x }),
			...(pos.y === undefined ? {} : { y: pos.y }),
		};
	});
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}
function onAlign(edge: AlignEdge): void {
	applyPositionMap(alignElements(selectedElements.value, edge));
}
function onDistribute(axis: DistributeAxis): void {
	applyPositionMap(distributeElements(selectedElements.value, axis));
}
function onGroup(): void {
	const sel = selectedElements.value;
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (sel.length < 2 || !slide) {
		return;
	}
	const minX = Math.min(...sel.map((e) => e.x));
	const minY = Math.min(...sel.map((e) => e.y));
	const maxX = Math.max(...sel.map((e) => e.x + e.width));
	const maxY = Math.max(...sel.map((e) => e.y + e.height));
	// Children store coordinates relative to the group's top-left.
	const children = sel.map((e) => ({ ...e, x: e.x - minX, y: e.y - minY }));
	const group = createGroupElement(children, {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	});
	history.pushHistory();
	const selIds = new Set(sel.map((e) => e.id));
	const nextSlides = slides.value.slice();
	nextSlides[index] = {
		...slide,
		elements: [...slide.elements.filter((e) => !selIds.has(e.id)), group],
	};
	slides.value = nextSlides;
	selectedElementIds.value = [group.id];
}
function onUngroup(): void {
	const g = selectedElements.value[0];
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!g || g.type !== 'group' || !slide) {
		return;
	}
	// Re-absolutise children (inverse of the group-relative offset).
	const restored = (g.children ?? []).map((c) => ({ ...c, x: c.x + g.x, y: c.y + g.y }));
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = {
		...slide,
		elements: slide.elements.flatMap((e) => (e.id === g.id ? restored : [e])),
	};
	slides.value = nextSlides;
	selectedElementIds.value = restored.map((c) => c.id);
}

// ── Autosave ──────────────────────────────────────────────────────────
const autosaveEnabled = computed(() => props.canEdit && (props.autosave ?? false));
const autosave = useAutosave({
	slides,
	enabled: autosaveEnabled,
	intervalMs: props.autosaveIntervalMs ?? 2000,
	onSave: async () => {
		const bytes = await getContent();
		emit('autosave', bytes);
	},
});

// ── Comments ──────────────────────────────────────────────────────────
const showComments = ref(false);
const activeComments = computed(() => activeSlide.value?.comments ?? []);
const authorNameRef = computed(() => props.authorName ?? 'You');
const commentsApi = useComments({
	comments: activeComments,
	activeSlideIndex,
	authorName: authorNameRef,
});
/** Commit a new comment array for the active slide (history-aware). */
function commitComments(next: ReturnType<typeof commentsApi.addComment>): void {
	if (!next) {
		return;
	}
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, comments: next };
	slides.value = nextSlides;
}

// ── Collaboration (Yjs) ───────────────────────────────────────────────
const collab = useCollaboration({
	slides,
	onRemoteSlides: (remote) => {
		slides.value = remote;
	},
});
const shareOpen = ref(false);
const collabActive = collab.active;
function onShareStart(config: CollaborationConfig): void {
	void collab.start(config);
	emit('start-collaboration', config);
	shareOpen.value = false;
}
function onShareStop(): void {
	collab.stop();
	emit('stop-collaboration');
	shareOpen.value = false;
}
/** Publish the local cursor in slide coordinates while collaborating. */
function onCollabPointerMove(event: PointerEvent): void {
	if (!collab.active.value) {
		return;
	}
	const stage = (event.currentTarget as HTMLElement | null)?.querySelector('.pptx-vue-stage');
	if (!stage) {
		return;
	}
	const rect = stage.getBoundingClientRect();
	collab.setCursor(
		(event.clientX - rect.left) / effectiveZoom.value,
		(event.clientY - rect.top) / effectiveZoom.value,
	);
}

// ── Digital signatures ────────────────────────────────────────────────
const showSignatures = ref(false);
const signaturesApi = useSignatures(signatures);

// ── Broadcast ─────────────────────────────────────────────────────────
const broadcastOpen = ref(false);
const broadcastConfig = ref<{ roomId: string; serverUrl: string } | null>(null);
const broadcastViewerUrl = computed(() => {
	if (!broadcastConfig.value || typeof window === 'undefined') {
		return '';
	}
	const { roomId, serverUrl } = broadcastConfig.value;
	const base = `${window.location.origin}${window.location.pathname}`;
	return `${base}?broadcast=${encodeURIComponent(roomId)}&server=${encodeURIComponent(serverUrl)}`;
});
function onBroadcastStart(config: { roomId: string; serverUrl: string }): void {
	broadcastConfig.value = config;
	void collab.start({ ...config, userName: props.authorName ?? 'Presenter' });
	emit('start-collaboration', { ...config, userName: props.authorName ?? 'Presenter' });
	broadcastOpen.value = false;
}
function onBroadcastStop(): void {
	broadcastConfig.value = null;
	collab.stop();
	emit('stop-collaboration');
	broadcastOpen.value = false;
}

// ── Responsive / mobile chrome ────────────────────────────────────────
const { isMobile } = useIsMobile();
function present(): void {
	presenting.value = true;
}

// ── Document properties dialog ────────────────────────────────────────
const propertiesOpen = ref(false);
function onPropertiesSave(patch: DocumentPropertiesSavePatch): void {
	// Persist the edited core properties — `getContent` forwards them to
	// `handler.save`. Custom/app properties are not yet round-tripped (the
	// loader does not surface parsed custom/app props).
	coreProperties.value = { ...coreProperties.value, ...patch.core };
	propertiesOpen.value = false;
}
function sendBackward(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.sendBackward(id);
	}
}

// ── Keyboard shortcuts ────────────────────────────────────────────────
// A config-driven registry (mirrors React `useKeyboardShortcuts`) replaces the
// old ad-hoc Ctrl+Z/Y/Delete handling. Find (Ctrl+F) and the shortcut-help
// overlay (Ctrl+/) are handled in `onEditorKeydown` before delegating.
const showShortcuts = ref(false);

/** Select every element on the active slide. */
function selectAllElements(): void {
	selectedElementIds.value = (activeSlide.value?.elements ?? []).map((e) => e.id);
}
/** Copy the first selected element to the in-memory clipboard. */
function copySelected(): void {
	const id = selectedElementIds.value[0];
	if (id) {
		copyElement(id);
	}
}
/** Cut the first selected element to the in-memory clipboard. */
function cutSelected(): void {
	const id = selectedElementIds.value[0];
	if (id) {
		cutElement(id);
	}
}
/** Nudge every selected element by (dx, dy) px as one history entry. */
function nudgeSelected(dx: number, dy: number): void {
	if (selectedElementIds.value.length === 0) {
		return;
	}
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	const ids = new Set(selectedElementIds.value);
	history.pushHistory();
	const nextElements = slide.elements.map((el) =>
		ids.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
	);
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}

const shortcuts = useKeyboardShortcuts({
	actions: {
		undo: history.undo,
		redo: history.redo,
		copy: copySelected,
		cut: cutSelected,
		paste: pasteElement,
		duplicate: duplicateSelected,
		delete: deleteSelected,
		selectAll: selectAllElements,
		nudge: nudgeSelected,
		prevSlide: goPrev,
		nextSlide: goNext,
		escape: clearSelection,
	},
	canEdit: () => props.canEdit,
	hasSelection,
	isPresenting: presenting,
});

/** Root keydown: Find / shortcut-help first, then the shortcut registry. */
function onEditorKeydown(event: KeyboardEvent): void {
	const mod = event.ctrlKey || event.metaKey;
	if (props.canEdit && mod && event.key.toLowerCase() === 'f') {
		event.preventDefault();
		findOpen.value = !findOpen.value;
		return;
	}
	if (mod && event.key === '/') {
		event.preventDefault();
		showShortcuts.value = !showShortcuts.value;
		return;
	}
	shortcuts.handleKeyDown(event);
}

// ── Imperative surface (mirrors the React forwardRef handle) ──────────
defineExpose<PowerPointViewerExpose>({ getContent });
</script>

<template>
	<div
		class="pptx-vue-viewer"
		:class="props.class"
		:style="themeStyle"
		:tabindex="props.canEdit ? 0 : undefined"
		@keydown="onEditorKeydown"
	>
		<!-- Loading -->
		<div v-if="loading" class="pptx-vue-state pptx-vue-loading">
			<div class="pptx-vue-spinner" aria-hidden="true" />
			<p>Loading presentation…</p>
		</div>

		<!-- Encrypted -->
		<div v-else-if="isEncrypted" class="pptx-vue-state pptx-vue-error">
			<p>This presentation is password-protected and cannot be opened.</p>
		</div>

		<!-- Error -->
		<div v-else-if="error" class="pptx-vue-state pptx-vue-error">
			<p>Failed to load presentation.</p>
			<pre class="pptx-vue-error-detail">{{ error }}</pre>
		</div>

		<!-- Viewer -->
		<template v-else>
			<header v-if="!isMobile" class="pptx-vue-toolbar">
				<div class="pptx-vue-nav">
					<button type="button" :disabled="activeSlideIndex <= 0" @click="goPrev">‹</button>
					<span class="pptx-vue-slide-counter">
						{{ slideCount === 0 ? 0 : activeSlideIndex + 1 }} / {{ slideCount }}
					</span>
					<button type="button" :disabled="activeSlideIndex >= slideCount - 1" @click="goNext">
						›
					</button>
				</div>
				<div class="pptx-vue-zoom">
					<button type="button" @click="zoomOut">−</button>
					<button type="button" class="pptx-vue-zoom-value" @click="zoomReset">
						{{ zoomPercent }}%
					</button>
					<button type="button" @click="zoomIn">+</button>
					<button
						v-if="slideCount > 0"
						type="button"
						class="pptx-vue-present-btn"
						title="Present"
						aria-label="Present"
						@click="startPresenting"
					>
						▶
					</button>
					<ExportMenu
						v-if="slideCount > 0"
						:exporting="exporter.exporting.value"
						@export-png="onExportPng"
						@export-pdf="onExportPdf"
					/>
					<button
						v-if="slideCount > 0"
						type="button"
						class="pptx-vue-print-btn"
						title="Print"
						aria-label="Print"
						@click="printer.openPrintDialog"
					>
						🖨
					</button>
					<button
						v-if="slideCount > 0"
						type="button"
						class="pptx-vue-sorter-btn"
						title="Slide sorter"
						aria-label="Slide sorter"
						@click="showSorter = true"
					>
						▦
					</button>
					<button
						v-if="props.canEdit"
						type="button"
						class="pptx-vue-a11y-btn"
						:title="`Accessibility (${a11y.issueCount.value})`"
						aria-label="Accessibility checker"
						@click="showA11y = !showA11y"
					>
						♿ {{ a11y.issueCount.value }}
					</button>
					<AutosaveIndicator
						v-if="autosaveEnabled"
						:status="autosave.status.value"
						:is-dirty="autosave.isDirty.value"
					/>
					<button
						v-if="props.canEdit"
						type="button"
						class="pptx-vue-comments-btn"
						:title="`Comments (${activeComments.length})`"
						aria-label="Comments"
						@click="showComments = !showComments"
					>
						💬 {{ activeComments.length }}
					</button>
					<button
						type="button"
						class="pptx-vue-share-btn"
						title="Share"
						aria-label="Share"
						@click="shareOpen = true"
					>
						⤴
					</button>
					<button
						type="button"
						class="pptx-vue-broadcast-btn"
						title="Broadcast"
						aria-label="Broadcast"
						@click="broadcastOpen = true"
					>
						📡
					</button>
					<button
						type="button"
						class="pptx-vue-props-btn"
						title="Properties"
						aria-label="Document properties"
						@click="propertiesOpen = true"
					>
						ⓘ
					</button>
					<button
						type="button"
						class="pptx-vue-shortcuts-btn"
						title="Keyboard shortcuts (Ctrl+/)"
						aria-label="Keyboard shortcuts"
						@click="showShortcuts = true"
					>
						⌨
					</button>
					<button
						v-if="signaturesApi.isSigned.value"
						type="button"
						class="pptx-vue-sig-btn"
						:title="`Digital signatures (${signaturesApi.overall.value})`"
						aria-label="Digital signatures"
						@click="showSignatures = !showSignatures"
					>
						🔏
					</button>
				</div>
			</header>

			<!-- Editing toolbar -->
			<EditorToolbar
				v-if="props.canEdit"
				:can-undo="history.canUndo.value"
				:can-redo="history.canRedo.value"
				:zoom-percent="zoomPercent"
				:has-selection="hasSelection"
				@undo="history.undo"
				@redo="history.redo"
				@zoom-in="zoomIn"
				@zoom-out="zoomOut"
				@zoom-reset="zoomReset"
				@add-text="addText"
				@add-shape="addShape"
				@delete-selected="deleteSelected"
				@duplicate-selected="duplicateSelected"
				@bring-forward="bringForward"
				@send-backward="sendBackward"
			/>

			<!-- Align / distribute / group -->
			<AlignToolbar
				v-if="props.canEdit && hasSelection"
				:can-group="canGroup"
				:can-ungroup="canUngroup"
				@align="onAlign"
				@distribute="onDistribute"
				@group="onGroup"
				@ungroup="onUngroup"
			/>

			<!-- Find & replace bar -->
			<FindReplaceBar
				v-if="props.canEdit && findOpen"
				v-model:query="find.query.value"
				v-model:replacement="find.replacement.value"
				v-model:match-case="find.matchCase.value"
				:match-count="find.matchCount.value"
				:current-index="find.currentMatch.value"
				@next="find.next"
				@prev="find.prev"
				@replace="find.replaceCurrent"
				@replace-all="find.replaceAll"
				@close="findOpen = false"
			/>

			<div class="pptx-vue-body">
				<nav class="pptx-vue-thumbnails" aria-label="Slides">
					<SlidesPaneControls
						v-if="props.canEdit"
						:can-delete="canDeleteSlide"
						@add="slideOps.addSlide()"
						@duplicate="slideOps.duplicateSlide(activeSlideIndex)"
						@delete="slideOps.deleteSlide(activeSlideIndex)"
					/>
					<SlideTransitionPanel
						v-if="props.canEdit && activeSlide"
						:slide="activeSlide"
						@update="onTransitionUpdate"
					/>
					<button
						v-for="(slide, index) in slides"
						:key="slide.id ?? index"
						type="button"
						class="pptx-vue-thumb"
						:class="{ 'is-active': index === activeSlideIndex }"
						:style="{ height: `${thumbHeight}px` }"
						:aria-label="`Slide ${index + 1}`"
						:aria-current="index === activeSlideIndex ? 'true' : undefined"
						@click="goTo(index)"
					>
						<div class="pptx-vue-thumb-stage" aria-hidden="true">
							<SlideStage
								:slide="slide"
								:canvas-size="canvasSize"
								:media-data-urls="mediaDataUrls"
								:scale="thumbScale"
							/>
						</div>
						<span class="pptx-vue-thumb-index">{{ index + 1 }}</span>
					</button>
				</nav>

				<main
					class="pptx-vue-main"
					:class="{ 'is-editable': props.canEdit }"
					@pointerdown="onCanvasPointerDown"
					@contextmenu="onCanvasContextMenu"
					@pointermove="onCollabPointerMove"
					@touchstart="onMainTouchStart"
					@touchend="onMainTouchEnd"
				>
					<SlideCanvas
						:slide="activeSlide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:zoom="effectiveZoom"
						@update:fit-scale="fitScale = $event"
					>
						<SelectionOverlay
							v-if="props.canEdit"
							:elements="selectedElements"
							:selected-ids="selectedElementIds"
							:zoom="effectiveZoom"
							@transform-start="onTransformStart"
							@transform="onTransform"
							@transform-end="onTransformEnd"
						/>
						<CollaborationCursors
							v-if="collabActive"
							:cursors="collab.cursors.value"
							:zoom="effectiveZoom"
						/>
					</SlideCanvas>
					<NotesPanel v-if="props.canEdit" :slide="activeSlide" @update="onNotesUpdate" />
				</main>

				<!-- Property inspector (single selection, edit mode) -->
				<InspectorPane
					v-if="props.canEdit && inspectorElementForPanels"
					:element="inspectorElementForPanels"
					@update="onInspectorUpdate"
				/>

				<!-- Accessibility checker -->
				<AccessibilityPanel
					v-if="props.canEdit && showA11y"
					:issues="a11y.issues.value"
					@select-slide="goTo"
				/>

				<!-- Comments -->
				<CommentsPanel
					v-if="props.canEdit && showComments"
					:comments="commentsApi.slideComments.value"
					:author-name="authorNameRef"
					@add="(t) => commitComments(commentsApi.addComment(t))"
					@remove="(id) => commitComments(commentsApi.removeComment(id))"
					@resolve="(id) => commitComments(commentsApi.resolveComment(id))"
				/>

				<!-- Digital signatures -->
				<SignaturesPanel v-if="showSignatures" :signatures="signatures" />
			</div>

			<!-- Element context menu (edit mode) -->
			<ContextMenu
				:open="contextMenu.open"
				:x="contextMenu.x"
				:y="contextMenu.y"
				:items="contextItems"
				@select="onContextSelect"
				@close="contextMenu.open = false"
			/>

			<!-- Hyperlink editor -->
			<HyperlinkDialog
				:open="hyperlinkOpen"
				:element="hyperlinkTarget"
				@save="onHyperlinkSave"
				@close="hyperlinkOpen = false"
			/>

			<!-- Share / collaboration -->
			<ShareDialog
				:open="shareOpen"
				:defaults="props.shareDefaults"
				:active="collabActive"
				@start="onShareStart"
				@stop="onShareStop"
				@close="shareOpen = false"
			/>

			<!-- Document properties (General / Statistics / Custom) -->
			<DocumentPropertiesDialog
				:open="propertiesOpen"
				:core-properties="coreProperties"
				:slides="slides"
				@save="onPropertiesSave"
				@close="propertiesOpen = false"
			/>

			<!-- Print -->
			<PrintDialog
				:open="printer.isPrintDialogOpen.value"
				:slides="slides"
				:active-slide-index="activeSlideIndex"
				@print="printer.print"
				@close="printer.closePrintDialog"
			/>

			<!-- Keyboard shortcut help -->
			<ShortcutPanel :open="showShortcuts" @close="showShortcuts = false" />

			<!-- Broadcast -->
			<BroadcastDialog
				:open="broadcastOpen"
				:active="collabActive"
				:viewer-url="broadcastViewerUrl"
				:defaults="{ serverUrl: props.shareDefaults?.serverUrl }"
				@start="onBroadcastStart"
				@stop="onBroadcastStop"
				@close="broadcastOpen = false"
			/>

			<!-- Mobile bottom bar -->
			<MobileBottomBar
				v-if="isMobile"
				:slide-index="activeSlideIndex"
				:slide-count="slideCount"
				:zoom-percent="zoomPercent"
				@prev="goPrev"
				@next="goNext"
				@zoom-in="zoomIn"
				@zoom-out="zoomOut"
				@present="present"
				@menu="showSorter = true"
			/>

			<!-- Off-screen stage used to rasterise slides for export -->
			<div
				ref="exportStageRef"
				class="pptx-vue-export-stage"
				aria-hidden="true"
				style="position: fixed; left: -99999px; top: 0; pointer-events: none; opacity: 0"
			>
				<SlideStage
					v-if="exportSlide"
					:slide="exportSlide"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="1"
				/>
			</div>
		</template>

		<!-- Slide sorter overlay -->
		<SlideSorter
			v-if="showSorter"
			:slides="slides"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:active-index="activeSlideIndex"
			@select="onSorterSelect"
			@reorder="onSorterReorder"
			@close="showSorter = false"
		/>

		<!-- Presentation / slideshow overlay -->
		<PresentationMode
			v-if="presenting"
			:slides="slides"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:start-index="activeSlideIndex"
			@close="onPresentClose"
			@slide-change="onPresentSlideChange"
		/>
	</div>
</template>
