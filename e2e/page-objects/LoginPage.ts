import { Selector } from "testcafe";

export const LoginPage = {
  email: Selector("#email"),
  password: Selector("#password"),
  signIn: Selector('button[type="submit"]').withText("Sign In"),
  toast: Selector('[data-sonner-toast], [role="status"]'),
};

export const AdminDashboardPage = {
  heading: Selector("h1").withText("Dashboard"),
};
