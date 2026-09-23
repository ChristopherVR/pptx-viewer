<script lang="ts">
	/**
	 * PresentationSettingsSection: deck-wide slide-show / print settings shown in
	 * the inspector's PRESENTATION card; the Svelte port of Vue's
	 * `PresentationSettingsCard` (React `inspector/PresentationSettingsCards.tsx`).
	 * The parent owns `properties` and commits each patch.
	 */
	import type { PptxPresentationProperties } from 'pptx-viewer-core';
	import {
		printPropertiesFrameSlides,
		printPropertiesSlidesPerPage,
		withFrameSlides,
		withSlidesPerPage,
	} from 'pptx-viewer-shared';

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
	<!-- svelte-ignore a11y_label_has_associated_control -- form-associated custom element -->
	<label>
		<span>{t('pptx.presentationSettings.showType')}</span>
		<pptx-ui-select
			aria-label={t('pptx.presentationSettings.showType')}
			disabled={!canEdit}
			value={properties.showType ?? 'presented'}
			onchange={(event: Event) =>
				onupdate({
					showType: (event.currentTarget as HTMLElement & { value: string }).value as 'presented' | 'browsed' | 'kiosk',
				})}
		>
			<option value="presented">{t('pptx.presentationSettings.showTypePresented')}</option>
			<option value="browsed">{t('pptx.presentationSettings.showTypeBrowsed')}</option>
			<option value="kiosk">{t('pptx.presentationSettings.showTypeKiosk')}</option>
		</pptx-ui-select>
	</label>
	<!-- svelte-ignore a11y_label_has_associated_control -- form-associated custom element -->
	<label>
		<span>{t('pptx.presentationSettings.loopContinuously')}</span>
		<pptx-ui-checkbox
			aria-label={t('pptx.presentationSettings.loopContinuously')}
			disabled={!canEdit}
			checked={Boolean(properties.loopContinuously)}
			onchange={(event: Event) => onupdate({ loopContinuously: (event.currentTarget as HTMLElement & { checked: boolean }).checked })}
		></pptx-ui-checkbox>
	</label>
	<!-- svelte-ignore a11y_label_has_associated_control -- form-associated custom element -->
	<label>
		<span>{t('pptx.presentationSettings.showNarration')}</span>
		<pptx-ui-checkbox
			aria-label={t('pptx.presentationSettings.showNarration')}
			disabled={!canEdit}
			checked={properties.showWithNarration !== false}
			onchange={(event: Event) => onupdate({ showWithNarration: (event.currentTarget as HTMLElement & { checked: boolean }).checked })}
		></pptx-ui-checkbox>
	</label>
	<!-- svelte-ignore a11y_label_has_associated_control -- form-associated custom element -->
	<label>
		<span>{t('pptx.presentationSettings.showAnimation')}</span>
		<pptx-ui-checkbox
			aria-label={t('pptx.presentationSettings.showAnimation')}
			disabled={!canEdit}
			checked={properties.showWithAnimation !== false}
			onchange={(event: Event) => onupdate({ showWithAnimation: (event.currentTarget as HTMLElement & { checked: boolean }).checked })}
		></pptx-ui-checkbox>
	</label>
	<!-- svelte-ignore a11y_label_has_associated_control -- form-associated custom element -->
	<label>
		<span>{t('pptx.presentationSettings.frameSlides')}</span>
		<pptx-ui-checkbox
			aria-label={t('pptx.presentationSettings.frameSlides')}
			disabled={!canEdit}
			checked={printPropertiesFrameSlides(properties.printProperties)}
			onchange={(event: Event) =>
				onupdate({ printProperties: withFrameSlides(properties.printProperties, (event.currentTarget as HTMLElement & { checked: boolean }).checked) })}
		></pptx-ui-checkbox>
	</label>
	<label>
		<span>{t('pptx.presentationSettings.slidesPerPage')}</span>
		<input
			type="number"
			min="1"
			max="16"
			disabled={!canEdit}
			value={printPropertiesSlidesPerPage(properties.printProperties)}
			oninput={(event) =>
				onupdate({ printProperties: withSlidesPerPage(properties.printProperties, Number(event.currentTarget.value)) })}
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

	pptx-ui-select {
		width: 96px;
	}
	@media (max-width: 767px) {
		pptx-ui-select { min-height: 44px; }
	}

	input[type='number'] {
		min-width: 0;
		width: 96px;
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
	}

</style>
