// Sparse term-frequency vectors run entirely inside the workspace backend.
// This is lexical vector search, not model-generated semantic embeddings.
const stopWords = new Set('a an the is are was were be been to of for in on and or it this that what how who has have with about please'.split(' '));
function vector(text) {
  const counts = new Map();
  for (const term of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
    if (!stopWords.has(term)) counts.set(term, (counts.get(term) || 0) + 1);
  }
  const norm = Math.sqrt([...counts.values()].reduce((sum, count) => sum + count * count, 0));
  return { counts, norm };
}
export function searchSources(sources, question) {
  const query = vector(question);
  const matches = [];
  if (!query.norm) return matches;
  for (const source of sources) {
    if (source.reference.startsWith('T') && !source.text.startsWith('Processed file content:\n')) continue;
    // Bounded, overlapping excerpts retain the source reference and exact text.
    for (let start = 0; start < source.text.length; start += 600) {
      const excerpt = source.text.slice(start, start + 800);
      const candidate = vector(excerpt);
      let dot = 0;
      for (const [term, count] of query.counts) dot += count * (candidate.counts.get(term) || 0);
      const score = candidate.norm ? dot / (query.norm * candidate.norm) : 0;
      if (score > 0) matches.push({ reference: source.reference, label: source.label, excerpt, score });
      if (start + 800 >= source.text.length) break;
    }
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
