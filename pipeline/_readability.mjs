// Reading level for explanations (docs/EXPLANATIONS-PLAN.md §5): the Flesch–Kincaid grade, with one fixed formula and
// syllable counter for every text, so grades compare. Used by step 12 (the Plain limit), step 15 (the report) and the
// explanation assembly script.
//   grade = 0.39 × words per sentence + 11.8 × syllables per word − 15.59
// Syllables are estimated from the spelling (vowel groups, less a silent final e or -ed/-es); no dictionary is used.

/** Syllables in one word, estimated from its spelling. */
export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return /\d/.test(word) ? 1 : 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouytd]ed|[^laeiouy]e)$/, m => m[0]).replace(/^y/, '');
  return Math.max(1, (w.match(/[aeiouy]{1,2}/g) ?? []).length);
}

/** Words in a text: runs between spaces that contain a letter or digit (hyphenated words count once). */
export const words = text => text.split(/\s+/).filter(t => /[\p{L}\p{N}]/u.test(t));

/** Sentences in plain text: split after . ! or ? followed by a space and a capital letter or digit. */
export const sentencesOf = text => text.trim().split(/(?<=[.!?])\s+(?=[\p{Lu}\p{N}"“(])/u).filter(s => /[\p{L}\p{N}]/u.test(s));

/** The Flesch–Kincaid grade of a text, given as a string or as its sentences; rounded to one decimal. */
export function grade(text) {
  const list = Array.isArray(text) ? text : sentencesOf(text);
  const w = list.flatMap(words);
  if (!list.length || !w.length) return null;
  const syl = w.reduce((n, x) => n + syllables(x), 0);
  return Math.round((0.39 * (w.length / list.length) + 11.8 * (syl / w.length) - 15.59) * 10) / 10;
}
