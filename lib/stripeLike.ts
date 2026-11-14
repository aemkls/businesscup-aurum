import type Stripe from "stripe";

/**
 * The parts of the Stripe client the payment checks use. The real client
 * fits it; unit tests pass a fake instead of calling Stripe.
 */
export interface StripeLike {
  checkout: {
    sessions: {
      retrieve(
        id: string,
        params?: Stripe.Checkout.SessionRetrieveParams,
      ): Promise<Stripe.Checkout.Session>;
    };
  };
  paymentIntents: {
    update(id: string, params: Stripe.PaymentIntentUpdateParams): Promise<unknown>;
  };
}
