#!/usr/bin/env node
/**
 * Build-Script: Liest alle JSON-Rezepte und generiert eine standalone index.html
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');

const REZEPTE_DIR = path.join(__dirname, 'rezepte');
const OUTPUT = path.join(__dirname, 'index.html');
const MANIFEST_OUT = path.join(__dirname, 'manifest.json');
const SW_OUT = path.join(__dirname, 'sw.js');
const ICONS_DIR = path.join(__dirname, 'icons');

// PWA Version — bei Aenderungen hochzaehlen damit der Service Worker den Cache neu laedt
const PWA_VERSION = 'v1.0.2';

// Alle JSON-Dateien lesen
const rezepte = fs.readdirSync(REZEPTE_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const raw = fs.readFileSync(path.join(REZEPTE_DIR, f), 'utf-8');
    return JSON.parse(raw);
  })
  .sort((a, b) => a.titel.localeCompare(b.titel, 'de'));

console.log(`${rezepte.length} Rezepte geladen.`);

// HTML generieren
const html = generateHTML(rezepte);
fs.writeFileSync(OUTPUT, html, 'utf-8');
console.log(`index.html generiert (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);

// PWA-Dateien generieren
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.svg'), generateIcon(192), 'utf-8');
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.svg'), generateIcon(512), 'utf-8');
console.log('icons/icon-192.svg und icon-512.svg generiert');

fs.writeFileSync(MANIFEST_OUT, generateManifest(), 'utf-8');
console.log('manifest.json generiert');

fs.writeFileSync(SW_OUT, generateServiceWorker(), 'utf-8');
console.log(`sw.js generiert (${PWA_VERSION})`);

console.log('\nPWA bereit. Zum Testen: Server starten und "Zum Homescreen hinzufuegen" auf dem Handy.');

// PWA Manifest — was Browser ueber die App wissen muessen
function generateManifest() {
  return JSON.stringify({
    name: "Nicos Kueche",
    short_name: "Kueche",
    description: "Nicos Rezeptsammlung mit Einkaufslisten-Generator und Menueplaner",
    start_url: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0f0f",
    theme_color: "#f59e0b",
    lang: "de-CH",
    icons: [
      {
        src: "icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: "icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  }, null, 2);
}

// SVG Icon — Kochtopf-Emoji auf orangem Hintergrund
function generateIcon(size) {
  const fontSize = Math.round(size * 0.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#f59e0b" rx="${size * 0.2}"/>
  <text x="50%" y="50%" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">&#127859;</text>
</svg>`;
}

// Service Worker — Cache-First Strategie fuer Offline-Faehigkeit
function generateServiceWorker() {
  return `// Nicos Kueche Service Worker — ${PWA_VERSION}
// Auto-generiert von build.js. NICHT manuell editieren.

const CACHE_NAME = 'nicos-kueche-${PWA_VERSION}';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

// Install: alle Assets in Cache laden
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: alte Caches loeschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME)
             .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: erst Cache, dann Netzwerk (Cache-First)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Neue Requests zum Cache hinzufuegen (z.B. dynamisch geladene Assets)
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline + nicht im Cache: fallback zu index.html fuer Navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
`;
}

function generateHTML(rezepte) {
  const rezepteJSON = JSON.stringify(rezepte);

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Nicos Küche</title>

<!-- PWA Meta -->
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#f59e0b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Nicos Küche">
<link rel="apple-touch-icon" href="icons/icon-192.svg">
<link rel="icon" type="image/svg+xml" href="icons/icon-192.svg">

<style>
${getCSS()}
</style>
</head>
<body>

<div id="app">
  <header>
    <h1>Nicos K&uuml;che</h1>
    <div class="search-bar">
      <input type="search" id="search" placeholder="Suche (Name, Zutat, Tag...)" autocomplete="off">
    </div>
    <nav class="tabs">
      <button class="tab active" data-view="rezepte">Rezepte</button>
      <button class="tab" data-view="einkauf">Einkaufsliste</button>
      <button class="tab" data-view="menu">Men&uuml;planer</button>
    </nav>
  </header>

  <div class="filters">
    <div class="filter-row">
      <button class="filter-btn active" data-filter="alle">Alle</button>
      <button class="filter-btn" data-filter="favorit">&#9733; Favoriten</button>
      <button class="filter-btn" data-filter="Vorspeise">&#127869; Vorspeise</button>
      <button class="filter-btn" data-filter="Hauptgang">&#127860; Hauptgang</button>
      <button class="filter-btn" data-filter="Beilage">&#129388; Beilage</button>
      <button class="filter-btn" data-filter="Dessert">&#127856; Dessert</button>
      <button class="filter-btn" data-filter="Brot & Geb&auml;ck">&#127838; Brot</button>
      <button class="filter-btn" data-filter="Sauce & Dip">&#129379; Saucen</button>
      <button class="filter-btn" data-filter="Ap&eacute;ro">&#127863; Ap&eacute;ro</button>
      <button class="filter-btn" data-filter="Grundrezept">&#128218; Grundrezept</button>
    </div>
  </div>

  <!-- Rezepte View -->
  <div id="view-rezepte" class="view">
    <div id="rezepte-list" class="card-grid"></div>
  </div>

  <!-- Rezept Detail -->
  <div id="view-detail" class="view hidden">
    <div id="detail-content"></div>
  </div>

  <!-- Einkaufsliste View -->
  <div id="view-einkauf" class="view hidden">
    <div id="einkauf-content">
      <div class="einkauf-header">
        <h2>Einkaufsliste</h2>
        <span id="einkauf-count" class="badge">0</span>
      </div>
      <div id="einkauf-selected"></div>
      <div id="einkauf-liste"></div>
      <div id="einkauf-empty" class="empty-state">
        <p>Noch keine Rezepte ausgew&auml;hlt.</p>
        <p>Geh zu den Rezepten und tippe auf &laquo;Zur Einkaufsliste&raquo;.</p>
      </div>
    </div>
  </div>

  <!-- Menüplaner View -->
  <div id="view-menu" class="view hidden">
    <div id="menu-content">
      <h2>Men&uuml;planer</h2>
      <div class="menu-options">
        <label>Personen:
          <input type="number" id="menu-personen" value="4" min="1" max="20">
        </label>
      </div>
      <button id="menu-generate" class="btn primary">Men&uuml; vorschlagen</button>
      <div id="menu-result"></div>
    </div>
  </div>
</div>

<script>
const REZEPTE = ${rezepteJSON};
${getJS()}

// Service Worker Registrierung — aktiviert Offline-Modus und "Zum Homescreen hinzufuegen"
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('[PWA] Service Worker registriert:', reg.scope))
      .catch((err) => console.error('[PWA] SW Registrierung fehlgeschlagen:', err));
  });
}
</script>
</body>
</html>`;
}

function getCSS() {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #110d0a;
  --bg-elevated: #1c1512;
  --card: rgba(255, 120, 50, 0.05);
  --card-hover: rgba(255, 120, 50, 0.1);
  --text: #f5ebe0;
  --text-mid: #c4a882;
  --text-light: #7a6350;
  --accent: #ff6b35;
  --accent2: #ff9f1c;
  --accent-glow: rgba(255, 107, 53, 0.25);
  --accent-hover: #ff8555;
  --green: #4ade80;
  --green-glow: rgba(74, 222, 128, 0.12);
  --border: rgba(255, 150, 80, 0.08);
  --border-light: rgba(255, 150, 80, 0.15);
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.2);
  --radius: 16px;
  --radius-sm: 10px;
  --tag-bg: rgba(255, 107, 53, 0.08);
  --glass: rgba(255, 120, 50, 0.03);
  --glass-border: rgba(255, 150, 80, 0.12);
  --glass-bg: rgba(35, 25, 20, 0.65);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 2rem;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Gradient Mesh Background */
