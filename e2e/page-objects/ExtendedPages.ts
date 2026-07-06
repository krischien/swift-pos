import { Selector } from "testcafe";

export const SignupPage = {
  orgInput: Selector("#org"),
  storeInput: Selector("#store"),
  nameInput: Selector("#adminName"),
  emailInput: Selector("#email"),
  passwordInput: Selector("#password"),
  submit: Selector('button[type="submit"]').withText("Create account"),
  title: Selector("h1, .text-3xl").withText(/Create your account/i),
};

export const ReportsPage = {
  heading: Selector("h1").withText("Reports"),
};

export const SettingsPage = {
  heading: Selector("h1").withText("Settings"),
};

export const MenuPage = {
  heading: Selector("h1").withText("Menu"),
};

export const IngredientsPage = {
  heading: Selector("h1").withText("Ingredients"),
};

export const AdminOrganizationsPage = {
  heading: Selector("h1").withText("Organizations"),
};

export const AdminProductRankingPage = {
  heading: Selector("h1").withText("Product Ranking"),
};

export const AdminPaymentMonitoringPage = {
  heading: Selector("h1").withText("Payment monitoring"),
};
