import { PptxXmlBuilder } from "./builders/fluent";
import {
  createDefaultPptxHandlerRuntime,
  type IPptxHandlerRuntime,
  type IPptxHandlerRuntimeFactory,
  type PptxHandlerLoadOptions,
  type PptxHandlerSaveOptions,
} from "./core";
import {
  detectFileFormat,
  EncryptedFileError,
} from "./utils/encryption-detection";
import { decryptPptx, encryptPptx } from "./utils/ooxml-crypto";
import type { EncryptionOptions } from "./utils/ooxml-crypto";
import type {
  PptxChartData,
  PptxCompatibilityWarning,
  PptxExportOptions,
  PptxLayoutOption,
  PptxData,
  PptxSlide,
  PptxSmartArtData,
  PptxThemeColorScheme,
  PptxThemeFontScheme,
  XmlObject,
} from "./types";

/**
 * Dependency injection options for {@link PptxHandlerCore}.
 *
 * Provide either `runtime` (an already-constructed runtime) or
 * `runtimeFactory` (a factory that will be called once). When neither
 * is supplied the default runtime is created automatically.
 *
 * @example
 * ```ts
 * // Use the default runtime:
 * const core = new PptxHandlerCore();
 *
 * // Inject a custom runtime:
 * const core = new PptxHandlerCore({ runtime: myRuntime });
 *
 * // Supply a factory for lazy creation:
 * const core = new PptxHandlerCore({ runtimeFactory: myFactory });
 * // => PptxHandlerCore instance with injected runtime
 * ```
 */
export interface PptxHandlerCoreDependencies {
  runtime?: IPptxHandlerRuntime;
  runtimeFactory?: IPptxHandlerRuntimeFactory;
}

/**
 * Thin facade over the PPTX runtime implementation.
 *
 * All heavy parsing, serialisation, and XML manipulation is delegated to an
 * {@link IPptxHandlerRuntime}. This surface stays stable and small so that
 * callers remain decoupled from the runtime internals and host-specific
 * runtime swaps (e.g. WASM vs Node) can be done transparently.
 *
 * @remarks
 * - Constructed once per open document.
 * - Errors from encrypted files are caught at `load()` time via
 *   {@link EncryptedFileError}.
 * - `PptxXmlBuilder` instances returned by `createXmlBuilder()` / `Builder()`
 *   operate directly on the runtime’s in-memory ZIP.
 *
 * @example
 * ```ts
 * const handler = new PptxHandlerCore();
 * const data    = await handler.load(arrayBuffer);
 * // ... mutate slides ...
 * const out     = await handler.save(data.slides);
 * // => Uint8Array of the modified .pptx file
 * ```
 */
export class PptxHandlerCore {
  private readonly runtime: IPptxHandlerRuntime;

  /**
   * Create a new handler, optionally injecting a custom runtime.
   *
   * Resolution order:
   * 1. `dependencies.runtime` — use as-is.
   * 2. `dependencies.runtimeFactory` — call `createRuntime()` once.
   * 3. Fall back to {@link createDefaultPptxHandlerRuntime}.
   *
   * @param dependencies - Optional runtime or factory override.
   *
   * @example
   * ```ts
   * const core = new PptxHandlerCore();
   * // => PptxHandlerCore instance with default runtime
   * ```
   */
  public constructor(dependencies: PptxHandlerCoreDependencies = {}) {
    if (dependencies.runtime) {
      this.runtime = dependencies.runtime;
      return;
    }

    if (dependencies.runtimeFactory) {
      this.runtime = dependencies.runtimeFactory.createRuntime();
      return;
    }

    this.runtime = createDefaultPptxHandlerRuntime();
  }

