/**
 * Simple paragraph-aware chunker. Targets ~700 tokens per chunk (≈ 2800 chars),
 * with 1-paragraph overlap to preserve context across boundaries.
 *
 * Heuristic char-based — good enough for retrieval. If you need true token
 * counts, swap in @anthropic-ai/tokenizer or tiktoken.
 */
const TARGET_CHARS = 2800;
const OVERLAP_PARAGRAPHS = 1;

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [normalized];

  const chunks: string[] = [];
  let buf: string[] = [];
  let bufLen = 0;

  for (const p of paragraphs) {
    if (bufLen + p.length > TARGET_CHARS && buf.length > 0) {
      chunks.push(buf.join("\n\n"));
      buf = buf.slice(-OVERLAP_PARAGRAPHS);
      bufLen = buf.reduce((n, s) => n + s.length, 0);
    }
    buf.push(p);
    bufLen += p.length;
  }
  if (buf.length > 0) chunks.push(buf.join("\n\n"));

  return chunks;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
