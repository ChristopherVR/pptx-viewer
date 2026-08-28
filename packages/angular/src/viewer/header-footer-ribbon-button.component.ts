import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ViewerDialogsService } from './viewer-dialogs.service';

@Component({
	selector: 'pptx-header-footer-ribbon-button',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<!-- pptx-rb-pill, not pptx-rb-gb: this button is standalone (not
		     inside a .pptx-rb-grp), so it needs its own rounded/bg-muted
		     chrome rather than the border-r/no-background style meant for a
		     group member. No icon either, matching React/Vue's plain-text
		     Header & Footer pill. -->
		<button
			type="button"
			class="pptx-rb-pill"
			(click)="dialogs.showHeaderFooter.set(true)"
			[title]="'pptx.headerFooter.title' | translate"
			[attr.aria-label]="'pptx.headerFooter.title' | translate"
		>
			{{ 'pptx.headerFooter.title' | translate }}
		</button>
	`,
})
export class HeaderFooterRibbonButtonComponent {
	protected readonly dialogs = inject(ViewerDialogsService);
}
