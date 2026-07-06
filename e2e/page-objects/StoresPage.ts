import { Selector } from "testcafe";

export const StoresPage = {
  heading: Selector("h1").withText("Stores"),
  addButton: Selector('[data-testid="stores-add"]'),
  nameInput: Selector("#store-name"),
  addressInput: Selector("#store-address"),
  saveButton: Selector('[role="dialog"] button').withText(/Create|Update/),
  row: (name: string) => Selector("tr").withText(name),
  editButton: (name: string) => Selector("tr").withText(name).find("button").nth(0),
  deleteButton: (name: string) => Selector("tr").withText(name).find("button").nth(1),
};
