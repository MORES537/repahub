/**
 * Load ERC-721-style metadata JSON from IPFS via the configured Pinata gateway.
 * @param {string} cid IPFS CID or `ipfs://...` URI
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchMetadata(cid) {
  if (!cid || typeof cid !== "string") {
    throw new Error("fetchMetadata: invalid cid");
  }
  const base =
    (typeof APP_CONFIG !== "undefined" && APP_CONFIG.pinataGateway) || "";
  if (!base) {
    throw new Error("fetchMetadata: VITE_PINATA_GATEWAY is not set");
  }
  const gateway = base.replace(/\/+$/, "");
  const cleaned = cid.replace(/^ipfs:\/\//i, "").trim();
  const url = `${gateway}/ipfs/${cleaned}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchMetadata: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

globalThis.fetchMetadata = fetchMetadata;
export { fetchMetadata };
