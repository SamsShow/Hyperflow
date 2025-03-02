/**
 * Decision Logic Module for HypeFlow AI
 * Converts sentiment scores into trading decisions
 */

// Decision thresholds
export const DEFAULT_THRESHOLDS = {
  BULLISH_THRESHOLD: 0.4, // If sentiment > this value, take a bullish action
  BEARISH_THRESHOLD: -0.2, // If sentiment < this value, take a bearish action
  NEUTRAL_ZONE: [-0.2, 0.4], // Range where no action is taken (wait and observe)
};

export type ActionType = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW" | "HOLD";

export interface DecisionConfig {
  bullishThreshold: number;
  bearishThreshold: number;
  minTweetVolume: number; // Minimum number of tweets needed for making a decision
  timeWindowMinutes: number; // Time window for analyzing tweets (in minutes)
  maxPositionSize: number; // Maximum position size in USD or token amount
  currentlyInvested: boolean; // Whether we already have an active position
}

export interface DecisionResult {
  action: ActionType;
  confidence: number; // 0 to 1, how confident we are in this decision
  reason: string;
  suggestedAmount?: number; // Suggested amount to buy/sell (optional)
}

/**
 * Determines the action to take based on sentiment score and configuration
 * @param sentimentScore Overall sentiment score (-1 to 1)
 * @param tweetCount Number of tweets analyzed
 * @param config Decision configuration parameters
 * @returns Decision result with action, confidence, and reasoning
 */
export function makeDecision(
  sentimentScore: number,
  tweetCount: number,
  config: DecisionConfig
): DecisionResult {
  // Default to HOLD if insufficient data
  if (tweetCount < config.minTweetVolume) {
    return {
      action: "HOLD",
      confidence: 0,
      reason: `Insufficient data: only ${tweetCount} tweets (minimum required: ${config.minTweetVolume})`,
    };
  }

  // Calculate confidence based on how far the sentiment is from thresholds
  let confidence = 0;
  let action: ActionType = "HOLD";
  let reason = "";

  if (sentimentScore > config.bullishThreshold) {
    // Bullish scenario
    confidence = Math.min(
      (sentimentScore - config.bullishThreshold) /
        (1 - config.bullishThreshold),
      1
    );

    if (config.currentlyInvested) {
      action = "DEPOSIT";
      reason = `Positive sentiment (${sentimentScore.toFixed(2)}) above threshold (${config.bullishThreshold}). Already invested, so deposit more into yield.`;
    } else {
      action = "BUY";
      reason = `Positive sentiment (${sentimentScore.toFixed(2)}) above threshold (${config.bullishThreshold}). Recommend buying.`;
    }
  } else if (sentimentScore < config.bearishThreshold) {
    // Bearish scenario
    confidence = Math.min(
      (config.bearishThreshold - sentimentScore) /
        (config.bearishThreshold + 1),
      1
    );

    if (config.currentlyInvested) {
      action = "WITHDRAW";
      reason = `Negative sentiment (${sentimentScore.toFixed(2)}) below threshold (${config.bearishThreshold}). Recommend withdrawing funds.`;
    } else {
      action = "SELL";
      reason = `Negative sentiment (${sentimentScore.toFixed(2)}) below threshold (${config.bearishThreshold}). Recommend selling if holding.`;
    }
  } else {
    // Neutral zone - hold and observe
    action = "HOLD";
    reason = `Neutral sentiment (${sentimentScore.toFixed(2)}) within thresholds (${config.bearishThreshold} to ${config.bullishThreshold}). No action needed.`;
    confidence = 0.5; // Medium confidence for hold decisions
  }

  // Calculate suggested amount based on confidence (more confident = higher percentage of max position)
  const suggestedAmount =
    action !== "HOLD" ? Math.round(config.maxPositionSize * confidence) : 0;

  return {
    action,
    confidence,
    reason,
    suggestedAmount,
  };
}

/**
 * Reduces position size based on how recent the data is
 * @param decisionResult Original decision result
 * @param dataAgeMinutes Age of the sentiment data in minutes
 * @param maxAgeMinutes Maximum acceptable age for full confidence (beyond this, confidence decreases)
 * @returns Updated decision result with adjusted confidence and amount
 */
export function adjustForDataAge(
  decisionResult: DecisionResult,
  dataAgeMinutes: number,
  maxAgeMinutes: number
): DecisionResult {
  if (dataAgeMinutes <= maxAgeMinutes) {
    // Data is fresh enough, no adjustment needed
    return decisionResult;
  }

  // Calculate age factor (1.0 for fresh data, approaching 0 as data gets older)
  const ageFactor = Math.max(
    0,
    1 - (dataAgeMinutes - maxAgeMinutes) / (maxAgeMinutes * 3)
  );

  // Adjust confidence and amount
  const adjustedConfidence = decisionResult.confidence * ageFactor;
  const adjustedAmount = decisionResult.suggestedAmount
    ? Math.round(decisionResult.suggestedAmount * ageFactor)
    : undefined;

  // If confidence drops too low, change action to HOLD
  if (adjustedConfidence < 0.2 && decisionResult.action !== "HOLD") {
    return {
      action: "HOLD",
      confidence: adjustedConfidence,
      reason: `${decisionResult.reason} However, data is ${dataAgeMinutes} minutes old, which exceeds the freshness threshold of ${maxAgeMinutes} minutes. Action changed to HOLD.`,
      suggestedAmount: 0,
    };
  }

  // Otherwise, keep original action with adjusted confidence
  return {
    ...decisionResult,
    confidence: adjustedConfidence,
    reason: `${decisionResult.reason} (Note: data is ${dataAgeMinutes} minutes old)`,
    suggestedAmount: adjustedAmount,
  };
}
