import {
  ContractExecuteTransaction,
  ContractId,
  ContractFunctionParameters,
  Hbar,
  AccountId,
  TokenId,
  TransferTransaction
} from '@hashgraph/sdk';

async function loadContractId() {
  const res = await fetch(
    APP_CONFIG.mirrorNodeUrl +
    "/api/v1/contracts/" +
    APP_CONFIG.rcSaleContractEvm
  );
  const data = await res.json();
  APP_CONFIG.contractIdHedera = data.contract_id;
  console.log("Contract ID loaded:", data.contract_id);
}

async function hederaBuyTokens(hbarAmount) {
  if (!globalThis.wallet) throw new Error("Wallet not connected");
  if (!window.hashconnect) throw new Error("HashConnect not initialized");
  if (!APP_CONFIG.contractIdHedera) await loadContractId();

  const accountId = AccountId.fromString(globalThis.wallet);
  const expectedRC = hbarAmount * APP_CONFIG.rcPerHbar;
  const minRCOut = Math.floor(
    expectedRC * 0.99 * Math.pow(10, APP_CONFIG.rcTokenDecimals)
  );
  console.log("Building transaction:");
  console.log("- Contract:", APP_CONFIG.contractIdHedera);
  console.log("- HBAR amount:", hbarAmount);
  console.log("- Min RC out:", minRCOut);
  const params = new ContractFunctionParameters()
    .addUint256(minRCOut);
  const transaction = new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(APP_CONFIG.contractIdHedera))
    .setGas(APP_CONFIG.rcSaleContractGas)
    .setPayableAmount(new Hbar(hbarAmount))
    .setFunction("buyWithHBAR", params);

  const response = await window.hashconnect.sendTransaction(
    accountId,
    transaction
  );
  console.log("Transaction response:", response);
  return response;
}

async function hederaPayWithRC(amountRC, memo = "") {
  if (!globalThis.wallet) throw new Error("Wallet not connected");

  const fromAccount = AccountId.fromString(globalThis.wallet);
  const toAccount = AccountId.fromString(APP_CONFIG.treasuryAccountId);
  const tokenId = TokenId.fromString(APP_CONFIG.rcTokenId);

  // Convert full RC amount into token's smallest unit
  const rawAmount = Math.floor(amountRC * Math.pow(10, APP_CONFIG.rcTokenDecimals));

  const transaction = new TransferTransaction()
    .addTokenTransfer(tokenId, fromAccount, -rawAmount)
    .addTokenTransfer(tokenId, toAccount, rawAmount)
    .setTransactionMemo(memo);

  const response = await window.hashconnect.sendTransaction(
    fromAccount,
    transaction
  );
  return response;
}

async function hederaGetSaleInfo() {
  const ethersObj = globalThis.ethers || window.ethers;
  if (!ethersObj) throw new Error("ethers.js not available");
  const iface = new ethersObj.Interface([
    "function saleInfo() view returns (uint256,bool,uint256,uint256)"
  ]);
  const data = iface.encodeFunctionData("saleInfo", []);
  const rpcRes = await fetch(APP_CONFIG.hedera.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: APP_CONFIG.rcSaleContractEvm, data }, "latest"]
    })
  });
  if (!rpcRes.ok) throw new Error(`RPC request failed (${rpcRes.status})`);
  const payload = await rpcRes.json();
  if (payload.error) {
    throw new Error(payload.error.message || "eth_call saleInfo failed");
  }
  const decoded = iface.decodeFunctionResult("saleInfo", payload.result);
  const pricePerRCInTinybar = BigInt(decoded[0].toString());
  const paused = Boolean(decoded[1]);
  const rcBalanceRaw = BigInt(decoded[2].toString());
  const hbarBalanceTinybar = BigInt(decoded[3].toString());
  const scale = BigInt(10) ** BigInt(APP_CONFIG.rcTokenDecimals);
  return {
    pricePerRCInTinybar,
    paused,
    rcBalanceRaw,
    hbarBalanceTinybar,
    rcBalance: Number(rcBalanceRaw) / Number(scale),
    hbarBalance: Number(hbarBalanceTinybar) / 1e8,
    pricePerRCHbar: Number(pricePerRCInTinybar) / 1e8
  };
}

async function getRCBalance(walletAddress){
  const endpoint = `${APP_CONFIG.mirrorNodeUrl}/api/v1/accounts/${walletAddress}/tokens?token.id=${APP_CONFIG.rcTokenId}`;
  const res = await fetch(endpoint);
  if(!res.ok){
    throw new Error(`Mirror Node request failed (${res.status})`);
  }
  const data = await res.json();
  const tokenEntry = (data.tokens || []).find(b => b.token_id === APP_CONFIG.rcTokenId);
  return Number(tokenEntry ? tokenEntry.balance : 0);
}

async function hederaGetTokenInfoFromMirror(){
  const endpoint = `${APP_CONFIG.mirrorNodeUrl}/api/v1/tokens/${APP_CONFIG.rcTokenId}`;
  try{
    const res = await fetch(endpoint);
    if(!res.ok){
      throw new Error(`Mirror token info request failed (${res.status})`);
    }
    return await res.json();
  }catch(e){
    console.log("Mirror token info fetch failed:", e && (e.message || e));
    return null;
  }
}

window.hederaBuyTokens = hederaBuyTokens;
window.hederaPayWithRC = hederaPayWithRC;
globalThis.hederaBuyTokens = hederaBuyTokens;
globalThis.hederaPayWithRC = hederaPayWithRC;
globalThis.getRCBalance = getRCBalance;
globalThis.hederaGetTokenInfoFromMirror = hederaGetTokenInfoFromMirror;
globalThis.hederaGetSaleInfo = hederaGetSaleInfo;
globalThis.loadContractId = loadContractId;

loadContractId();
