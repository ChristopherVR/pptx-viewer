/**
 * account-page.component.ts: File > Account content.
 *
 * Local-only profile editor + storage/privacy panel + app info, backed by the
 * shared `pptx-viewer-shared` account/viewer-prefs-storage helpers (vendored
 * via `../internal/shared`). Rendered by `RibbonFileSectionComponent` when the
 * backstage `page()` is `'account'` (replacing the old static stub shared
 * with the Options page).
 *
 * The Sign-in section only renders when a host supplies `accountAuth` with
 * `enabled: true`; it's absent by default, so hosts that don't wire it see no
 * visible change from before this feature landed.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
	AVATAR_COLOR_SWATCHES,
	clearAllLocalViewerData,
	DEFAULT_VIEWER_PROFILE,
	formatBackstageSize,
	getLocalStorageUsageSummary,
	readStoredViewerPrefs,
	resolveProfileInitial,
	saveViewerProfile,
} from '../internal/shared';
import type {
	AccountAuthConfig,
	LocalStorageUsageSummary,
	ViewerProfile,
} from '../internal/shared';
import { PPTX_ANGULAR_VIEWER_VERSION } from '../internal/version';

@Component({
	selector: 'pptx-account-page',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	templateUrl: './account-page.component.html',
	styleUrl: './account-page.component.css',
})
export class AccountPageComponent {
	/** Optional host-provided sign-in hook point. Absent/disabled by default. */
	readonly accountAuth = input<AccountAuthConfig | undefined>(undefined);

	private readonly translate = inject(TranslateService);

	protected readonly swatches = AVATAR_COLOR_SWATCHES;
	protected readonly version = PPTX_ANGULAR_VIEWER_VERSION;

	protected readonly profile = signal<ViewerProfile>(
		readStoredViewerPrefs().profile ?? DEFAULT_VIEWER_PROFILE,
	);
	protected readonly initial = computed(() => resolveProfileInitial(this.profile()));

	protected readonly usage = signal<LocalStorageUsageSummary | null>(null);
	protected readonly cleared = signal(false);
	protected readonly formattedSize = computed(() =>
		formatBackstageSize(this.usage()?.totalBytes ?? 0),
	);

	constructor() {
		void this.refreshUsage();
	}

	private async refreshUsage(): Promise<void> {
		this.usage.set(await getLocalStorageUsageSummary());
	}

	protected updateName(name: string): void {
		this.profile.update((profile) => ({ ...profile, displayName: name }));
		saveViewerProfile(this.profile());
	}

	protected selectColor(color: string): void {
		this.profile.update((profile) => ({ ...profile, avatarColor: color }));
		saveViewerProfile(this.profile());
	}

	protected async clearData(): Promise<void> {
		const confirmed = window.confirm(this.translate.instant('pptx.account.storage.clearConfirm'));
		if (!confirmed) {
			return;
		}
		await clearAllLocalViewerData();
		this.profile.set(DEFAULT_VIEWER_PROFILE);
		this.cleared.set(true);
		await this.refreshUsage();
	}
}
