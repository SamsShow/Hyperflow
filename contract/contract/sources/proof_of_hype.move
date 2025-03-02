module HypeFlow::proof_of_hype {
    use std::signer;
    use std::string::{Self, String};
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
        // NFT Collection
        collection_created: bool,
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
        
        move_to(account, ProofOfHypeState {
            collection_created: false,
            minted_nfts: table::new(),
            next_token_id: 0,
            mint_events: event::new_event_handle<MintEvent>(account),
        });
    }
    
    // Create the NFT collection
    public entry fun create_collection(account: &signer) acquires ProofOfHypeState {
        let account_addr = signer::address_of(account);
        
        assert!(exists<ProofOfHypeState>(account_addr), ERR_UNAUTHORIZED);
        let state = borrow_global_mut<ProofOfHypeState>(account_addr);
        
        // Ensure collection not already created
        assert!(!state.collection_created, 0);
        
        // Create the collection
        token::create_collection(
            account,
            string::utf8(COLLECTION_NAME),
            string::utf8(COLLECTION_DESCRIPTION),
            string::utf8(COLLECTION_URI),
            false, // unlimited supply
            false, // no royalty
        );
        
        state.collection_created = true;
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
        
        // Ensure collection is created
        assert!(state.collection_created, 0);
        
        // Get next token ID
        let token_id = state.next_token_id;
        
        // Mint the token to recipient
        token::create_token_script(
            account,
            string::utf8(COLLECTION_NAME),
            token_name,
            token_description,
            1, // One token
            token_uri,
            recipient, // Token recipient
            0, // No royalty
            0, // No royalty
            token::create_token_mutability_config(
                &vector[false, false, false, false, true],
            ),
            vector::empty<String>(),
            vector::empty<vector<u8>>(),
            vector::empty<String>(),
        );
        
        // Update recipient's NFT count
        if (!table::contains(&state.minted_nfts, recipient)) {
            table::add(&mut state.minted_nfts, recipient, 1);
        } else {
            let count = table::borrow_mut(&mut state.minted_nfts, recipient);
            *count = *count + 1;
        }
        
        // Emit mint event
        event::emit_event<MintEvent>(
            &mut state.mint_events,
            MintEvent {
                recipient,
                token_id,
                contribution_score,
                timestamp: timestamp::now_seconds(),
            },
        );
        
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
