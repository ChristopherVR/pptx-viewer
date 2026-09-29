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
// The openable-file allow list comes from the binding's public surface, not a
// local regex: a hand-rolled `.pptx|.ppt|.json` refused a `.pptm` on drop that
// the viewer's own File > Open accepted.
import { PPTX_OPEN_ACCEPT, isSupportedPresentationFile } from 'pptx-angular-viewer';

/**
 * No-content dropzone screen (Angular port of the React demo's empty state).
 *
 * Uses the demo's shared landing styles and root theme variables. It surfaces
 * the join messaging when arriving via a `?room=` /
 * `?broadcast=` URL. Emits the picked file or a "new presentation" request.
 */
@Component({
	selector: 'app-dropzone',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<main class="demo-stage" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
			<h1 class="sr-only">PPTX Viewer</h1>
			<div class="demo-dropzone" data-testid="dropzone" (click)="onZoneClick($event)">
				@if (urlBroadcast()) {
					<p class="demo-join">
						{{ tr('demo.dropzone.joiningBroadcast') }}
						<code>{{ urlBroadcast() }}</code>
					</p>
					<p class="demo-hint">
						{{ tr('demo.dropzone.loadingBroadcast') }}
					</p>
				} @else if (urlRoom()) {
					<p class="demo-join">
						{{ tr('demo.dropzone.joiningSession') }}
						<code>{{ urlRoom() }}</code>
					</p>
					<label for="file-input" class="demo-hint">
						{{ tr('demo.dropzone.hintCollab') }}
					</label>
				} @else {
					<label for="file-input" class="demo-hint">
						{{ tr('demo.dropzone.hint') }}
					</label>
				}
				<p class="demo-sub">
					{{ tr('demo.dropzone.processed') }}
				</p>
				<div class="demo-actions">
					<button
						type="button"
						class="demo-browse"
						data-testid="browse-files"
						(click)="$event.stopPropagation(); openFilePicker()"
					>
						{{ tr('demo.dropzone.browse') }}
					</button>
					<button
						type="button"
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
					[attr.accept]="acceptedExtensions"
					[attr.aria-label]="tr('demo.dropzone.uploadAriaLabel')"
					class="sr-only"
					(change)="onInputChange($event)"
				/>
			</div>
		</main>
	`,
})
export class DropzoneComponent {
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

	/** `accept` list for the file input; the same list the viewer's picker uses. */
	protected readonly acceptedExtensions = PPTX_OPEN_ACCEPT;

	protected onInputChange(e: Event): void {
		const picked = (e.target as HTMLInputElement).files?.[0];
		if (picked) {
			this.file.emit(picked);
		}
	}

	protected onDrop(e: DragEvent): void {
		e.preventDefault();
		const picked = e.dataTransfer?.files?.[0];
		if (picked && isSupportedPresentationFile(picked.name)) {
			this.file.emit(picked);
		}
	}
}
