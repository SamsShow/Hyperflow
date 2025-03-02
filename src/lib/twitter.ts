import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import natural from "natural";

// Load environment variables
dotenv.config();

// Initialize Twitter client - use bearerToken for read-only operations
const bearerToken = process.env.TWITTER_BEARER_TOKEN || "";
const twitterClient = new TwitterApi(bearerToken);

// Create a read-only client
const roClient = twitterClient.readOnly;

// Initialize sentiment analyzer
const analyzer = new natural.SentimentAnalyzer(
  "English",
  natural.PorterStemmer,
  "afinn"
);

/**
 * Fetches tweets based on a hashtag or search query
 * @param query - Hashtag or search query to search for
 * @param maxResults - Maximum number of tweets to fetch (max 100)
 * @returns Array of tweets with sentiment scores
 */
export async function fetchTweetsWithSentiment(
  query: string,
  maxResults: number = 5
) {
  try {
    // Search tweets
    const tweets = await roClient.v2.search(query, {
      "tweet.fields": ["created_at", "public_metrics", "author_id"],
      max_results: maxResults,
    });

    // Analyze sentiment for each tweet
    const analyzedTweets = tweets.data.data.map((tweet) => {
      const text = tweet.text;
      // Perform sentiment analysis
      const words = new natural.WordTokenizer().tokenize(text) || [];
      const sentimentScore = analyzer.getSentiment(words);

      return {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author_id: tweet.author_id,
        public_metrics: tweet.public_metrics,
        sentiment_score: sentimentScore,
        // Classify sentiment: positive (> 0.2), neutral (between -0.2 and 0.2), negative (< -0.2)
        sentiment:
          sentimentScore > 0.2
            ? "positive"
            : sentimentScore < -0.2
              ? "negative"
              : "neutral",
      };
    });

    return {
      data: analyzedTweets,
      meta: tweets.data.meta,
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