  /**
   * Return any compatibility warnings detected during the most recent load.
   *
   * Warnings indicate features the editor cannot fully represent (e.g.
   * SmartArt, 3-D effects, embedded OLE objects).
   *
   * @returns Array of {@link PptxCompatibilityWarning} objects.
   */
  public getCompatibilityWarnings(): PptxCompatibilityWarning[] {
    return this.runtime.getCompatibilityWarnings();
  }

  /**
   * Get the slide layout options available in the loaded presentation.
   *
   * Each option maps to a `<p:sldLayout>` inside the PPTX archive.
   *
   * @returns Array of {@link PptxLayoutOption} entries.
   */
  public getLayoutOptions(): PptxLayoutOption[] {
    return this.runtime.getLayoutOptions();
  }

  /**
   * Create a fluent XML builder scoped to the given presentation data.
   *
   * The builder provides a chainable API for constructing and inserting
   * OpenXML nodes directly into the runtime’s in-memory ZIP.
   *
   * @param data - The parsed {@link PptxData} to bind the builder to.
   * @returns A new {@link PptxXmlBuilder} instance.
   */
  public createXmlBuilder(data: PptxData): PptxXmlBuilder {
    return this.runtime.createXmlBuilder(data);
  }

  /**
   * Shorthand alias for {@link createXmlBuilder}.
   *
   * @param data - Parsed presentation data.
   * @returns A {@link PptxXmlBuilder} instance.
   */
  public Builder(data: PptxData): PptxXmlBuilder {
    return this.runtime.Builder(data);
  }

  /**
   * Register a background image for a specific template layout path.
   *
   * @param path - The internal PPTX path (e.g. `ppt/slideLayouts/slideLayout1.xml`).
   * @param backgroundColor - Optional hex colour to render behind the image.
   */
  public setTemplateBackground(
    path: string,
    backgroundColor: string | undefined,
  ): void {
    this.runtime.setTemplateBackground(path, backgroundColor);
  }

  /**
   * Retrieve the background colour previously set for a template layout.
   *
   * @param path - The internal PPTX layout path.
   * @returns Hex colour string, or `undefined` if none was set.
   */
  public getTemplateBackgroundColor(path: string): string | undefined {
    return this.runtime.getTemplateBackgroundColor(path);
  }

  /**
   * Replace the presentation’s theme by loading an external `.thmx` file.
   *
   * @param themePath - Absolute or relative path to the `.thmx` file.
   * @param applyToAllMasters - Apply to every slide master (default `true`).
   *
   * @example
   * ```ts
   * await handler.setPresentationTheme("./themes/corporate.thmx");
   * // => void — theme XML replaced in the in-memory ZIP
   * ```
   */
  public async setPresentationTheme(
    themePath: string,
    applyToAllMasters = true,
  ): Promise<void> {
    await this.runtime.setPresentationTheme(themePath, applyToAllMasters);
  }

  /**
   * Modify the theme’s colour scheme (accent colours, background, text, etc.).
   *
   * @param colorScheme - A {@link PptxThemeColorScheme} with hex colour values.
   *
   * @example
   * ```ts
   * await handler.updateThemeColorScheme({
   *   dk1: "#1A1A2E", dk2: "#16213E",
   *   lt1: "#FFFFFF", lt2: "#E8E8E8",
   *   accent1: "#0F3460", accent2: "#533483",
   *   accent3: "#E94560", accent4: "#F0A500",
   * });
   * // => void — colour scheme updated in the in-memory theme XML
   * ```
   */
  public async updateThemeColorScheme(
    colorScheme: PptxThemeColorScheme,
  ): Promise<void> {
    await this.runtime.updateThemeColorScheme(colorScheme);
  }

  /**
   * Update the theme’s font scheme (heading + body typefaces).
   *
   * @param fontScheme - A {@link PptxThemeFontScheme} with font family names.
   *
   * @example
   * ```ts
   * await handler.updateThemeFontScheme({
   *   majorFont: "Montserrat",
   *   minorFont: "Open Sans",
   * });
   * // => void — font scheme updated in the in-memory theme XML
   * ```
   */
  public async updateThemeFontScheme(
    fontScheme: PptxThemeFontScheme,
  ): Promise<void> {
    await this.runtime.updateThemeFontScheme(fontScheme);
  }

