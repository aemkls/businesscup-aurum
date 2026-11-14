/** Round to cents, avoiding binary float drift (0.1 + 0.2). */
export function cents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sum(values: number[]): number {
  return cents(values.reduce((a, b) => a + b, 0));
}

export function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}
