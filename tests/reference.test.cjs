const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "obsidian") {
    return path.join(__dirname, "../test-stubs/obsidian/index.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  AutomaticTriggerRegistry,
  applyInlineEmphasis,
  buildBlockquoteParagraphReplacement,
  parseAyahReference,
  formatReference,
  formatQuranOutput,
  findParenthesizedReferenceAtCursor,
  getTriggerRemovalRange,
} = require("../main.js");

const baseSettings = {
  arabicEdition: "quran-uthmani",
  translationEdition: "en.sahih",
  contentMode: "arabic-english",
  outputStyle: "blockquote",
  inlineEmphasis: "italic",
  keepTriggerReference: true,
  includeVerseNumbers: true,
  includeTranslationCredit: true,
  includeSurahName: true,
  autoInsertEnabled: true,
  detectParenthesizedReference: true,
};

assert.deepEqual(parseAyahReference("20:12-13"), { surah: 20, startAyah: 12, endAyah: 13 });
assert.deepEqual(parseAyahReference(" 13 : 14 "), { surah: 13, startAyah: 14, endAyah: 14 });
assert.deepEqual(parseAyahReference("Qur'an 2:255"), { surah: 2, startAyah: 255, endAyah: 255 });
assert.deepEqual(parseAyahReference("Quran 36:1–3"), { surah: 36, startAyah: 1, endAyah: 3 });
assert.equal(formatReference({ surah: 20, startAyah: 12, endAyah: 13 }), "20:12–13");
assert.equal(formatReference({ surah: 13, startAyah: 14, endAyah: 14 }), "13:14");

assert.deepEqual(findParenthesizedReferenceAtCursor("(20:12-13)", 10), {
  referenceText: "20:12-13",
  matchedText: "(20:12-13)",
  startCh: 0,
  endCh: 10,
});

// Auto-pair state: the reference is complete but the cursor is still before
// the pre-created closing bracket, so it must not run yet.
assert.equal(findParenthesizedReferenceAtCursor("(13:14)", 6), null);
assert.deepEqual(findParenthesizedReferenceAtCursor("(13:14)", 7), {
  referenceText: "13:14",
  matchedText: "(13:14)",
  startCh: 0,
  endCh: 7,
});

const sentence = "Allah says (Qur’an 13:14), which is important.";
const sentenceCursor = "Allah says (Qur’an 13:14)".length;
assert.deepEqual(findParenthesizedReferenceAtCursor(sentence, sentenceCursor), {
  referenceText: "Qur’an 13:14",
  matchedText: "(Qur’an 13:14)",
  startCh: 11,
  endCh: sentenceCursor,
});

assert.equal(findParenthesizedReferenceAtCursor("13:14", 5), null);
assert.equal(findParenthesizedReferenceAtCursor("Invalid (115:1)", 15), null);
assert.equal(findParenthesizedReferenceAtCursor("Incomplete (13:14", 17), null);

assert.deepEqual(getTriggerRemovalRange("This matters (13:14).", 13, 20), {
  startCh: 12,
  endCh: 20,
});
assert.deepEqual(getTriggerRemovalRange("See (13:14) for more", 4, 11), {
  startCh: 3,
  endCh: 11,
});
assert.deepEqual(getTriggerRemovalRange("(13:14) starts here", 0, 7), {
  startCh: 0,
  endCh: 8,
});

assert.throws(() => parseAyahReference("0:1"), /between 1 and 114/);
assert.throws(() => parseAyahReference("20:13-12"), /cannot come before/);
assert.throws(() => parseAyahReference("not a reference"), /Use a reference/);
assert.throws(() => parseAyahReference("2:1-60"), /at most 50/);

const ayahs = [
  { number: 12, arabic: "ARABIC ONE", english: "English one" },
  { number: 13, arabic: "ARABIC TWO", english: "English two" },
];
const reference = { surah: 20, startAyah: 12, endAyah: 13 };

const arabicEnglishBlockquote = formatQuranOutput(
  reference,
  ayahs,
  "Taa-Haa",
  baseSettings,
);
assert.match(arabicEnglishBlockquote, /^> <div class="quran-quote-arabic"/);
assert.match(arabicEnglishBlockquote, /﴿١٢﴾/);
assert.match(arabicEnglishBlockquote, /> \*\*12\.\*\* English one/);
assert.match(
  arabicEnglishBlockquote,
  /> \(Qur’an 20:12–13 · Taa-Haa · Sahih International\)$/,
);

const englishBlockquote = formatQuranOutput(reference, ayahs, "Taa-Haa", {
  ...baseSettings,
  contentMode: "english-only",
});
assert.doesNotMatch(englishBlockquote, /quran-quote-arabic/);
assert.match(englishBlockquote, /^> \*\*12\.\*\* English one/);
assert.match(englishBlockquote, /> \(Qur’an 20:12–13/);

const englishInline = formatQuranOutput(reference, ayahs, "Taa-Haa", {
  ...baseSettings,
  contentMode: "english-only",
  outputStyle: "inline",
});
assert.equal(
  englishInline,
  '<em class="quran-quote-inline-emphasis">12. English one 13. English two (Qur’an 20:12–13 · Taa-Haa · Sahih International)</em>',
);

const arabicEnglishInline = formatQuranOutput(reference, ayahs, "Taa-Haa", {
  ...baseSettings,
  outputStyle: "inline",
});
assert.match(arabicEnglishInline, /^<em class="quran-quote-inline-emphasis"><span class="quran-quote-arabic-inline"/);
assert.match(arabicEnglishInline, /ARABIC ONE/);
assert.match(arabicEnglishInline, /— 12\. English one/);
assert.match(arabicEnglishInline, /\(Qur’an 20:12–13 · Taa-Haa · Sahih International\)<\/em>$/);

assert.equal(applyInlineEmphasis("passage", "none"), "passage");
assert.equal(applyInlineEmphasis("passage", "italic"), '<em class="quran-quote-inline-emphasis">passage</em>');
assert.equal(applyInlineEmphasis("passage", "bold"), '<strong class="quran-quote-inline-emphasis">passage</strong>');

const atomicReplacement = buildBlockquoteParagraphReplacement(
  ["This matters (13:14)."], 0, 13, 20, "> translated passage", false,
);
assert.equal(atomicReplacement, "This matters.\n\n> translated passage");
assert.equal(
  buildBlockquoteParagraphReplacement(
    ["First line", "This matters (13:14)."], 1, 13, 20, "> translated passage", true,
  ),
  "First line\nThis matters (13:14).\n\n> translated passage",
);

const registry = new AutomaticTriggerRegistry();
const fingerprint = { line: 0, startCh: 5, endCh: 12, matchedText: "(13:14)" };
assert.equal(registry.begin("same-trigger"), true);
assert.equal(registry.begin("same-trigger"), false, "a pending trigger must not start twice");
registry.complete("same-trigger", fingerprint);
assert.equal(registry.begin("same-trigger"), false, "a completed unchanged trigger must not repeat");
registry.prune(() => "changed");
assert.equal(registry.begin("same-trigger"), true, "editing the source trigger should allow it again");

console.log("All Qur'an Autocomplete tests passed.");
