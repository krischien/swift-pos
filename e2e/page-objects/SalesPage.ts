import { Selector } from "testcafe";

export const SalesPage = {
  heading: Selector("h1").withText("Sales History"),
  table: Selector("table"),
  gcashRow: Selector("table tbody tr").withText(/gcash/i),
  firstRow: Selector("table tbody tr").nth(0),
  paymentCell: (method: string) =>
    Selector("table tbody tr").nth(0).find("td").withText(new RegExp(method, "i")),
  viewDetails: Selector("table tbody tr").nth(0).find("button").withText("View Details"),
  detailsDialog: Selector('[role="dialog"]'),
};
