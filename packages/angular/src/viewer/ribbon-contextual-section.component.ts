/**
 * ribbon-contextual-section.component.ts: the content of a contextual ribbon
 * tab (Shape Format, Picture Format, Table Design, Chart Design, SmartArt
 * Design). Renders shared `CONTEXTUAL_TAB_GROUPS[tab]` as ordinary ribbon
 * groups (caption under the controls, `data-ribbon-group` on the wrapper),
 * each holding its galleries in the mode the shared placement names. No
 * placement is decided here, so a gallery shared adds to a tab appears in
 * all five bindings at once.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { CONTEXTUAL_TAB_GROUPS } from '../internal/shared';
import type { RibbonContextualTabId } from '../internal/shared';
import { RibbonGalleryComponent } from './ribbon-gallery.component';

@Component({
	selector: 'pptx-ribbon-contextual-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, RibbonGalleryComponent],
	template: `
		@for (group of groups(); track group.group; let last = $last) {
			<div class="flex flex-col items-center gap-0.5" [attr.data-ribbon-group]="group.group">
				<div class="flex items-center gap-1">
					@for (placement of group.galleries; track placement.control) {
						<pptx-ribbon-gallery
							[gallery]="placement.gallery"
							[mode]="placement.mode"
							[control]="placement.control"
							[element]="selectedElement()"
							[slideIndex]="slideIndex()"
							[canEdit]="canEdit()"
						/>
					}
				</div>
				<span class="text-[9px] leading-none text-muted-foreground">
					{{ group.labelKey | translate }}
				</span>
			</div>
			@if (!last) {
				<span class="pptx-rb-sep"></span>
			}
		}
	`,
})
export class RibbonContextualSectionComponent {
	readonly tab = input.required<RibbonContextualTabId>();
	readonly selectedElement = input<PptxElement | null>(null);
	readonly slideIndex = input<number>(0);
	readonly canEdit = input<boolean>(false);

	readonly groups = computed(() => CONTEXTUAL_TAB_GROUPS[this.tab()]);
}
