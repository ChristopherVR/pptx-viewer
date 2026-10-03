// Compatibility exports: all document operations are owned by OOXML core.
import { apiToolsThemeTools as operations } from 'ooxml-core/pptx/automation';
export type ThemeInfo = operations.ThemeInfo;
export const getThemeInfo = operations.getThemeInfo;
export type ApplyThemePresetParams = operations.ApplyThemePresetParams;
export type ApplyThemePresetResult = operations.ApplyThemePresetResult;
export const applyThemePreset = operations.applyThemePreset;
export type UpdateThemeColorsParams = operations.UpdateThemeColorsParams;
export const updateThemeColors = operations.updateThemeColors;
export type UpdateThemeFontsParams = operations.UpdateThemeFontsParams;
export const updateThemeFonts = operations.updateThemeFonts;
