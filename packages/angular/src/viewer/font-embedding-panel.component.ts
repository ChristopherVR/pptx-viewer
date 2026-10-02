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
	CUSTOM_ELEMENTS_SCHEMA,
	computed,
	effect,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { DialogFooterActionSpec } from './dialog-footer.component';
import { DialogFooterComponent } from './dialog-footer.component';
import { scanAvailableFonts } from './font-embedding-helpers';
import { FontEmbeddingListComponent } from './font-embedding-list.component';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-font-embedding-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DialogFooterComponent, ModalDialogComponent, FontEmbeddingListComponent, TranslatePipe],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.fontEmbedding.title' | translate"
			(close)="close.emit()"
		>
			<div class="pptx-ng-fonts">
				<p class="pptx-ng-fonts-desc">
					{{ 'pptx.fontEmbedding.description' | translate }}
				</p>

				<label class="pptx-ng-fonts-toggle" [class.is-disabled]="!canEmbedFonts()">
					<pptx-ui-checkbox
						[checked]="embedFontsEnabled()"
						[disabled]="!canEmbedFonts()"
						(change)="onToggle($event)"
					></pptx-ui-checkbox>
					<span class="pptx-ng-fonts-toggle-label">{{
						'pptx.fontEmbedding.embedWhenSaving' | translate
					}}</span>
				</label>
				<!--
					The switch used to move and change nothing at all. It now decides
					whether save keeps the deck's embedded font data, so it has to say
					which of those two things it is doing - and admit when it can do
					neither.
				-->
				<p class="pptx-ng-fonts-note">{{ toggleNoteKey() | translate }}</p>

				<pptx-font-embedding-list
					[usedFontFamilies]="usedFontFamilies()"
					[availableFamilies]="availableFamilies()"
					[embeddedSet]="embeddedSet()"
					[scanning]="scanning()"
					[missingCount]="missingCount()"
				/>
			</div>

			<div footer>
				<pptx-dialog-footer [actions]="footerActions()" (action)="onFooterAction()" />
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
			.pptx-ng-fonts-toggle.is-disabled {
				cursor: not-allowed;
				opacity: 0.6;
			}
			.pptx-ng-fonts-toggle-label {
				font-size: 0.75rem;
				color: var(--pptx-foreground, #f3f4f6);
			}
			.pptx-ng-fonts-note {
				margin: -0.5rem 0 0;
				font-size: 0.6875rem;
				line-height: 1.5;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
		`,
	],
})
export class FontEmbeddingPanelComponent {
	/** Footer actions for the shared `pptx-ui-dialog-footer`. */
	protected readonly footerActions = computed<DialogFooterActionSpec[]>(() => [
		{ id: 'done', labelKey: 'pptx.fontEmbedding.done', variant: 'primary' as const },
	]);

	protected onFooterAction(): void {
		this.close.emit();
	}

	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Whether font embedding is currently enabled. */
	readonly embedFontsEnabled = input<boolean>(false);

	/** Font families referenced by the presentation. */
	readonly usedFontFamilies = input<string[]>([]);

	/** Font families already embedded in the file. */
	readonly embeddedFonts = input<string[]>([]);

	/**
	 * False when the deck embeds nothing, in which case the switch is inert and
	 * says why. The viewer can keep or strip embedded font data on save, but it
	 * cannot manufacture it: a browser will not hand over the bytes of an
	 * installed system face.
	 */
	readonly canEmbedFonts = input<boolean>(true);

	/** i18n key for the explanation shown when `canEmbedFonts` is false. */
	readonly embedUnavailableKey = input<string | undefined>(undefined);

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

	/** Line of copy under the switch: what it does, or why it cannot. */
	readonly toggleNoteKey = computed(() =>
		this.canEmbedFonts()
			? 'pptx.fonts.embedKeepsExisting'
			: (this.embedUnavailableKey() ?? 'pptx.fonts.embedUnavailable'),
	);

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
