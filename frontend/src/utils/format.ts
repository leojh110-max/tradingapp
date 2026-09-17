export function formatPrice(raw: string): string {
  if (!raw.includes(".")) {
    return raw;
  }
  return raw.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

export function formatVolume(raw: string): string {
  return formatPrice(raw);
}

export function formatOpenTime(openTime: number, interval?: string): string {
  const date = new Date(openTime);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  const millis = String(openTime % 1000).padStart(3, "0");
  if (interval === "1d") {
    return `${year}-${month}-${day} UTC`;
  }
  if (openTime % 60_000 === 0) {
    return `${year}-${month}-${day} ${hour}:${minute} UTC`;
  }
  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millis} UTC`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function symbolLabel(baseAsset: string, quoteAsset: string): string {
  return `${baseAsset}/${quoteAsset}`;
}

export function marketLabel(market: string): string {
  if (market.toLowerCase() === "spot") {
    return "Spot";
  }
  return market;
}
