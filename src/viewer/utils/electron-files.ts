/**
 * Electron Files API helper and misc utility functions.
 */

export interface ElectronFilesApi {
  saveFileDialog: (opts: {
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    title?: string;
  }) => Promise<string | null>;
  writeBinaryFile: (path: string, buffer: Uint8Array) => Promise<boolean>;
  writeFile: (path: string, content: string) => Promise<boolean>;
  copyFile: (source: string, dest: string) => Promise<boolean>;
  createFolder: (path: string) => Promise<boolean>;
  openFolderDialog: () => Promise<string | null>;
}

export function getElectronFilesApi(): ElectronFilesApi | null {
  const w =
    typeof window !== "undefined"
      ? (window as unknown as Record<string, unknown>)
      : undefined;
  const electronRef = w?.["electron"] as
    | { files?: ElectronFilesApi }
    | undefined;
  if (!electronRef?.files) return null;
  return electronRef.files;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safePrompt(
  message: string,
  defaultValue?: string,
): string | null {
  try {
    return window.prompt(message, defaultValue);
  } catch {
    return null;
  }
}

export function safeConfirm(message: string): boolean {
  try {
    return window.confirm(message);
  } catch {
    return false;
  }
}
