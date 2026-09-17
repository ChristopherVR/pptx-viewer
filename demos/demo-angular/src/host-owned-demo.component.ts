import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PowerPointViewerComponent, translationsEn } from 'pptx-angular-viewer';
import {
	translationsDe,
	translationsEs,
	translationsFr,
	translationsZhCN,
} from 'pptx-viewer-locales';

import { createHostOwnedDemo } from '../../shared/host-owned-collaboration';
import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';

@Component({
	selector: 'app-root',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [PowerPointViewerComponent],
	template: `<main style="position: fixed; inset: 64px 0 0">
		@if (error()) {
			<p role="alert">{{ error() }}</p>
		}
		@if (host(); as session) {
			@if (mounted()) {
				<pptx-viewer
					[content]="session.source"
					[fileName]="session.fileName"
					[collaboration]="session.config"
					[canEdit]="session.editable"
				/>
			}
		}
	</main>`,
})
export class HostOwnedDemoComponent {
	readonly host = signal<HostOwnedDemo | null>(null);
	readonly mounted = signal(true);
	readonly error = signal('');
	private readonly viewer = viewChild(PowerPointViewerComponent);
	constructor() {
		const translate = inject(TranslateService);
		for (const [language, messages] of Object.entries({
			en: translationsEn,
			de: translationsDe,
			es: translationsEs,
			fr: translationsFr,
			'zh-CN': translationsZhCN,
		})) {
			translate.setTranslation(language, messages);
		}
		translate.use('en');
		let disposed = false;
		inject(DestroyRef).onDestroy(() => {
			disposed = true;
			this.host()?.dispose();
		});
		void createHostOwnedDemo(import.meta.env.VITE_COLLAB_SERVER_URL?.trim())
			.then((session) => {
				if (disposed) {
					session.dispose();
					return;
				}
				this.host.set(session);
				session.attachControls(
					(value) => this.mounted.set(value),
					async () => this.viewer()?.getContent(),
				);
				return undefined;
			})
			.catch((reason: unknown) => this.error.set(String(reason)));
	}
}
