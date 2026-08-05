"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomaticTriggerRegistry = exports.formatQuranQuote = void 0;
exports.parseAyahReference = parseAyahReference;
exports.findParenthesizedReferenceAtCursor = findParenthesizedReferenceAtCursor;
exports.getTriggerRemovalRange = getTriggerRemovalRange;
exports.formatReference = formatReference;
exports.formatQuranOutput = formatQuranOutput;
const obsidian_1 = require("obsidian");
const API_BASE_URL = "https://api.alquran.cloud/v1";
const TRANSLATIONS = {
    "en.sahih": "Sahih International",
    "en.pickthall": "Marmaduke Pickthall",
    "en.yusufali": "Abdullah Yusuf Ali",
    "en.asad": "Muhammad Asad",
};
const DEFAULT_SETTINGS = {
    arabicEdition: "quran-uthmani",
    translationEdition: "en.sahih",
    contentMode: "arabic-english",
    outputStyle: "blockquote",
    keepTriggerReference: true,
    includeVerseNumbers: true,
    includeTranslationCredit: true,
    includeSurahName: false,
    autoInsertEnabled: true,
    detectParenthesizedReference: true,
};
function parseAyahReference(input) {
    const normalized = input
        .trim()
        .replace(/^qur(?:a|ā)n\s+/i, "")
        .replace(/^qur['’]an\s+/i, "");
    const match = normalized.match(/^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/);
    if (!match) {
        throw new Error("Use a reference such as 13:14 or 20:12-13.");
    }
    const surah = Number(match[1]);
    const startAyah = Number(match[2]);
    const endAyah = match[3] ? Number(match[3]) : startAyah;
    if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
        throw new Error("The surah number must be between 1 and 114.");
    }
    if (!Number.isInteger(startAyah) || startAyah < 1 || !Number.isInteger(endAyah) || endAyah < 1) {
        throw new Error("Ayah numbers must be positive whole numbers.");
    }
    if (endAyah < startAyah) {
        throw new Error("The ending ayah cannot come before the starting ayah.");
    }
    if (endAyah - startAyah + 1 > 50) {
        throw new Error("Insert at most 50 ayahs at a time.");
    }
    return { surah, startAyah, endAyah };
}
/**
 * Detect a completed parenthesized Qur'an reference immediately before the
 * cursor. It works when CodeMirror auto-created the closing parenthesis and
 * the user's final `)` key only moved the cursor over it.
 */
function findParenthesizedReferenceAtCursor(line, cursorCh) {
    if (cursorCh < 1 || cursorCh > line.length || line[cursorCh - 1] !== ")") {
        return null;
    }
    const textBeforeCursor = line.slice(0, cursorCh);
    const match = textBeforeCursor.match(/\(\s*((?:(?:quran|qurān|qur['’]an)\s+)?\d{1,3}\s*:\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)\s*\)$/i);
    if (!match || match.index === undefined) {
        return null;
    }
    try {
        parseAyahReference(match[1]);
    }
    catch (_a) {
        return null;
    }
    return {
        referenceText: match[1],
        matchedText: match[0],
        startCh: match.index,
        endCh: cursorCh,
    };
}
/**
 * Remove a parenthesized trigger without leaving a space before punctuation
 * or doubled whitespace around the removed text.
 */
function getTriggerRemovalRange(line, startCh, endCh) {
    let start = startCh;
    let end = endCh;
    const left = line.slice(0, startCh);
    const right = line.slice(endCh);
    const leftHasSpace = /\s$/.test(left);
    const rightHasSpace = /^\s/.test(right);
    const rightStartsPunctuation = /^[,.;:!?]/.test(right);
    if (leftHasSpace && (rightStartsPunctuation || right.length === 0 || rightHasSpace)) {
        start -= 1;
    }
    else if (!leftHasSpace && rightHasSpace) {
        end += 1;
    }
    return { startCh: Math.max(0, start), endCh: Math.min(line.length, end) };
}
function formatReference(reference) {
    return reference.startAyah === reference.endAyah
        ? `${reference.surah}:${reference.startAyah}`
        : `${reference.surah}:${reference.startAyah}–${reference.endAyah}`;
}
function toArabicIndic(value) {
    return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function escapeMarkdown(value) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/\*/g, "\\*")
        .replace(/_/g, "\\_")
        .replace(/\r?\n/g, " ")
        .trim();
}
function buildCitation(reference, surahName, settings) {
    const surahSuffix = settings.includeSurahName && surahName ? ` · ${surahName}` : "";
    const translationSuffix = settings.includeTranslationCredit
        ? ` · ${TRANSLATIONS[settings.translationEdition]}`
        : "";
    return `Qur’an ${formatReference(reference)}${surahSuffix}${translationSuffix}`;
}
function formatEnglishAyahs(ayahs, settings) {
    const showEnglishVerseNumber = settings.includeVerseNumbers && ayahs.length > 1;
    return ayahs.map((ayah) => {
        const number = showEnglishVerseNumber ? `**${ayah.number}.** ` : "";
        return `${number}${escapeMarkdown(ayah.english)}`;
    });
}
function formatArabicAyahs(ayahs, settings) {
    return ayahs.map((ayah) => {
        const number = settings.includeVerseNumbers
            ? ` <span class="quran-quote-verse-number">﴿${toArabicIndic(ayah.number)}﴾</span>`
            : "";
        return `${escapeHtml(ayah.arabic)}${number}`;
    });
}
function formatQuranOutput(reference, ayahs, surahName, settings) {
    const citation = `(${buildCitation(reference, surahName, settings)})`;
    const english = formatEnglishAyahs(ayahs, settings);
    if (settings.outputStyle === "inline") {
        const englishInline = english.join(" ");
        if (settings.contentMode === "english-only") {
            return `${englishInline} ${citation}`;
        }
        const arabicInline = formatArabicAyahs(ayahs, settings).join(" ");
        return `<span class="quran-quote-arabic-inline" dir="rtl" lang="ar">${arabicInline}</span> — ${englishInline} ${citation}`;
    }
    const lines = [];
    if (settings.contentMode === "arabic-english") {
        const arabic = formatArabicAyahs(ayahs, settings);
        ayahs.forEach((_ayah, index) => {
            lines.push(`> <div class="quran-quote-arabic" dir="rtl" lang="ar">${arabic[index]}</div>`);
            lines.push(">");
            lines.push(`> ${english[index]}`);
            if (index < ayahs.length - 1) {
                lines.push(">");
            }
        });
    }
    else {
        english.forEach((translation, index) => {
            lines.push(`> ${translation}`);
            if (index < english.length - 1) {
                lines.push(">");
            }
        });
    }
    lines.push(">");
    lines.push(`> ${citation}`);
    return lines.join("\n");
}
/** Backwards-compatible export retained for older tests and integrations. */
exports.formatQuranQuote = formatQuranOutput;
/**
 * One registry is kept per Editor. It blocks duplicate key/editor events while
 * a request is pending and remembers completed source triggers until the user
 * actually edits or removes them.
 */
class AutomaticTriggerRegistry {
    constructor() {
        this.pending = new Set();
        this.handled = new Map();
    }
    begin(key) {
        if (this.pending.has(key) || this.handled.has(key)) {
            return false;
        }
        this.pending.add(key);
        return true;
    }
    complete(key, fingerprint) {
        this.pending.delete(key);
        this.handled.set(key, fingerprint);
    }
    cancel(key) {
        this.pending.delete(key);
    }
    prune(readRange) {
        for (const [key, fingerprint] of this.handled.entries()) {
            if (readRange(fingerprint) !== fingerprint.matchedText) {
                this.handled.delete(key);
            }
        }
    }
}
exports.AutomaticTriggerRegistry = AutomaticTriggerRegistry;
class QuranReferenceModal extends obsidian_1.Modal {
    constructor(app, onSubmitReference) {
        super(app);
        this.onSubmitReference = onSubmitReference;
    }
    onOpen() {
        this.contentEl.empty();
        this.contentEl.createEl("h2", { text: "Insert Qur’an passage" });
        let reference = "";
        const setting = new obsidian_1.Setting(this.contentEl)
            .setName("Ayah reference")
            .setDesc("Examples: 13:14 or 20:12-13")
            .addText((text) => {
            text.setPlaceholder("20:12-13");
            text.onChange((value) => {
                reference = value;
            });
            text.inputEl.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                }
            });
            window.setTimeout(() => text.inputEl.focus(), 0);
        });
        const submit = async () => {
            const value = reference.trim();
            if (!value) {
                new obsidian_1.Notice("Enter an ayah reference.");
                return;
            }
            this.close();
            await this.onSubmitReference(value);
        };
        setting.addButton((button) => {
            button.setButtonText("Insert");
            button.setCta();
            button.onClick(() => void submit());
        });
    }
    onClose() {
        this.contentEl.empty();
    }
}
class QuranQuotePlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.settings = DEFAULT_SETTINGS;
        this.autoInsertTimers = new Map();
        this.autoInsertInProgress = new WeakSet();
        this.triggerRegistries = new WeakMap();
        this.suppressAutoInsertUntil = new WeakMap();
    }
    async onload() {
        await this.loadSettings();
        this.addCommand({
            id: "insert-quran-quote",
            name: "Insert Qur’an passage",
            editorCallback: (editor) => {
                const selectedReference = editor.getSelection().trim();
                if (selectedReference) {
                    void this.insertFromCommand(editor, selectedReference);
                    return;
                }
                new QuranReferenceModal(this.app, async (reference) => {
                    await this.insertFromCommand(editor, reference);
                }).open();
            },
        });
        this.addRibbonIcon("book-open", "Insert Qur’an passage", () => {
            const view = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
            if (!view) {
                new obsidian_1.Notice("Open a Markdown note before inserting an ayah.");
                return;
            }
            const selectedReference = view.editor.getSelection().trim();
            if (selectedReference) {
                void this.insertFromCommand(view.editor, selectedReference);
                return;
            }
            new QuranReferenceModal(this.app, async (reference) => {
                await this.insertFromCommand(view.editor, reference);
            }).open();
        });
        this.registerEvent(this.app.workspace.on("editor-change", (editor) => {
            this.queueAutoInsert(editor, 100);
        }));
        // With auto-closing brackets, pressing `)` can move the cursor over an
        // existing closing parenthesis without changing the document. Listening
        // for the key ensures that case still triggers. The registry below makes
        // this safe even when editor-change fires as well.
        this.registerDomEvent(document, "keydown", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) ||
                !target.closest(".cm-editor") ||
                event.key !== ")" ||
                event.defaultPrevented ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                !this.settings.autoInsertEnabled) {
                return;
            }
            window.setTimeout(() => {
                const view = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
                if (view) {
                    this.queueAutoInsert(view.editor, 0);
                }
            }, 0);
        });
        this.addSettingTab(new QuranQuoteSettingTab(this.app, this));
    }
    onunload() {
        this.autoInsertTimers.forEach((timer) => window.clearTimeout(timer));
        this.autoInsertTimers.clear();
    }
    registryFor(editor) {
        let registry = this.triggerRegistries.get(editor);
        if (!registry) {
            registry = new AutomaticTriggerRegistry();
            this.triggerRegistries.set(editor, registry);
        }
        return registry;
    }
    queueAutoInsert(editor, delay) {
        var _a;
        if (!this.settings.autoInsertEnabled || this.autoInsertInProgress.has(editor)) {
            return;
        }
        if (((_a = this.suppressAutoInsertUntil.get(editor)) !== null && _a !== void 0 ? _a : 0) > Date.now()) {
            return;
        }
        const registry = this.registryFor(editor);
        registry.prune((fingerprint) => {
            if (fingerprint.line >= editor.lineCount()) {
                return "";
            }
            return editor.getRange({ line: fingerprint.line, ch: fingerprint.startCh }, { line: fingerprint.line, ch: fingerprint.endCh });
        });
        const existingTimer = this.autoInsertTimers.get(editor);
        if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
        }
        const timer = window.setTimeout(() => {
            this.autoInsertTimers.delete(editor);
            void this.maybeAutoInsert(editor);
        }, delay);
        this.autoInsertTimers.set(editor, timer);
    }
    async maybeAutoInsert(editor) {
        var _a;
        if (!this.settings.autoInsertEnabled ||
            !this.settings.detectParenthesizedReference ||
            this.autoInsertInProgress.has(editor) ||
            ((_a = this.suppressAutoInsertUntil.get(editor)) !== null && _a !== void 0 ? _a : 0) > Date.now()) {
            return;
        }
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);
        const match = findParenthesizedReferenceAtCursor(currentLine, cursor.ch);
        if (!match) {
            return;
        }
        const key = `${cursor.line}:${match.startCh}:${match.endCh}:${match.matchedText}`;
        const registry = this.registryFor(editor);
        if (!registry.begin(key)) {
            return;
        }
        const fingerprint = {
            line: cursor.line,
            startCh: match.startCh,
            endCh: match.endCh,
            matchedText: match.matchedText,
        };
        const inserted = await this.performAutomaticInsertion(editor, match, fingerprint);
        if (inserted && this.settings.outputStyle === "blockquote" && this.settings.keepTriggerReference) {
            registry.complete(key, fingerprint);
        }
        else {
            // Inline output and removed triggers no longer exist at the source range.
            registry.cancel(key);
        }
    }
    async performAutomaticInsertion(editor, match, fingerprint) {
        this.autoInsertInProgress.add(editor);
        try {
            const reference = parseAyahReference(match.referenceText);
            const { ayahs, surahName } = await this.fetchAyahs(reference);
            const output = formatQuranOutput(reference, ayahs, surahName, this.settings);
            const from = { line: fingerprint.line, ch: fingerprint.startCh };
            const to = { line: fingerprint.line, ch: fingerprint.endCh };
            // The request is asynchronous. Do not touch the note if the source
            // trigger changed while the passage was loading.
            if (editor.getRange(from, to) !== fingerprint.matchedText) {
                return false;
            }
            this.suppressAutoInsertUntil.set(editor, Date.now() + 500);
            if (this.settings.outputStyle === "inline") {
                editor.replaceRange(output, from, to, "quran-quote-auto");
                return true;
            }
            const paragraphEndLine = this.findParagraphEndLine(editor, fingerprint.line);
            const paragraphEndCh = editor.getLine(paragraphEndLine).length;
            editor.replaceRange(`\n\n${output}`, { line: paragraphEndLine, ch: paragraphEndCh }, undefined, "quran-quote-auto");
            if (!this.settings.keepTriggerReference) {
                const currentSourceLine = editor.getLine(fingerprint.line);
                const removal = getTriggerRemovalRange(currentSourceLine, fingerprint.startCh, fingerprint.endCh);
                editor.replaceRange("", { line: fingerprint.line, ch: removal.startCh }, { line: fingerprint.line, ch: removal.endCh }, "quran-quote-auto");
            }
            return true;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "The Qur’an passage could not be inserted.";
            new obsidian_1.Notice(message, 7000);
            return false;
        }
        finally {
            this.autoInsertInProgress.delete(editor);
        }
    }
    findParagraphEndLine(editor, startLine) {
        let endLine = startLine;
        while (endLine + 1 < editor.lineCount()) {
            const nextLine = editor.getLine(endLine + 1);
            if (nextLine.trim() === "") {
                break;
            }
            endLine += 1;
        }
        return endLine;
    }
    async insertFromCommand(editor, input) {
        try {
            const reference = parseAyahReference(input);
            const { ayahs, surahName } = await this.fetchAyahs(reference);
            const output = formatQuranOutput(reference, ayahs, surahName, this.settings);
            editor.replaceSelection(output);
            new obsidian_1.Notice(`Inserted Qur’an ${formatReference(reference)}.`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "The Qur’an passage could not be inserted.";
            new obsidian_1.Notice(message, 7000);
        }
    }
    async fetchAyahs(reference) {
        const [arabicSurah, translatedSurah] = await Promise.all([
            this.fetchEdition(reference, this.settings.arabicEdition),
            this.fetchEdition(reference, this.settings.translationEdition),
        ]);
        const expectedCount = reference.endAyah - reference.startAyah + 1;
        if (arabicSurah.ayahs.length !== expectedCount || translatedSurah.ayahs.length !== expectedCount) {
            throw new Error("That ayah range is not valid for the selected surah.");
        }
        const translations = new Map(translatedSurah.ayahs.map((ayah) => [ayah.numberInSurah, ayah.text]));
        const ayahs = arabicSurah.ayahs.map((ayah) => {
            const english = translations.get(ayah.numberInSurah);
            if (!english) {
                throw new Error(`The English translation for ayah ${ayah.numberInSurah} was not returned.`);
            }
            return {
                number: ayah.numberInSurah,
                arabic: ayah.text,
                english,
            };
        });
        return { ayahs, surahName: arabicSurah.englishName };
    }
    async fetchEdition(reference, edition) {
        const offset = reference.startAyah - 1;
        const limit = reference.endAyah - reference.startAyah + 1;
        const url = `${API_BASE_URL}/surah/${reference.surah}/${encodeURIComponent(edition)}?offset=${offset}&limit=${limit}`;
        let response;
        try {
            response = await (0, obsidian_1.requestUrl)({
                url,
                method: "GET",
                headers: {
                    Accept: "application/json",
                },
            });
        }
        catch (_a) {
            throw new Error("Could not reach the Qur’an text service. Check your internet connection and try again.");
        }
        const payload = response.json;
        if (response.status < 200 || response.status >= 300 || payload.code !== 200 || !payload.data) {
            throw new Error("The Qur’an text service did not return that passage.");
        }
        return payload.data;
    }
    async loadSettings() {
        const saved = (await this.loadData());
        this.settings = Object.assign({}, DEFAULT_SETTINGS, saved !== null && saved !== void 0 ? saved : {});
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}
exports.default = QuranQuotePlugin;
class QuranQuoteSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Qur’an Autocomplete settings" });
        new obsidian_1.Setting(containerEl)
            .setName("Automatic insertion")
            .setDesc("Detect a completed Qur’an reference inside parentheses while you type.")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.autoInsertEnabled);
            toggle.onChange(async (value) => {
                this.plugin.settings.autoInsertEnabled = value;
                await this.plugin.saveSettings();
                this.display();
            });
        });
        if (this.plugin.settings.autoInsertEnabled) {
            new obsidian_1.Setting(containerEl)
                .setName("Parenthesized reference trigger")
                .setDesc("Type (13:14) or (20:12-13) anywhere in a sentence or paragraph. Auto-closing parentheses are supported.")
                .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.detectParenthesizedReference);
                toggle.onChange(async (value) => {
                    this.plugin.settings.detectParenthesizedReference = value;
                    await this.plugin.saveSettings();
                });
            });
        }
        new obsidian_1.Setting(containerEl)
            .setName("Content")
            .setDesc("Choose whether the generated passage contains English only or Arabic followed by English.")
            .addDropdown((dropdown) => {
            dropdown.addOption("english-only", "English + Qur’an reference");
            dropdown.addOption("arabic-english", "Arabic + English + Qur’an reference");
            dropdown.setValue(this.plugin.settings.contentMode);
            dropdown.onChange(async (value) => {
                this.plugin.settings.contentMode = value;
                await this.plugin.saveSettings();
            });
        });
        new obsidian_1.Setting(containerEl)
            .setName("Layout")
            .setDesc("Insert the passage as a Markdown blockquote beneath the paragraph or replace the trigger inline.")
            .addDropdown((dropdown) => {
            dropdown.addOption("blockquote", "Quote block beneath paragraph");
            dropdown.addOption("inline", "Inline at the trigger position");
            dropdown.setValue(this.plugin.settings.outputStyle);
            dropdown.onChange(async (value) => {
                this.plugin.settings.outputStyle = value;
                await this.plugin.saveSettings();
                this.display();
            });
        });
        if (this.plugin.settings.outputStyle === "blockquote") {
            new obsidian_1.Setting(containerEl)
                .setName("Keep typed reference")
                .setDesc("Keep the original (13:14) in the sentence. Turn this off to remove it after adding the quote block.")
                .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.keepTriggerReference);
                toggle.onChange(async (value) => {
                    this.plugin.settings.keepTriggerReference = value;
                    await this.plugin.saveSettings();
                });
            });
        }
        else {
            new obsidian_1.Setting(containerEl)
                .setName("Inline trigger replacement")
                .setDesc("Inline layout replaces the typed parenthesized trigger with the generated passage and its formatted Qur’an reference.");
        }
        new obsidian_1.Setting(containerEl)
            .setName("English translation")
            .setDesc("Choose the English translation used in the generated passage.")
            .addDropdown((dropdown) => {
            Object.entries(TRANSLATIONS).forEach(([id, label]) => dropdown.addOption(id, label));
            dropdown.setValue(this.plugin.settings.translationEdition);
            dropdown.onChange(async (value) => {
                this.plugin.settings.translationEdition = value;
                await this.plugin.saveSettings();
            });
        });
        new obsidian_1.Setting(containerEl)
            .setName("Show verse numbers")
            .setDesc("Append Arabic verse markers and number English verses in a range.")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.includeVerseNumbers);
            toggle.onChange(async (value) => {
                this.plugin.settings.includeVerseNumbers = value;
                await this.plugin.saveSettings();
            });
        });
        new obsidian_1.Setting(containerEl)
            .setName("Show translation credit")
            .setDesc("Add the selected translator to the formatted Qur’an reference.")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.includeTranslationCredit);
            toggle.onChange(async (value) => {
                this.plugin.settings.includeTranslationCredit = value;
                await this.plugin.saveSettings();
            });
        });
        new obsidian_1.Setting(containerEl)
            .setName("Show surah name")
            .setDesc("Add the English surah name to the formatted Qur’an reference.")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.includeSurahName);
            toggle.onChange(async (value) => {
                this.plugin.settings.includeSurahName = value;
                await this.plugin.saveSettings();
            });
        });
    }
}
