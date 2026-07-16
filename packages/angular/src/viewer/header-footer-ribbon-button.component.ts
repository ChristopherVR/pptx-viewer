import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ViewerDialogsService } from './viewer-dialogs.service';

@Component({
	selector: 'pptx-header-footer-ribbon-button',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<button
			type="button"
			class="pptx-rb-gb"
			(click)="dialogs.showHeaderFooter.set(true)"
			[title]="'pptx.headerFooter.title' | translate"
		>
			# {{ 'pptx.headerFooter.title' | translate }}
		</button>
	`,
})
export class HeaderFooterRibbonButtonComponent {
	protected readonly dialogs = inject(ViewerDialogsService);
}