body::before {
  content: '';
  position: fixed;
  top: -20%; left: -20%;
  width: 60%; height: 50%;
  background: radial-gradient(ellipse, rgba(255, 107, 53, 0.08) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
  animation: meshFloat1 20s ease-in-out infinite;
}

body::after {
  content: '';
  position: fixed;
  bottom: -10%; right: -20%;
  width: 50%; height: 45%;
  background: radial-gradient(ellipse, rgba(255, 159, 28, 0.06) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
  animation: meshFloat2 25s ease-in-out infinite;
}

@keyframes meshFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(10%, 5%) scale(1.1); }
  66% { transform: translate(-5%, -3%) scale(0.95); }
}

@keyframes meshFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-8%, -5%) scale(1.08); }
}

#app { position: relative; z-index: 1; }

header {
  position: sticky;
  top: 0;
  background: rgba(17, 13, 10, 0.75);
  backdrop-filter: blur(24px) saturate(1.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
  z-index: 100;
  padding: 1rem 1rem 0;
  border-bottom: 1px solid var(--glass-border);
}

h1 {
  font-size: 1.3rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.search-bar { margin-bottom: 0.75rem; }

.search-bar input {
  width: 100%;
  padding: 0.65rem 1.1rem;
  border: 1px solid var(--glass-border);
  border-radius: 99px;
  font-size: 0.9rem;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text);
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-bar input::placeholder { color: var(--text-light); }
.search-bar input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow), 0 0 20px rgba(255, 107, 53, 0.1);
  background: rgba(28, 21, 18, 0.8);
}

