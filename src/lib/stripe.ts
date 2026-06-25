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

export const CREDIT_PACKS = [
  {
    id: "starter",
    name: "Starter",
    credits: 50,
    priceCents: 500,
    priceLabel: "$5",
    description: "50 AI messages",
    popular: false,
  },
  {
    id: "standard",
    name: "Standard",
    credits: 200,
    priceCents: 1500,
    priceLabel: "$15",
    description: "200 AI messages",
    popular: true,
  },
  {
    id: "power",
    name: "Power Pack",
    credits: 500,
    priceCents: 3000,
    priceLabel: "$30",
    description: "500 AI messages",
    popular: false,
  },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];
export type CreditPack = (typeof CREDIT_PACKS)[number];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id) as CreditPack | undefined;
}
