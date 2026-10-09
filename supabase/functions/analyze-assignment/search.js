// Sparse term-frequency vectors run entirely inside the workspace backend.
// This is lexical vector search, not model-generated semantic embeddings.
const stopWords = new Set('a an the is are was were be been to of for in on and or it this that what how who has have with about please'.split(' '));

// Extract explicit reports conservatively; never turn a request into completed work.
function reportedUpdates(sources) {
  const reports = [];
  const seen = new Set();
  for (const source of [...sources].reverse()) {
    for (const sentence of source.text.split(/(?<=[.!?])\s+|\n+/u)) {
      const text = sentence.trim();
      if (!text || text.length > 400 || /\?|^(please|can|could|would|should|must|include|add|create|implement|finish|complete|ensure|remember)\b/i.test(text)) continue;
      if (/\b(should|must|will|would|could|might|may|needs? to|plan to|want to|if)\b/i.test(text)) continue;
      if (!/\b(is|are|was|were|has|have|am|i|we)\b.*\b(done|complete[ds]?|finished|drafted|ready|working|started|blocked|waiting|pending|remaining|left|not yet|in progress)\b|\b(completed|finished|drafted|implemented|fixed|tested|deployed)\b/i.test(text)) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const author = source.label.split(' · ')[1] || 'A team member';
      reports.push({ author, text });
      if (reports.length === 3) return reports;
    }
  }
  return reports;
}

export function progressOverview(context, question) {
  if (!/\b(progress|status|updates?)\b|\bhow\b.*\b(going|coming|far)\b|\bwhat\b.*\b(done|completed|remaining)\b/i.test(question)) return null;
  const assignment = context.assignment;
  if (!assignment) return null;
  const feedback = context.sources.filter(source => source.reference.startsWith('F'));
  const reports = reportedUpdates(feedback);
  const groups = new Map();
  for (const { author, text } of reports) {
    if (!groups.has(author)) groups.set(author, []);
    groups.get(author).push(`“${text}”`);
  }
  const groupedReports = [...groups].map(([author, updates]) => `${author} reported: ${updates.join(' ')}`).join('\n\n');
  const parts = reports.length
    ? [groupedReports, `The assignment is marked ${assignment.status.toLowerCase()}. These updates do not confirm completion of every requirement.`]
    : [`${assignment.title} is marked ${assignment.status.toLowerCase()}, but ${feedback.length ? 'the saved discussion does not clearly establish what has been completed or what remains' : 'there are no saved feedback updates yet'}. The brief describes requested work, not evidence of completion.`];
  if (assignment.due) parts.push(`The recorded due date is ${assignment.due}.`);
  if (feedback.length && !reports.length) parts.push('The latest messages are shown below for context.');
  return {
    answer: parts.join('\n\n'),
    matches: reports.length ? [] : feedback.slice(-3).reverse().map(source => ({ ...source, excerpt: source.text.slice(0, 800) + (source.text.length > 800 ? '…' : '') })),
    suggested_feedback: null,
  };
}
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
