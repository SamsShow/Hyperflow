import { APTOS_API_KEY, NETWORK } from "../constants.js";
import { Aptos, AptosConfig, Network as AptosNetwork, Ed25519PrivateKey, PrivateKey, PrivateKeyVariants } from "@aptos-labs/ts-sdk";
import { AgentRuntime, LocalSigner } from "move-agent-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Constants for token addresses
const APT_COIN_ADDRESS = "0x1::aptos_coin::AptosCoin";
const USDC_COIN_ADDRESS = "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC";

// Constants for token decimals
const APT_DECIMALS = 8;
const USDC_DECIMALS = 6;

// PancakeSwap router address
const PANCAKESWAP_ROUTER = "0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa::router::";

const APTOS_CLIENT = new Aptos(
  new AptosConfig({
    network: NETWORK,
    clientConfig: { API_KEY: APTOS_API_KEY },
  })
);

export const getAptosClient = () => APTOS_CLIENT;

/**
 * Initialize the Move Agent Kit
 * @returns AgentRuntime instance
 */
export const initMoveAgentKit = async (): Promise<AgentRuntime> => {
  dotenv.config();
  
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("WALLET_PRIVATE_KEY not found in environment variables");
  }
  
  const aptosConfig = new AptosConfig({
    network: NETWORK as AptosNetwork,
  });

  const aptos = new Aptos(aptosConfig);
  
  const account = await aptos.deriveAccountFromPrivateKey({
    privateKey: new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(
        privateKey,
        PrivateKeyVariants.Ed25519,
      ),
    ),
  });

  const signer = new LocalSigner(account, NETWORK as AptosNetwork);
  
  return new AgentRuntime(signer, aptos, {

  });
};

/**
 * Get wallet balances for APT and USDC
 * @returns Object with APT and USDC balances
 */
export const getWalletBalances = async () => {
  const agent = await initMoveAgentKit();
  
  // Get APT balance (default token if no mint is specified)
  const aptBalance = await agent.getBalance();
  
  // Get USDC balance by specifying the USDC coin address
  const usdcBalance = await agent.getBalance(USDC_COIN_ADDRESS);
  
  return {
    apt: aptBalance / Math.pow(10, APT_DECIMALS),
    usdc: usdcBalance / Math.pow(10, USDC_DECIMALS),
    aptRaw: aptBalance,
    usdcRaw: usdcBalance,
  };
};

/**
 * Get current APT price in USD
 * @returns APT price in USD
 */
export const getAptPrice = async (): Promise<number> => {
  // In a real implementation, this would fetch the price from an API
  // For now, we'll use a mock price
  return 15.75; // Mock APT price in USD
};

/**
 * Record sentiment trade on-chain
 * @param sentimentScore Sentiment score (-1 to 1)
 * @param confidence Confidence level (0 to 1)
 */
export const recordSentimentTrade = async (
  sentimentScore: number,
  confidence: number
) => {
  const agent = await initMoveAgentKit();
  
  // Convert sentiment score and confidence to integers for on-chain storage
  // Sentiment ranges from -1 to 1, scale to 0-200 (100 being neutral)
  const sentimentInt = Math.round((sentimentScore + 1) * 100);
  
  // Confidence ranges from 0 to 1, scale to 0-100
  const confidenceInt = Math.round(confidence * 100);
  
  // Since executeFunction is not available, we need to use the Aptos SDK directly
  // Get the signer's address
  const signerAddress = agent.account.getAddress();
  
  // Build and submit the transaction using the Aptos instance
  const payload = {
    function: `${process.env.SENTIMENT_TRADER_ADDRESS}::sentiment_trader::record_sentiment_trade`,
    type_arguments: [],
    arguments: [sentimentInt, confidenceInt]
  };
  
  // Use the account's sendTransaction method to submit the transaction
  const txHash = await agent.account.sendTransaction({
    data: {
      function: payload.function,
      typeArguments: payload.type_arguments,
      functionArguments: payload.arguments
    }
  });
  
  console.log(`Recorded sentiment trade on-chain: score=${sentimentScore}, confidence=${confidence}`);
  return txHash;
};

/**
 * Swap tokens on PancakeSwap
 * @param fromToken Token to swap from (APT or USDC)
 * @param toToken Token to swap to (APT or USDC)
 * @param amount Amount to swap (in source token units)
 * @param slippage Slippage tolerance (default: 0.5%)
 * @returns Transaction hash
 */
export const swapTokens = async (
  fromToken: "APT" | "USDC",
  toToken: "APT" | "USDC",
  amount: number,
  slippage: number = 0.5
): Promise<string> => {
  if (fromToken === toToken) {
    throw new Error("Cannot swap the same token");
  }
  
  const agent = await initMoveAgentKit();
  
  // Convert amount to raw units based on token decimals
  const decimals = fromToken === "APT" ? APT_DECIMALS : USDC_DECIMALS;
  const rawAmount = Math.floor(amount * Math.pow(10, decimals));
  
  // Get token addresses
  const fromTokenAddress = fromToken === "APT" ? APT_COIN_ADDRESS : USDC_COIN_ADDRESS;
  const toTokenAddress = toToken === "APT" ? APT_COIN_ADDRESS : USDC_COIN_ADDRESS;
  
  // Execute the swap using swapWithPanora
  const txHash = await agent.swapWithPanora(
    fromTokenAddress,
    toTokenAddress,
    rawAmount
  );
  
  console.log(`Swapped ${amount} ${fromToken} to ${toToken}. Transaction hash: ${txHash}`);
  return txHash;
};
