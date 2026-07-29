import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

// Credits are denominated in tenths of a cent (see src/lib/billing/credits.ts), so a
// pack grants priceCents * 10 credits and the dollar amount you pay is the dollar amount
// of balance you receive. Usage is then deducted at the AI provider's actual cost plus
// a 20% markup, which is what covers Stripe's fee — that markup is disclosed in the UI.
//
// Packs start at $5 because Stripe takes 2.9% + $0.30, which is 8.9% of a $5 charge.
// Smaller top-ups lose money on processing alone.
export const CREDIT_PACKS = [
  {
    id: "starter",
    name: "Starter",
    credits: 5000,
    priceCents: 500,
    priceLabel: "$5",
    description: "$5 of AI usage",
    popular: false,
  },
  {
    id: "standard",
    name: "Standard",
    credits: 15000,
    priceCents: 1500,
    priceLabel: "$15",
    description: "$15 of AI usage",
    popular: true,
  },
  {
    id: "power",
    name: "Power Pack",
    credits: 30000,
    priceCents: 3000,
    priceLabel: "$30",
    description: "$30 of AI usage",
    popular: false,
  },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];
export type CreditPack = (typeof CREDIT_PACKS)[number];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id) as CreditPack | undefined;
}
