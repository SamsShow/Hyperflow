import {
  AptosAccount,
  AptosClient,
  HexString,
  TxnBuilderTypes,
  BCS,
} from "aptos";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

// Initialize constants
const NODE_URL =
  process.env.APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com";
const NETWORK = process.env.APTOS_NETWORK || "testnet";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify readline question
function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function transferTokens() {
  try {
    // Initialize Aptos client
    const client = new AptosClient(NODE_URL);

    // Create or load sender account
    const senderPrivateKey = process.env.WALLET_PRIVATE_KEY;
    if (!senderPrivateKey) {
      throw new Error("Sender private key not found in environment variables");
    }

    // Create AptosAccount from private key
    const sender = new AptosAccount(
      HexString.ensure(senderPrivateKey).toUint8Array()
    );

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

    console.log("\nStarting token transfer...");
    console.log(`From: ${sender.address()}`);
    console.log(`To: ${receiverAddress}`);
    console.log(`Amount: ${amount} octas (${amount / 100000000} APT)`);

    // Confirm transaction
    const confirmation = await question("\nConfirm transaction? (y/n): ");
    if (confirmation.toLowerCase() !== "y") {
      console.log("Transaction cancelled by user.");
      rl.close();
      return false;
    }

    // Get initial balances
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

      console.log(
        `Sender balance: ${(senderResource.data as any).coin.value} octas`
      );
      console.log(
        `Receiver balance: ${(receiverResource.data as any).coin.value} octas`
      );
    } catch (error: any) {
      console.log("Could not fetch balances:", error.message);
    }

    // Build transaction payload for token transfer
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
    console.log("\nBuilding and signing transaction...");
    const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
      client.getAccount(sender.address()),
      client.getChainId(),
    ]);

    const rawTxn = new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(sender.address().toString()),
      BigInt(sequenceNumber),
      entryFunctionPayload,
      BigInt(2000), // Max gas amount
      BigInt(100), // Gas unit price
      BigInt(Math.floor(Date.now() / 1000) + 60), // Expiration timestamp (60 seconds from now)
      new TxnBuilderTypes.ChainId(chainId)
    );

    // Sign transaction
    const bcsTxn = AptosClient.generateBCSTransaction(sender, rawTxn);

    // Submit transaction
    console.log("Submitting transaction...");
    const pendingTxn = await client.submitSignedBCSTransaction(bcsTxn);

    // Wait for transaction
    console.log("Waiting for transaction confirmation...");
    const txnResult = await client.waitForTransactionWithResult(
      pendingTxn.hash
    );

    console.log("\nTransfer completed successfully! ✅");
    console.log("Transaction hash:", pendingTxn.hash);
    console.log(
      "View on explorer:",
      `https://explorer.aptoslabs.com/txn/${pendingTxn.hash}?network=${NETWORK}`
    );

    // Get updated balances
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

      console.log(
        `Sender balance: ${(senderResource.data as any).coin.value} octas`
      );
      console.log(
        `Receiver balance: ${(receiverResource.data as any).coin.value} octas`
      );
    } catch (error: any) {
      console.log("Could not fetch balances:", error.message);
    }

    rl.close();
    return true;
  } catch (error) {
    console.error("\n❌ Error during transfer:", error);
    rl.close();
    throw error;
  }
}

// Execute the transfer
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
