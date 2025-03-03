/**
 * Test DEX Integration
 * 
 * This script tests the DEX integration functionality for Hyperflow
 * by executing a small token swap between APT and USDC.
 */

import dotenv from "dotenv";
import { 
  swapTokens, 
  getWalletBalances, 
  getAptPrice,
  recordSentimentTrade
} from "../src/lib/aptos.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Load environment variables
dotenv.config();

// Get the current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log function
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Also append to log file
  const logFile = path.join(__dirname, "../logs/dex-test.log");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, logMessage + "\n");
}

async function testDexIntegration() {
  log("Starting DEX integration test");
  
  try {
    // 1. Test sentiment recording
    log("Testing sentiment recording...");
    await recordSentimentTrade(0.75, 0.85);
    log("✅ Sentiment recording successful");
    
    // 2. Get wallet balances
    log("Fetching wallet balances...");
    const balances = await getWalletBalances();
    log(`Current balances: ${balances.apt.toFixed(4)} APT, ${balances.usdc.toFixed(2)} USDC`);
    
    // 3. Get APT price
    const aptPrice = await getAptPrice();
    log(`Current APT price: $${aptPrice.toFixed(2)}`);
    
    // 4. Test small swap (only if we have enough balance)
    const testAmount = 0.1; // Small test amount
    
    if (balances.usdc >= testAmount * aptPrice) {
      log(`Testing USDC → APT swap (${testAmount * aptPrice} USDC)...`);
      const buyTxHash = await swapTokens("USDC", "APT", testAmount * aptPrice);
      log(`✅ Buy transaction successful. Hash: ${buyTxHash}`);
      
      // Wait a bit for the transaction to be processed
      log("Waiting for transaction to be processed...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get updated balances
      const updatedBalances = await getWalletBalances();
      log(`Updated balances: ${updatedBalances.apt.toFixed(4)} APT, ${updatedBalances.usdc.toFixed(2)} USDC`);
      
      // Swap back a small amount
      if (updatedBalances.apt >= testAmount) {
        log(`Testing APT → USDC swap (${testAmount} APT)...`);
        const sellTxHash = await swapTokens("APT", "USDC", testAmount);
        log(`✅ Sell transaction successful. Hash: ${sellTxHash}`);
      } else {
        log("⚠️ Insufficient APT balance for reverse swap test");
      }
    } else {
      log("⚠️ Insufficient USDC balance for swap test");
    }
    
    log("DEX integration test completed successfully");
  } catch (error) {
    if (error instanceof Error) {
      log(`❌ Error during DEX integration test: ${error.message}`);
    } else {
      log(`❌ Error during DEX integration test: ${String(error)}`);
    }
    console.error(error);
  }
}

// Run the test if this script is executed directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  testDexIntegration();
}
