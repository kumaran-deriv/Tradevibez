export const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089";

export const DERIV_WS_PUBLIC =
  "wss://api.derivws.com/trading/v1/options/ws/public";

export const DERIV_REST_BASE = "https://api.derivws.com";

export const DERIV_AUTH_URL = "https://auth.deriv.com/oauth2/auth";
export const DERIV_TOKEN_URL = "https://auth.deriv.com/oauth2/token";

export const OAUTH_SCOPES = "trade account_manage";

export const WS_PING_INTERVAL = 30_000;
export const WS_RECONNECT_BASE = 1_000;
export const WS_RECONNECT_MAX = 16_000;

export const CANDLE_GRANULARITIES = [
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
  { label: "1h", value: 3600 },
  { label: "4h", value: 14400 },
  { label: "1d", value: 86400 },
] as const;

export const MARKET_GROUPS = [
  { key: "synthetic_index", label: "Synthetics" },
  { key: "forex", label: "Forex" },
  { key: "indices", label: "Stocks & Indices" },
  { key: "commodities", label: "Commodities" },
  { key: "cryptocurrency", label: "Crypto" },
] as const;

export const NAV_ITEMS = [
  { label: "Markets", href: "/dashboard", icon: "LayoutDashboard", auth: false },
  { label: "Trade", href: "/trade", icon: "TrendingUp", auth: true },
  { label: "History", href: "/history", icon: "History", auth: true },
] as const;
