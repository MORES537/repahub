import {
  AccountAllowanceApproveTransaction,
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  TokenId
} from "@hashgraph/sdk";

const MUSIC_NFT_ABI = [
  "function getAllTrackIds() view returns (uint256[])",
  "function getTrack(uint256 trackId) view returns (tuple(uint256 id, address creator, address owner, bytes32 audioHash, string metadataCid, string title, uint256 priceRC, uint256 reserved0, uint256 extra))",
  "function ownedTracks(address account, uint256 index) view returns (uint256)",
  "function buyTrack(uint256 trackId)"
];

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
    creator,
    owner,
    audioHash,
    metadataCid,
    title,
    priceRC,
    reserved0,
    extra
  ] = rawTuple;
  const priceRCBig =
    typeof priceRC === "bigint" ? priceRC : BigInt(priceRC.toString());
  return {
    id: Number(id),
    creator: creator.toLowerCase(),
    owner: owner.toLowerCase(),
    audioHash,
    metadataCid,
    title,
    priceRCRaw: priceRCBig.toString(),
    priceRC: Number(priceRCBig) / scale,
    reserved0: reserved0.toString(),
    extra: extra.toString()
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
  const nftContract = ContractId.fromString(APP_CONFIG.musicNftContractId);
  const tokenId = TokenId.fromString(APP_CONFIG.rcTokenId);

  const allowanceTx = new AccountAllowanceApproveTransaction().approveTokenAllowance(
    tokenId,
    ownerAccount,
    nftContract,
    priceRaw
  );

  await window.hashconnect.sendTransaction(ownerAccount, allowanceTx);

  const params = new ContractFunctionParameters().addUint256(BigInt(trackId));

  const executeTx = new ContractExecuteTransaction()
    .setContractId(nftContract)
    .setGas(DEFAULT_MUSIC_NFT_GAS)
    .setFunction("buyTrack", params);

  return window.hashconnect.sendTransaction(ownerAccount, executeTx);
}

globalThis.musicNftGetMirrorResults = fetchMirrorContractResults;
globalThis.musicNftGetAllTrackIds = getAllTrackIds;
globalThis.musicNftGetAllTracks = getAllTracks;
globalThis.musicNftGetTrackById = getTrackById;
globalThis.musicNftCheckOwnership = checkOwnership;
globalThis.musicNftBuyTrack = buyTrackNFT;
globalThis.musicNftResolveWalletEvm = resolveWalletEvmAddress;

export {
  fetchMirrorContractResults,
  getAllTrackIds,
  getAllTracks,
  getTrackById,
  checkOwnership,
  buyTrackNFT,
  resolveWalletEvmAddress
};
