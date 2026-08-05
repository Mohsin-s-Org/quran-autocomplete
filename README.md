# Qur'an Autocomplete for Obsidian

Qur'an Autocomplete detects a Qur'an ayah reference written inside parentheses and inserts the requested passage into the current Obsidian note.

Type a single ayah:

```text
The call of truth belongs to Allah (13:14).
```

Or a range:

```text
Allah addressed Musa directly (20:12-13), marking the beginning of his mission.
```

When the closing `)` is completed, the plugin retrieves the ayah text and inserts it using your chosen content and layout settings.

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

**English + Qur'an reference**

```markdown
And to Allah is the supplication of truth. (Qur’an 13:14 · Sahih International)
```

**Arabic + English + Qur'an reference**

```markdown
<div class="quran-quote-arabic" dir="rtl" lang="ar">لَهُۥ دَعْوَةُ ٱلْحَقِّ...</div>

To Him alone is the prayer of truth... (Qur’an 13:14 · Sahih International)
```

### Layout

**Quote block beneath the paragraph**

The original sentence remains in place and the generated passage is added below its paragraph:

```markdown
The call of truth belongs to Allah (13:14).

> To Him alone is the prayer of truth...
>
> (Qur’an 13:14 · Sahih International)
```

A setting controls whether the original typed `(13:14)` remains in the sentence. When it is disabled, the plugin removes the trigger cleanly without leaving a space before punctuation.

**Inline at the trigger position**

The parenthesized trigger is replaced directly:

```markdown
The call of truth belongs to Allah To Him alone is the prayer of truth... (Qur’an 13:14 · Sahih International).
```

Inline layout always replaces the typed trigger because the generated output already includes the formatted Qur'an reference.

## Settings

Open **Settings → Community plugins → Qur'an Autocomplete**.

Available settings:

- Enable or disable automatic insertion.
- Enable or disable the parenthesized-reference trigger.
- Content: English only, or Arabic followed by English.
- Layout: quote block beneath the paragraph, or inline replacement.
- Keep or remove the original typed reference when using quote-block layout.
- English translation: Sahih International, Pickthall, Yusuf Ali, or Muhammad Asad.
- Show or hide Arabic and English verse numbers.
- Show or hide the translation credit.
- Show or hide the English surah name.

## Manual command

The automatic trigger is optional. You can also:

1. Select `13:14` or `20:12-13` in a note.
2. Open the Command Palette.
3. Run **Qur'an Autocomplete: Insert Qur’an passage**.

Running the command without a selection opens a small reference-entry dialog. The ribbon book icon provides the same behaviour.

The command uses the same content, translation, citation, and layout settings. It replaces the selected reference with the generated output.

## Installation

### Manual installation from a release

Copy these release files into:

```text
<Vault>/.obsidian/plugins/quran-quote/
```

Required files:

- `main.js`
- `manifest.json`
- `styles.css`

Restart Obsidian, open **Settings → Community plugins**, and enable **Qur'an Autocomplete**.

The folder is named `quran-quote` because that is the stable plugin ID used by earlier versions.

### Development installation

```bash
git clone https://github.com/mohsinosman/quran-autocomplete-obsidian.git
cd quran-autocomplete-obsidian
npm install
npm run check
```

Copy `main.js`, `manifest.json`, and `styles.css` to the plugin folder in a test vault.

## Development commands

```bash
npm run build   # Compile TypeScript and update main.js
npm test        # Run parser, formatting, auto-pair, removal, and deduplication tests
npm run check   # Build and run the full test suite
npm run dev     # Watch TypeScript during development
```

## How automatic detection works

1. The plugin checks only text ending at the cursor when the cursor has just moved past `)`.
2. The text inside the nearest matching parentheses must be a valid reference such as `13:14` or `20:12-13`.
3. A keydown listener handles Obsidian's auto-closing-parenthesis behaviour.
4. The normal editor-change listener handles ordinary text insertion.
5. A per-editor registry blocks duplicate events while the API request is pending and remembers completed triggers while they remain unchanged.
6. Before inserting anything, the plugin confirms that the original trigger still exists in the same place. If the user edited it while the request was loading, the note is left untouched.

## Data and privacy

The plugin sends only the requested surah number, ayah range, Arabic edition, and translation edition to the Al Quran Cloud API. It does not send note content, filenames, or vault files.

An internet connection is currently required when inserting a passage.

Qur'an translations are interpretations of the Arabic text and are not replacements for it.

## Attribution

Qur'an text and translations are retrieved from the Al Quran Cloud API. This project is not affiliated with Obsidian or Al Quran Cloud.

## Licence

MIT. See [LICENSE](LICENSE).
