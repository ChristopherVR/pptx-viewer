import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	input,
	output,
	viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
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
		<main
			class="demo-dropzone"
			[ngStyle]="dropzoneStyle()"
			(drop)="onDrop($event)"
			(dragover)="$event.preventDefault()"
		>
			<h1 class="sr-only">PPTX Viewer</h1>
			<div
				class="demo-card"
				data-testid="dropzone"
				[ngStyle]="cardStyle()"
				(click)="onZoneClick($event)"
			>
				@if (urlBroadcast()) {
					<p class="demo-hint" [style.color]="color('foreground')">
						{{ tr('demo.dropzone.joiningBroadcast') }}
						<code [ngStyle]="codeStyle()">{{ urlBroadcast() }}</code>
					</p>
					<p class="demo-hint" [style.color]="color('mutedForeground')">
						{{ tr('demo.dropzone.loadingBroadcast') }}
					</p>
				} @else if (urlRoom()) {
					<p class="demo-hint" [style.color]="color('foreground')">
						{{ tr('demo.dropzone.joiningSession') }}
						<code [ngStyle]="codeStyle()">{{ urlRoom() }}</code>
					</p>
					<label for="file-input" class="demo-hint" [style.color]="color('mutedForeground')">
						{{ tr('demo.dropzone.hintCollab') }}
					</label>
				} @else {
					<label for="file-input" class="demo-hint" [style.color]="color('mutedForeground')">
						{{ tr('demo.dropzone.hint') }}
					</label>
				}
				<p class="demo-sub" [style.color]="color('mutedForeground')">
					{{ tr('demo.dropzone.processed') }}
				</p>
				<div class="demo-actions">
					<button
						type="button"
						class="demo-new-btn demo-browse"
						data-testid="browse-files"
						[ngStyle]="browseButtonStyle()"
						(click)="$event.stopPropagation(); openFilePicker()"
					>
						{{ tr('demo.dropzone.browse') }}
					</button>
					<button
						type="button"
						class="demo-new-btn"
						[ngStyle]="newButtonStyle()"
						[disabled]="busy()"
						(click)="$event.stopPropagation(); create.emit()"
					>
						{{ busy() ? tr('demo.dropzone.creating') : tr('demo.dropzone.newPresentation') }}
					</button>
				</div>
				<input
					#fileInput
					id="file-input"
					type="file"
					accept=".pptx,.ppt"
					[attr.aria-label]="tr('demo.dropzone.uploadAriaLabel')"
					class="sr-only"
					(change)="onInputChange($event)"
				/>
			</div>
		</main>
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
			}
			.demo-card {
				max-width: 900px;
				width: 100%;
				border: 2px dashed;
				border-radius: 0.75rem;
				padding: 3rem;
				cursor: pointer;
			}
			.demo-actions {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
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
			}
			.sr-only {
				position: absolute;
				width: 1px;
				height: 1px;
				padding: 0;
				margin: -1px;
				overflow: hidden;
				clip: rect(0, 0, 0, 0);
				white-space: nowrap;
				border: 0;
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

	private readonly translate = inject(TranslateService);

	/** Open the native picker from the explicit Browse control. */
	protected openFilePicker(): void {
		this.fileInput()?.nativeElement.click();
	}

	/**
	 * The dashed card paints `cursor: pointer` over its whole area and the copy
	 * says "click to browse", so the whole area has to open the picker, not just
	 * the one text line that happens to be a <label>. Clicks that originate on a
	 * button, on the label, or on the input itself are already handled by those
	 * elements; re-opening from here would double-fire or loop.
	 */
	protected onZoneClick(e: Event): void {
		const target = e.target as HTMLElement | null;
		if (target?.closest('button, label[for="file-input"], #file-input')) {
			return;
		}
		this.openFilePicker();
	}

	/** Translate a key using the active language (instant, no async). */
	protected tr(key: string): string {
		return this.translate.instant(key);
	}

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

	/** The primary call to action: the explicit "browse" control the copy promises. */
	protected browseButtonStyle(): Record<string, string> {
		return {
			borderColor: this.color('primary'),
			background: this.color('primary'),
			color: this.color('primaryForeground'),
			fontWeight: '500',
		};
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
		if (picked && (picked.name.endsWith('.pptx') || picked.name.endsWith('.ppt'))) {
			this.file.emit(picked);
		}
	}
}