.tabs {
  display: flex;
  gap: 0;
}

.tab {
  flex: 1;
  padding: 0.65rem;
  border: none;
  background: none;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-light);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.filters {
  padding: 0.75rem 1rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.filters::-webkit-scrollbar { display: none; }

.filter-row {
  display: flex;
  gap: 0.4rem;
  white-space: nowrap;
}

.filter-btn {
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--glass-border);
  border-radius: 99px;
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text-mid);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.filter-btn:active { transform: scale(0.92); }

.filter-btn.active {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15);
}

.view { padding: 0 1rem; }
.hidden { display: none !important; }

/* Cards */
.card-grid {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.5rem;
}

.card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border-radius: var(--radius);
  padding: 1rem 1rem 0.85rem;
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent2), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.card::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(255,107,53,0.03) 0%, transparent 50%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}

.card:active {
  transform: scale(0.97);
  border-color: rgba(255, 150, 80, 0.25);
}
.card:active::before { opacity: 1; }
.card:active::after { opacity: 1; }

.card-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
  letter-spacing: -0.01em;
  padding-right: 1.5rem;
}

.card-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-light);
  margin-bottom: 0.5rem;
}

.card-meta span {
  display: inline-flex;
  align-items: center;
}

.card-meta span::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-light);
  margin-right: 0.5rem;
}

.card-meta span:first-child::before { display: none; }

.card-tags {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.tag {
  background: rgba(255, 107, 53, 0.06);
  border: 1px solid rgba(255, 150, 80, 0.1);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  font-size: 0.65rem;
  color: var(--text-mid);
  font-weight: 500;
  letter-spacing: 0.02em;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.star {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  font-size: 0.9rem;
  color: var(--accent);
  filter: drop-shadow(0 0 6px rgba(255, 107, 53, 0.5));
  animation: starPulse 3s ease-in-out infinite;
}

@keyframes starPulse {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(255,107,53,0.4)); transform: scale(1); }
  50% { filter: drop-shadow(0 0 10px rgba(255,107,53,0.7)); transform: scale(1.1); }
}

/* Detail View */
#detail-content {
  padding-top: 0.5rem;
}

.detail-back {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--accent);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  margin-bottom: 1rem;
  border: none;
  background: none;
  transition: opacity 0.2s;
}

.detail-back:active { opacity: 0.7; }

.detail-title {
  font-size: 1.35rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.detail-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-light);
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.detail-meta span {
  background: rgba(255, 107, 53, 0.06);
  border: 1px solid rgba(255, 150, 80, 0.1);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.portionen-control {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  border: 1px solid var(--glass-border);
}

.portionen-control button {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: 1px solid var(--glass-border);
  background: rgba(255, 107, 53, 0.08);
  color: var(--text);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.portionen-control button:active {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  border-color: transparent;
  color: white;
  box-shadow: 0 0 16px var(--accent-glow);
  transform: scale(0.9);
}

.portionen-control span {
  font-weight: 700;
  min-width: 1.5rem;
  text-align: center;
}

.section-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 1.5rem 0 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--glass-border);
}

.zutat-gruppe { margin-bottom: 0.5rem; }

.zutat-gruppe-name {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-mid);
  margin-bottom: 0.2rem;
  margin-top: 0.5rem;
}

.zutat-item {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0;
  font-size: 0.88rem;
  border-bottom: 1px solid var(--border);
}

.zutat-menge {
  color: var(--accent);
  font-weight: 600;
  white-space: nowrap;
  margin-left: 0.5rem;
  font-variant-numeric: tabular-nums;
}

