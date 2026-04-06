// Active symbol from active_symbols response
export interface ActiveSymbol {
  exchange_is_open: 0 | 1;
  is_trading_suspended: 0 | 1;
  market: string;
  pip_size: number;
  subgroup: string;
  submarket: string;
  trade_count: number;
  underlying_symbol: string;
  underlying_symbol_name: string;
  underlying_symbol_type: string;
}

// Tick from ticks subscription
export interface Tick {
  ask: number;
  bid: number;
  epoch: number;
  id: string;
  quote: number;
  symbol: string;
}

// Tick history response
export interface TickHistory {
  prices: number[];
  times: number[];
}

// Proposal response
export interface Proposal {
  ask_price: number;
  payout: number;
  id: string;
  spot: number;
  longcode: string;
  date_start: number;
  display_value: string;
}

// Buy response
export interface BuyResponse {
  balance_after: number;
  buy_price: number;
  contract_id: number;
  longcode: string;
  payout: number;
  purchase_time: number;
  shortcode: string;
  start_time: number;
  transaction_id: number;
}

// Sell response
export interface SellResponse {
  balance_after: number;
  contract_id: number;
  reference_id: number;
  sold_for: number;
  transaction_id: number;
}

// Balance response
export interface Balance {
  balance: number;
  currency: string;
  id: string;
  loginid: string;
}

// Portfolio contract
export interface PortfolioContract {
  contract_id: number;
  contract_type: string;
  currency: string;
  buy_price: number;
  payout: number;
  symbol: string;
  longcode: string;
  shortcode: string;
  date_start: number;
  expiry_time: number;
}

// Open contract status
export interface OpenContract {
  account_id: string;
  contract_id: number;
  contract_type: string;
  currency: string;
  barrier: string;
  entry_spot: number;
  current_spot: number;
  buy_price: number;
  bid_price: number;
  payout: number;
  profit: number;
  profit_percentage: number;
  is_expired: 0 | 1;
  is_sold: 0 | 1;
  is_valid_to_sell: 0 | 1;
  longcode: string;
  shortcode: string;
  underlying_symbol: string;
  date_start: number;
  date_expiry: number;
}

// Profit table transaction
export interface ProfitTransaction {
  contract_id: number;
  buy_price: number;
  sell_price: number;
  profit_loss: number;
  longcode: string;
  shortcode: string;
  purchase_time: number;
  sell_time: number;
  transaction_id: number;
}

// Account from REST API
export interface DerivAccount {
  account_id: string;
  balance: number;
  currency: string;
  group: string;
  status: string;
  account_type: "demo" | "real";
}

// WebSocket message wrapper
export interface WsMessage<T = unknown> {
  msg_type: string;
  req_id?: number;
  error?: {
    code: string;
    message: string;
  };
  subscription?: {
    id: string;
  };
  [key: string]: T | string | number | undefined | { id: string } | { code: string; message: string };
}
