import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import natural from "natural";

// Load environment variables
dotenv.config();

// Constants
const SENTIMENT_THRESHOLDS = {
  POSITIVE: 0.2,
  NEGATIVE: -0.2,
};

const ENGAGEMENT_WEIGHTS = {
  RETWEET: 2,
  LIKE: 1,
  BASE: 1, // Minimum weight per tweet
};

// Initialize Twitter client
const bearerToken = process.env.TWITTER_BEARER_TOKEN || "";
const twitterClient = new TwitterApi(bearerToken).readOnly;

// Initialize sentiment analysis tools (singleton instances)
const tokenizer = new natural.WordTokenizer();
const analyzer = new natural.SentimentAnalyzer(
  "English",
  natural.PorterStemmer,
  "afinn"
);

/**
 * Analyzes sentiment of a single tweet
 * @param text Tweet text content
 * @returns Sentiment score and classification
 */
function analyzeSingleTweet(text: string) {
  const words = tokenizer.tokenize(text) || [];
  const sentimentScore = analyzer.getSentiment(words);

  return {
    sentiment_score: sentimentScore,
    sentiment:
      sentimentScore > SENTIMENT_THRESHOLDS.POSITIVE
        ? "positive"
        : sentimentScore < SENTIMENT_THRESHOLDS.NEGATIVE
          ? "negative"
          : "neutral",
  };
}

/**
 * Calculates weighted sentiment based on engagement metrics
 * @param tweets Array of analyzed tweets with engagement metrics
 * @returns Overall weighted sentiment score
 */
function calculateWeightedSentiment(tweets: any[]) {
  if (!tweets?.length) return 0;

  const { totalWeightedSentiment, totalWeight } = tweets.reduce(
    (acc, tweet) => {
      const engagementWeight =
        (tweet.public_metrics?.retweet_count || 0) *
          ENGAGEMENT_WEIGHTS.RETWEET +
        (tweet.public_metrics?.like_count || 0) * ENGAGEMENT_WEIGHTS.LIKE;

      const weight = Math.max(engagementWeight, ENGAGEMENT_WEIGHTS.BASE);

      return {
        totalWeightedSentiment:
          acc.totalWeightedSentiment + tweet.sentiment_score * weight,
        totalWeight: acc.totalWeight + weight,
      };
    },
    { totalWeightedSentiment: 0, totalWeight: 0 }
  );

  return totalWeight > 0 ? totalWeightedSentiment / totalWeight : 0;
}

/**
 * Fetches and analyzes tweets based on a search query
 * @param query Search query or hashtag
 * @param maxResults Maximum number of tweets to fetch (max 100)
 * @returns Analyzed tweets with sentiment and overall sentiment score
 */
export async function fetchTweetsWithSentiment(
  query: string,
  maxResults: number = 5
) {
  try {
    const tweets = await twitterClient.v2.search(query, {
      "tweet.fields": ["created_at", "public_metrics", "author_id"],
      max_results: maxResults,
    });

    // Analyze each tweet
    const analyzedTweets = tweets.data.data.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      author_id: tweet.author_id,
      public_metrics: tweet.public_metrics,
      ...analyzeSingleTweet(tweet.text),
    }));

    // Calculate overall weighted sentiment
    const overallSentiment = calculateWeightedSentiment(analyzedTweets);

    return {
      data: analyzedTweets,
      meta: tweets.data.meta,
      overall_sentiment: overallSentiment,
      overall_sentiment_label:
        overallSentiment > SENTIMENT_THRESHOLDS.POSITIVE
          ? "positive"
          : overallSentiment < SENTIMENT_THRESHOLDS.NEGATIVE
            ? "negative"
            : "neutral",
    };
  } catch (error) {
    console.error("Error fetching tweets:", error);
    throw error;
  }
}

/**
 * Calculates overall sentiment score from a collection of tweets
 * @param tweets - Array of analyzed tweets
 * @returns Overall sentiment score
 */
export function calculateOverallSentiment(tweets: any[]) {
  if (!tweets || tweets.length === 0) {
    return 0;
  }

  // Calculate weighted sentiment based on engagement metrics
  let totalWeightedSentiment = 0;
  let totalWeight = 0;

  tweets.forEach((tweet) => {
    // Calculate engagement weight (retweets are worth more than likes)
    const weight =
      (tweet.public_metrics?.retweet_count || 0) * 2 +
      (tweet.public_metrics?.like_count || 0);

    // Add a minimum weight of 1 per tweet
    const finalWeight = Math.max(weight, 1);

    totalWeightedSentiment += tweet.sentiment_score * finalWeight;
    totalWeight += finalWeight;
  });

  // Return normalized sentiment score
  const overallSentiment =
    totalWeight > 0 ? totalWeightedSentiment / totalWeight : 0;

  return overallSentiment;
}

/**
 * Analyze sentiment of tweets using Natural.js SentimentAnalyzer
 * This function handles tweets with or without pre-assigned sentiment
 * @param tweets Array of tweet objects with text content
 * @returns Number representing average sentiment (-1 to 1 scale)
 */
export function analyzeTweetSentiment(tweets: any[]) {
  if (!tweets || tweets.length === 0) {
    return 0;
  }

  // Initialize the sentiment analyzer from Natural.js
  const analyzer = new natural.SentimentAnalyzer(
    "English",
    natural.PorterStemmer,
    "afinn"
  );

  let totalSentiment = 0;
  let validTweets = 0;

  for (const tweet of tweets) {
    // Skip invalid tweets
    if (!tweet || !tweet.text) continue;

    // If tweet already has a valid sentiment score, use it
    if (typeof tweet.sentiment === "number" && !isNaN(tweet.sentiment)) {
      totalSentiment += tweet.sentiment;
      validTweets++;
      continue;
    }

    // Otherwise, analyze the text
    const words = new natural.WordTokenizer().tokenize(tweet.text);
    if (!words || words.length === 0) continue;

    const sentimentScore = analyzer.getSentiment(words);

    // Only count valid sentiment scores
    if (typeof sentimentScore === "number" && !isNaN(sentimentScore)) {
      // Store the sentiment on the tweet object for future use
      tweet.sentiment = sentimentScore;
      totalSentiment += sentimentScore;
      validTweets++;
    }
  }

  // Return average sentiment, or 0 if no valid tweets
  return validTweets > 0 ? totalSentiment / validTweets : 0;
}
