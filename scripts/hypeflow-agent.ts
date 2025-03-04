/**
 * HypeFlow AI Agent
 *
 * This script monitors Twitter for sentiment about Aptos projects,
 * makes trading decisions based on that sentiment, and executes
 * on-chain actions via Move Agent Kit.
 */

import {
  fetchTweetsWithSentiment,
  calculateOverallSentiment,
  analyzeTweetSentiment,
} from "../src/lib/twitter.js";
import {
  makeDecision,
  adjustForDataAge,
  DecisionConfig,
  ActionType,
} from "../src/lib/decisionLogic.js";
import {
  getAptosClient,
  swapTokens,
  getWalletBalances,
  getAptPrice,
  recordSentimentTrade,
} from "../src/lib/aptos.js";
import dotenv from "dotenv";
import { appendFileSync } from "fs";
import { TwitterApi } from "twitter-api-v2";
import { fileURLToPath } from "url";
import path from "path";
import { mockTweets } from "../src/data/mockTweets.js";

// Get the current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Configuration
const CONFIG: {
  hashtagsToTrack: string[];
  decisionConfig: DecisionConfig;
  maxDataAgeMinutes: number;
  checkIntervalMinutes: number;
  logFilePath: string;
  twitterPostResults: boolean;
  mockMode: boolean;
} = {
  hashtagsToTrack: ["#Aptos"],
  decisionConfig: {
    bullishThreshold: 0.4,
    bearishThreshold: -0.2,
    minTweetVolume: 2, // Require at least 10 tweets for a decision
    timeWindowMinutes: 60, // Look at last hour of tweets
    maxPositionSize: 100, // Maximum position size (adjust units as needed)
    currentlyInvested: false, // Start with no investment position
  },
  maxDataAgeMinutes: 30, // Data older than 30 minutes gets reduced confidence
  checkIntervalMinutes: 10, // Check Twitter every 10 minutes
  logFilePath: "./hypeflow-logs.txt",
  twitterPostResults: true, // Whether to post results to Twitter
  mockMode: process.env.MOCK_SWAPS === "true", // Use mock mode based on environment variable
};

// Aptos client is initialized from src/lib/aptos.ts

// Comment out Twitter API initialization
let twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);
if (
  process.env.TWITTER_API_KEY &&
  process.env.TWITTER_API_SECRET &&
  process.env.TWITTER_ACCESS_TOKEN &&
  process.env.TWITTER_ACCESS_SECRET
) {
  // For posting tweets we need user context auth (not just bearer token)
  twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
}

/**
 * Log message to file and console
 */
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  appendFileSync(CONFIG.logFilePath, logMessage + "\n");
}

/**
 * Post a status update to Twitter
 */
async function postToTwitter(message: string) {
  // Comment out Twitter posting functionality
  if (!CONFIG.twitterPostResults || !twitterClient) {
    log("Twitter posting disabled or client not initialized");
    return;
  }

  try {
    const response = await twitterClient.v2.tweet(message);
    log(`Posted to Twitter: ${message}`);
    return response;
  } catch (error) {
    log(`Error posting to Twitter: ${error}`);
  }

  // Just log the message instead
  log(`Would have posted to Twitter: ${message}`);
  console.log("_____________________oh yeahh_____________________");
  return null;
}

/**
 * Execute on-chain action based on decision
 */
