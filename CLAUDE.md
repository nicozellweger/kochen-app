# Nicos Küche — Rezeptsammlung PWA

> **Wichtig für Claude:** Das ist eine PWA die auf Vercel deployed ist. Live-URL: https://nicos-kueche.vercel.app/
>
> Der primäre Workflow ist **konversational**: Nico bespricht ein Rezept mit dir, und wenn er "deploy" sagt, führst du den Full-Deploy-Flow aus (siehe unten).

---

## Projektstruktur

```
Kochen/
├── rezepte/              # Einzelne Rezepte als JSON (die Source of Truth)
├── icons/                # PWA Icons (SVG, auto-generiert)
├── index.html            # Generiert von build.js (NICHT manuell editieren)
├── manifest.json         # PWA Manifest (auto-generiert)
├── sw.js                 # Service Worker (auto-generiert)
├── build.js              # Node-Script: JSON → HTML + PWA Assets
├── CLAUDE.md             # Diese Datei
└── .gitignore
```

**Wichtig:** `index.html`, `manifest.json`, `sw.js` und `icons/` werden **automatisch von `build.js` generiert**. Nie manuell editieren — immer nur die Quellen (`rezepte/*.json`, `build.js`) ändern und dann `node build.js` laufen lassen.

---

## Der primäre Workflow: Rezept-Konversation + Deploy

### Wie Nico arbeitet

1. **Nico fragt dich nach einem Rezept** — typisch: "Ich will heute Abend X kochen, gib mir das beste Rezept"
2. **Du lieferst einen Vorschlag** — strukturiert, mit Zutaten, Schritten, Tipps
3. **Nico reviewt und stellt Fragen** — iteriert, passt an, fragt nach Alternativen
4. **Wenn das Rezept passt, sagt Nico "deploy"** (oder "deploy das Rezept" / "deploy to app" / "push it")
5. **DU führst dann den Deploy-Flow aus** (siehe unten)

### Der Deploy-Flow (wenn Nico "deploy" sagt)

```bash
# 1. JSON-Datei erstellen unter rezepte/[slug].json
#    slug = kebab-case Version des Titels, ohne Umlaute
#    Beispiel: "Lasagne Bolognese" → lasagne-bolognese.json

# 2. PWA_VERSION in build.js hochzählen (Patch-Version)
#    WICHTIG: Sonst cached der Service Worker auf installierten PWAs (v.a. Handys)
#    die alte Version und neue Rezepte erscheinen erst nach manuellem Cache-Reset.
#    Beispiel: 'v1.0.1' → 'v1.0.2'

# 3. Build ausführen
cd "/c/Users/NicoZellweger(Amphas/Desktop/AI Projects/Kochen"
node build.js

# 4. Git-Commit mit aussagekräftiger Message
git add rezepte/[slug].json build.js index.html manifest.json sw.js icons/
git commit -m "Add [Titel]

[1-2 Sätze Beschreibung was das Rezept auszeichnet]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

# 5. Push zu GitHub — Vercel deployt automatisch in ~30 Sekunden
git push

# 6. Bestätige Nico: "Rezept deployed. In ~30 Sekunden auf https://nicos-kueche.vercel.app/ sichtbar.
#    PWA auf dem Handy einmal schliessen und neu öffnen — SW aktualisiert sich dann automatisch."
```

---

## Rezept-JSON Schema

Jedes Rezept ist eine Datei in `rezepte/` mit folgendem Aufbau:

### Pflicht-Felder
- `id`: Kebab-case Identifier (= Dateiname ohne .json)
- `titel`: Anzeigename (mit Umlauten OK)
- `kategorie`: Eine von: `Apéro`, `Vorspeise`, `Hauptgang`, `Beilage`, `Dessert`, `Brot & Gebäck`, `Sauce & Dip`, `Grundrezept`
- `tags`: Array von Strings (lowercase, z.B. `["grill", "vegetarisch", "schnell"]`)
- `favorit`: Boolean (default: `false`)
- `portionen`: Number — Anzahl Standardportionen
- `aufwand`: `"einfach"` | `"mittel"` | `"aufwändig"`
- `zeit`: Object mit `vorbereitung` und `gesamt` in Minuten
- `zutaten`: Array von Gruppen, jede mit `gruppe` (Name) und `items` (Array)
- `schritte`: Array von Strings (nummerierte Schritte)

### Optional
- `tipps`: Array von Strings (Hinweise, Variationen, Tricks)
- `notizen`: Freitext (persönliche Notizen, Quelle)

### Zutaten-Item Schema
```json
{
  "menge": 500,
  "einheit": "g",
  "name": "Rindshackfleisch",
  "abteilung": "Fleisch & Fisch"
}
```

### Komplettes Beispiel

