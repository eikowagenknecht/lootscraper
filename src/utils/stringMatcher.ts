const RESULT_MATCH_THRESHOLD = 0.85;

function getSequenceMatchRatio(a: string, b: string): number {
  let longer = a;
  let shorter = b;

  if (a.length < b.length) {
    longer = b;
    shorter = a;
  }

  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longerLength - editDistance) / longerLength;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }

  return costs[s2.length];
}

/**
 * TODO: This is currently a Claude-generated Levenshtein distance algorithm.
 * The results need to be checked against the Python difflib implementation.
 * If they are not close enough, it should be replaced with e.g. fuse.js.
 *
 * @param search
 * @param result
 * @returns
 */
export function getMatchScore(search: string, result: string): number {
  // Clean strings: keep only alphanumeric and spaces, condense spaces
  const cleanedSearch = search
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/ +/g, " ")
    .toLowerCase();

  const cleanedResult = result
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/ +/g, " ")
    .toLowerCase();

  let score = getSequenceMatchRatio(cleanedSearch, cleanedResult);

  // If it is no match, look for a partial match instead. Look at the
  // first x or last x words from the result because the result often
  // includes additional text (e.g. a prepended "Tom Clancy's ...") or
  // an appended " - Ultimate edition". x is the number of words the
  // search term has.
  if (score < RESULT_MATCH_THRESHOLD) {
    // Try partial matches if full match score is too low
    const wordsResult = cleanedResult.split(" ");
    const wordsSearch = cleanedSearch.split(" ");
    const searchLength = wordsSearch.length;

    // Try matching with first x words
    const startScore = getSequenceMatchRatio(
      cleanedSearch,
      wordsResult.slice(0, searchLength).join(" "),
    );

    // Try matching with last x words
    const endScore = getSequenceMatchRatio(
      cleanedSearch,
      wordsResult.slice(-searchLength).join(" "),
    );

    // This score needed some help, there is a small penalty for it, so for example
    // Cities: Skylines is preferred over
    // Cities: Skylines - One more DLC
    score = Math.max(score, startScore, endScore) - 0.01;
  }

  return Math.max(score, 0);
}
