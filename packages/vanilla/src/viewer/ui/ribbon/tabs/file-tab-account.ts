import {
	AVATAR_COLOR_SWATCHES,
	clearAllLocalViewerData,
	DEFAULT_VIEWER_PROFILE,
	formatBackstageSize,
	getLocalStorageUsageSummary,
	readStoredViewerPrefs,
	resolveProfileInitial,
	saveViewerProfile,
} from 'pptx-viewer-shared';
import type { AccountAuthConfig, ViewerProfile } from 'pptx-viewer-shared';

import { version as vanillaViewerVersion } from '../../../../../package.json';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';

/**
 * File > Account page content: a local-only profile editor, a storage/privacy
 * panel backed by the shared IndexedDB autosave store, app info, and an
 * opt-in sign-in hook point. Replaces the old static "PowerPoint Viewer"
 * card (still used by File > Options, see `renderCard` in `file-tab.ts`).
 */
export function renderAccountPage(
	doc: Document,
	t: Translator,
	main: HTMLElement,
	accountAuth: AccountAuthConfig | undefined,
): void {
	const root = createEl(doc, 'div', 'pptxv-account');
	main.appendChild(root);

	let profile: ViewerProfile = { ...DEFAULT_VIEWER_PROFILE, ...readStoredViewerPrefs().profile };
	root.appendChild(
		renderProfileSection(doc, t, profile, (next) => {
			profile = next;
			saveViewerProfile(profile);
		}),
	);

	const storageSection = createEl(doc, 'section', 'pptxv-account-section');
	root.appendChild(storageSection);
	renderStorageSection(doc, t, storageSection);

	root.appendChild(renderAboutSection(doc, t));

	if (accountAuth?.enabled) {
		root.appendChild(renderSignInSection(doc, t, accountAuth));
	}
}

function renderProfileSection(
	doc: Document,
	t: Translator,
	initialProfile: ViewerProfile,
	onChange: (profile: ViewerProfile) => void,
): HTMLElement {
	let profile = initialProfile;
	const section = createEl(doc, 'section', 'pptxv-account-section');
	const heading = doc.createElement('h2');
	heading.textContent = t('pptx.account.profile.title');
	section.appendChild(heading);

	const row = createEl(doc, 'div', 'pptxv-account-profile-row');
	const avatar = createEl(doc, 'span', 'pptxv-account-avatar');
	const syncAvatar = (): void => {
		avatar.textContent = resolveProfileInitial(profile);
		avatar.style.background = profile.avatarColor;
	};
	syncAvatar();

	const nameLabel = doc.createElement('label');
	nameLabel.className = 'pptxv-account-name-field';
	const nameText = doc.createElement('span');
	nameText.textContent = t('pptx.account.profile.nameLabel');
	const nameInput = doc.createElement('input');
	nameInput.type = 'text';
	nameInput.placeholder = t('pptx.account.profile.namePlaceholder');
	nameInput.value = profile.displayName;
	nameInput.addEventListener('input', () => {
		profile = { ...profile, displayName: nameInput.value };
		syncAvatar();
		onChange(profile);
	});
	nameLabel.append(nameText, nameInput);

	row.append(avatar, nameLabel);
	section.appendChild(row);

	const swatchLabel = doc.createElement('p');
	swatchLabel.className = 'pptxv-account-swatch-label';
	swatchLabel.textContent = t('pptx.account.profile.avatarColorLabel');
	section.appendChild(swatchLabel);

	const swatches = createEl(doc, 'div', 'pptxv-parity-swatch-row');
	const selectColor = (swatch: HTMLButtonElement, color: string): void => {
		profile = { ...profile, avatarColor: color };
		syncAvatar();
		for (const sibling of swatches.querySelectorAll('button')) {
			sibling.classList.toggle('is-active', sibling === swatch);
		}
		onChange(profile);
	};
	for (const color of AVATAR_COLOR_SWATCHES) {
		const swatch = doc.createElement('button');
		swatch.type = 'button';
		swatch.className = 'pptxv-account-color-swatch';
		swatch.classList.toggle('is-active', color === profile.avatarColor);
		swatch.style.background = color;
		swatch.setAttribute('aria-label', color);
		swatch.addEventListener('click', () => selectColor(swatch, color));
		swatches.appendChild(swatch);
	}
	section.appendChild(swatches);

	return section;
}

function renderStorageSection(doc: Document, t: Translator, section: HTMLElement): void {
	const heading = doc.createElement('h2');
	heading.textContent = t('pptx.account.storage.title');
	section.appendChild(heading);

	const usageText = doc.createElement('p');
	section.appendChild(usageText);

	const privacyText = doc.createElement('p');
	privacyText.className = 'pptxv-account-privacy';
	privacyText.textContent = t('pptx.account.storage.privacyBlurb');
	section.appendChild(privacyText);

	const clearButton = doc.createElement('button');
	clearButton.type = 'button';
	clearButton.className = 'pptxv-bs-primary';
	clearButton.textContent = t('pptx.account.storage.clear');
	section.appendChild(clearButton);

	const notice = doc.createElement('p');
	notice.className = 'pptxv-account-notice';
	notice.hidden = true;
	section.appendChild(notice);

	async function refresh(): Promise<void> {
		const summary = await getLocalStorageUsageSummary();
		usageText.textContent =
			summary.presentationCount > 0
				? t('pptx.account.storage.usage', {
						count: summary.presentationCount,
						size: formatBackstageSize(summary.totalBytes),
					})
				: t('pptx.account.storage.usageEmpty');
	}
	void refresh();

	clearButton.addEventListener('click', () => {
		if (!window.confirm(t('pptx.account.storage.clearConfirm'))) {
			return;
		}
		void (async () => {
			await clearAllLocalViewerData();
			notice.hidden = false;
			notice.textContent = t('pptx.account.storage.clearedNotice');
			await refresh();
		})();
	});
}

function renderAboutSection(doc: Document, t: Translator): HTMLElement {
	const section = createEl(doc, 'section', 'pptxv-account-section');
	const heading = doc.createElement('h2');
	heading.textContent = t('pptx.account.about.title');
	section.appendChild(heading);
	const name = doc.createElement('p');
	name.textContent = 'pptx-vanilla-viewer';
	section.appendChild(name);
	const version = doc.createElement('p');
	version.className = 'pptxv-account-privacy';
	version.textContent = t('pptx.account.about.version', { version: vanillaViewerVersion });
	section.appendChild(version);
	return section;
}

function renderSignInSection(
	doc: Document,
	t: Translator,
	accountAuth: AccountAuthConfig,
): HTMLElement {
	const section = createEl(doc, 'section', 'pptxv-account-section');
	const heading = doc.createElement('h2');
	heading.textContent = t('pptx.account.signIn.title');
	section.appendChild(heading);
	const description = doc.createElement('p');
	description.textContent = t('pptx.account.signIn.description');
	section.appendChild(description);
	if (accountAuth.signedInUser) {
		const signedIn = doc.createElement('p');
		signedIn.textContent = t('pptx.account.signIn.signedInAs', {
			name: accountAuth.signedInUser.name,
		});
		section.appendChild(signedIn);
		return section;
	}
	const button = doc.createElement('button');
	button.type = 'button';
	button.className = 'pptxv-bs-primary';
	button.textContent = t('pptx.account.signIn.button');
	button.addEventListener('click', () => accountAuth.onSignIn());
	section.appendChild(button);
	return section;
}
