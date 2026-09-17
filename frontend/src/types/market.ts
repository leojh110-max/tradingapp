export type Timeframe = "1m" | "5m" | "10m" | "15m" | "30m" | "1h" | "4h" | "1d";

export type Candle = {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  sourceCandleCount?: number;
  expectedCandleCount?: number;
  complete?: boolean;
};

export type MarketInfo = {
  exchange: string;
  market: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  interval: string;
  firstOpenTime: number | null;
  lastOpenTime: number | null;
  candleCount: number;
  sourceInterval?: string;
  sourceCandleCount?: number;
};

export type CandlePage = {
  symbol: string;
  interval: string;
  candles: Candle[];
};

export type Direction = "up" | "down" | "neutral";
