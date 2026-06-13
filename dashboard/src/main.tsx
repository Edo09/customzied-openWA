import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { i18nReady } from './i18n';
import './index.css';
import App from './App.tsx';

// Polyfill crypto.randomUUID for insecure contexts (http:// over an IP, not localhost), where the
// browser does not expose it. crypto.getRandomValues is available there, so the UUID is still
// random. Runs before anything else because the app can reach for randomUUID during first render.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  (crypto as Crypto).randomUUID = function randomUUID() {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0'));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}

// Apply the stored theme BEFORE first paint: useTheme() only runs inside Layout, so standalone
// routes (Login) otherwise flash the OS theme on reload even when the user explicitly picked one.
// Mirrors applyTheme: an explicit choice sets data-theme; system/absent leaves it to the media query.
const storedTheme = localStorage.getItem('openwa_theme');
if (storedTheme === 'light' || storedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', storedTheme);
}

// The active locale is fetched rather than bundled into the entry, so first paint waits for it —
// otherwise the shell renders raw keys and swaps to real copy a tick later. A catalogue that fails
// to arrive does not hold this up: i18next settles init either way, falling back to English or, if
// nothing loads at all, to raw keys. The second handler is therefore belt and braces rather than the
// live path — but it is what guarantees that no future change to that contract can leave the
// dashboard blank, which is a worse failure than untranslated text.
const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

void i18nReady.then(render, render);
