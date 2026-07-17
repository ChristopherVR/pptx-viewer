/**
 * Optional sign-in hook point for File > Account.
 *
 * `PowerPointViewer` provides this from its `accountAuth` prop; `AccountPage`
 * reads it to decide whether to render a sign-in section. A context avoids
 * threading the (usually-undefined) config through the Toolbar/FileSection
 * component chain and the separate mobile `MobileMenuSheet` path.
 */

import type { AccountAuthConfig } from 'pptx-viewer-shared';
import { createContext } from 'react';

/** `undefined` when the host has not opted in to a sign-in flow. */
export const AccountAuthContext = createContext<AccountAuthConfig | undefined>(undefined);
