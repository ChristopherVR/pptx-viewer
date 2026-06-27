import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	input,
	output,
	viewChild,
} from '@angular/core';
import type { ViewerTheme } from 'pptx-angular-viewer';

type ColorKey = keyof NonNullable<ViewerTheme['colors']>;

/**
 * No-content dropzone screen (Angular port of the React demo's empty state).
 *
 * Themed from the active {@link ViewerTheme} so it tracks the floating theme
 * picker, and surfaces the join messaging when arriving via a `?room=` /
 * `?broadcast=` URL. Emits the picked file or a "new presentation" request.
 */
@Component({
	selector: 'app-dropzone',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div
			class="demo-dropzone"
			role="button"
			tabindex="0"
			[ngStyle]="dropzoneStyle()"
			(drop)="onDrop($event)"
			(dragover)="$event.preventDefault()"
			(click)="browse()"
			(keydown.enter)="browse()"
		>
			<div class="demo-card" [ngStyle]="cardStyle()">
				@if (urlBroadcast()) {
					<p class="demo-hint" [style.color]="color('foreground')">
						Joining broadcast:
						<code [ngStyle]="codeStyle()">{{ urlBroadcast() }}</code>
					</p>
					<p class="demo-hint" [style.color]="color('mutedForeground')">
						Loading presentation from broadcaster...
					</p>
				} @else if (urlRoom()) {
					<p class="demo-hint" [style.color]="color('foreground')">
						Joining collaboration session:
						<code [ngStyle]="codeStyle()">{{ urlRoom() }}</code>
					</p>
					<p class="demo-hint" [style.color]="color('mutedForeground')">
						Drop a .pptx file here or click to browse to start collaborating
					</p>
				} @else {
					<p class="demo-hint" [style.color]="color('mutedForeground')">
						Drop a .pptx file here or click to browse
					</p>
				}
				<p class="demo-sub" [style.color]="color('mutedForeground')">
					The file is processed entirely in the browser
				</p>
				<button
					type="button"
					class="demo-new-btn"
					[ngStyle]="newButtonStyle()"
					[disabled]="busy()"
					(click)="$event.stopPropagation(); create.emit()"
				>
					{{ busy() ? 'Creating...' : 'or create a New Presentation' }}
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
		</div>
	`,
	styles: [
		`
			.demo-dropzone {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
				height: 100dvh;
				width: 100vw;
				padding: 3rem;
				text-align: center;
				cursor: pointer;
			}
			.demo-card {
				max-width: 900px;
				width: 100%;
				border: 2px dashed;
				border-radius: 0.75rem;
				padding: 3rem;
			}
			.demo-card:hover {
				filter: brightness(1.05);
			}
			.demo-hint {
				margin: 0 0 0.75rem;
			}
			.demo-sub {
				margin: 0;
				font-size: 0.85rem;
				opacity: 0.6;
			}
			.demo-card code {
				padding: 0.1rem 0.35rem;
				border-radius: 0.25rem;
			}
			.demo-new-btn {
				margin-top: 1rem;
				padding: 0.5rem 1rem;
				border-radius: 0.5rem;
				border: 1px solid;
				font-size: 0.85rem;
				cursor: pointer;
			}
			.demo-new-btn:disabled {
				opacity: 0.5;
				cursor: default;
			}
		`,
	],
})
export class DropzoneComponent {
	readonly theme = input.required<ViewerTheme>();
	readonly urlRoom = input<string | null>(null);
	readonly urlBroadcast = input<string | null>(null);
	readonly busy = input<boolean>(false);

	/** Emits the picked / dropped `.pptx` file. */
	readonly file = output<File>();
	/** Emits when the user asks for a blank presentation. */
	readonly create = output<void>();

	private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

	protected color(key: ColorKey): string {
		return this.theme().colors?.[key] ?? '';
	}

	protected dropzoneStyle(): Record<string, string> {
		return { background: this.color('background'), color: this.color('foreground') };
	}

	protected cardStyle(): Record<string, string> {
		return { borderColor: this.color('border') };
	}

	protected codeStyle(): Record<string, string> {
		return { background: this.color('muted'), color: this.color('primary') };
	}

	protected newButtonStyle(): Record<string, string> {
		return {
			borderColor: this.color('border'),
			background: this.color('muted'),
			color: this.color('foreground'),
		};
	}

	protected browse(): void {
		this.fileInput()?.nativeElement.click();
	}

	protected onInputChange(e: Event): void {
		const picked = (e.target as HTMLInputElement).files?.[0];
		if (picked) {
			this.file.emit(picked);
		}
	}

	protected onDrop(e: DragEvent): void {
		e.preventDefault();
		const picked = e.dataTransfer?.files?.[0];
		if (picked?.name.endsWith('.pptx')) {
			this.file.emit(picked);
		}
	}
}
