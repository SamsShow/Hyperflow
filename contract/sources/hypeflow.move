module HypeFlow::sentiment_trader {
    use std::signer;
    use std::string::{Self, String};
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    
    // Error codes
    const ERR_UNAUTHORIZED: u64 = 1;
    const ERR_INSUFFICIENT_BALANCE: u64 = 2;
    
    // Main HypeFlow state resource
    struct HypeFlowState has key {
        // Track sentiment history
        sentiment_history: Table<u64, SentimentRecord>,
        // Track trades executed
        trade_history: Table<u64, TradeRecord>,
        // Latest sentiment score
        current_sentiment: u64,
        // Is currently invested
        is_invested: bool,
        // Next record ID
        next_record_id: u64,
        // Events
        trade_events: event::EventHandle<TradeEvent>,
    }
    
    // Sentiment record
    struct SentimentRecord has store, drop, copy {
        timestamp: u64,
        sentiment_score: u64,
        tweet_volume: u64,
        action_taken: String,
    }
    
    // Trade record
    struct TradeRecord has store, drop, copy {
        timestamp: u64,
        action: String,
        amount: u64,
        confidence: u64,
    }
    
    // Trade event
    struct TradeEvent has drop, store {
        timestamp: u64,
        action: String,
        amount: u64,
        confidence: u64,
        sentiment_score: u64,
    }
    
    // Initialize the HypeFlow state
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        
        // Check if the account already has HypeFlowState
        assert!(!exists<HypeFlowState>(account_addr), 0);
        
        move_to(account, HypeFlowState {
            sentiment_history: table::new(),
            trade_history: table::new(),
            current_sentiment: 0,
            is_invested: false,
            next_record_id: 0,
            trade_events: account::new_event_handle(account),
        });
    }
    
    // Update sentiment from off-chain data
    public entry fun update_sentiment(
        account: &signer,
        sentiment_score: u64,
        tweet_volume: u64,
    ) acquires HypeFlowState {
        let account_addr = signer::address_of(account);
        
        // Ensure caller is authorized 
        // In production, you'd want more robust authorization
        assert!(exists<HypeFlowState>(account_addr), ERR_UNAUTHORIZED);
        
        let state = borrow_global_mut<HypeFlowState>(account_addr);
        
        // Update current sentiment
        state.current_sentiment = sentiment_score;
        
        // Record sentiment history
        let record_id = state.next_record_id;
        let now = timestamp::now_seconds();
        
        let pending_action = string::utf8(b"PENDING");
        table::add(&mut state.sentiment_history, record_id, SentimentRecord {
            timestamp: now,
            sentiment_score,
            tweet_volume,
            action_taken: pending_action,
        });
        
        // Increment next record ID
        state.next_record_id = record_id + 1;
    }
    
    // Execute a buy operation based on sentiment
    public entry fun execute_buy(
        account: &signer,
        amount: u64,
        confidence: u64,
    ) acquires HypeFlowState {
        let account_addr = signer::address_of(account);
        
        assert!(exists<HypeFlowState>(account_addr), ERR_UNAUTHORIZED);
        let state = borrow_global_mut<HypeFlowState>(account_addr);
        
        // Check that we're not already invested
        assert!(!state.is_invested, ERR_INSUFFICIENT_BALANCE);
        
        // In a real implementation, this would perform the actual token swap
        // using DEX interfaces available on Aptos
        
        // Record the trade
        let record_id = state.next_record_id;
        let now = timestamp::now_seconds();
        
        let buy_action = string::utf8(b"BUY");
        table::add(&mut state.trade_history, record_id, TradeRecord {
            timestamp: now,
            action: buy_action,
            amount,
            confidence,
        });
        
        // Create and emit trade event
        let buy_action_event = string::utf8(b"BUY");
        let trade_event = TradeEvent {
            timestamp: now,
            action: buy_action_event,
            amount,
            confidence,
            sentiment_score: state.current_sentiment,
        };
        
        event::emit_event(&mut state.trade_events, trade_event);
        
        // Update investment state
        state.is_invested = true;
        
        // Increment next record ID
        state.next_record_id = record_id + 1;
    }
    
    // Execute a sell operation based on sentiment
    public entry fun execute_sell(
        account: &signer,
        amount: u64,
        confidence: u64,
    ) acquires HypeFlowState {
        let account_addr = signer::address_of(account);
        
        assert!(exists<HypeFlowState>(account_addr), ERR_UNAUTHORIZED);
        let state = borrow_global_mut<HypeFlowState>(account_addr);
        
        // Check that we are invested
        assert!(state.is_invested, ERR_INSUFFICIENT_BALANCE);
        
        // Record the trade
        let record_id = state.next_record_id;
        let now = timestamp::now_seconds();
        
        let sell_action = string::utf8(b"SELL");
        table::add(&mut state.trade_history, record_id, TradeRecord {
            timestamp: now,
            action: sell_action,
            amount,
            confidence,
        });
        
        // Create and emit trade event
        let sell_action_event = string::utf8(b"SELL");
        let trade_event = TradeEvent {
            timestamp: now,
            action: sell_action_event,
            amount,
            confidence,
            sentiment_score: state.current_sentiment,
        };
        
        event::emit_event(&mut state.trade_events, trade_event);
        
        // Update investment state
        state.is_invested = false;
        
        // Increment next record ID
        state.next_record_id = record_id + 1;
    }
}
