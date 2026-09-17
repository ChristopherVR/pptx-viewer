import {
	ChangeDetectionStrategy,
	Component,
	inject,
	input,
	signal,
	viewChild,
} from '@angular/core';
import {
	CollaborationCursorsComponent,
	POWER_POINT_VIEWER_PROVIDERS,
	RemoteSelectionOverlayComponent,
	SlideCanvasComponent,
	ViewerCollaborationShellService,
} from 'pptx-angular-viewer';

import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';

/** Host-defined chrome and the public canvas, without mounting the full viewer. */
@Component({
	selector: 'app-host-owned-headless-editor',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [...POWER_POINT_VIEWER_PROVIDERS, ViewerCollaborationShellService],
	imports: [SlideCanvasComponent, CollaborationCursorsComponent, RemoteSelectionOverlayComponent],
	styles: `
		:host {
			display: block;
			height: 100%;
		}
		section {
			height: 100%;
			display: flex;
			flex-direction: column;
		}
		pptx-slide-canvas {
			flex: 1;
			min-height: 0;
		}
	`,
	template: `
		<section
			data-host-custom-shell
			[attr.aria-busy]="shell.loader.loading()"
			(pointermove)="shell.cursor.onPointerMove($event)"
		>
			<div role="status" aria-label="Headless collaboration">
				Custom shell: {{ shell.state().status }}; collaborators: {{ shell.state().connectedCount }}
			</div>
			@if (shell.loader.error(); as error) {
				<p role="alert">{{ error }}</p>
			}
			<pptx-slide-canvas
				[slide]="shell.activeSlide()"
				[canvasSize]="shell.loader.canvasSize()"
				[mediaDataUrls]="shell.loader.mediaDataUrls()"
				[editable]="shell.canEdit()"
				[autoFit]="false"
				[zoom]="scale()"
				[selectedIds]="shell.editor.selectedIds()"
				[editingId]="shell.canvasEditing.editingId()"
				[templateElements]="shell.activeTemplateElements()"
				(elementSelect)="shell.canvasEditing.onElementSelect($event)"
				(backgroundClick)="shell.canvasEditing.onBackgroundClick()"
				(transformStart)="shell.canEdit() && shell.editor.beginTransform($event.label)"
				(transformUpdate)="
					shell.canEdit() &&
						shell.editor.applyTransform(shell.activeSlideIndex(), $event.id, $event.box)
				"
				(transformEnd)="
					shell.canEdit() && shell.editor.rerouteConnectors(shell.activeSlideIndex(), $event.ids)
				"
				(rotateUpdate)="
					shell.canEdit() &&
						shell.editor.applyTransform(shell.activeSlideIndex(), $event.id, {
							rotation: $event.rotation,
						})
				"
				(textEditStart)="shell.canvasEditing.onTextEditStart($event.id)"
				(textInput)="shell.canvasEditing.onTextInput($event)"
				(textCommit)="shell.canvasEditing.onTextCommit($event)"
				(textCancel)="shell.canvasEditing.editingId.set(null)"
				(listSession)="shell.canvasEditing.onListSession($event)"
			>
				<pptx-collaboration-cursors [cursors]="shell.cursor.cursors()" />
				<pptx-remote-selection-overlay
					[presences]="shell.collaboration.presence()"
					[elements]="shell.activeSlide()?.elements ?? []"
					[activeSlideIndex]="shell.activeSlideIndex()"
				/>
			</pptx-slide-canvas>
		</section>
	`,
})
export class HostOwnedHeadlessEditorComponent {
	readonly host = input.required<HostOwnedDemo>();
	readonly shell = inject(ViewerCollaborationShellService);
	readonly scale = signal(1);
	private readonly canvas = viewChild(SlideCanvasComponent);

	constructor() {
		this.shell.bind({
			content: () => this.host().source,
			collaboration: () => this.host().config,
			canEdit: () => this.host().editable,
			stageElement: () => this.canvas()?.getStageElement(),
		});
	}

	getContent(): Promise<Uint8Array> {
		return this.shell.getContent();
	}

	setScale(value: number): void {
		if (Number.isFinite(value) && value > 0) {
			this.scale.set(value);
		}
	}
}
