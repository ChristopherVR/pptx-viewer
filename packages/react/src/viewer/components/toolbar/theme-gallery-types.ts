import type { PptxThemeColorScheme } from "pptx-viewer-core";

export interface ThemeDefinition {
  id: string;
  name: string;
  colorScheme: PptxThemeColorScheme;
  fontScheme: {
    majorFont: string;
    minorFont: string;
  };
}

export interface ThemeGalleryProps {
  open: boolean;
  currentTheme?: ThemeDefinition | null;
  canEdit: boolean;
  onClose: () => void;
  onApplyTheme: (theme: ThemeDefinition) => void;
  onImportTheme?: (file: File) => void;
}
