/**
 * Aptos Token Transfer Script
 *
 * This script provides an interactive interface for transferring APT tokens
 * between accounts on the Aptos blockchain. It prompts for receiver address
 * and amount, displays transaction details, and confirms the transaction
 * before execution.
 */

import {
  AptosAccount,
  AptosClient,
  HexString,
  TxnBuilderTypes,
  BCS,
} from "aptos";
import dotenv from "dotenv";
import readline from "readline";
import { fileURLToPath } from "url";
import path from "path";
import { appendFileSync } from "fs";

// Get the current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Configuration
const CONFIG: {
  nodeUrl: string;
  network: string;
  gasAmount: bigint;
  gasUnitPrice: bigint;
  expirationSeconds: number;
  logFilePath: string;
} = {
  nodeUrl:
    process.env.APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com",
  network: process.env.APTOS_NETWORK || "testnet",
  gasAmount: BigInt(2000),
  gasUnitPrice: BigInt(100),
  expirationSeconds: 60,
  logFilePath: path.join(__dirname, "../../token-transfer-logs.txt"),
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper functions
function logMessage(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);

  try {
    appendFileSync(CONFIG.logFilePath, logMessage + "\n");
  } catch (error) {
    console.error("Error writing to log file:", error);
  }
}

// Promisify readline question
function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Main function to transfer tokens between accounts
 */
