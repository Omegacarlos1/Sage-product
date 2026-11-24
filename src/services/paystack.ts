import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifiedTransaction = { status: string; reference: string; amount: number; currency: string; customer?: { email?: string } };
export interface PaymentGateway {
  initialize(input: { email: string; amount: number; reference: string }): Promise<{ authorizationUrl: string; reference: string }>;
  verify(reference: string): Promise<VerifiedTransaction>;
}

export class PaystackInvalidEmailError extends Error {
  constructor() { super("Paystack rejected the learner email address."); }
}

export class PaystackGateway implements PaymentGateway {
  constructor(private readonly secretKey: string) {}

  private async call(path: string, body?: object): Promise<unknown> {
    const response = await fetch(`https://api.paystack.co${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // Expose only this known, actionable validation case. Never log the provider body or API key.
      if (response.status === 400) {
        const failure: unknown = await response.json().catch(() => null);
        if (failure && typeof failure === "object" && "message" in failure && typeof failure.message === "string" && /email.*valid email/i.test(failure.message)) throw new PaystackInvalidEmailError();
      }
      throw new Error("Paystack request failed");
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("status" in result) || result.status !== true || !("data" in result)) throw new Error("Invalid Paystack response");
    return result.data;
  }

  async initialize(input: { email: string; amount: number; reference: string }) {
    const data = await this.call("/transaction/initialize", { ...input, currency: "NGN" }) as Record<string, unknown>;
    if (typeof data.authorization_url !== "string" || typeof data.reference !== "string" || data.reference !== input.reference || !data.authorization_url.startsWith("https://checkout.paystack.com/")) throw new Error("Invalid Paystack checkout response");
    return { authorizationUrl: data.authorization_url, reference: data.reference };
  }

  async verify(reference: string): Promise<VerifiedTransaction> {
    const data = await this.call(`/transaction/verify/${encodeURIComponent(reference)}`) as Record<string, unknown>;
    if (typeof data.status !== "string" || typeof data.reference !== "string" || typeof data.amount !== "number" || typeof data.currency !== "string") throw new Error("Invalid Paystack verification response");
    return data as VerifiedTransaction;
  }
}

export function validPaystackSignature(raw: Buffer, modern: string | undefined, legacy: string | undefined, signingSecret?: string, secretKey?: string): boolean {
  if (modern) {
    if (!signingSecret) return false;
    const parts = modern.split(",").map((part) => part.trim());
    const timestampPart = parts.find((part) => part.startsWith("t="));
    const timestamp = timestampPart?.slice(2);
    if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const expected = createHmac("sha512", signingSecret).update(`${timestamp}.`).update(raw).digest();
    return parts.filter((part) => part.startsWith("v1=")).some((part) => {
      const match = /^v1=whk_[^:]+:([0-9a-f]{128})$/.exec(part);
      return !!match && timingSafeEqual(expected, Buffer.from(match[1], "hex"));
    });
  }
  if (!secretKey || !legacy || !/^[0-9a-f]{128}$/.test(legacy)) return false;
  return timingSafeEqual(createHmac("sha512", secretKey).update(raw).digest(), Buffer.from(legacy, "hex"));
}