  /**
   * Rename the presentation theme.
   *
   * @param name - New display name for the theme.
   */
  public async updateThemeName(name: string): Promise<void> {
    await this.runtime.updateThemeName(name);
  }

  /**
   * Apply a complete theme in one call (colour scheme + font scheme + optional name).
   *
   * This is a convenience wrapper over {@link updateThemeColorScheme},
   * {@link updateThemeFontScheme}, and {@link updateThemeName}.
   *
   * @param colorScheme - Colour definitions.
   * @param fontScheme  - Font definitions.
   * @param themeName   - Optional theme display name.
   *
   * @example
   * ```ts
   * await handler.applyTheme(
   *   { dk1: "#000", lt1: "#FFF", accent1: "#0066CC", /* … *\/ },
   *   { majorFont: "Helvetica", minorFont: "Arial" },
   *   "Corporate 2025",
   * );
   * // => void — colour scheme, font scheme, and name applied atomically
   * ```
   */
  public async applyTheme(
    colorScheme: PptxThemeColorScheme,
    fontScheme: PptxThemeFontScheme,
    themeName?: string,
  ): Promise<void> {
    await this.runtime.applyTheme(colorScheme, fontScheme, themeName);
  }

  /**
   * Parse a PPTX file from an `ArrayBuffer` and return structured data.
   *
   * If the file is encrypted and a `password` is provided in `options`,
   * the file will be decrypted before parsing. If no password is provided
   * for an encrypted file, throws {@link EncryptedFileError}.
   *
   * @param data    - Raw bytes of the `.pptx` file (may be encrypted OLE2).
   * @param options - Optional load-time settings, including `password`.
   * @returns Parsed {@link PptxData} containing slides, theme, layouts, etc.
   *
   * @example
   * ```ts
   * // Load an unencrypted file:
   * const pptx = await handler.load(buf.buffer);
   *
   * // Load a password-protected file:
   * const pptx = await handler.load(buf.buffer, { password: "secret" });
   * console.log(`${pptx.slides.length} slides loaded`);
   * ```
   */
  public async load(
    data: ArrayBuffer,
    options: PptxHandlerLoadOptions = {},
  ): Promise<PptxData> {
    const detection = detectFileFormat(data);

    if (detection.encrypted) {
      if (!options.password) {
        throw new EncryptedFileError(
          "This presentation is encrypted. Provide a password via options.password to open it.",
        );
      }

      // Decrypt the OLE2 container to get the actual PPTX ZIP
      const decryptedData = await decryptPptx(data, options.password);

      // Parse the decrypted data
      const result = await this.runtime.load(decryptedData, options);
      result.isPasswordProtected = true;
      return result;
    }

    return this.runtime.load(data, options);
  }

  /**
   * Extract chart data from a graphic-frame XML node.
   *
   * @param slidePath    - Internal archive path of the slide (e.g. `ppt/slides/slide1.xml`).
   * @param graphicFrame - Parsed XML object for the `<p:graphicFrame>` node.
   * @returns Chart data, or `undefined` if the frame is not a chart.
   */
  public async getChartDataForGraphicFrame(
    slidePath: string,
    graphicFrame: XmlObject | undefined,
  ): Promise<PptxChartData | undefined> {
    return this.runtime.getChartDataForGraphicFrame(slidePath, graphicFrame);
  }

  /**
   * Extract SmartArt data from a graphic-frame XML node.
   *
   * @param slidePath    - Internal archive path of the slide.
   * @param graphicFrame - Parsed XML object for the `<p:graphicFrame>` node.
   * @returns SmartArt data, or `undefined` if the frame is not SmartArt.
   */
  public async getSmartArtDataForGraphicFrame(
    slidePath: string,
    graphicFrame: XmlObject | undefined,
  ): Promise<PptxSmartArtData | undefined> {
    return this.runtime.getSmartArtDataForGraphicFrame(slidePath, graphicFrame);
  }

