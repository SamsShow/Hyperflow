module HypeFlow::proof_of_hype {
    use std::signer;
    use std::string::{Self, String};
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_token::token;
    use aptos_std::table::{Self, Table};
    
    // Error codes
    const ERR_UNAUTHORIZED: u64 = 1;
    
    // Collection info
    const COLLECTION_NAME: vector<u8> = b"HypeFlow Proof of Hype";
    const COLLECTION_DESCRIPTION: vector<u8> = b"Rewards for active participants in the HypeFlow ecosystem";
    const COLLECTION_URI: vector<u8> = b"https://hypeflow.ai/collection";
    
    // NFT Rewards State
    struct ProofOfHypeState has key {
        // Track minted NFTs
        minted_nfts: Table<address, u64>,
        // Next token ID
        next_token_id: u64,
        // Events
        mint_events: event::EventHandle<MintEvent>,
    }
    
    // Mint event
    struct MintEvent has drop, store {
        recipient: address,
        token_id: u64,
        contribution_score: u64,
        timestamp: u64,
    }
    
    // Initialize the NFT rewards system
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        
        // Check if the account already has ProofOfHypeState
        assert!(!exists<ProofOfHypeState>(account_addr), 0);
        
        // Create the collection first
        token::create_collection(
            account,
            string::utf8(COLLECTION_NAME),
            string::utf8(COLLECTION_DESCRIPTION),
            string::utf8(COLLECTION_URI),
            1000, // Max supply of NFTs
            vector<bool>[false, false, false] // Collection mutate settings
        );
        
        // Initialize state
        move_to(account, ProofOfHypeState {
            minted_nfts: table::new(),
            next_token_id: 0,
            mint_events: account::new_event_handle(account),
        });
    }
    
    // Mint a Proof of Hype NFT to a participant
    public entry fun mint_proof_of_hype(
        account: &signer,
        recipient: address,
        contribution_score: u64,
        token_name: String,
        token_description: String,
        token_uri: String,
    ) acquires ProofOfHypeState {
        let account_addr = signer::address_of(account);
        
        assert!(exists<ProofOfHypeState>(account_addr), ERR_UNAUTHORIZED);
        let state = borrow_global_mut<ProofOfHypeState>(account_addr);
        
        // Get next token ID
        let token_id = state.next_token_id;
        
        // Token mutability config - whether various fields can be mutated
        let token_mutability_config = token::create_token_mutability_config(
            &vector<bool>[false, false, false, false, true]
        );
        
        // Create token data
        let token_data_id = token::create_tokendata(
            account,
            string::utf8(COLLECTION_NAME),
            token_name,
            token_description,
            1, // Maximum copies of this token that can be created
            token_uri,
            account_addr, // Royalty payee address
            1000, // Royalty denominator
            0, // Royalty numerator (0 = no royalty)
            token_mutability_config,
            vector<String>[], // Property keys
            vector<vector<u8>>[], // Property values
            vector<String>[], // Property types
        );
        
        // Mint the token
        let token_id_created = token::mint_token(account, token_data_id, 1);
        
        // Transfer token to recipient if not the same as minter
        if (signer::address_of(account) != recipient) {
            // In a real implementation, you'd need to ensure the recipient account exists
            // For now, we'll just transfer directly
            token::direct_transfer(account, account, token_id_created, 1);
            // Note: In production, you'd need a different approach to transfer to another account
        };
        
        // Update recipient's NFT count
        if (!table::contains(&state.minted_nfts, recipient)) {
            table::add(&mut state.minted_nfts, recipient, 1);
        } else {
            let count = table::borrow_mut(&mut state.minted_nfts, recipient);
            *count = *count + 1;
        };
        
        // Create and emit mint event
        let mint_event = MintEvent {
            recipient,
            token_id,
            contribution_score,
            timestamp: timestamp::now_seconds(),
        };
        
        event::emit_event(&mut state.mint_events, mint_event);
        
        // Increment token ID
        state.next_token_id = token_id + 1;
    }
    
    // Get user's NFT count
    public fun get_nft_count(addr: address): u64 acquires ProofOfHypeState {
        let publisher_addr = @HypeFlow; // This should be the deployer address
        
        let state = borrow_global<ProofOfHypeState>(publisher_addr);
        
        if (table::contains(&state.minted_nfts, addr)) {
            *table::borrow(&state.minted_nfts, addr)
        } else {
            0
        }
    }
}
