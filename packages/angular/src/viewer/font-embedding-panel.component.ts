/**
 * font-embedding-panel.component.ts: Font-embedding settings dialog.
 *
 * Selector: `pptx-font-embedding-panel`
 *
 * Angular port of the React `FontEmbeddingPanel` component
 * (`packages/react/src/viewer/components/FontEmbeddingPanel.tsx`). Composes the
 * reusable {@link ModalDialogComponent} and {@link FontEmbeddingListComponent}.
 * Lets the user toggle font embedding and shows, for every font family used by
 * the deck, whether it is available in the current browser (scanned via
 * {@link scanAvailableFonts}) and whether it is already embedded. The host owns
 * `open`, `embedFontsEnabled`, and the font lists.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	output,
	signal,
} from '@angular/core';

import { scanAvailableFonts } from './font-embedding-helpers';
import { FontEmbeddingListComponent } from './font-embedding-list.component';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-font-embedding-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, FontEmbeddingListComponent],
	template: `
		<pptx-modal-dialog [open]="open()" title="Embed Fonts" (close)="close.emit()">
			<div class="pptx-ng-fonts">
				<p class="pptx-ng-fonts-desc">
					Embed the fonts used by this presentation so it renders correctly on devices that do not
					have them installed.
				</p>

				<label class="pptx-ng-fonts-toggle">
					<span class="pptx-ng-fonts-switch" [class.is-on]="embedFontsEnabled()">
						<input
							type="checkbox"
							class="pptx-ng-fonts-switch-input"
							[checked]="embedFontsEnabled()"
							(change)="onToggle($event)"
						/>
						<span class="pptx-ng-fonts-switch-knob" [class.is-on]="embedFontsEnabled()"></span>
					</span>
					<span class="pptx-ng-fonts-toggle-label">Embed fonts when saving</span>
				</label>

				<pptx-font-embedding-list
					[usedFontFamilies]="usedFontFamilies()"
					[availableFamilies]="availableFamilies()"
					[embeddedSet]="embeddedSet()"
					[scanning]="scanning()"
					[missingCount]="missingCount()"
				/>
			</div>

			<div footer>
				<button type="button" class="pptx-ng-fonts-done" (click)="close.emit()">Done</button>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-fonts {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}
			.pptx-ng-fonts-desc {
				margin: 0;
				font-size: 0.75rem;
				line-height: 1.5;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-fonts-toggle {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				cursor: pointer;
			}
			.pptx-ng-fonts-switch {
				position: relative;
				display: inline-block;
				width: 2.25rem;
				height: 1.25rem;
				border-radius: 9999px;
				background: var(--pptx-muted-foreground, #6b7280);
				transition: background 0.15s ease;
			}
			.pptx-ng-fonts-switch.is-on {
				background: var(--pptx-primary, #6366f1);
			}
			.pptx-ng-fonts-switch-input {
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
			.pptx-ng-fonts-switch-knob {
				position: absolute;
				top: 0.125rem;
				left: 0.125rem;
				width: 1rem;
				height: 1rem;
				border-radius: 9999px;
				background: #ffffff;
				transition: transform 0.15s ease;
			}
			.pptx-ng-fonts-switch-knob.is-on {
				transform: translateX(1rem);
			}
			.pptx-ng-fonts-toggle-label {
				font-size: 0.75rem;
				color: var(--pptx-foreground, #f3f4f6);
			}
			.pptx-ng-fonts-done {
				padding: 0.375rem 0.75rem;
				font-size: 0.75rem;
				color: #ffffff;
				background: var(--pptx-primary, #6366f1);
				border: 1px solid var(--pptx-primary, #6366f1);
				border-radius: 0.5rem;
				cursor: pointer;
				transition: filter 0.15s ease;
			}
			.pptx-ng-fonts-done:hover {
				filter: brightness(1.1);
			}
		`,
	],
})
export class FontEmbeddingPanelComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Whether font embedding is currently enabled. */
	readonly embedFontsEnabled = input<boolean>(false);

	/** Font families referenced by the presentation. */
	readonly usedFontFamilies = input<string[]>([]);

	/** Font families already embedded in the file. */
	readonly embeddedFonts = input<string[]>([]);

	/** Fired when the dialog is dismissed. */
	readonly close = output<void>();

	/** Fired when the embed toggle changes; carries the new checked state. */
	readonly toggleEmbedFonts = output<boolean>();

	/** Families that resolve in the current browser (populated by the scan). */
	readonly availableFamilies = signal<Set<string>>(new Set<string>());

	/** True while the font-availability scan is running. */
	readonly scanning = signal(false);

	/** True once a scan has completed for the current open cycle. */
	readonly scanned = signal(false);

	/** Set view of {@link embeddedFonts} for fast membership checks. */
	readonly embeddedSet = computed(() => new Set(this.embeddedFonts()));

	/** How many used families failed to resolve in the browser. */
	readonly missingCount = computed(() => {
		const available = this.availableFamilies();
		return this.usedFontFamilies().filter((f) => !available.has(f)).length;
	});

	constructor() {
		// Kick off a scan when the dialog opens, and reset so reopening rescans.
		effect(() => {
			if (this.open()) {
				if (!this.scanned()) {
					void this.scanFonts();
				}
			} else if (this.scanned()) {
				this.scanned.set(false);
			}
		});
	}

	onToggle(event: Event): void {
		this.toggleEmbedFonts.emit((event.target as HTMLInputElement).checked);
	}

	private async scanFonts(): Promise<void> {
		this.scanning.set(true);
		try {
			this.availableFamilies.set(await scanAvailableFonts(this.usedFontFamilies()));
			this.scanned.set(true);
		} finally {
			this.scanning.set(false);
		}
	}
}
