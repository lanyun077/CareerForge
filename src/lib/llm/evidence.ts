/** 仅核验引用是否出现在允许的原文中，不判断结论是否合理。 */
export function findEvidence(evidence: string, sources: { id: string; text: string }[]): string | undefined {
  const quotes = [...evidence.matchAll(/「([^」]+)」/g)].map((match) => match[1]);
  const parts = quotes.length ? quotes : [evidence];
  const normalize = (text: string) => text.replace(/\s+/g, '');
  if (parts.some((part) => normalize(part).length < 2)) return undefined;
  return sources.find((source) => parts.every((part) => normalize(source.text).includes(normalize(part))))?.id;
}
