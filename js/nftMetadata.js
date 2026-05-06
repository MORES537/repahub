/**
 * Load ERC-721-style metadata JSON from IPFS via the configured Pinata gateway.
 * @param {string} cid IPFS CID or `ipfs://...` URI
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchMetadata(cid) {
  if (!cid || typeof cid !== "string") {
    throw new Error("fetchMetadata: invalid cid");
  }
  const cleaned = cid.replace(/^ipfs:\/\//i, "").trim();

  // Try Pinata signed URL first (works for private files on dedicated gateway)
  if (typeof globalThis.pinataSignedUrl === "function") {
    try {
      const signed = await globalThis.pinataSignedUrl(cleaned);
      if (signed) {
        const res = await fetch(signed, { signal: AbortSignal.timeout(12000) });
        if (res.ok) return await res.json();
      }
    } catch (_) {}
  }

  // Fallback: public gateways (work if file has propagated to public IPFS)
  const fallbacks = [
    { url: `https://gateway.pinata.cloud/ipfs/${cleaned}`, timeout: 15000 },
    { url: `https://ipfs.io/ipfs/${cleaned}`, timeout: 15000 },
  ];

  let lastError;
  for (const { url, timeout } of fallbacks) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (res.ok) return await res.json();
      lastError = new Error(`${res.status} from ${url}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`fetchMetadata: all gateways failed for ${cleaned} — ${lastError?.message || ""}`);
}

globalThis.fetchMetadata = fetchMetadata;
export { fetchMetadata };
