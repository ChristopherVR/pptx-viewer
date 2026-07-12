/**
 * Global stylesheet written over the Vite starter's default styles.
 * Provides the demo-site look: dark background, CSS-variable theming, and
 * the shared landing-screen layout (`.stage`, `.dropzone`, etc.).
 * Used as `src/index.css` (React), `src/app.css` (Svelte), and
 * `src/style.css` (Vanilla JS).
 */
export const MINIMAL_APP_CSS = `:root {
  color-scheme: dark;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  overflow-x: hidden;
  background: var(--pptx-background, #030712);
  color: var(--pptx-foreground, #f3f4f6);
}

#app,
#root {
  height: 100dvh;
}

.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100dvh;
  padding: 2rem;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  max-width: 520px;
  width: 100%;
  padding: 3rem;
  text-align: center;
  border: 2px dashed var(--pptx-border, #374151);
  border-radius: 0.75rem;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.dropzone.over,
.dropzone:hover {
  border-color: var(--pptx-primary, #6366f1);
  background: var(--pptx-muted, rgba(255, 255, 255, 0.04));
}

.dropzone h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 500;
}

.dropzone p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--pptx-muted-foreground, #9ca3af);
}

.pick-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  border: 1px solid var(--pptx-border, #374151);
  background: var(--pptx-muted, #1f2937);
  color: var(--pptx-foreground, #f3f4f6);
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.pick-label:hover {
  background: var(--pptx-accent, #374151);
}

.or-sep {
  font-size: 0.8rem;
  color: var(--pptx-muted-foreground, #6b7280);
}

.new-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  border: none;
  background: var(--pptx-primary, #6366f1);
  color: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: opacity 0.15s;
}

.new-btn:hover {
  opacity: 0.9;
}
`;

/**
 * Global stylesheet for Angular scaffolds. Angular uses `<app-root>` instead
 * of `#app`, so this is kept separate from `MINIMAL_APP_CSS`. Placed at
 * `src/styles.css` (Angular CLI's default global stylesheet path).
 */
export const ANGULAR_GLOBAL_CSS = `:root {
  color-scheme: dark;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: var(--pptx-background, #030712);
  color: var(--pptx-foreground, #f3f4f6);
}

app-root {
  display: block;
  height: 100dvh;
}
`;
