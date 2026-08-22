/** The signer that owns an output. Slot position says nothing, a full spend leaves no change. */
export function senderOf(
  signers: readonly string[],
  ownerTags: readonly (string | undefined)[],
): string | undefined {
  const owned = new Set(ownerTags.filter((tag): tag is string => tag !== undefined));
  return signers.find((signer) => owned.has(signer));
}