  /**
   * Get the base64-encoded data URL for an embedded image.
   *
   * @param imagePath - Archive-relative path (e.g. `ppt/media/image1.png`).
   * @returns A `data:image/...;base64,...` string, or `undefined` if not found.
   */
  public async getImageData(imagePath: string): Promise<string | undefined> {
    return this.runtime.getImageData(imagePath);
  }

  /**
   * Extract a media file from the PPTX archive as an ArrayBuffer.
   * Avoids the 33% base64 overhead of getImageData — prefer this for
   * audio/video media that will be played via Blob URLs.
   */
  public async getMediaArrayBuffer(
    mediaPath: string,
  ): Promise<ArrayBuffer | undefined> {
    return this.runtime.getMediaArrayBuffer(mediaPath);
  }

  /**
   * Serialise current slides back into a PPTX byte array.
   *
   * @param slides  - The (possibly mutated) slide array.
   * @param options - Optional save-time settings (e.g. thumbnail generation).
   * @returns `Uint8Array` of the complete `.pptx` file.
   *
   * @example
   * ```ts
   * const bytes = await handler.save(data.slides);
   * await fs.writeFile("output.pptx", Buffer.from(bytes));
   * // => Uint8Array written to disk as a valid .pptx file
   * ```
   */
  public async save(
    slides: PptxSlide[],
    options?: PptxHandlerSaveOptions,
  ): Promise<Uint8Array> {
    return this.runtime.save(slides, options);
  }

  /**
   * Serialise slides and then encrypt the output with a password.
   *
   * This is a convenience method that calls {@link save} followed by
   * {@link encryptPptx}. The result is an OLE2 container suitable for
   * opening in Microsoft PowerPoint with a password prompt.
   *
   * @param slides   - The (possibly mutated) slide array.
   * @param password - The password to encrypt with.
   * @param options  - Optional save-time and encryption settings.
   * @returns `Uint8Array` of the encrypted OLE2 file.
   *
   * @example
   * ```ts
   * const bytes = await handler.saveEncrypted(data.slides, "secret");
   * await fs.writeFile("protected.pptx", Buffer.from(bytes));
   * // => Encrypted OLE2 file requiring password to open
   * ```
   */
  public async saveEncrypted(
    slides: PptxSlide[],
    password: string,
    options?: PptxHandlerSaveOptions & { encryption?: EncryptionOptions },
  ): Promise<Uint8Array> {
    const pptxBytes = await this.runtime.save(slides, options);
    const encryptedBuffer = await encryptPptx(
      pptxBytes.buffer,
      password,
      options?.encryption,
    );
    return new Uint8Array(encryptedBuffer);
  }

  /**
   * Export selected slides as individual PPTX files.
   *
   * Each entry in the returned map is keyed by slide index and contains a
   * standalone `Uint8Array` PPTX with only that slide.
   *
   * @param slides  - Full slide array.
   * @param options - Export options (slide indexes, format, etc.).
   * @returns A `Map<slideIndex, Uint8Array>` of exported files.
   *
   * @example
   * ```ts
   * const exports = await handler.exportSlides(data.slides, {
   *   slideIndexes: [0, 2],
   * });
   * for (const [idx, bytes] of exports) {
   *   await fs.writeFile(`slide_${idx}.pptx`, Buffer.from(bytes));
   * }
   * // => Map<number, Uint8Array> — one standalone .pptx per exported slide
   * ```
   */
  public async exportSlides(
    slides: PptxSlide[],
    options: PptxExportOptions,
  ): Promise<Map<number, Uint8Array>> {
    return this.runtime.exportSlides(slides, options);
  }
}
