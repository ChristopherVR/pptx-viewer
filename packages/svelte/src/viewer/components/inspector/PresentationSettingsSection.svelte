<script lang="ts">
	/**
	 * PresentationSettingsSection: deck-wide slide-show / print settings shown in
	 * the inspector's PRESENTATION card; the Svelte port of Vue's
	 * `PresentationSettingsCard` (React `inspector/PresentationSettingsCards.tsx`).
	 * The parent owns `properties` and commits each patch.
	 */
	import type { PptxPresentationProperties } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';

	const {
		properties,
		canEdit = true,
		onupdate,
	}: {
		properties: PptxPresentationProperties;
		canEdit?: boolean;
		onupdate: (patch: Partial<PptxPresentationProperties>) => void;
	} = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-presentation-settings">
	<label>
		<span>{t('pptx.presentationSettings.showType')}</span>
		<select
			disabled={!canEdit}
			value={properties.showType ?? 'presented'}
			onchange={(event) =>
				onupdate({
					showType: event.currentTarget.value as 'presented' | 'browsed' | 'kiosk',
				})}
		>
			<option value="presented">{t('pptx.presentationSettings.showTypePresented')}</option>
			<option value="browsed">{t('pptx.presentationSettings.showTypeBrowsed')}</option>
			<option value="kiosk">{t('pptx.presentationSettings.showTypeKiosk')}</option>
		</select>
	</label>
	<label>
		<span>{t('pptx.presentationSettings.loopContinuously')}</span>
		<input
			type="checkbox"
			disabled={!canEdit}
			checked={Boolean(properties.loopContinuously)}
			onchange={(event) => onupdate({ loopContinuously: event.currentTarget.checked })}
		/>
	</label>
	<label>
		<span>{t('pptx.presentationSettings.showNarration')}</span>
		<input
			type="checkbox"
			disabled={!canEdit}
			checked={properties.showWithNarration !== false}
			onchange={(event) => onupdate({ showWithNarration: event.currentTarget.checked })}
		/>
	</label>
	<label>
		<span>{t('pptx.presentationSettings.showAnimation')}</span>
		<input
			type="checkbox"
			disabled={!canEdit}
			checked={properties.showWithAnimation !== false}
			onchange={(event) => onupdate({ showWithAnimation: event.currentTarget.checked })}
		/>
	</label>
	<label>
		<span>{t('pptx.presentationSettings.frameSlides')}</span>
		<input
			type="checkbox"
			disabled={!canEdit}
			checked={Boolean(properties.printFrameSlides)}
			onchange={(event) => onupdate({ printFrameSlides: event.currentTarget.checked })}
		/>
	</label>
	<label>
		<span>{t('pptx.presentationSettings.slidesPerPage')}</span>
		<input
			type="number"
			min="1"
			max="16"
			disabled={!canEdit}
			value={properties.printSlidesPerPage ?? 1}
			oninput={(event) => onupdate({ printSlidesPerPage: Number(event.currentTarget.value) })}
		/>
	</label>
</div>

<style>
	.pptx-svelte-presentation-settings {
		display: grid;
		gap: 6px;
	}

	label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	select,
	input[type='number'] {
		min-width: 0;
		width: 96px;
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
	}

	input[type='checkbox'] {
		accent-color: var(--pptx-primary, #6366f1);
	}
</style>
