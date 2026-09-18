import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { resolveCollaborationShellState } from '../internal/shared';
import type { CollaborationShellState } from '../internal/shared';
import { CollaborationService } from './collaboration.service';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { buildSaveSlides } from './template-mode';
import type { CollaborationConfig } from './types';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';
import { ViewerCollabCursorService } from './viewer-collab-cursor.service';
import { ViewerCollaborationSessionService } from './viewer-collaboration-session.service';

/** Reactive accessors supplied by a component with its own canvas and chrome. */
export interface ViewerCollaborationShellOptions {
	content: () => Uint8Array | ArrayBuffer | null;
	collaboration: () => CollaborationConfig | undefined;
	/** Host permission is a ceiling; a collaboration session never grants it. */
	canEdit: () => boolean;
	/** The scaled slide stage, not its outer scroll container. */
	stageElement: () => HTMLElement | undefined;
}

/**
 * Supported custom-shell wiring over the same services as the full viewer.
 * Provide this beside POWER_POINT_VIEWER_PROVIDERS and call bind once from
 * the host constructor. The host owns its UI and any external Yjs transport.
 */
@Injectable()
export class ViewerCollaborationShellService {
	readonly editor = inject(EditorStateService);
	readonly loader = inject(LoadContentService);
	readonly collaboration = inject(CollaborationService);
	readonly canvasEditing = inject(ViewerCanvasEditingService);
	readonly cursor = inject(ViewerCollabCursorService);
	private readonly session = inject(ViewerCollaborationSessionService);
	private readonly options = signal<ViewerCollaborationShellOptions | null>(null);
	private readonly loadedContent = signal<Uint8Array | ArrayBuffer | null>(null);

	readonly activeSlideIndex = signal(0);
	readonly activeSlide = computed(() => this.editor.slides()[this.activeSlideIndex()]);
	readonly activeTemplateElements = computed(
		() => this.editor.templateElementsBySlideId()[this.activeSlide()?.id ?? ''] ?? [],
	);
	readonly state = computed<CollaborationShellState>(() => {
		const host = this.options();
		const content = host?.content();
		return resolveCollaborationShellState({
			authorizedCanEdit: host?.canEdit() ?? false,
			configured: Boolean(host?.collaboration()),
			readOnly: this.collaboration.readOnly(),
			sourcePending:
				Boolean(content) && (this.loader.loading() || content !== this.loadedContent()),
			sourceError: Boolean(this.loader.error()),
			status: this.collaboration.status(),
			remoteUsers: this.collaboration.presence(),
		});
	});
	readonly canEdit = computed(() => this.state().canEdit);

	constructor() {
		this.session.bind({
			authorName: () => this.options()?.collaboration()?.userName,
			shareDefaults: () => undefined,
			getTemplateElements: () => this.editor.templateElementsBySlideId(),
			applyRemoteSlides: (slides) => this.editor.applyRemoteSlides(slides),
			canvasSize: () => this.loader.canvasSize(),
			getSourceBytes: () => {
				const content = this.options()?.content();
				return content instanceof Uint8Array ? content : content ? new Uint8Array(content) : null;
			},
			getSaveOptions: () => this.loader.getSaveOptions(),
			currentSlides: () => this.editor.slides(),
			emitStart: () => {},
			emitStop: () => {},
		});
		this.canvasEditing.bind({
			canEdit: this.canEdit,
			activeSlide: this.activeSlide,
			activeSlideIndex: this.activeSlideIndex,
			activeTemplateElements: this.activeTemplateElements,
		});
		this.cursor.bind({
			stageElement: () => this.options()?.stageElement(),
			canvasSize: () => this.loader.canvasSize(),
			activeSlideIndex: this.activeSlideIndex,
		});
		this.loader.bindPendingInlineEdit(() => {
			const snapshot = this.canEdit() ? this.canvasEditing.readInlineSnapshot() : undefined;
			const slide = this.activeSlide();
			return snapshot && slide
				? { snapshot, text: snapshot.text, target: { slideId: slide.id } }
				: undefined;
		});
		effect(() => {
			const content = this.options()?.content() ?? null;
			untracked(() => {
				void this.loader.load(content).then(() => {
					if (this.options()?.content() === content) {
						this.loadedContent.set(content);
					}
					return undefined;
				});
			});
		});
		effect(() => {
			const slides = this.loader.slides();
			untracked(() => {
				this.editor.setSlides(slides, this.loader.sections());
				this.activeSlideIndex.set(0);
				this.collaboration.adoptDocSlidesAfterLoad('bootstrap');
			});
		});
		effect(() => {
			const config = this.options()?.collaboration();
			untracked(() => this.session.syncHostConfig(config));
		});
		effect(() => {
			const slides = this.editor.slides();
			if (this.collaboration.active() && this.collaboration.activeRole() !== 'viewer') {
				untracked(() => this.collaboration.broadcastSlides(slides));
			}
		});
		effect(() => {
			const selected = this.editor.selectedIds()[0];
			const index = this.activeSlideIndex();
			if (this.collaboration.active()) {
				untracked(() => this.collaboration.setSelection(selected, index));
			}
		});
		effect(() => {
			const index = this.activeSlideIndex();
			if (this.collaboration.active()) {
				untracked(() => this.collaboration.setActiveSlide(index));
			}
		});
		effect(() => {
			if (!this.canEdit()) {
				untracked(() => this.canvasEditing.suspendInlineEdit());
			}
		});
	}

	bind(options: ViewerCollaborationShellOptions): void {
		this.options.set(options);
	}

	/** Save the live model even while readiness or a viewer role blocks editing. */
	getContent(): Promise<Uint8Array> {
		return this.loader.saveSlides(
			buildSaveSlides(this.editor.slides(), this.editor.templateElementsBySlideId()),
			'pptx',
			this.editor.sections(),
		);
	}
}
