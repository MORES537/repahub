const APP_CONFIG = {
  hedera: {
    network: import.meta.env.VITE_HEDERA_NETWORK || "mainnet",
    chainId: 295,
    rpcUrl: "https://mainnet.hashio.io/api"
  },
  rcSaleContractEvm: import.meta.env.VITE_RC_SALE_CONTRACT_EVM_ADDRESS,
  rcSaleContractGas: parseInt(import.meta.env.VITE_RC_SALE_CONTRACT_GAS) || 450000,
  treasuryAccountId: import.meta.env.VITE_HEDERA_TREASURY_ACCOUNT_ID,
  rcTokenId: import.meta.env.VITE_RC_TOKEN_ID,
  rcTokenDecimals: 9,
  rcPerHbar: 2000,
  topUpMinHbar: parseFloat(import.meta.env.VITE_TOPUP_MIN_HBAR) || 0.01,
  topUpMaxHbar: parseFloat(import.meta.env.VITE_TOPUP_MAX_HBAR) || 25,
  mirrorNodeUrl: "https://mainnet-public.mirrornode.hedera.com",
  reownProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  musicNftContractEvm: import.meta.env.VITE_MUSIC_NFT_CONTRACT_EVM,
  musicNftContractId: import.meta.env.VITE_MUSIC_NFT_CONTRACT_ID,
  pinataGateway: import.meta.env.VITE_PINATA_GATEWAY,
  pinataJwt: import.meta.env.VITE_PINATA_JWT,
  htsNftTokenId: import.meta.env.VITE_HTS_NFT_TOKEN_ID,
  htsNftTokenEvm: import.meta.env.VITE_HTS_NFT_TOKEN_EVM
};

export { APP_CONFIG };
globalThis.APP_CONFIG = APP_CONFIG;
