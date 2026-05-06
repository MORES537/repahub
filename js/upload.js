// Pinata v3 API — upload to public IPFS network so files are accessible via any gateway
const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";

async function pinataUpload(file) {
  const jwt = import.meta.env.VITE_PINATA_JWT;
  if (!jwt) throw new Error("VITE_PINATA_JWT not configured");
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("network", "public"); // store on public IPFS network
  const res = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata upload failed (${res.status}): ${text}`);
  }
  const { data } = await res.json();
  console.log("[pinataUpload] uploaded:", data.name, "cid:", data.cid, "network:", data.network);
  return data.cid;
}

async function pinataUploadFile(file) {
  return pinataUpload(file);
}

async function pinataUploadJSON(obj) {
  const jsonFile = new File(
    [JSON.stringify(obj)],
    "metadata.json",
    { type: "application/json" }
  );
  return pinataUpload(jsonFile);
}

/**
 * Generate a Pinata signed URL for accessing a private file via the dedicated gateway.
 * @param {string} cid IPFS CID
 * @returns {Promise<string|null>}
 */
async function pinataSignedUrl(cid) {
  const jwt = import.meta.env.VITE_PINATA_JWT;
  const gw = (typeof APP_CONFIG !== "undefined" && APP_CONFIG.pinataGateway || "").replace(/\/+$/, "");
  if (!jwt || !gw) return null;
  try {
    const res = await fetch("https://api.pinata.cloud/v3/files/sign", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `${gw}/ipfs/${cid}`,
        date: Math.floor(Date.now() / 1000),
        expires: 3600,
        method: "GET"
      })
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("[pinataSignedUrl] sign API failed:", res.status, t);
      return null;
    }
    const data = await res.json();
    console.log("[pinataSignedUrl] full response:", JSON.stringify(data).slice(0, 300));
    const signed = data.data || null;
    return signed;
  } catch(e) {
    console.warn("[pinataSignedUrl] error:", e?.message);
    return null;
  }
}

async function computeAudioHash(file) {
  const buffer = await file.arrayBuffer();
  const ethersObj = globalThis.ethers || window.ethers;
  if (!ethersObj) throw new Error("ethers.js not loaded");
  return ethersObj.keccak256(new Uint8Array(buffer));
}

/**
 * Full upload flow: Pinata + approve RC + uploadTrack on-chain.
 * @param {string}    title
 * @param {string}    genre
 * @param {number}    priceRC      full RC units (e.g. 20000)
 * @param {File}      audioFile
 * @param {File|null} coverFile    optional cover image
 * @param {string}    [artistName] artist display name (falls back to wallet address)
 */
async function performUpload(title, genre, priceRC, audioFile, coverFile, artistName) {
  const rcDecimals = APP_CONFIG.rcTokenDecimals || 9;
  const priceInTinyRC = BigInt(Math.round(priceRC)) * BigInt(10 ** rcDecimals);

  const creator = (artistName && artistName.trim()) || globalThis.wallet || "RepaHub Artist";
  const totalSteps = coverFile ? 5 : 4;

  globalThis.toast(`Step 1/${totalSteps}: Computing audio hash...`, "");
  const audioHash = await computeAudioHash(audioFile);

  globalThis.toast(`Step 2/${totalSteps}: Uploading audio to IPFS...`, "");
  const audioCID = await pinataUploadFile(audioFile);

  let coverCID = null;
  if (coverFile) {
    globalThis.toast(`Step 3/${totalSteps}: Uploading cover image to IPFS...`, "");
    coverCID = await pinataUploadFile(coverFile);
  }

  globalThis.toast(`Step ${coverFile ? 4 : 3}/${totalSteps}: Uploading metadata to IPFS...`, "");
  const metadata = {
    name: title,
    description: `${title} — Original ${genre} track on RepaHub`,
    creator,
    ...(coverCID ? { image: `ipfs://${coverCID}` } : {}),
    properties: {
      audio: `ipfs://${audioCID}`,
      genre
    },
    attributes: [
      { trait_type: "Genre", value: genre },
      { trait_type: "Platform", value: "RepaHub" }
    ]
  };
  const metadataCID = await pinataUploadJSON(metadata);

  globalThis.toast(`Step ${totalSteps}/${totalSteps}: Signing & uploading to blockchain...`, "");
  await globalThis.musicNftUploadTrack(audioHash, metadataCID, title, priceInTinyRC);

  return { audioCID, coverCID, metadataCID, audioHash };
}

globalThis.performUpload = performUpload;
globalThis.pinataSignedUrl = pinataSignedUrl;
export { performUpload, pinataUploadFile, pinataUploadJSON, computeAudioHash, pinataSignedUrl };
