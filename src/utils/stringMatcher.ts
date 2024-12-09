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

    // Use best score with a small penalty
    score = Math.max(score, startScore, endScore) - 0.01;
  }

  return score;
}
