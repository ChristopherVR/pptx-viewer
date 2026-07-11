// See react.ts for why the picker/new-presentation pattern is what it is.
export const ANGULAR_APP_TS = `import { Component, signal } from '@angular/core';
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: \`
		@if (content(); as c) {
			<div style="height: 100vh">
				<pptx-power-point-viewer [content]="c" [canEdit]="true" style="height: 100%" />
			</div>
		} @else {
			<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; height: 100vh; font-family: system-ui, sans-serif">
				<h1 style="margin: 0; font-size: 24px; font-weight: 500; color: #e5e7eb">Open a Presentation</h1>
				<label style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: 1px solid #4b5563; background: #1f2937; color: #f3f4f6; cursor: pointer; font-size: 14px">
					Choose .pptx file
					<input type="file" accept=".pptx" style="display: none" (change)="onPick($event)" />
				</label>
				<span style="color: #6b7280; font-size: 13px">or</span>
				<button style="padding: 10px 20px; border-radius: 8px; border: none; background: #2563eb; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500" (click)="newPresentation()">New Presentation</button>
			</div>
		}
	\`,
})
export class App {
	content = signal<ArrayBuffer | Uint8Array | null>(null);

	async onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) {
			this.content.set(await file.arrayBuffer());
		}
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
