import { Selector } from "testcafe";

export const UsersPage = {
  heading: Selector("h1").withText("User Management"),
  addButton: Selector('[data-testid="users-add"]'),
  nameInput: Selector("#name"),
  emailInput: Selector("#email"),
  passwordInput: Selector("#password"),
  roleTrigger: Selector("#role"),
  roleOption: (role: string) => Selector('[role="option"]').withText(new RegExp(role, "i")),
  saveButton: Selector('[role="dialog"] button').withText(/Create|Update/),
  row: (name: string) => Selector("tr").withText(name),
  editButton: (name: string) => Selector("tr").withText(name).find("button").nth(0),
  deleteButton: (name: string) => Selector("tr").withText(name).find("button").nth(1),
};
