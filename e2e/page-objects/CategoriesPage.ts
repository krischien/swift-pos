import { Selector } from "testcafe";

export const CategoriesPage = {
  heading: Selector("h1").withText("Category Management"),
  addButton: Selector('[data-testid="categories-add"]'),
  nameInput: Selector("#name"),
  saveButton: Selector('[role="dialog"] button').withText(/Create|Update/),
  row: (name: string) => Selector("tr").withText(name),
  editButton: (name: string) => Selector("tr").withText(name).find("button").nth(0),
  deleteButton: (name: string) => Selector("tr").withText(name).find("button").nth(1),
};