.schritt {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  font-size: 0.88rem;
  color: var(--text-mid);
}

.schritt-num {
  flex-shrink: 0;
  width: 1.6rem;
  height: 1.6rem;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  margin-top: 0.15rem;
  box-shadow: 0 2px 12px var(--accent-glow);
}

.tipp {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-left: 2px solid var(--accent);
  padding: 0.6rem 0.85rem;
  margin-bottom: 0.5rem;
  font-size: 0.82rem;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-mid);
  border-top: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
}

.btn {
  padding: 0.65rem 1.3rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.btn:active { transform: scale(0.95); }

.btn.primary {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 20px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15);
}

.btn.primary:active {
  box-shadow: 0 2px 10px var(--accent-glow);
  transform: scale(0.95);
}

.detail-actions {
  display: flex;
  gap: 0.5rem;
  margin: 1.25rem 0;
  flex-wrap: wrap;
}

/* Einkaufsliste */
.einkauf-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.75rem 0 1rem;
}

.einkauf-header h2 {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.badge {
  background: var(--accent);
  color: white;
  font-size: 0.7rem;
  padding: 0.15rem 0.55rem;
  border-radius: 99px;
  font-weight: 700;
  box-shadow: 0 2px 8px var(--accent-glow);
}

#einkauf-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.selected-chip {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  padding: 0.3rem 0.65rem;
  border-radius: 99px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-mid);
}

.selected-chip .remove {
  cursor: pointer;
  color: var(--accent);
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1;
}

.abteilung-group {
  margin-bottom: 1.25rem;
}

.abteilung-title {
  font-weight: 700;
  font-size: 0.7rem;
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.4rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid var(--glass-border);
}

.einkauf-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0;
  font-size: 0.88rem;
  transition: opacity 0.2s;
}

.einkauf-item input[type="checkbox"] {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--green);
  border-radius: 4px;
}

.einkauf-item.checked {
  text-decoration: line-through;
  color: var(--text-light);
  opacity: 0.5;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-light);
}

/* Menuplaner */
.menu-options {
  margin: 1rem 0;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.menu-options label {
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-mid);
}

.menu-options input {
  width: 3.5rem;
  padding: 0.45rem;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
  background: var(--glass-bg);
  color: var(--text);
}

.menu-options input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.menu-gang {
  margin: 0.75rem 0;
  background: rgba(40, 28, 20, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: var(--radius);
  padding: 1rem;
  border: 1px solid rgba(255, 150, 80, 0.18);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-gang:active {
  transform: scale(0.97);
  border-color: var(--accent);
  box-shadow: 0 0 20px var(--accent-glow);
}

.menu-gang-title {
  font-size: 0.65rem;
  text-transform: uppercase;
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 0.2rem;
}

.menu-gang-name {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.notiz-box {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-size: 0.82rem;
  margin-top: 1rem;
  font-style: italic;
  color: var(--text-light);
}

/* View Transitions */
.view {
  padding: 0 1rem;
  animation: viewFadeIn 0.3s ease-out;
}

@keyframes viewFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.card {
  animation: cardSlideIn 0.4s ease-out backwards;
}

.card:nth-child(1) { animation-delay: 0.03s; }
.card:nth-child(2) { animation-delay: 0.06s; }
.card:nth-child(3) { animation-delay: 0.09s; }
.card:nth-child(4) { animation-delay: 0.12s; }
.card:nth-child(5) { animation-delay: 0.15s; }
.card:nth-child(6) { animation-delay: 0.18s; }
.card:nth-child(7) { animation-delay: 0.21s; }
.card:nth-child(8) { animation-delay: 0.24s; }
.card:nth-child(9) { animation-delay: 0.27s; }
.card:nth-child(10) { animation-delay: 0.3s; }

@keyframes cardSlideIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Print */
@media print {
  :root {
    --bg: white;
    --card: white;
    --glass-bg: white;
    --text: black;
    --text-mid: #333;
    --text-light: #666;
    --accent: #d4622b;
    --accent2: #e07038;
    --border: #ddd;
    --glass-border: #ddd;
  }
  body::before, body::after { display: none; }
  header, .filters, .tabs, .btn, .detail-actions, .portionen-control button { display: none; }
  body { max-width: 100%; background: white; }
  .card { border: 1px solid #ddd; backdrop-filter: none; }
}
`;
}

function getJS() {
  return `
// State
let currentView = 'rezepte';
let currentFilter = 'alle';
let searchQuery = '';
let einkaufRezepte = []; // [{id, portionen}]
let detailPortionen = {};

// Bug 1 Fix: HTML escaping to prevent XSS
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  renderRezepte();
  bindEvents();
});

function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      switchView(tab.dataset.view);
    });
  });

  // Filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderRezepte();
    });
  });

  // Search
  document.getElementById('search').addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderRezepte();
  });

  // Menu generator
  document.getElementById('menu-generate').addEventListener('click', generateMenu);
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelector('.filters').classList.toggle('hidden', view !== 'rezepte');

  if (view === 'rezepte') {
    document.getElementById('view-rezepte').classList.remove('hidden');
    renderRezepte();
  } else if (view === 'einkauf') {
    document.getElementById('view-einkauf').classList.remove('hidden');
    renderEinkaufsliste();
  } else if (view === 'menu') {
    document.getElementById('view-menu').classList.remove('hidden');
  }
}

