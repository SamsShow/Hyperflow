# HypeFlow AI: Social Sentiment-Driven Automated Trading on Aptos

HypeFlow AI is an autonomous agent that monitors social sentiment (primarily on Twitter) related to Aptos-based projects and automatically executes on-chain actions (e.g., token swaps, staking) in response to that sentiment. By combining real-time social data with DeFi operations on Aptos, HypeFlow AI creates a viral feedback loop where increased hype drives investment activity—and that investment activity, in turn, fosters more hype.

## Project Overview

**Primary Track:** Social/Viral  
**Secondary Alignment:** DeFi (due to on-chain swaps/investments)  
**Core Technology:** Move Agent Kit for Aptos blockchain interactions

### System Architecture

```
                ┌────────────────────┐
                │ Twitter API /      │
                │ Social Data Stream │
                └─────────┬──────────┘
                          │
                    (1) Collect & Score
                          │
                    ┌─────▼─────┐
                    │ Sentiment  │
                    │ Analyzer   │
                    └─────┬─────┘
                          │
                    (2) Decision Logic
                          │
       ┌──────────────────┴───────────────────┐
       │                                      │
(3a) On-Chain Action                   (3b) Social Feedback
       │                                      │
┌──────▼────────┐                     ┌──────▼──────────┐
│ Move Agent Kit │                     │ Twitter Post/    │
│ (Aptos)        │                     │ Telegram Bot, etc│
└────────────────┘                     └──────────────────┘
        │                                      │
        └──────────── (4) Event Logs  ─────────┘
```

## Current Implementation Status

We have successfully implemented the following core components:

### 1. Twitter Sentiment Analysis (`src/lib/twitter.ts`)

- Integration with Twitter API to fetch tweets based on hashtags
- Sentiment analysis using the Natural NLP library
- Weighted sentiment scoring based on engagement metrics (retweets, likes)

### 2. Decision Logic (`src/lib/decisionLogic.ts`)

- Translation of sentiment scores into actionable trading decisions
- Configurable thresholds for bullish/bearish sentiment
- Confidence scoring based on sentiment strength and data freshness

### 3. Agent Orchestration (`scripts/hypeflow-agent.ts`)

- Main script that coordinates the entire workflow
- Configurable parameters for hashtags, decision thresholds, etc.
- Scheduling for periodic sentiment analysis
- Mock implementations of on-chain actions (to be integrated with Move Agent Kit)

## Setup Instructions

### Prerequisites

- Node.js and npm installed
- Twitter Developer Account with API keys
- Aptos wallet for on-chain actions

### Installation

1. Clone this repository:

```bash
git clone [repository-url]
cd hyperflow
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:
   Edit the `.env` file and add your Twitter API credentials:

```
TWITTER_API_KEY="your-api-key"
TWITTER_API_SECRET="your-api-secret"
TWITTER_ACCESS_TOKEN="your-access-token"
TWITTER_ACCESS_TOKEN_SECRET="your-access-token-secret"
TWITTER_BEARER_TOKEN="your-bearer-token"
```

### Running HypeFlow AI

To start the HypeFlow AI agent:

```bash
npm run hypeflow:start
```

This will:

1. Fetch tweets containing configured hashtags
2. Analyze sentiment of those tweets
3. Make trading decisions based on sentiment
4. Log actions that would be taken (currently mock implementations)
5. Continue monitoring at configured intervals

## Configuration

You can configure HypeFlow AI by modifying the CONFIG object in `scripts/hypeflow-agent.ts`:

- `hashtagsToTrack`: Array of hashtags to monitor
- `decisionConfig`:
  - `bullishThreshold`: Sentiment threshold for buying/depositing
  - `bearishThreshold`: Sentiment threshold for selling/withdrawing
  - `minTweetVolume`: Minimum tweets required for a decision
  - `maxPositionSize`: Maximum position size to take
- `checkIntervalMinutes`: How often to check Twitter for new sentiment
- `twitterPostResults`: Whether to post actions back to Twitter

## Next Steps

The following features are planned for future implementation:

1. **On-Chain Integration**: Full integration with Move Agent Kit to execute real transactions
2. **Advanced Sentiment Analysis**: More sophisticated NLP models for better accuracy
3. **Multi-Platform Support**: Expand beyond Twitter to include Discord, Telegram, etc.
4. **NFT Rewards System**: Implement "Proof of Hype" NFTs for top contributors
5. **Analytics Dashboard**: Web UI to visualize sentiment trends and trading performance

## Project Structure

- `src/lib/twitter.ts` - Twitter API integration and sentiment analysis
- `src/lib/decisionLogic.ts` - Convert sentiment to trading decisions
- `scripts/hypeflow-agent.ts` - Main agent orchestration script
- `.env` - Environment variables and API keys

## Custom Indexer Template

This project was built on top of the Aptos Custom Indexer Template. The template provides:

- **Folder structure** - A pre-made dapp folder structure with `src` for frontend, `contract` for Move contract and `indexer` for custom indexer.
- **Dapp infrastructure** - All required dependencies a dapp needs to start building on the Aptos network.
- **Move contract tools** - Commands for testing, compiling, and publishing Move contracts.

The tool utilizes aptos-cli npm package that lets us run Aptos CLI in a Node environment.

Some commands are built-in the template and can be ran as a npm script, for example:

npm run move:publish - a command to publish the Move contract
npm run move:test - a command to run Move unit tests
npm run move:compile - a command to compile the Move contract
npm run move:upgrade - a command to upgrade the Move contract
npm run dev - a command to run the frontend locally
npm run deploy - a command to deploy the dapp to Vercel
For all other available CLI commands, can run npx aptos and see a list of all available commands.

For more information about the underlying template, see the [Custom Indexer template docs](https://learn.aptoslabs.com/en/dapp-templates/custom-indexer-template).

## License

Apache-2.0