async function transferTokens() {
  try {
    logMessage("Starting token transfer process");

    // Initialize Aptos client
    const client = new AptosClient(CONFIG.nodeUrl);
    logMessage(`Connected to Aptos network: ${CONFIG.network}`);

    // Create or load sender account
    const senderPrivateKey = process.env.WALLET_PRIVATE_KEY;
    if (!senderPrivateKey) {
      throw new Error("Sender private key not found in environment variables");
    }

    // Create AptosAccount from private key
    const sender = new AptosAccount(
      HexString.ensure(senderPrivateKey).toUint8Array()
    );

    logMessage(`Sender address: ${sender.address()}`);
    console.log(`\nSender address: ${sender.address()}`);

    // Prompt for receiver address
    const receiverAddress = await question("Enter receiver address: ");
    if (!receiverAddress || !receiverAddress.trim()) {
      throw new Error("Receiver address is required");
    }

    // Validate receiver address format
    try {
      TxnBuilderTypes.AccountAddress.fromHex(receiverAddress);
    } catch (error) {
      throw new Error(
        "Invalid receiver address format. Please provide a valid Aptos address."
      );
    }

    // Prompt for amount
    const amountInput = await question("Enter amount to transfer (in APT): ");
    const amount = Math.floor(parseFloat(amountInput) * 100000000); // Convert to octas

    if (isNaN(amount) || amount <= 0) {
      throw new Error("Invalid amount. Please enter a positive number.");
    }

    logMessage(
      `Preparing to transfer ${amount / 100000000} APT to ${receiverAddress}`
    );
    console.log("\nStarting token transfer...");
    console.log(`From: ${sender.address()}`);
    console.log(`To: ${receiverAddress}`);
    console.log(`Amount: ${amount} octas (${amount / 100000000} APT)`);

    // Confirm transaction
    const confirmation = await question("\nConfirm transaction? (y/n): ");
    if (confirmation.toLowerCase() !== "y") {
      logMessage("Transaction cancelled by user");
      console.log("Transaction cancelled by user.");
      rl.close();
      return false;
    }

    // Get initial balances
    logMessage("Fetching initial balances");
    console.log("\nFetching initial balances...");
    try {
      const senderResource = await client.getAccountResource(
        sender.address().toString(),
        "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      const receiverResource = await client.getAccountResource(
        receiverAddress,
        "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      const senderBalance = (senderResource.data as any).coin.value;
      const receiverBalance = (receiverResource.data as any).coin.value;

      logMessage(`Initial sender balance: ${senderBalance} octas`);
      logMessage(`Initial receiver balance: ${receiverBalance} octas`);

      console.log(`Sender balance: ${senderBalance} octas`);
      console.log(`Receiver balance: ${receiverBalance} octas`);

      // Check if sender has enough balance
      if (
        BigInt(senderBalance) <
        BigInt(amount) + CONFIG.gasAmount * CONFIG.gasUnitPrice
      ) {
        throw new Error(
          `Insufficient balance. You need at least ${amount + Number(CONFIG.gasAmount * CONFIG.gasUnitPrice)} octas.`
        );
      }
    } catch (error: any) {
      logMessage(`Could not fetch balances: ${error.message}`);
      console.log("Could not fetch balances:", error.message);
    }

    // Build transaction payload for token transfer
    logMessage("Building transaction payload");
    const entryFunctionPayload =
      new TxnBuilderTypes.TransactionPayloadEntryFunction(
        TxnBuilderTypes.EntryFunction.natural(
          "0x1::coin",
          "transfer",
          [
            new TxnBuilderTypes.TypeTagStruct(
              TxnBuilderTypes.StructTag.fromString("0x1::aptos_coin::AptosCoin")
            ),
          ],
          [
            BCS.bcsToBytes(
              TxnBuilderTypes.AccountAddress.fromHex(receiverAddress)
            ),
            BCS.bcsSerializeUint64(amount),
          ]
        )
      );

    // Build and sign the transaction
    logMessage("Building and signing transaction");
    console.log("\nBuilding and signing transaction...");
    const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
      client.getAccount(sender.address()),
      client.getChainId(),
    ]);

    const rawTxn = new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(sender.address().toString()),
      BigInt(sequenceNumber),
      entryFunctionPayload,
      CONFIG.gasAmount, // Max gas amount
      CONFIG.gasUnitPrice, // Gas unit price
      BigInt(Math.floor(Date.now() / 1000) + CONFIG.expirationSeconds), // Expiration timestamp
      new TxnBuilderTypes.ChainId(chainId)
    );

    // Sign transaction
    const bcsTxn = AptosClient.generateBCSTransaction(sender, rawTxn);

    // Submit transaction
    logMessage("Submitting transaction to the network");
    console.log("Submitting transaction...");
    const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);

    // Wait for transaction
    logMessage(`Transaction submitted with hash: ${pendingTxn.hash}`);
    console.log("Waiting for transaction confirmation...");
    const txnResult = await client.waitForTransactionWithResult(
      pendingTxn.hash
    );

    // Check if transaction was successful
    let isSuccess = false;
    let errorStatus = "Transaction failed with unknown error";

    try {
      // Different versions of the Aptos SDK might have different response formats
      // This approach handles both older and newer versions
      if (typeof txnResult === "object") {
        if ("success" in txnResult) {
          isSuccess = Boolean(txnResult.success);
        }

        if ("vm_status" in txnResult) {
          errorStatus = JSON.stringify(txnResult.vm_status);
          // Some SDK versions indicate success with specific vm_status values
          if (
            typeof txnResult.vm_status === "string" &&
            txnResult.vm_status.toLowerCase().includes("executed successfully")
          ) {
            isSuccess = true;
          }
        }
      }
    } catch (error) {
      logMessage(`Error parsing transaction result: ${error}`);
    }

    if (isSuccess) {
      logMessage("Transaction completed successfully");
      console.log("\nTransfer completed successfully! ✅");
      console.log("Transaction hash:", pendingTxn.hash);
      console.log(
        "View on explorer:",
        `https://explorer.aptoslabs.com/txn/${pendingTxn.hash}?network=${CONFIG.network}`
      );
    } else {
      logMessage(`Transaction failed: ${errorStatus}`);
      console.log("\nTransaction failed ❌");
      console.log("Error:", errorStatus);
    }

    // Get updated balances
    logMessage("Fetching final balances");
    console.log("\nFetching final balances...");
    try {
      const senderResource = await client.getAccountResource(
        sender.address().toString(),
        "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      const receiverResource = await client.getAccountResource(
        receiverAddress,
        "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      const senderBalance = (senderResource.data as any).coin.value;
      const receiverBalance = (receiverResource.data as any).coin.value;

      logMessage(`Final sender balance: ${senderBalance} octas`);
      logMessage(`Final receiver balance: ${receiverBalance} octas`);

      console.log(`Sender balance: ${senderBalance} octas`);
      console.log(`Receiver balance: ${receiverBalance} octas`);
    } catch (error: any) {
      logMessage(`Could not fetch final balances: ${error.message}`);
      console.log("Could not fetch balances:", error.message);
    }

    logMessage("Token transfer process completed");
    rl.close();
    return true;
  } catch (error: any) {
    logMessage(`Error during transfer: ${error.message}`);
    console.error("\n❌ Error during transfer:", error.message);
    rl.close();
    throw error;
  }
}

// Execute the transfer
console.log("=".repeat(50));
console.log("🪙 Aptos Token Transfer Tool");
console.log("=".repeat(50));

transferTokens()
  .then((success) => {
    if (success) {
      console.log("\n✨ Transfer process completed");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
