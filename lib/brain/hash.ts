import { createHash } from "node:crypto";

/**
 * Normalize text before hashing so cosmetic differences (extra spaces, case,
 * trailing punctuation) don't produce different hashes for what is effectively
 * the same article. Drops:
 *  - lowercase
 *  - collapse runs of whitespace to a single space
 *  - strip leading/trailing whitespace
 *  - strip a leading "by <author> — " style byline if present
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^by [^—–-]{1,80}[—–-]\s*/i, "")
    .trim();
}

/** Stable SHA-256 of normalized text. Used to dedupe ingests across feeds. */
export function contentHash(rawText: string): string {
  return createHash("sha256").update(normalize(rawText)).digest("hex");
}
