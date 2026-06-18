import { Component, signal } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
import type { ViewerTheme } from 'pptx-angular-viewer';
import 'pptx-angular-viewer/styles';

/**
 * Demo app for `pptx-angular-viewer`.
 *
 * Pick a `.pptx` file and render it with the Angular viewer. Mirrors the React
 * `demo/` app's load-from-file flow at a minimal scale.
 */
@Component({
	selector: 'app-root',
	standalone: true,
	imports: [PowerPointViewerComponent],
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				height: 100vh;
				background: #0b1020;
				color: #e5e7eb;
				font-family: system-ui, sans-serif;
				/* Never let the demo chrome scroll the page horizontally — the mobile
				   e2e specs assert the document does not overflow its width. */
				overflow-x: hidden;
			}
			.bar {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem 1rem;
				padding: 0.75rem 1rem;
				border-bottom: 1px solid #1f2937;
				max-width: 100%;
				box-sizing: border-box;
			}
			.bar h1 {
				font-size: 1rem;
				font-weight: 600;
				margin: 0;
			}
			.bar input,
			.bar span {
				min-width: 0;
				max-width: 100%;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.viewer-host {
				flex: 1;
				min-height: 0;
			}
			.empty {
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100%;
				color: #9ca3af;
			}
		`,
	],
	template: `
		<div class="bar">
			<h1>pptx-angular-viewer</h1>
			<input
				id="file-input"
				type="file"
				accept=".pptx"
				aria-label="Upload PPTX file"
				(change)="onFile($event)"
			/>
			@if (fileName()) {
				<span>{{ fileName() }}</span>
			}
		</div>
		<div class="viewer-host">
			@if (content()) {
				<pptx-viewer [content]="content()" [theme]="theme" [canEdit]="true" />
			} @else {
				<div class="empty">Choose a .pptx file to preview it.</div>
			}
		</div>
	`,
})
export class AppComponent {
	readonly content = signal<ArrayBuffer | null>(null);
	readonly fileName = signal<string>('');
	readonly theme: ViewerTheme = { colors: { primary: '#6366f1' } };

	async onFile(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			return;
		}
		this.fileName.set(file.name);
		this.content.set(await file.arrayBuffer());
	}
}
