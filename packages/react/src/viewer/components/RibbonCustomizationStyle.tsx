/**
 * Group- and control-level ribbon hiding for one viewer instance.
 *
 * The viewer root carries `data-pptx-ribbon-scope="<token>"` and this
 * component renders the ONE `<style>` element whose rules (built by the
 * shared `ribbonCustomizationCss`) hide every `data-ribbon-group` /
 * `data-ribbon-control` the host named, confined to that root so a second
 * viewer on the page is untouched.
 */
import type { ResolvedCustomization } from 'pptx-viewer-shared';
import { ribbonCustomizationCss } from 'pptx-viewer-shared';
import React, { useId, useMemo } from 'react';

/**
 * A per-instance scope token. `useId` output carries punctuation (`:r1:`,
 * `«r1»`) that the shared scope validator rejects, so only the word
 * characters are kept; they are still unique per instance.
 */
export function useRibbonScopeToken(): string {
	const id = useId();
	return `pptx-ribbon-${id.replace(/[^\w-]/gu, '')}`;
}

export interface RibbonCustomizationStyleProps {
	resolved: ResolvedCustomization;
	scope: string;
}

export function RibbonCustomizationStyle({
	resolved,
	scope,
}: RibbonCustomizationStyleProps): React.ReactElement {
	const css = useMemo(() => ribbonCustomizationCss(resolved, scope), [resolved, scope]);
	return <style data-pptx-ribbon-customization=''>{css}</style>;
}
