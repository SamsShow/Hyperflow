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
import { getAptosClient } from "../src/lib/aptos.js";
import dotenv from "dotenv";
import { appendFileSync } from "fs";
import { TwitterApi } from "twitter-api-v2";
import { fileURLToPath } from 'url';
import path from 'path';

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
};

// Aptos client is initialized from src/lib/aptos.ts

// Comment out Twitter API initialization
// let twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);
// if (
//   process.env.TWITTER_API_KEY &&
//   process.env.TWITTER_API_SECRET &&
//   process.env.TWITTER_ACCESS_TOKEN &&
//   process.env.TWITTER_ACCESS_TOKEN_SECRET
// ) {
//   // For posting tweets we need user context auth (not just bearer token)
//   twitterClient = new TwitterApi({
//     appKey: process.env.TWITTER_API_KEY,
//     appSecret: process.env.TWITTER_API_SECRET,
//     accessToken: process.env.TWITTER_ACCESS_TOKEN,
//     accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
//   });
// }

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
  // if (!CONFIG.twitterPostResults || !twitterClient) {
  //   log("Twitter posting disabled or client not initialized");
  //   return;
  // }
  
  // try {
  //   const response = await twitterClient.v2.tweet(message);
  //   log(`Posted to Twitter: ${message}`);
  //   return response;
  // } catch (error) {
  //   log(`Error posting to Twitter: ${error}`);
  // }
  
  // Just log the message instead
  log(`Would have posted to Twitter: ${message}`);
  return null;
}

/**
 * Execute on-chain action based on decision
 */
async function executeOnChainAction(
  action: ActionType,
  amount: number,
  confidence: number
) {
  log(
    `Executing on-chain action: ${action} amount=${amount} confidence=${confidence.toFixed(2)}`
  );

  // In a real implementation, this would use Move Agent Kit
  // For MVP, we just log the action details

  switch (action) {
    case "BUY":
      log(`Would execute: Buy ${amount} APT`);
      // In real implementation:
      // await agent.swapTokens(...);
      break;
    case "SELL":
      log(`Would execute: Sell ${amount} APT`);
      // In real implementation:
      // await agent.swapTokens(...);
      break;
    case "DEPOSIT":
      log(`Would execute: Deposit ${amount} APT to yield protocol`);
      // In real implementation:
      // await agent.deposit(...);
      break;
    case "WITHDRAW":
      log(`Would execute: Withdraw ${amount} APT from yield protocol`);
      // In real implementation:
      // await agent.withdraw(...);
      break;
    case "HOLD":
      log("Action: HOLD - No transaction needed");
      break;
  }

  // Generate and post tweet about the action
  if (action !== "HOLD") {
    const actionVerb =
      action === "BUY" || action === "DEPOSIT" ? "bought" : "sold";
    const tweetContent = `HypeFlow AI just ${actionVerb} ${amount} $APT because Twitter sentiment is ${confidence > 0.7 ? "strongly" : ""} ${confidence > 0.5 ? "positive" : "negative"}! #AptosHype #Web3 #HypeFlowAI`;
    await postToTwitter(tweetContent);
  }

  return true;
}

// Add hardcoded mock tweets function
async function getMockTweetsWithSentiment(hashtag: string) {
  const mockTweets = [
    {
      id: "1",
      text: "Absolutely loving the #Aptos ecosystem! The community is amazing, and the technology is top-notch. 🚀",
      sentiment: 0.9,
      created_at: new Date().toISOString(),
    },
    {
      id: "2",
      text: "The Move language is a game-changer! Developing on #Aptos has never been more exciting. 🔥",
      sentiment: 0.8,
      created_at: new Date().toISOString(),
    },
    {
      id: "3",
      text: "#Aptos is redefining blockchain performance. Insane transaction speeds and low fees!",
      sentiment: 0.9,
      created_at: new Date().toISOString(),
    },
    {
      id: "4",
      text: "Exciting times ahead for #Aptos! The development updates keep getting better and better. 📈",
      sentiment: 0.85,
      created_at: new Date().toISOString(),
    },
    {
      id: "5",
      text: "#Aptos is leading the way in blockchain scalability. Real-world adoption is coming soon!",
      sentiment: 0.9,
      created_at: new Date().toISOString(),
    },
    {
      id: "6",
      text: "Every update from #Aptos makes me more bullish. This project is going places! 🚀",
      sentiment: 0.8,
      created_at: new Date().toISOString(),
    },
    {
      id: "7",
      text: "The developer experience on #Aptos is getting better. Excited to build more projects!",
      sentiment: 0.75,
      created_at: new Date().toISOString(),
    },
    {
      id: "8",
      text: "More partnerships, more adoption! #Aptos is proving itself as a serious blockchain contender.",
      sentiment: 0.8,
      created_at: new Date().toISOString(),
    },
    {
      id: "9",
      text: "#Aptos is solving blockchain problems that others ignore. The future looks bright!",
      sentiment: 0.85,
      created_at: new Date().toISOString(),
    },
    {
      id: "10",
      text: "Security and speed—#Aptos has both. A great time to be involved in this ecosystem!",
      sentiment: 0.8,
      created_at: new Date().toISOString(),
    },
    {
      id: "11",
      text: "Tried out #Aptos smart contracts today, and I must say, the experience is fantastic! 😃",
      sentiment: 0.75,
      created_at: new Date().toISOString(),
    },
    {
      id: "12",
      text: "Tokenomics aside, #Aptos is one of the most technically advanced blockchains out there.",
      sentiment: 0.7,
      created_at: new Date().toISOString(),
    },
    {
      id: "13",
      text: "Great dev resources coming out from the #Aptos team. Documentation is improving rapidly! 📖",
      sentiment: 0.7,
      created_at: new Date().toISOString(),
    },
    {
      id: "14",
      text: "Excited to see how #Aptos adoption grows in the coming years. Solid fundamentals!",
      sentiment: 0.8,
      created_at: new Date().toISOString(),
    },
    {
      id: "15",
      text: "Been following #Aptos since launch, and it's great to see continuous improvements. 💪",
      sentiment: 0.75,
      created_at: new Date().toISOString(),
    },
    {
      id: "16",
      text: "#Aptos NFTs are taking off! The ecosystem is growing beyond just DeFi.",
      sentiment: 0.8,
      created_at: new Date().toISOString(),
    },
    {
      id: "17",
      text: "More DeFi projects launching on #Aptos—exciting times ahead!",
      sentiment: 0.85,
      created_at: new Date().toISOString(),
    },
    {
      id: "18",
      text: "Just tried an #Aptos-based dApp, and it's smoother than anything I've used before!",
      sentiment: 0.9,
      created_at: new Date().toISOString(),
    },
    {
      id: "19",
      text: "I think #Aptos will play a major role in blockchain gaming. The tech is built for it!",
      sentiment: 0.85,
      created_at: new Date().toISOString(),
    },
    {
      id: "20",
      text: "#Aptos is here to stay. If you're not paying attention, you're missing out! 🔥",
      sentiment: 0.9,
      created_at: new Date().toISOString(),
    },
  ];

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
    console.log(overallSentiment)

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