function filterRezepte() {
  return REZEPTE.filter(r => {
    // Filter
    if (currentFilter === 'favorit' && !r.favorit) return false;
    if (currentFilter !== 'alle' && currentFilter !== 'favorit' && r.kategorie !== currentFilter) return false;

    // Search
    if (searchQuery) {
      const haystack = [
        r.titel,
        r.kategorie,
        ...r.tags,
        ...r.zutaten.flatMap(g => g.items.map(i => i.name)),
        r.notizen || ''
      ].join(' ').toLowerCase();
      return haystack.includes(searchQuery);
    }
    return true;
  });
}

function renderRezepte() {
  const filtered = filterRezepte();
  const container = document.getElementById('rezepte-list');

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Keine Rezepte gefunden.</p></div>';
    return;
  }

  container.innerHTML = filtered.map(r => {
    const zeit = r.zeit.gesamt >= 60
      ? Math.floor(r.zeit.gesamt / 60) + ' Std.' + (r.zeit.gesamt % 60 > 0 ? ' ' + r.zeit.gesamt % 60 + ' Min.' : '')
      : r.zeit.gesamt + ' Min.';
    return \`
    <div class="card" onclick="showDetail('\${esc(r.id)}')">
      \${r.favorit ? '<span class="star">\\u2605</span>' : ''}
      <div class="card-title">\${esc(r.titel)}</div>
      <div class="card-meta">
        <span>\${esc(r.kategorie)}</span>
        <span>\${zeit}</span>
        <span>\${esc(r.aufwand)}</span>
        <span>\${r.portionen} \${esc(r.portionenEinheit || 'Port.')}</span>
      </div>
      <div class="card-tags">\${r.tags.map(t => '<span class="tag">' + esc(t) + '</span>').join('')}</div>
    </div>\`;
  }).join('');
}

function showDetail(id) {
  const r = REZEPTE.find(x => x.id === id);
  if (!r) return;

  const portionen = detailPortionen[id] || r.portionen;
  const faktor = portionen / r.portionen;

  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelector('.filters').classList.add('hidden');
  document.getElementById('view-detail').classList.remove('hidden');

  const inEinkauf = einkaufRezepte.some(e => e.id === id);

  document.getElementById('detail-content').innerHTML = \`
    <button class="detail-back" onclick="backToList()">\\u2190 Zur\\u00fcck</button>
    <div class="detail-title">\${r.favorit ? '\\u2605 ' : ''}\${esc(r.titel)}</div>
    <div class="detail-meta">
      <span>\${esc(r.kategorie)}</span>
      <span>\${esc(r.aufwand)}</span>
      <span>Vorb. \${r.zeit.vorbereitung} Min.</span>
      <span>Gesamt \${formatZeit(r.zeit.gesamt)}</span>
    </div>

    <div class="portionen-control">
      <span>\${esc(r.portionenEinheit || 'Portionen')}:</span>
      <button onclick="adjustPortionen('\${esc(id)}', -1)">\\u2212</button>
      <span id="port-display">\${portionen}</span>
      <button onclick="adjustPortionen('\${esc(id)}', 1)">+</button>
    </div>

    <div class="detail-actions">
      <button class="btn primary" onclick="toggleEinkauf('\${esc(id)}', \${portionen})">
        \${inEinkauf ? '\\u2713 In Einkaufsliste' : '\\u2795 Zur Einkaufsliste'}
      </button>
    </div>

    <div class="section-title">Zutaten</div>
    \${r.zutaten.map(g => \`
      <div class="zutat-gruppe">
        \${g.gruppe ? '<div class="zutat-gruppe-name">' + esc(g.gruppe) + '</div>' : ''}
        \${g.items.map(i => \`
          <div class="zutat-item">
            <span>\${esc(i.name)}</span>
            <span class="zutat-menge">\${formatMenge(i.menge * faktor, i.einheit)}</span>
          </div>
        \`).join('')}
      </div>
    \`).join('')}

    <div class="section-title">Zubereitung</div>
    \${r.schritte.map((s, i) => \`
      <div class="schritt">
        <span class="schritt-num">\${i + 1}</span>
        <span>\${esc(s)}</span>
      </div>
    \`).join('')}

    \${r.tipps && r.tipps.length ? \`
      <div class="section-title">Tipps</div>
      \${r.tipps.map(t => '<div class="tipp">' + esc(t) + '</div>').join('')}
    \` : ''}

    \${r.notizen ? '<div class="notiz-box">' + esc(r.notizen) + '</div>' : ''}
  \`;

  window.scrollTo(0, 0);
}

function backToList() {
  document.getElementById('view-detail').classList.add('hidden');
  document.getElementById('view-rezepte').classList.remove('hidden');
  document.querySelector('.filters').classList.remove('hidden');
}

function adjustPortionen(id, delta) {
  const r = REZEPTE.find(x => x.id === id);
  const current = detailPortionen[id] || r.portionen;
  const next = Math.max(1, current + delta);
  detailPortionen[id] = next;
  showDetail(id);
}

function toggleEinkauf(id, portionen) {
  const idx = einkaufRezepte.findIndex(e => e.id === id);
  if (idx >= 0) {
    einkaufRezepte.splice(idx, 1);
  } else {
    einkaufRezepte.push({ id, portionen });
  }
  showDetail(id);
  updateEinkaufBadge();
}

function updateEinkaufBadge() {
  document.getElementById('einkauf-count').textContent = einkaufRezepte.length;
}

function renderEinkaufsliste() {
  const selectedEl = document.getElementById('einkauf-selected');
  const listeEl = document.getElementById('einkauf-liste');
  const emptyEl = document.getElementById('einkauf-empty');

  if (einkaufRezepte.length === 0) {
    selectedEl.innerHTML = '';
    listeEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  // Selected chips
  selectedEl.innerHTML = einkaufRezepte.map(e => {
    const r = REZEPTE.find(x => x.id === e.id);
    return \`<div class="selected-chip">
      \${esc(r.titel)} (\\u00d7\${e.portionen})
      <span class="remove" onclick="removeEinkauf('\${esc(e.id)}')">&times;</span>
    </div>\`;
  }).join('');

  // Merge ingredients
  // Bug 3 Fix: Normalize name by stripping parenthetical suffixes for merge key
  function mergeKey(name, einheit) {
    return name.toLowerCase().replace(/\\s*\\(.*\\)\\s*/g, '').trim() + '|' + einheit;
  }

  const merged = {};
  einkaufRezepte.forEach(e => {
    const r = REZEPTE.find(x => x.id === e.id);
    const faktor = e.portionen / r.portionen;
    r.zutaten.forEach(g => {
      g.items.forEach(item => {
        const key = mergeKey(item.name, item.einheit);
        if (merged[key]) {
          merged[key].menge += item.menge * faktor;
        } else {
          merged[key] = {
            name: item.name.replace(/\\s*\\(.*\\)\\s*/g, '').trim(),
            menge: item.menge * faktor,
            einheit: item.einheit,
            abteilung: item.abteilung
          };
        }
      });
    });
  });

  // Group by Abteilung
  const byAbt = {};
  Object.values(merged).forEach(item => {
    const abt = item.abteilung || 'Sonstiges';
    if (!byAbt[abt]) byAbt[abt] = [];
    byAbt[abt].push(item);
  });

  const abtOrder = ['Gemüse & Früchte', 'Milchprodukte', 'Fleisch & Fisch', 'Brot & Backwaren', 'Grundnahrungsmittel', 'Gewürze & Öle', 'Tiefkühl', 'Getränke', 'Sonstiges'];

  listeEl.innerHTML = abtOrder
    .filter(a => byAbt[a])
    .map(abt => \`
      <div class="abteilung-group">
        <div class="abteilung-title">\${abt}</div>
        \${byAbt[abt].map((item, i) => \`
          <label class="einkauf-item" id="ei-\${i}">
            <input type="checkbox" onchange="this.parentElement.classList.toggle('checked')">
            <span>\${formatMenge(item.menge, item.einheit)} \${esc(item.name)}</span>
          </label>
        \`).join('')}
      </div>
    \`).join('');
}

function removeEinkauf(id) {
  einkaufRezepte = einkaufRezepte.filter(e => e.id !== id);
  updateEinkaufBadge();
  renderEinkaufsliste();
}

function generateMenu() {
  let personen = parseInt(document.getElementById('menu-personen').value) || 4;
  // Bug 7 Fix: Clamp to valid range
  if (personen < 1) personen = 1;
  if (personen > 20) personen = 20;
  document.getElementById('menu-personen').value = personen;
  const resultEl = document.getElementById('menu-result');

  const vorspeisen = REZEPTE.filter(r => r.kategorie === 'Vorspeise');
  const hauptgaenge = REZEPTE.filter(r => r.kategorie === 'Hauptgang');
  const beilagen = REZEPTE.filter(r => r.kategorie === 'Beilage');
  const desserts = REZEPTE.filter(r => r.kategorie === 'Dessert');
  const saucen = REZEPTE.filter(r => r.kategorie === 'Sauce & Dip');

  const pick = arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;

  const menu = [
    { gang: 'Vorspeise', rezept: pick(vorspeisen) },
    { gang: 'Hauptgang', rezept: pick(hauptgaenge) },
    { gang: 'Beilage', rezept: pick(beilagen) },
    { gang: 'Sauce', rezept: pick(saucen) },
    { gang: 'Dessert', rezept: pick(desserts) }
  ].filter(m => m.rezept);

  if (menu.length === 0) {
    resultEl.innerHTML = '<div class="empty-state">Zu wenig Rezepte für ein Menü.</div>';
    return;
  }

  resultEl.innerHTML = \`
    <p style="color:var(--text-light); margin-top:1rem; font-size:0.85rem">Vorschlag f\\u00fcr \${personen} Personen:</p>
    \${menu.map(m => \`
      <div class="menu-gang" onclick="showDetail('\${esc(m.rezept.id)}')">
        <div class="menu-gang-title">\${esc(m.gang)}</div>
        <div class="menu-gang-name">\${esc(m.rezept.titel)}</div>
      </div>
    \`).join('')}
    <div style="margin-top:1rem; display:flex; gap:0.5rem; flex-wrap:wrap">
      <button class="btn primary" onclick="addMenuToEinkauf(\${personen})">Alles zur Einkaufsliste</button>
      <button class="btn" onclick="generateMenu()">Nochmal w\\u00fcrfeln</button>
    </div>
  \`;

  // Store current menu for einkauf
  window._currentMenu = menu.map(m => m.rezept.id);
}

function addMenuToEinkauf(personen) {
  if (!window._currentMenu) return;
  window._currentMenu.forEach(id => {
    if (!einkaufRezepte.some(e => e.id === id)) {
      einkaufRezepte.push({ id, portionen: personen });
    }
  });
  updateEinkaufBadge();
  // Switch to einkauf view
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab')[1].classList.add('active');
  switchView('einkauf');
}

function formatMenge(menge, einheit) {
  if (!menge || menge <= 0) return '';

  // Bug 2 Fix: Auto-convert to larger units
  if (einheit === 'g' && menge >= 1000) {
    menge = menge / 1000;
    einheit = 'kg';
  } else if (einheit === 'ml' && menge >= 1000) {
    menge = menge / 1000;
    einheit = 'l';
  } else if (einheit === 'ml' && menge >= 100) {
    menge = menge / 100;
    einheit = 'dl';
  }

  // Smart rounding
  let display;
  if (menge >= 100) display = Math.round(menge);
  else if (menge >= 10) display = Math.round(menge * 10) / 10;
  else display = Math.round(menge * 100) / 100;

  // Remove trailing zeros
  display = parseFloat(display);

  return display + ' ' + einheit;
}

function formatZeit(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h + ' Std.' + (m > 0 ? ' ' + m + ' Min.' : '');
  }
  return min + ' Min.';
}
`;
}
