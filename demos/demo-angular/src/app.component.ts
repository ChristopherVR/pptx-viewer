import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
import type { ViewerTheme } from 'pptx-angular-viewer';
import { PptxHandler } from 'pptx-viewer-core';
import 'pptx-angular-viewer/styles';

interface ThemePreset {
	label: string;
	theme: ViewerTheme;
}

const THEMES: Record<string, ThemePreset> = {
	dark: {
		label: 'Dark',
		theme: {
			colors: {
				background: '#030712',
				foreground: '#f3f4f6',
				card: '#111827',
				primary: '#6366f1',
				border: '#374151',
				mutedForeground: '#9ca3af',
			},
		},
	},
	light: {
		label: 'Light',
		theme: {
			colors: {
				background: '#f8fafc',
				foreground: '#0f172a',
				card: '#ffffff',
				primary: '#4f46e5',
				border: '#e2e8f0',
				mutedForeground: '#64748b',
			},
		},
	},
	midnight: {
		label: 'Midnight Blue',
		theme: {
			colors: {
				background: '#0c1222',
				foreground: '#e2e8f0',
				card: '#162032',
				primary: '#38bdf8',
				border: '#1e3a5f',
				mutedForeground: '#7dd3fc',
			},
		},
	},
};

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
				font-family:
					system-ui,
					-apple-system,
					'Segoe UI',
					Roboto,
					sans-serif;
				overflow-x: hidden;
			}

			/* ── Dropzone (no file loaded) ─────────────────────────────────── */
			.demo-dropzone {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.75rem;
				height: 100%;
				padding: 2rem;
				text-align: center;
				color: #cbd5e1;
				background: #030712;
				cursor: pointer;
			}
			.demo-dropzone h1 {
				margin: 0;
				font-size: 1.5rem;
				color: #6366f1;
			}
			.demo-hint {
				margin: 0;
				font-size: 1rem;
			}
			.demo-sub {
				margin: 0;
				font-size: 0.8rem;
				color: #64748b;
			}
			.demo-dropzone code {
				padding: 0.1rem 0.3rem;
				border-radius: 0.25rem;
				background: #1e293b;
				color: #818cf8;
			}
			.demo-dropzone button {
				margin-top: 0.5rem;
				padding: 0.5rem 1rem;
				border-radius: 0.5rem;
				border: 1px solid #334155;
				background: #1e293b;
				color: #e2e8f0;
				font-size: 0.85rem;
				cursor: pointer;
			}
			.demo-dropzone button:disabled {
				opacity: 0.5;
				cursor: default;
			}

			/* ── Shell (file loaded) ───────────────────────────────────────── */
			.demo-shell {
				display: flex;
				flex-direction: column;
				height: 100%;
			}
			.demo-bar {
				display: flex;
				align-items: center;
				justify-content: space-between;
				flex-wrap: wrap;
				gap: 0.5rem 1rem;
				padding: 0.5rem 1rem;
				background: #0b1220;
				color: #e2e8f0;
				border-bottom: 1px solid #1e293b;
			}
			.demo-file {
				font-weight: 600;
				font-size: 0.9rem;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.demo-actions {
				display: flex;
				align-items: center;
				flex-wrap: wrap;
				gap: 0.5rem 0.75rem;
			}
			.demo-theme {
				display: flex;
				align-items: center;
				gap: 0.4rem;
				font-size: 0.8rem;
				color: #94a3b8;
			}
			.demo-bar select,
			.demo-bar button {
				padding: 0.35rem 0.6rem;
				border-radius: 0.375rem;
				border: 1px solid #334155;
				background: #1e293b;
				color: #e2e8f0;
				font-size: 0.8rem;
				cursor: pointer;
			}
			.demo-viewer {
				flex: 1;
				min-height: 0;
			}
		`,
	],
	template: `
		@if (content()) {
			<div class="demo-shell">
				<header class="demo-bar">
					<span class="demo-file">{{ fileName() }}</span>
					<div class="demo-actions">
						<label class="demo-theme">
							Theme
							<select [value]="themeKey()" (change)="onThemeChange($event)">
								@for (entry of themeEntries; track entry[0]) {
									<option [value]="entry[0]">{{ entry[1].label }}</option>
								}
							</select>
						</label>
						<button type="button" (click)="download()">Download .pptx</button>
						<button type="button" (click)="close()">Close</button>
					</div>
				</header>
				<div class="demo-viewer">
					<pptx-viewer
						#viewer
						[content]="content()!"
						[theme]="activeTheme()"
						[canEdit]="true"
						[smartArt3D]="smartArt3D"
					/>
				</div>
			</div>
		} @else {
			<div
				class="demo-dropzone"
				role="button"
				tabindex="0"
				(drop)="onDrop($event)"
				(dragover)="$event.preventDefault()"
				(click)="browse()"
				(keydown.enter)="browse()"
			>
				<h1>pptx-angular-viewer</h1>
				<p class="demo-hint">Drop a <code>.pptx</code> file here or click to browse</p>
				<p class="demo-sub">The file is processed entirely in the browser.</p>
				<button
					type="button"
					[disabled]="isBusy()"
					(click)="$event.stopPropagation(); newPresentation()"
				>
					{{ isBusy() ? 'Creating...' : 'or create a New Presentation' }}
				</button>
				<input
					#fileInput
					id="file-input"
					type="file"
					accept=".pptx"
					aria-label="Upload PPTX file"
					style="display: none"
					(change)="onInputChange($event)"
				/>
			</div>
		}
	`,
})
export class AppComponent {
	readonly content = signal<ArrayBuffer | null>(null);
	readonly fileName = signal<string>('');
	readonly themeKey = signal<string>('dark');
	readonly isBusy = signal<boolean>(false);

	/** Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`. */
	readonly smartArt3D = new URLSearchParams(window.location.search).get('smartArt3D') === '1';

	readonly themeEntries = Object.entries(THEMES);

	readonly viewer = viewChild<PowerPointViewerComponent>('viewer');
	readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

	activeTheme() {
		return THEMES[this.themeKey()]?.theme ?? THEMES['dark'].theme;
	}

	onThemeChange(e: Event): void {
		this.themeKey.set((e.target as HTMLSelectElement).value);
	}

	browse(): void {
		this.fileInput()?.nativeElement.click();
	}

	async onInputChange(e: Event): Promise<void> {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) {
			await this.loadFile(file);
		}
	}

	onDrop(e: DragEvent): void {
		e.preventDefault();
		const file = e.dataTransfer?.files?.[0];
		if (file?.name.endsWith('.pptx')) {
			void this.loadFile(file);
		}
	}

	async loadFile(file: File): Promise<void> {
		this.fileName.set(file.name);
		this.content.set(await file.arrayBuffer());
	}

	async newPresentation(): Promise<void> {
		this.isBusy.set(true);
		try {
			const { handler, data } = await PptxHandler.createBlank({
				title: 'Untitled Presentation',
				initialSlideCount: 1,
			});
			const bytes = await handler.save(data.slides);
			this.content.set(bytes.buffer as ArrayBuffer);
			this.fileName.set('Untitled Presentation');
		} finally {
			this.isBusy.set(false);
		}
	}

	close(): void {
		this.content.set(null);
		this.fileName.set('');
	}

	async download(): Promise<void> {
		const v = this.viewer();
		if (!v) {
			return;
		}
		const bytes = await v.getContent();
		const blob = new Blob([bytes as BlobPart], {
			type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const name = this.fileName();
		a.download = name.endsWith('.pptx') ? name : `${name || 'presentation'}.pptx`;
		a.click();
		URL.revokeObjectURL(url);
	}
}
