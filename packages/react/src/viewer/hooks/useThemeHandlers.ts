/**
 * useThemeHandlers — Theme application, colour-scheme / font-scheme / name
 * updates, presentation-wide theme apply, and template background handling.
 */
import type { RefObject } from "react";
import type {
  PptxThemeColorScheme,
  PptxThemeFontScheme,
} from "pptx-viewer-core";
import type { PptxHandler } from "pptx-viewer-core";
import type { EditorHistoryResult } from "./useEditorHistory";

export interface UseThemeHandlersInput {
  handlerRef: RefObject<PptxHandler | null>;
  serializeSlides: () => Promise<Uint8Array | null>;
  setContent: React.Dispatch<
    React.SetStateAction<ArrayBuffer | Uint8Array | null>
  >;
  onContentChange: ((data: Uint8Array) => void) | undefined;
  setTheme: React.Dispatch<
    React.SetStateAction<Record<string, unknown> | null>
  >;
  setSlideMasters: React.Dispatch<
    React.SetStateAction<Array<Record<string, unknown>>>
  >;
  slideMasters: Array<Record<string, unknown>>;
  history: EditorHistoryResult;
}

export interface ThemeHandlersResult {
  handleApplyTheme: (
    themePath: string,
    applyToAllMasters: boolean,
  ) => Promise<void>;
  handleUpdateThemeColorScheme: (
    colorScheme: PptxThemeColorScheme,
  ) => Promise<void>;
  handleUpdateThemeFontScheme: (
    fontScheme: PptxThemeFontScheme,
  ) => Promise<void>;
  handleUpdateThemeName: (name: string) => Promise<void>;
  handleApplyThemeToPresentation: () => Promise<void>;
  handleApplyThemeData: (
    colorScheme: PptxThemeColorScheme,
    fontScheme: PptxThemeFontScheme,
    themeName?: string,
  ) => Promise<void>;
  handleSetTemplateBackground: (
    path: string,
    backgroundColor: string | undefined,
  ) => void;
  handleGetTemplateBackgroundColor: (path: string) => string | undefined;
}

export function useThemeHandlers(
  input: UseThemeHandlersInput,
): ThemeHandlersResult {
  const {
    handlerRef,
    serializeSlides,
    setContent,
    onContentChange,
    setTheme,
    setSlideMasters,
    slideMasters,
    history,
  } = input;

  const refreshContentAfterThemeChange = async () => {
    const updated = await serializeSlides();
    if (!updated) return;
    setContent(updated);
    if (onContentChange) onContentChange(updated);
    history.markDirty();
  };

  const handleApplyTheme = async (
    themePath: string,
    applyToAllMasters: boolean,
  ) => {
    const handler = handlerRef.current;
    if (!handler) return;
    await handler.setPresentationTheme(themePath, applyToAllMasters);
    setSlideMasters((prev) =>
      prev.map((master, index) =>
        applyToAllMasters || index === 0 ? { ...master, themePath } : master,
      ),
    );
    await refreshContentAfterThemeChange();
  };

  const handleUpdateThemeColorScheme = async (
    colorScheme: PptxThemeColorScheme,
  ) => {
    const handler = handlerRef.current;
    if (!handler) return;
    await handler.updateThemeColorScheme(colorScheme);
    setTheme((prev) => (prev ? { ...prev, colorScheme } : { colorScheme }));
    await refreshContentAfterThemeChange();
  };

  const handleUpdateThemeFontScheme = async (
    fontScheme: PptxThemeFontScheme,
  ) => {
    const handler = handlerRef.current;
    if (!handler) return;
    await handler.updateThemeFontScheme(fontScheme);
    setTheme((prev) => (prev ? { ...prev, fontScheme } : { fontScheme }));
    await refreshContentAfterThemeChange();
  };

  const handleUpdateThemeName = async (name: string) => {
    const handler = handlerRef.current;
    if (!handler) return;
    await handler.updateThemeName(name);
    setTheme((prev) => (prev ? { ...prev, name } : { name }));
    history.markDirty();
  };

  const handleApplyThemeToPresentation = async () => {
    const handler = handlerRef.current;
    if (!handler) return;
    const primaryThemePath = (
      slideMasters[0] as { themePath?: string } | undefined
    )?.themePath;
    if (primaryThemePath) {
      await handler.setPresentationTheme(primaryThemePath, true);
    }
    await refreshContentAfterThemeChange();
  };

  const handleApplyThemeData = async (
    colorScheme: PptxThemeColorScheme,
    fontScheme: PptxThemeFontScheme,
    themeName?: string,
  ) => {
    const handler = handlerRef.current;
    if (!handler) return;
    await handler.applyTheme(colorScheme, fontScheme, themeName);
    setTheme((prev) => ({
      ...prev,
      colorScheme,
      fontScheme,
      ...(themeName && { name: themeName }),
    }));
    await refreshContentAfterThemeChange();
  };

  const handleSetTemplateBackground = (
    path: string,
    backgroundColor: string | undefined,
  ) => {
    const handler = handlerRef.current;
    if (!handler) return;
    handler.setTemplateBackground(path, backgroundColor);
    setSlideMasters((prev) =>
      prev.map((m) =>
        (m as { path?: string }).path === path ? { ...m, backgroundColor } : m,
      ),
    );
    history.markDirty();
  };

  const handleGetTemplateBackgroundColor = (
    path: string,
  ): string | undefined => {
    const handler = handlerRef.current;
    if (!handler) return undefined;
    return handler.getTemplateBackgroundColor(path);
  };

  return {
    handleApplyTheme,
    handleUpdateThemeColorScheme,
    handleUpdateThemeFontScheme,
    handleUpdateThemeName,
    handleApplyThemeToPresentation,
    handleApplyThemeData,
    handleSetTemplateBackground,
    handleGetTemplateBackgroundColor,
  };
}
