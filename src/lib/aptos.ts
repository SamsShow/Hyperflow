import { APTOS_API_KEY, NETWORK } from "../constants.js";
import {
  Aptos,
  AptosConfig,
  Network as AptosNetwork,
  Ed25519PrivateKey,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { AgentRuntime, LocalSigner } from "move-agent-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Constants for token addresses
const APT_COIN_ADDRESS = "0x1::aptos_coin::AptosCoin";
const USDC_COIN_ADDRESS = "0x1::aptos_coin::AptosCoin"; // Temporarily use APT as USDC for testing

// Constants for token decimals
const APT_DECIMALS = 8;
const USDC_DECIMALS = 6;

// PancakeSwap router address
const PANCAKESWAP_ROUTER =
  "0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa::router::";

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
  try {
    dotenv.config();

    const privateKey = process.env.WALLET_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error("WALLET_PRIVATE_KEY not found in environment variables");
    }

    const aptosConfig = new AptosConfig({
      network: NETWORK as AptosNetwork,
    });

    const aptos = new Aptos(aptosConfig);

    // Parse the private key carefully to avoid BCS errors
    let formattedPrivateKey;
    try {
      formattedPrivateKey = PrivateKey.formatPrivateKey(
        privateKey,
        PrivateKeyVariants.Ed25519
      );
    } catch (error) {
      console.error("Error formatting private key:", error);
      throw new Error(
        `Failed to format private key: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Create the Ed25519PrivateKey instance
    const ed25519Key = new Ed25519PrivateKey(formattedPrivateKey);

    const account = await aptos.deriveAccountFromPrivateKey({
      privateKey: ed25519Key,
    });

    const signer = new LocalSigner(account, NETWORK as AptosNetwork);

    return new AgentRuntime(signer, aptos, {});
  } catch (error) {
    console.error("Error initializing Move Agent Kit:", error);
    throw new Error(
      `Failed to initialize Move Agent Kit: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
  try {
    // Check if the sentiment trader address is defined
    if (!process.env.SENTIMENT_TRADER_ADDRESS) {
      console.warn(
        "SENTIMENT_TRADER_ADDRESS not found in environment variables. Skipping sentiment recording."
      );
      return "skipped-no-address";
    }

    const agent = await initMoveAgentKit();

    // Convert sentiment score and confidence to integers for on-chain storage
    // Sentiment ranges from -1 to 1, scale to 0-200 (100 being neutral)
    const sentimentInt = Math.round((sentimentScore + 1) * 100);

    // Confidence ranges from 0 to 1, scale to 0-100
    const confidenceInt = Math.round(confidence * 100);

    console.log(
      `Sentiment as integer: ${sentimentInt}, Confidence as integer: ${confidenceInt}`
    );

    // Get the signer's address
    const signerAddress = agent.account.getAddress();

    // Build and submit the transaction using the Aptos instance
    const payload = {
      function: `${process.env.SENTIMENT_TRADER_ADDRESS}::sentiment_trader::record_sentiment_trade`,
      type_arguments: [],
      arguments: [BigInt(sentimentInt), BigInt(confidenceInt)],
    };

    // Log the transaction payload for debugging
    console.log(
      "Sentiment payload:",
      JSON.stringify(payload, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      )
    );

    // Use the account's sendTransaction method to submit the transaction
    let txHash;
    try {
      txHash = await agent.account.sendTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.type_arguments,
          functionArguments: payload.arguments,
        },
      });
    } catch (txError) {
      console.error("Transaction error in recordSentimentTrade:", txError);
      // Just log the error and continue without failing the entire process
      console.warn("Continuing despite sentiment recording error");
      return "skipped-tx-error";
    }

    console.log(
      `Recorded sentiment trade on-chain: score=${sentimentScore}, confidence=${confidence}`
    );
    return txHash;
  } catch (error) {
    console.error("Error in recordSentimentTrade:", error);
    // Don't throw an error, just return a status to allow the process to continue
    return "skipped-general-error";
  }
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

  if (!amount || amount <= 0) {
    throw new Error(
      `Invalid amount: ${amount}. Amount must be greater than 0.`
    );
  }

  // For testing purposes, we can mock the swap
  const isMockMode = process.env.MOCK_SWAPS === "true";
  if (isMockMode) {
    console.log(`MOCK MODE: Would swap ${amount} ${fromToken} to ${toToken}`);
    return `mock-tx-hash-${Date.now()}`;
  }

  try {
    const agent = await initMoveAgentKit();

    // Convert amount to raw units based on token decimals
    const decimals = fromToken === "APT" ? APT_DECIMALS : USDC_DECIMALS;
    // Ensure we don't lose precision in the calculation
    const rawAmount = Math.floor(amount * Math.pow(10, decimals));

    if (rawAmount <= 0) {
      throw new Error(
        `Invalid raw amount calculated: ${rawAmount}. Check your input amount.`
      );
    }

    // Log the raw amount for debugging
    console.log(
      `Converting ${amount} ${fromToken} to raw amount: ${rawAmount}`
    );

    // Get token addresses
    const fromTokenAddress =
      fromToken === "APT" ? APT_COIN_ADDRESS : USDC_COIN_ADDRESS;
    const toTokenAddress =
      toToken === "APT" ? APT_COIN_ADDRESS : USDC_COIN_ADDRESS;

    // Since we're using the same token for testing (APT), we need to simulate a swap
    // instead of actually doing it. In a real environment, this would be a real swap.
    if (fromTokenAddress === toTokenAddress) {
      console.log(
        `TESTING MODE: Simulating swap of ${amount} ${fromToken} to ${toToken}`
      );
      return `simulated-tx-hash-${Date.now()}`;
    }

    // Use the Aptos SDK directly instead of swapWithPanora
    // Define the transaction payload for PancakeSwap router
    const data = {
      function: `${PANCAKESWAP_ROUTER}swap_exact_input_direct`,
      typeArguments: [fromTokenAddress, toTokenAddress],
      functionArguments: [
        BigInt(rawAmount), // amount in - ensure we use BigInt for large numbers
        BigInt(1), // min amount out (1 unit, practically no slippage protection for simplicity)
      ],
    };

    // Log the transaction details for debugging
    console.log(
      "Sending transaction with payload:",
      JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    );

    // Submit the transaction
    let txHash;
    try {
      txHash = await agent.account.sendTransaction({
        data: {
          function: data.function as `${string}::${string}::${string}`,
          typeArguments: data.typeArguments,
          functionArguments: data.functionArguments,
        },
      });
    } catch (txError) {
      console.error("Transaction error:", txError);
      // Check if it's a BCS-related error
      if (txError instanceof Error && txError.message.includes("bcsToBytes")) {
        throw new Error(
          `BCS serialization error: Please ensure all transaction arguments are properly formatted`
        );
      }
      throw txError;
    }

    console.log(
      `Swapped ${amount} ${fromToken} to ${toToken}. Transaction hash: ${txHash}`
    );
    return txHash;
  } catch (error) {
    console.error("Error in swapTokens:", error);
    throw new Error(
      `Failed to swap tokens: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
