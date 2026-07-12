// See react.ts for why the picker/new-presentation pattern is what it is.
// The component's `styles` array carries the landing-screen layout so no extra
// CSS file is needed beyond the global `src/styles.css` (ANGULAR_GLOBAL_CSS).
export const ANGULAR_APP_TS = `import { Component, signal } from '@angular/core';
import { PptxHandler } from 'pptx-viewer-core';
import type { CollaborationConfig } from 'pptx-angular-viewer';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [PowerPointViewerComponent],
	styles: [\`
		:host { display: block; height: 100dvh; }
		.stage { display: flex; align-items: center; justify-content: center; height: 100dvh; padding: 2rem; cursor: default; }
		.dropzone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; max-width: 520px; width: 100%; padding: 3rem; text-align: center; border: 2px dashed var(--pptx-border, #374151); border-radius: 0.75rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
		.dropzone.over, .dropzone:hover { border-color: var(--pptx-primary, #6366f1); background: var(--pptx-muted, rgba(255,255,255,0.04)); }
		h1 { margin: 0; font-size: 1.5rem; font-weight: 500; }
		p { margin: 0; font-size: 0.875rem; color: var(--pptx-muted-foreground, #9ca3af); }
		.pick-label { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: 1px solid var(--pptx-border, #374151); background: var(--pptx-muted, #1f2937); color: var(--pptx-foreground, #f3f4f6); cursor: pointer; font-size: 0.875rem; transition: background 0.15s; }
		.pick-label:hover { background: var(--pptx-accent, #374151); }
		.or-sep { font-size: 0.8rem; color: var(--pptx-muted-foreground, #6b7280); }
		.new-btn { padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; background: var(--pptx-primary, #6366f1); color: #fff; cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: opacity 0.15s; }
		.new-btn:hover { opacity: 0.9; }
	\`],
	template: \`
		@if (content(); as c) {
			<div style="height: 100dvh">
				<pptx-power-point-viewer
					[content]="c"
					[canEdit]="true"
					style="height: 100%"
					[collaboration]="collab()"
					(startCollaboration)="collab.set($event)"
					(stopCollaboration)="collab.set(undefined)"
				/>
			</div>
		} @else {
			<div
				class="stage"
				[class.over]="over()"
				(dragover)="$event.preventDefault(); over.set(true)"
				(dragleave)="over.set(false)"
				(drop)="onDrop($event)"
				(click)="fileInput.click()"
			>
				<div class="dropzone">
					<h1>Open a Presentation</h1>
					<p>Drag &amp; drop a .pptx file here, or</p>
					<label class="pick-label" (click)="$event.stopPropagation()">
						Choose .pptx file
						<input #fileInput type="file" accept=".pptx" style="display: none" (change)="onPick($event)" />
					</label>
					<span class="or-sep">or</span>
					<button class="new-btn" (click)="$event.stopPropagation(); newPresentation()">New Presentation</button>
				</div>
			</div>
		}
	\`,
})
export class App {
	content = signal<ArrayBuffer | Uint8Array | null>(null);
	collab = signal<CollaborationConfig | undefined>(undefined);
	over = signal(false);

	async onDrop(e: DragEvent) {
		e.preventDefault();
		this.over.set(false);
		const file = e.dataTransfer?.files?.[0];
		if (file?.name.endsWith('.pptx')) this.content.set(await file.arrayBuffer());
	}

	async onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) this.content.set(await file.arrayBuffer());
	}

	async newPresentation() {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		this.content.set(await handler.save(data.slides));
	}
}
`;

export const ANGULAR_MAIN_TS = `import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Injectable } from '@angular/core';
import type { MissingTranslationHandlerParams } from '@ngx-translate/core';
import { MissingTranslationHandler, provideTranslateService } from '@ngx-translate/core';
import { keyToLabel } from 'pptx-angular-viewer';

import { App } from './app/app.ts';

@Injectable()
class LabelFallbackHandler implements MissingTranslationHandler {
	handle(params: MissingTranslationHandlerParams): string {
		return keyToLabel(params.key);
	}
}

bootstrapApplication(App, {
	providers: [
		provideTranslateService({
			lang: 'en',
			fallbackLang: 'en',
			missingTranslationHandler: {
				provide: MissingTranslationHandler,
				useClass: LabelFallbackHandler,
			},
		}),
	],
}).catch((err) => console.error(err));
`;
