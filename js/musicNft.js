import {
  AccountAllowanceApproveTransaction,
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  TokenId,
  TokenAssociateTransaction
} from "@hashgraph/sdk";

const MUSIC_NFT_ABI = [
  "function getAllTrackIds() view returns (uint256[])",
  "function getTrack(uint256 trackId) view returns (tuple(uint256 id, address artist, address currentOwner, bytes32 audioHash, string metadataCID, string title, uint256 price, uint8 status, uint256 createdAt, uint256 soldAt, int64 serialNumber))",
  "function ownedTracks(address account, uint256 index) view returns (uint256)",
  "function buyTrack(uint256 trackId)",
  "function uploadTrack(bytes32 audioHash, string metadataCID, string title, uint256 priceInTinyRC) returns (uint256)"
];

const UPLOAD_FEE_TINY_RC = BigInt(100) * BigInt(1e9);

const DEFAULT_MUSIC_NFT_GAS = 800000;

function getEthers() {
  const e = globalThis.ethers || window.ethers;
  if (!e) throw new Error("ethers.js is required for music NFT calls");
  return e;
}

function musicNftIface() {
  const { Interface } = getEthers();
  return new Interface(MUSIC_NFT_ABI);
}

function assertMusicNftConfig() {
  const evm = APP_CONFIG.musicNftContractEvm;
  const cid = APP_CONFIG.musicNftContractId;
  if (!evm || !cid) {
    throw new Error(
      "Music NFT contract env missing: set VITE_MUSIC_NFT_CONTRACT_EVM and VITE_MUSIC_NFT_CONTRACT_ID"
    );
  }
}

async function ethCallMusicNft(encodedCallData) {
  assertMusicNftConfig();
  const rpcUrl = APP_CONFIG.hedera.rpcUrl;
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: APP_CONFIG.musicNftContractEvm, data: encodedCallData }, "latest"]
    })
  });
  if (!res.ok) throw new Error(`Music NFT eth_call HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.error) {
    throw new Error(payload.error.message || "Music NFT eth_call failed");
  }
  return payload.result;
}

/**
 * Mirror Node contract results (optional). May be empty depending on indexing;
 * prefer {@link getAllTracks} which uses eth_call.
 */
async function fetchMirrorContractResults({ limit = 100 } = {}) {
  assertMusicNftConfig();
  const id = APP_CONFIG.musicNftContractId;
  const url = `${APP_CONFIG.mirrorNodeUrl}/api/v1/contracts/${id}/results?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mirror results ${res.status}`);
  return await res.json();
}

function decodeTrackTuple(rawTuple) {
  const scale = 10 ** APP_CONFIG.rcTokenDecimals;
  const [
    id,
    artist,
    currentOwner,
    audioHash,
    metadataCid,
    title,
    priceRC,
    status,
    createdAt,
    soldAt,
    serialNumber
  ] = rawTuple;
  const priceRCBig =
    typeof priceRC === "bigint" ? priceRC : BigInt(priceRC.toString());
  return {
    id: Number(id),
    creator: artist.toLowerCase(),
    owner: currentOwner.toLowerCase(),
    audioHash,
    metadataCid,
    title,
    priceRCRaw: priceRCBig.toString(),
    priceRC: Number(priceRCBig) / scale,
    status: Number(status),
    createdAt: Number(createdAt),
    soldAt: Number(soldAt),
    serialNumber: serialNumber.toString()
  };
}

/**
 * @returns {Promise<number[]>}
 */
async function getAllTrackIds() {
  const iface = musicNftIface();
  const data = iface.encodeFunctionData("getAllTrackIds", []);
  const hex = await ethCallMusicNft(data);
  const decoded = iface.decodeFunctionResult("getAllTrackIds", hex);
  const arr = decoded[0];
  return arr.map((x) => Number(x));
}

/**
 * Full track structs from chain (no IPFS metadata merged).
 * @returns {Promise<ReturnType<typeof decodeTrackTuple>[]>}
 */
async function getAllTracks() {
  const ids = await getAllTrackIds();
  const out = [];
  for (const id of ids) {
    out.push(await getTrackById(id));
  }
  return out;
}

/**
 * @param {number|string|bigint} id
 */
async function getTrackById(id) {
  const iface = musicNftIface();
  const data = iface.encodeFunctionData("getTrack", [id]);
  const hex = await ethCallMusicNft(data);
  const decoded = iface.decodeFunctionResult("getTrack", hex);
  return decodeTrackTuple(decoded[0]);
}

/**
 * Hedera account `0.0.x` → lowercase EVM alias; passes through `0x` addresses.
 */
async function resolveWalletEvmAddress(walletAddress) {
  if (!walletAddress || typeof walletAddress !== "string") return null;
  if (/^0\.0\.\d+$/.test(walletAddress.trim())) {
    const acct = walletAddress.trim();
    const endpoint = `${APP_CONFIG.mirrorNodeUrl}/api/v1/accounts/${acct}`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Mirror account lookup failed (${res.status})`);
    const data = await res.json();
    const evm = data.evm_address;
    if (!evm) throw new Error("Account has no evm_address");
    return evm.toLowerCase();
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
    return walletAddress.trim().toLowerCase();
  }
  throw new Error("walletAddress must be Hedera account id or EVM address");
}

