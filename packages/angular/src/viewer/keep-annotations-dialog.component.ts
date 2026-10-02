/**
 * keep-annotations-dialog.component.ts: Prompt shown when the user exits
 * presentation mode with ink annotations present.
 *
 * Selector: `pptx-keep-annotations-dialog`
 *
 * Angular port of the React `KeepAnnotationsDialog` component
 * (`packages/react/src/viewer/components/KeepAnnotationsDialog.tsx`). Composes
 * {@link ModalDialogComponent}. Offers to persist the drawn annotations as ink
 * elements on their slides, or discard them. Dismissing the modal is treated as a
 * discard (exit) to match the React close semantics. Drops react-i18next in
 * favour of the English fallback copy.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogFooterComponent } from './dialog-footer.component';
import type { DialogFooterActionSpec } from './dialog-footer.component';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-keep-annotations-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DialogFooterComponent, ModalDialogComponent, TranslatePipe],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.keepAnnotations.title' | translate"
			(close)="discard.emit()"
		>
			<div class="pptx-ng-keep">
				<div class="pptx-ng-keep-badge">&#128393;</div>
				<p class="pptx-ng-keep-desc">
					{{
						'pptx.keepAnnotations.description'
							| translate: { count: annotationCount(), slides: slideCount() }
					}}
				</p>
			</div>

			<div footer>
				<pptx-dialog-footer
					[actions]="footerActions"
					(action)="$event === 'keep' ? keep.emit() : discard.emit()"
				/>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-keep {
				display: flex;
				align-items: flex-start;
				gap: 0.75rem;
			}

			.pptx-ng-keep-badge {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 2.5rem;
				height: 2.5rem;
				flex-shrink: 0;
				border-radius: 9999px;
				background: rgba(99, 102, 241, 0.15);
				font-size: 1.125rem;
			}

			.pptx-ng-keep-desc {
				margin: 0;
				font-size: 0.8125rem;
				line-height: 1.5;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
		`,
	],
})
export class KeepAnnotationsDialogComponent {
	protected readonly footerActions: readonly DialogFooterActionSpec[] = [
		{ id: 'discard', labelKey: 'pptx.keepAnnotations.discard', icon: 'trash' },
		{ id: 'keep', labelKey: 'pptx.keepAnnotations.keep', variant: 'primary', icon: 'pen' },
	];

	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** How many ink annotations were drawn. */
	readonly annotationCount = input<number>(0);

	/** How many slides carry those annotations. */
	readonly slideCount = input<number>(0);

	/** Fired when the user keeps the annotations as ink on the slides. */
	readonly keep = output<void>();

	/** Fired when the user discards the annotations (also on dismiss). */
	readonly discard = output<void>();
}