async function executeOnChainAction(
  action: ActionType,
  amount: number,
  confidence: number
): Promise<boolean> {
  log(
    `Executing on-chain action: ${action} amount=${amount} confidence=${confidence.toFixed(2)}`
  );

  try {
    // Record sentiment trade on-chain regardless of action
    try {
      log("Recording sentiment data on-chain...");
      const sentimentResult = await recordSentimentTrade(
        confidence * 2 - 1,
        confidence
      ); // Convert confidence (0-1) to sentiment (-1 to 1)
      log(`Sentiment recording result: ${sentimentResult}`);
    } catch (sentimentError) {
      log(
        `Error recording sentiment: ${sentimentError instanceof Error ? sentimentError.message : String(sentimentError)}`
      );
      // Continue execution even if sentiment recording fails
    }

    // Check if we're in mock mode
    const isMockMode = CONFIG.mockMode;
    if (isMockMode) {
      log(`Running in MOCK mode - simulating transaction for ${action}`);

      if (action === "BUY") {
        log(`Would execute: Buy ${amount} APT`);
      } else if (action === "SELL") {
        log(`Would execute: Sell ${amount} APT`);
      } else if (action === "DEPOSIT") {
        log(`Would execute: Deposit ${amount} APT to yield protocol`);
      } else if (action === "WITHDRAW") {
        log(`Would execute: Withdraw ${amount} APT from yield protocol`);
      } else if (action === "HOLD") {
        log("Action: HOLD - No transaction needed");
      } else {
        // Handle any other cases to make TypeScript happy
        const exhaustiveCheck: never = action;
        log(`Unhandled action type: ${exhaustiveCheck}`);
      }

      // Generate and post tweet about the action in mock mode
      if (action !== "HOLD") {
        const actionVerb =
          action === "BUY" || action === "DEPOSIT" ? "bought" : "sold";
        const tweetContent = `HypeFlow AI just ${actionVerb} ${amount} $APT because Twitter sentiment is ${confidence > 0.7 ? "strongly" : ""} ${confidence > 0.5 ? "positive" : "negative"}! #AptosHype #Web3 #HypeFlowAI`;
        await postToTwitter(tweetContent);
      }

      return true;
    }

    // If not in mock mode, continue with actual execution
    log("🚨 EXECUTING REAL ON-CHAIN TRANSACTION 🚨");
    log(`Current mode: REAL TRANSACTION MODE (mock mode is OFF)`);

    try {
      // Check wallet balances before executing trades
      log("Fetching current wallet balances...");
      const balances = await getWalletBalances();
      const aptPrice = await getAptPrice();

      log(
        `Current wallet balances: ${balances.apt.toFixed(4)} APT, ${balances.usdc.toFixed(2)} USDC`
      );
      log(`Current APT price: $${aptPrice.toFixed(2)}`);

      if (action === "BUY") {
        // Calculate how much USDC we need to spend
        const usdcAmount = amount * aptPrice;

        // Check if we have enough USDC
        if (balances.usdc < usdcAmount) {
          log(
            `Insufficient USDC balance (${balances.usdc.toFixed(2)}) to buy ${amount} APT (${usdcAmount.toFixed(2)} USDC needed)`
          );
          return false;
        }

        log(
          `Executing REAL transaction: Buy ${amount} APT for approximately ${usdcAmount.toFixed(2)} USDC`
        );

        // Execute the swap from USDC to APT
        const buyTxHash = await swapTokens("USDC", "APT", usdcAmount);
        log(`Buy transaction executed. Hash: ${buyTxHash}`);
        log(
          `Transaction can be viewed at: https://explorer.aptoslabs.com/txn/${buyTxHash}?network=testnet`
        );
      } else if (action === "SELL") {
        // Check if we have enough APT
        if (balances.apt < amount) {
          log(
            `Insufficient APT balance (${balances.apt.toFixed(4)}) to sell ${amount} APT`
          );
          return false;
        }

        log(
          `Executing REAL transaction: Sell ${amount} APT for approximately ${(amount * aptPrice).toFixed(2)} USDC`
        );

        // Execute the swap from APT to USDC
        const sellTxHash = await swapTokens("APT", "USDC", amount);
        log(`Sell transaction executed. Hash: ${sellTxHash}`);
        log(
          `Transaction can be viewed at: https://explorer.aptoslabs.com/txn/${sellTxHash}?network=testnet`
        );
      } else if (action === "DEPOSIT") {
        // Check if we have enough APT
        if (balances.apt < amount) {
          log(
            `Insufficient APT balance (${balances.apt.toFixed(4)}) to deposit ${amount} APT`
          );
          return false;
        }

        log(`Would execute: Deposit ${amount} APT to yield protocol`);
        log(
          `NOTE: Deposit functionality is not yet implemented in this version`
        );
        // In a real implementation, this would call a yield protocol
        // await agent.deposit(...);
      } else if (action === "WITHDRAW") {
        log(`Would execute: Withdraw ${amount} APT from yield protocol`);
        log(
          `NOTE: Withdraw functionality is not yet implemented in this version`
        );
        // In a real implementation, this would call a yield protocol
        // await agent.withdraw(...);
      } else if (action === "HOLD") {
        log("Action: HOLD - No transaction needed");
      } else {
        // Handle any other cases to make TypeScript happy
        const exhaustiveCheck: never = action;
        log(`Unhandled action type: ${exhaustiveCheck}`);
      }

      // Generate and post tweet about the action
      if (action !== "HOLD") {
        const actionVerb =
          action === "BUY" || action === "DEPOSIT" ? "bought" : "sold";
        const tweetContent = `HypeFlow AI just ${actionVerb} ${amount} $APT because Twitter sentiment is ${confidence > 0.7 ? "strongly" : ""} ${confidence > 0.5 ? "positive" : "negative"}! #AptosHype #Web3 #HypeFlowAI`;
        await postToTwitter(tweetContent);
      }
    } catch (actionError) {
      log(
        `Error during action execution: ${actionError instanceof Error ? actionError.message : String(actionError)}`
      );
      console.error("Action execution error details:", actionError);
      return false;
    }

    return true;
  } catch (error) {
    log(
      `Error executing on-chain action: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("Full error details:", error);
    return false;
  }
}

// Add hardcoded mock tweets function with proper type annotations
async function getMockTweetsWithSentiment(hashtag: string): Promise<{
  data: any[];
  meta: { result_count: number };
}> {
  return {
    data: mockTweets,
    meta: {
      result_count: mockTweets.length,
    },
  };
}

/**
 * Main function that runs the HypeFlow AI agent
 */
async function runHypeFlowAgent() {
  log("Starting HypeFlow AI agent run...");

  try {
    // 1. Collect tweets for all tracked hashtags
    let allTweets: any[] = [];

    for (const hashtag of CONFIG.hashtagsToTrack) {
      log(`Getting mock tweets for ${hashtag}...`);
      // Replace fetchTweetsWithSentiment with our mock function
      const result = await getMockTweetsWithSentiment(hashtag);
      log(`Found ${result.data.length} mock tweets for ${hashtag}`);
      allTweets = [...allTweets, ...result.data];
    }

    // Remove duplicates
    const uniqueTweets = Array.from(
      new Map(allTweets.map((tweet) => [tweet.id, tweet])).values()
    );
    log(`Analyzing ${uniqueTweets.length} unique tweets`);

    // 2. Calculate overall sentiment
    const overallSentiment = analyzeTweetSentiment(uniqueTweets);
    log(`Overall sentiment score: ${overallSentiment.toFixed(4)}`);
    console.log(overallSentiment);

    // 3. Make investment decision
    const decisionResult = makeDecision(
      overallSentiment,
      uniqueTweets.length,
      CONFIG.decisionConfig
    );

    // 4. Adjust for data freshness
    const dataAgeMinutes = 0; // In real implementation, calculate actual age of tweets
    const adjustedDecision = adjustForDataAge(
      decisionResult,
      dataAgeMinutes,
      CONFIG.maxDataAgeMinutes
    );

    log(
      `Decision: ${adjustedDecision.action} (Confidence: ${adjustedDecision.confidence.toFixed(2)})`
    );
    log(`Reason: ${adjustedDecision.reason}`);

    // 5. Execute on-chain action if confidence is high enough
    if (
      adjustedDecision.confidence > 0.25 &&
      adjustedDecision.action !== "HOLD"
    ) {
      const amount = adjustedDecision.suggestedAmount || 0;
      await executeOnChainAction(
        adjustedDecision.action,
        amount,
        adjustedDecision.confidence
      );

      // Update our state for next run
      CONFIG.decisionConfig.currentlyInvested =
        adjustedDecision.action === "BUY" ||
        adjustedDecision.action === "DEPOSIT";
    } else {
      log("Not taking action due to low confidence or HOLD recommendation");
    }

    log("HypeFlow AI agent run complete");
  } catch (error) {
    log(`Error running HypeFlow AI agent: ${error}`);
  }
}

// If this script is executed directly (not imported)
// ESM doesn't have require.main === module, so we use import.meta.url
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  // Run immediately once
  runHypeFlowAgent();

  // Then schedule to run periodically
  log(`Scheduling future runs every ${CONFIG.checkIntervalMinutes} minutes`);
  setInterval(runHypeFlowAgent, CONFIG.checkIntervalMinutes * 60 * 1000);
}

// Export for use in other modules
export { runHypeFlowAgent };
