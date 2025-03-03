# DEX Integration for Hyperflow

This document explains how the Hyperflow system integrates with decentralized exchanges (DEX) on the Aptos blockchain to execute automated token swaps based on social sentiment analysis.

## Overview

Hyperflow now has the capability to execute real token swaps on PancakeSwap DEX on Aptos. The system analyzes social sentiment (primarily Twitter) and makes trading decisions, which can now be automatically executed on-chain.

## Key Components

### 1. Move Agent Kit Integration

We use the [Move Agent Kit](https://github.com/MetaMove/move-agent-kit) library to interact with the Aptos blockchain. This toolkit simplifies interactions with Move-based blockchains and provides a unified interface for performing various blockchain operations.

```typescript
import { MoveAgentKit, TokenSwapParams } from "move-agent-kit";
```

### 2. Token Swap Functionality

The `swapTokens` function in `src/lib/aptos.ts` handles the token swap operation:

```typescript
export const swapTokens = async (
  fromToken: "APT" | "USDC",
  toToken: "APT" | "USDC",
  amount: number,
  slippage: number = 0.5
): Promise<string> => {
  // Implementation details...
}
```

This function:
- Converts token amounts to the correct decimal precision
- Sets appropriate slippage (default 0.5%)
- Executes the swap via PancakeSwap router
- Returns the transaction hash

### 3. Wallet Balance Management

Before executing trades, the system checks wallet balances to ensure sufficient funds:

```typescript
export const getWalletBalances = async () => {
  // Implementation details...
}
```

### 4. Price Fetching

The system includes a function to get the current APT price (currently using mock data):

```typescript
export const getAptPrice = async (): Promise<number> => {
  // Implementation details...
}
```

### 5. On-Chain Sentiment Recording

All sentiment analysis results are recorded on-chain using the `recordSentimentTrade` function:

```typescript
export const recordSentimentTrade = async (
  sentimentScore: number,
  confidence: number
) => {
  // Implementation details...
}
```

## Configuration

To use the DEX integration, you need to set up the following environment variables:

1. `WALLET_PRIVATE_KEY`: Your wallet's private key
2. `SENTIMENT_TRADER_ADDRESS`: Address of the sentiment trader contract
3. `PROOF_OF_HYPE_ADDRESS`: Address of the proof of hype contract
4. `NEXT_PUBLIC_APP_NETWORK`: Network to use (mainnet, testnet, etc.)
5. `NEXT_PUBLIC_APTOS_API_KEY`: Your Aptos API key

See `.env.example` for a template.

## Execution Flow

1. The Hyperflow agent analyzes Twitter sentiment
2. The decision logic converts sentiment scores into trading decisions
3. For BUY/SELL decisions:
   - Check wallet balances
   - Calculate required amounts based on current prices
   - Execute token swaps on PancakeSwap
   - Record the sentiment and trade on-chain
4. For HOLD decisions:
   - Only record the sentiment on-chain (no trade execution)

## Security Considerations

- Private keys are managed through environment variables and never exposed in code
- Balance checks prevent insufficient funds errors
- Slippage protection is implemented to prevent excessive price impact

## Testing

You can test the DEX integration by running:

```bash
npm run hypeflow:start
```

This will execute the Hyperflow agent with the DEX integration enabled.

## Future Improvements

1. Connect to real price APIs instead of using mock data
2. Add support for more tokens beyond APT and USDC
3. Implement more sophisticated trading strategies
4. Add support for other DEXes beyond PancakeSwap