async function isAssociatedToHtsNft(accountId) {
  const tokenId = APP_CONFIG.htsNftTokenId;
  const url = `${APP_CONFIG.mirrorNodeUrl}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data.tokens) && data.tokens.length > 0;
}

async function associateBuyerToHtsNft(signer, ownerAccount) {
  const tokenId = TokenId.fromString(APP_CONFIG.htsNftTokenId);
  const tx = await new TokenAssociateTransaction()
    .setAccountId(ownerAccount)
    .setTokenIds([tokenId])
    .freezeWithSigner(signer);
  return tx.executeWithSigner(signer);
}

/**
 * Uses `ownedTracks(address,uint256 index)` — enumerate until revert.
 * @param {string} walletAddress Hedera `0.0.x` or `0x...`
 * @param {number|string|bigint} trackId
 */
async function checkOwnership(walletAddress, trackId) {
  const iface = musicNftIface();
  const evm = await resolveWalletEvmAddress(walletAddress);
  const want = BigInt(trackId);
  let index = 0;
  for (;;) {
    let hex;
    try {
      const data = iface.encodeFunctionData("ownedTracks", [evm, index]);
      hex = await ethCallMusicNft(data);
    } catch {
      break;
    }
    const decoded = iface.decodeFunctionResult("ownedTracks", hex);
    const ownedId = BigInt(decoded[0].toString());
    if (ownedId === want) return true;
    index++;
    if (index > 256) break;
  }
  return false;
}

/**
 * Approve RC allowance for the music NFT contract, then `buyTrack(trackId)`.
 * @param {number|string|bigint} trackId
 */
async function buyTrackNFT(trackId) {
  assertMusicNftConfig();
  if (!globalThis.wallet) throw new Error("Wallet not connected");
  if (!window.hashconnect) throw new Error("HashConnect not initialized");

  const track = await getTrackById(trackId);
  const priceRaw = BigInt(track.priceRCRaw);

  const ownerAccount = AccountId.fromString(globalThis.wallet);
  const nftContractId = ContractId.fromString(APP_CONFIG.musicNftContractId);
  const tokenId = TokenId.fromString(APP_CONFIG.rcTokenId);
  const signer = window.hashconnect.getSigner(ownerAccount);

  // STEP 0: Check & associate HTS NFT if needed
  console.log("[musicNft] Step 0: checking HTS NFT association...");
  const isAssoc = await isAssociatedToHtsNft(globalThis.wallet);
  if (!isAssoc) {
    console.log("[musicNft] Step 0: NOT associated, sending associate tx...");
    await associateBuyerToHtsNft(signer, ownerAccount);
    console.log("[musicNft] Step 0: associated successfully.");
  } else {
    console.log("[musicNft] Step 0: already associated, skipping.");
  }

  // STEP 1: Approve RC allowance
  console.log("[musicNft] Step 1: building allowance tx...");
  const allowanceTx = await new AccountAllowanceApproveTransaction()
    .approveTokenAllowance(tokenId, ownerAccount, nftContractId, priceRaw)
    .freezeWithSigner(signer);

  console.log("[musicNft] Step 1: executing allowance tx...");
  await allowanceTx.executeWithSigner(signer);
  console.log("[musicNft] Step 1 DONE.");

  // STEP 2: Execute buyTrack
  console.log("[musicNft] Step 2: building buyTrack tx...");
  const params = new ContractFunctionParameters().addUint256(String(trackId));

  const executeTx = await new ContractExecuteTransaction()
    .setContractId(nftContractId)
    .setGas(DEFAULT_MUSIC_NFT_GAS)
    .setFunction("buyTrack", params)
    .freezeWithSigner(signer);

  console.log("[musicNft] Step 2: executing buyTrack tx...");
  const result = await executeTx.executeWithSigner(signer);
  console.log("[musicNft] Step 2 DONE:", result);
  return result;
}

/**
 * Approve 100 RC upload fee then call uploadTrack on the contract.
 * @param {string} audioHashHex  keccak256 hex string (0x...)
 * @param {string} metadataCID   IPFS CID
 * @param {string} title
 * @param {bigint|string|number} priceInTinyRC
 */
async function uploadTrackOnChain(audioHashHex, metadataCID, title, priceInTinyRC) {
  assertMusicNftConfig();
  if (!globalThis.wallet) throw new Error("Wallet not connected");
  if (!window.hashconnect) throw new Error("HashConnect not initialized");

  const ownerAccount = AccountId.fromString(globalThis.wallet);
  const nftContractId = ContractId.fromString(APP_CONFIG.musicNftContractId);
  const tokenId = TokenId.fromString(APP_CONFIG.rcTokenId);
  const signer = window.hashconnect.getSigner(ownerAccount);

  // Convert hex hash → Uint8Array(32) for addBytes32
  const hex = audioHashHex.startsWith("0x") ? audioHashHex.slice(2) : audioHashHex;
  const audioHashBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    audioHashBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  const priceBig = BigInt(priceInTinyRC.toString());

  // STEP 1: Approve 100 RC upload fee
  console.log("[uploadTrack] Step 1: approving upload fee...");
  const allowanceTx = await new AccountAllowanceApproveTransaction()
    .approveTokenAllowance(tokenId, ownerAccount, nftContractId, UPLOAD_FEE_TINY_RC)
    .freezeWithSigner(signer);
  await allowanceTx.executeWithSigner(signer);
  console.log("[uploadTrack] Step 1 DONE.");

  // STEP 2: Call uploadTrack
  console.log("[uploadTrack] Step 2: calling uploadTrack...");
  const params = new ContractFunctionParameters()
    .addBytes32(audioHashBytes)
    .addString(metadataCID)
    .addString(title)
    .addUint256(priceBig.toString());

  const executeTx = await new ContractExecuteTransaction()
    .setContractId(nftContractId)
    .setGas(DEFAULT_MUSIC_NFT_GAS)
    .setFunction("uploadTrack", params)
    .freezeWithSigner(signer);

  const result = await executeTx.executeWithSigner(signer);
  console.log("[uploadTrack] Step 2 DONE:", result);
  return result;
}

globalThis.musicNftGetMirrorResults = fetchMirrorContractResults;
globalThis.musicNftGetAllTrackIds = getAllTrackIds;
globalThis.musicNftGetAllTracks = getAllTracks;
globalThis.musicNftGetTrackById = getTrackById;
globalThis.musicNftCheckOwnership = checkOwnership;
/**
 * Cancel an unsold track (artist only, track must not have been sold).
 * @param {number|string} trackId
 */
async function cancelTrack(trackId) {
  assertMusicNftConfig();
  if (!globalThis.wallet) throw new Error("Wallet not connected");
  if (!window.hashconnect) throw new Error("HashConnect not initialized");

  const ownerAccount = AccountId.fromString(globalThis.wallet);
  const nftContractId = ContractId.fromString(APP_CONFIG.musicNftContractId);
  const signer = window.hashconnect.getSigner(ownerAccount);

  const params = new ContractFunctionParameters().addUint256(String(trackId));
  const tx = await new ContractExecuteTransaction()
    .setContractId(nftContractId)
    .setGas(300000)
    .setFunction("cancelUnsoldTrack", params)
    .freezeWithSigner(signer);

  const result = await tx.executeWithSigner(signer);
  console.log("[cancelTrack] DONE:", result);
  return result;
}

globalThis.musicNftBuyTrack = buyTrackNFT;
globalThis.musicNftUploadTrack = uploadTrackOnChain;
globalThis.musicNftCancelTrack = cancelTrack;
globalThis.musicNftResolveWalletEvm = resolveWalletEvmAddress;

export {
  fetchMirrorContractResults,
  getAllTrackIds,
  getAllTracks,
  getTrackById,
  checkOwnership,
  buyTrackNFT,
  uploadTrackOnChain,
  resolveWalletEvmAddress,
  isAssociatedToHtsNft,
  associateBuyerToHtsNft
};
