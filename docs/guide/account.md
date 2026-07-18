---
title: Account & Sign-in
description: What File > Account shows by default, and how to wire a sign-in flow into its disabled-by-default hook point.
---

# Account & Sign-in

File > Account contains a local profile editor, a storage/privacy panel showing live local-storage figures, an About section, and an optional sign-in section that stays hidden until a host explicitly wires it up.

## What ships by default

**Profile.** A display name field and a row of avatar-color swatches. Nothing is sent anywhere - it's purely cosmetic, persisted to `localStorage` (key `pptx-viewer-prefs`) alongside the theme/locale fallback from [Theming](/guide/theming).

**Storage & Privacy.** A live count of presentations with a local autosave/recovery snapshot and their total size, read from the same IndexedDB store the recovery-on-reload flow uses. A "Clear local data" button (behind a confirmation) wipes every local snapshot and every persisted preference.

**About.** The binding's package name and version.

**Sign-in.** Absent by default. Renders only when you pass `accountAuth` with `enabled: true` - see below.

None of this requires any setup. It works the same way in a bare, un-configured viewer as it does in a fully wired-up host app.

## Wiring a real sign-in flow

The viewer has no opinion on auth - no OAuth client, no session cookies, no backend call. `accountAuth` is a thin hook: when enabled, the Account page shows a sign-in prompt and calls back into your app; you decide what "signed in" means and pass the result back down.

```ts
interface AccountAuthConfig {
	enabled: boolean;
	onSignIn: () => void;
	signedInUser?: {
		name: string;
		email?: string;
		avatarUrl?: string;
	};
}
```

- `enabled: false` (or omitting `accountAuth` entirely) is the default - the sign-in section doesn't render at all.
- `onSignIn` fires when the user clicks the sign-in button. Kick off whatever your app's real flow is here (redirect, OAuth popup, opening your own modal, etc.) - the viewer doesn't wait on it or manage any loading state.
- Once your app knows who's signed in, pass `signedInUser` back through the same `accountAuth` prop on the next render/update - the Account page then shows "Signed in as {name}" instead of the sign-in button.

```tsx
// React
const [user, setUser] = useState<{ name: string; email?: string } | undefined>();

<PowerPointViewer
	content={bytes}
	accountAuth={{
		enabled: true,
		onSignIn: () => startOAuthFlow().then(setUser),
		signedInUser: user,
	}}
/>;
```

```vue
<!-- Vue -->
<PowerPointViewer
	:content="bytes"
	:accountAuth="{ enabled: true, onSignIn: startOAuthFlow, signedInUser: user }"
/>
```

```html
<!-- Angular -->
<pptx-viewer
	[content]="bytes"
	[accountAuth]="{ enabled: true, onSignIn: startOAuthFlow, signedInUser: user }"
/>
```

```ts
// Vanilla
const viewer = createPptxViewer(host, {
	source: bytes,
	accountAuth: { enabled: true, onSignIn: startOAuthFlow, signedInUser: user },
});
```

```svelte
<!-- Svelte -->
<PowerPointViewer {content} accountAuth={{ enabled: true, onSignIn: startOAuthFlow, signedInUser: user }} />
```

The shape is identical across all five bindings.

## Next steps

- [Theming](/guide/theming) - the same `localStorage` fallback backs both the profile editor and the Appearance/Language pickers.
- [Localization (i18n)](/guide/localization) - every Account page string routes through the standard `pptx.account.*` translation keys.
