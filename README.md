# Quran Autocomplete for Obsidian

Quran Autocomplete detects a Quran ayah reference written inside parentheses and inserts the requested passage into the current Obsidian note.

Type a single ayah:

```text
The call of truth belongs to Allah (13:14).
```

Or a range:

```text
Allah addressed Musa directly (20:12-13), marking the beginning of his mission.
```

When the closing `)` is completed, the plugin retrieves the ayah text and inserts it using your chosen content and layout settings.

## Quick demo

### Before

Type a reference anywhere in a sentence or paragraph:

```markdown
The call of truth belongs to Allah (13:14).
```

### After: English quote block

```markdown
The call of truth belongs to Allah (13:14).

> To Him [alone] is the supplication of truth...
>
> (Qur’an 13:14 · Sahih International)
```

### After: Arabic and English quote block

```markdown
The call of truth belongs to Allah (13:14).

> <div class="quran-quote-arabic" dir="rtl" lang="ar">لَهُۥ دَعْوَةُ ٱلْحَقِّ...</div>
>
> To Him [alone] is the supplication of truth...
>
> (Qur’an 13:14 · Sahih International)
```

### After: inline

With inline layout enabled, the parenthesized trigger is replaced directly. Inline text can be plain, italic, or bold; italic is the default:

```markdown
The call of truth belongs to Allah To Him [alone] is the supplication of truth... (Qur’an 13:14 · Sahih International).
```

The README examples are shortened for display. The plugin inserts the complete text returned for the selected translation and ayah range.


## Trigger removal and undo

For quote-block layout, **Keep typed reference** is disabled by default. A trigger-only line such as `(24:30–31)` is removed completely, so the generated quote begins at the quote block. The paragraph replacement is atomic, meaning one Undo removes the generated passage and restores the original trigger without reinserting it.

## Auto-closing parentheses are supported

Obsidian normally creates both parentheses when you type `(`:

```text
()
```

The cursor remains between them. Type the reference and then type `)` as normal:

```text
(13:14)
```

CodeMirror may move the cursor over the existing closing parenthesis instead of inserting another character. The plugin listens for that action as well as normal editor changes. Both paths pass through one deduplication registry, so the same reference cannot be fetched or inserted twice.

## Output options

The settings combine two independent choices.

### Content

- English and Quran reference
- Arabic, English, and Quran reference

### Layout

- Quote block beneath the paragraph
- Inline replacement at the trigger position

For quote-block layout, a setting controls whether the original typed reference such as `(13:14)` remains in the sentence. When disabled, the plugin removes the trigger cleanly without leaving incorrect spacing before punctuation.

## Installation

### Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release and place them directly in:

```text
<Vault>/.obsidian/plugins/quran-quote/
```

Restart Obsidian, then enable **Quran Autocomplete** under **Settings → Community plugins**. Official Obsidian releases contain only the three supported plugin assets.

Advanced users can instead download these three assets from the same release:

- `main.js`
- `manifest.json`
- `styles.css`

Place all three directly inside `<Vault>/.obsidian/plugins/quran-quote/`.

### Community Plugins directory

After the plugin is accepted into Obsidian's Community Plugins directory, it can be installed and updated directly from **Settings → Community plugins → Browse**.

## Settings

Open **Settings → Community plugins → Quran Autocomplete**.

Available settings:

- Enable or disable automatic insertion.
- Enable or disable the parenthesized-reference trigger.
- Content: English only, or Arabic followed by English.
- Layout: quote block beneath the paragraph, or inline replacement.
- Inline emphasis: plain, italic, or bold.
- Keep or remove the original typed reference when using quote-block layout.
- Undo removes the generated passage in one step and does not immediately insert it again.
- English translation: Sahih International, Pickthall, Yusuf Ali, or Muhammad Asad.
- Show or hide Arabic and English verse numbers.
- Show or hide the translation credit.
- Show or hide the English surah name.

## Manual command

The automatic trigger is optional. You can also:

1. Select `13:14` or `20:12-13` in a note.
2. Open the Command Palette.
3. Run **Quran Autocomplete: Insert Qur’an passage**.

Running the command without a selection opens a reference-entry dialog. The ribbon book icon provides the same behaviour.

The command uses the same content, translation, citation, and layout settings. It replaces the selected reference with the generated output.

## Development installation

```bash
git clone https://github.com/mohsinosman/quran-autocomplete.git
cd quran-autocomplete
npm ci
npm run check
```

Copy the generated `main.js`, `manifest.json`, and `styles.css` into the `quran-quote` folder in a test vault.

## Development commands

```bash
npm run build   # Compile TypeScript and update main.js
npm test        # Run parser, formatting, auto-pair, removal, and deduplication tests
npm run check   # Build and run the full test suite
npm run dev     # Watch TypeScript during development
```

## How automatic detection works

1. The plugin checks text ending at the cursor after the cursor moves past `)`.
2. The text inside the nearest matching parentheses must be a valid reference such as `13:14` or `20:12-13`.
3. A keydown listener handles Obsidian's auto-closing-parenthesis behaviour.
4. The normal editor-change listener handles ordinary text insertion.
5. A per-editor registry blocks duplicate events while the API request is pending and remembers completed triggers while they remain unchanged.
6. Before inserting anything, the plugin confirms that the original trigger still exists in the same place. If it was edited while the request was loading, the note is left untouched.

## Data and privacy

The plugin sends only the requested surah number, ayah range, Arabic edition, and translation edition to the Al Quran Cloud API. It does not send note content, filenames, or vault files.

An internet connection is currently required when inserting a passage.

Quran translations are interpretations of the Arabic text and are not replacements for it.

## Attribution

Quran text and translations are retrieved from the Al Quran Cloud API. This project is not affiliated with Obsidian or Al Quran Cloud.

## Licence

MIT. See [LICENSE](LICENSE).
