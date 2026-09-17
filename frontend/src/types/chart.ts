export type ViewIntent = {
  nonce: number;
  kind: "anchor" | "latest" | "reset";
  centerMs: number | null;
};
