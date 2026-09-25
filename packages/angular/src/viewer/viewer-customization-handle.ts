/**
 * viewer-customization-handle.ts: the `ViewerCustomizationApi` half of
 * `PowerPointViewerComponent`'s public imperative surface.
 *
 * A plain (undecorated, Angular-feature-free) base class, so the root component
 * picks up every helper as a real public method without growing its own file.
 * Each method delegates to the per-viewer {@link ViewerCustomizationService}'s
 * shared controller, so the semantics are exactly the other four bindings'.
 */
import type {
	BackstageCardId,
	BackstagePage,
	CanvasContextMenuCommandId,
	ContextMenuCommandId,
	EditorKeyActionName,
	OptionsPageId,
	OptionsSectionId,
	OptionsSettingId,
	ShortcutChord,
	ToolbarButtonId,
	ToolbarTabId,
	ViewerCustomization,
	ViewerCustomizationApi,
	ViewerDialogId,
	ViewerFeatureId,
	ViewerOptionPrimitive,
	ViewerPanelId,
} from '../internal/shared';
import type { ViewerCustomizationService } from './viewer-customization.service';

export abstract class ViewerCustomizationHandle implements ViewerCustomizationApi {
	/** The per-viewer customisation owner (injected by the concrete component). */
	protected abstract readonly customizationService: ViewerCustomizationService;

	private get customizationApi(): ViewerCustomizationApi {
		return this.customizationService.api;
	}

	getCustomization(): ViewerCustomization {
		return this.customizationApi.getCustomization();
	}
	setCustomization(next: ViewerCustomization): void {
		this.customizationApi.setCustomization(next);
	}
	updateCustomization(patch: ViewerCustomization): void {
		this.customizationApi.updateCustomization(patch);
	}
	resetCustomization(): void {
		this.customizationApi.resetCustomization();
	}
	hideRibbonTab(tab: ToolbarTabId): void {
		this.customizationApi.hideRibbonTab(tab);
	}
	showRibbonTab(tab: ToolbarTabId): void {
		this.customizationApi.showRibbonTab(tab);
	}
	hideToolbarButton(button: ToolbarButtonId): void {
		this.customizationApi.hideToolbarButton(button);
	}
	showToolbarButton(button: ToolbarButtonId): void {
		this.customizationApi.showToolbarButton(button);
	}
	hideOptionsPage(page: OptionsPageId): void {
		this.customizationApi.hideOptionsPage(page);
	}
	showOptionsPage(page: OptionsPageId): void {
		this.customizationApi.showOptionsPage(page);
	}
	hideOptionsSection(section: OptionsSectionId): void {
		this.customizationApi.hideOptionsSection(section);
	}
	showOptionsSection(section: OptionsSectionId): void {
		this.customizationApi.showOptionsSection(section);
	}
	hideSetting(setting: OptionsSettingId): void {
		this.customizationApi.hideSetting(setting);
	}
	showSetting(setting: OptionsSettingId): void {
		this.customizationApi.showSetting(setting);
	}
	lockSetting(setting: OptionsSettingId, value: ViewerOptionPrimitive, hidden?: boolean): void {
		this.customizationApi.lockSetting(setting, value, hidden);
	}
	unlockSetting(setting: OptionsSettingId): void {
		this.customizationApi.unlockSetting(setting);
	}
	setSettingDefault(setting: OptionsSettingId, value: ViewerOptionPrimitive | undefined): void {
		this.customizationApi.setSettingDefault(setting, value);
	}
	hideBackstagePage(page: BackstagePage): void {
		this.customizationApi.hideBackstagePage(page);
	}
	showBackstagePage(page: BackstagePage): void {
		this.customizationApi.showBackstagePage(page);
	}
	hideBackstageCard(card: BackstageCardId): void {
		this.customizationApi.hideBackstageCard(card);
	}
	showBackstageCard(card: BackstageCardId): void {
		this.customizationApi.showBackstageCard(card);
	}
	hideContextMenuCommand(command: ContextMenuCommandId): void {
		this.customizationApi.hideContextMenuCommand(command);
	}
	showContextMenuCommand(command: ContextMenuCommandId): void {
		this.customizationApi.showContextMenuCommand(command);
	}
	hideCanvasContextMenuCommand(command: CanvasContextMenuCommandId): void {
		this.customizationApi.hideCanvasContextMenuCommand(command);
	}
	showCanvasContextMenuCommand(command: CanvasContextMenuCommandId): void {
		this.customizationApi.showCanvasContextMenuCommand(command);
	}
	disableShortcut(action: EditorKeyActionName): void {
		this.customizationApi.disableShortcut(action);
	}
	enableShortcut(action: EditorKeyActionName): void {
		this.customizationApi.enableShortcut(action);
	}
	remapShortcut(
		action: EditorKeyActionName,
		chords: ShortcutChord | readonly ShortcutChord[] | undefined,
	): void {
		this.customizationApi.remapShortcut(action, chords);
	}
	setPanelVisible(panel: ViewerPanelId, visible: boolean): void {
		this.customizationApi.setPanelVisible(panel, visible);
	}
	setFeatureEnabled(feature: ViewerFeatureId, enabled: boolean): void {
		this.customizationApi.setFeatureEnabled(feature, enabled);
	}
	setDialogAvailable(dialog: ViewerDialogId, available: boolean): void {
		this.customizationApi.setDialogAvailable(dialog, available);
	}
}