```json
{
  "id": "lasagne-bolognese",
  "titel": "Lasagne Bolognese",
  "kategorie": "Hauptgang",
  "tags": ["italienisch", "ofen", "für-gäste", "klassiker"],
  "favorit": false,
  "portionen": 6,
  "aufwand": "mittel",
  "zeit": {
    "vorbereitung": 30,
    "gesamt": 150
  },
  "zutaten": [
    {
      "gruppe": "Bolognese",
      "items": [
        {"menge": 500, "einheit": "g", "name": "Rindshackfleisch", "abteilung": "Fleisch & Fisch"},
        {"menge": 1, "einheit": "Stück", "name": "Zwiebel", "abteilung": "Gemüse & Früchte"}
      ]
    },
    {
      "gruppe": "Béchamel",
      "items": [
        {"menge": 500, "einheit": "ml", "name": "Milch", "abteilung": "Milchprodukte"},
        {"menge": 50, "einheit": "g", "name": "Butter", "abteilung": "Milchprodukte"}
      ]
    }
  ],
  "schritte": [
    "Zwiebel fein würfeln und in Olivenöl anschwitzen.",
    "Hackfleisch dazugeben, krümelig anbraten bis Röststoffe entstehen.",
    "..."
  ],
  "tipps": [
    "Mindestens 1 Stunde köcheln lassen für volles Aroma.",
    "Am Vortag zubereitet ist sie noch besser."
  ]
}
```

---

## Konventionen (unbedingt einhalten)

### Sprache
- **Deutsch, Schweizer Konventionen**: "ss" statt "ß"
- Titel mit Umlauten OK (ü, ö, ä)
- Slug/ID: ohne Umlaute (ü→ue, ö→oe, ä→ae)
  - Beispiel: "Zürcher Geschnetzeltes" → `zuercher-geschnetzeltes`

### Einheiten (nur metrisch!)
- **Gewicht**: g, kg
- **Volumen**: ml, dl, l
- **Löffel**: TL (Teelöffel), EL (Esslöffel)
- **Stück**: Stück, Prise, Bund, Zweig, Scheibe
- **Temperatur**: immer °C
- **NIEMALS**: oz, lb, cup, tbsp, °F

### Abteilungen (für Einkaufsliste — MUSS übereinstimmen)
- `Milchprodukte`
- `Fleisch & Fisch`
- `Gemüse & Früchte`
- `Brot & Backwaren`
- `Grundnahrungsmittel`
- `Gewürze & Öle`
- `Tiefkühl`
- `Getränke`
- `Sonstiges`

### Dateinamen
- kebab-case
- keine Umlaute
- keine Sonderzeichen ausser Bindestrich
- Beispiel: `nicos-kueche.json`, `huehnchen-curry.json`

---

## Nicos Kochstil — Berücksichtige das bei Vorschlägen

- **Enthusiast-level Hobbykoch** — kein Anfänger, sucht Präzision und Verfeinerung
- **Grill-affin** — Outdoorchef Heat Grill (Sear Burner, Backburner, Rotisserie, Plancha)
- **Reverse-Sear-Spezialist** für Fleisch
- **Kocht für Gruppen** (4-8 Personen typisch)
- **Mehrstufige Rezepte gewünscht** — ganze Menüs von Apéro bis Dessert
- **Primär Migros** als Einkaufsquelle — Zutaten sollten dort verfügbar sein
- **Julia als Partnerin** — manche Rezepte werden gemeinsam gekocht
- **Favoriten**: Burrata, Café de Paris Butter, Panna Cotta, Bacon-wrapped Green Beans, Butterzopf

## Wann `favorit: true` setzen?
- **Nur wenn Nico es explizit sagt** ("das ist ein Favorit", "markier das als Favorit")
- Default ist immer `false`
- Nicht aufgrund eigener Einschätzung setzen

---

## Tech-Stack (Info für Debugging)

- **Pure Vanilla JS** — kein Framework, kein Build-Tool
- **Node.js** nur für `build.js` (generiert index.html aus JSON)
- **PWA** mit Service Worker (Cache-First Strategie)
- **Hosting**: Vercel (auto-deploy bei jedem `git push`)
- **Repository**: https://github.com/nicozellweger/kochen-app (public)

### Nach jeder Schema-Änderung
Wenn sich das JSON-Schema ändert (neue Felder, neue Kategorien etc.), muss:
1. `build.js` angepasst werden (damit das neue Feld gerendert wird)
2. Alle existierenden Rezept-JSONs geprüft werden (falls nötig migriert)
3. Diese `CLAUDE.md` aktualisiert werden

### Bei Fehlern
- Build-Fehler: `node build.js` lokal ausführen, Fehlermeldung lesen
- Vercel Build Fails: Check https://vercel.com/nicozellweger/kochen-app
- Service Worker Cache-Probleme (falls PWA_VERSION im Deploy-Flow vergessen wurde):
  1. `PWA_VERSION` in `build.js` nachträglich hochzählen
  2. Rebuild + commit + push
  3. Auf dem Handy: PWA schliessen + neu öffnen (ggf. zweimal)
  4. Als letzter Fallback: PWA deinstallieren und neu "Zum Homescreen hinzufügen"
