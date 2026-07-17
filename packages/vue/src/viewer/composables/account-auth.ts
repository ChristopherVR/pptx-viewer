import type { AccountAuthConfig } from 'pptx-viewer-shared';
/**
 * Optional sign-in hook point for File > Account (Vue).
 *
 * `PowerPointViewer.vue` provides this from its `accountAuth` prop; the
 * `AccountPage.vue` sign-in section injects it to decide whether to render
 * itself at all. Mirrors the `SmartArt3DKey` opt-in-flag pattern in
 * `smart-art-3d.ts`, so `accountAuth` doesn't need threading through the
 * large `RibbonProps` contract just to reach a single deeply-nested panel.
 */
import { inject } from 'vue';
import type { InjectionKey } from 'vue';

/** Injection key carrying the host's optional account/sign-in configuration. */
export const AccountAuthKey: InjectionKey<AccountAuthConfig | undefined> =
	Symbol('pptx-account-auth');

/** Read the host's account/sign-in config; `undefined` when not provided (the default). */
export function useAccountAuth(): AccountAuthConfig | undefined {
	return inject(AccountAuthKey, undefined);
}
