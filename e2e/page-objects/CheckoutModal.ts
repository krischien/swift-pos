import { Selector } from "testcafe";

export const CheckoutModal = {
  cash: Selector('[data-testid="checkout-cash"]'),
  gcash: Selector('[data-testid="checkout-gcash"]'),
  complete: Selector('[data-testid="checkout-complete"]'),
  amount: Selector("#amount"),
  gcashTxn: Selector("#gcash-txn"),
  exact: Selector("button").withText("Exact"),
  title: Selector("h2, [role=dialog] h2").withText(/Complete Payment/i),
};
