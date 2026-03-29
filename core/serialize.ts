import type { IToken } from "./types.js";

export function sanitizeToken(token: IToken): IToken {
  const plain = { ...token };
  if (plain._tags instanceof Set) {
    plain._tags = Array.from(plain._tags) as any;
  }
  return JSON.parse(JSON.stringify(plain));
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
