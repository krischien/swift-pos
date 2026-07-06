import { Selector } from "testcafe";

export const InventoryPage = {
  heading: Selector("h1").withText("Inventory Management"),
  addButton: Selector('[data-testid="inventory-add"]'),
  dialog: Selector('[role="dialog"]'),
  nameInput: Selector('[role="dialog"] input[placeholder="Product name"]'),
  categoryTrigger: Selector('[role="dialog"] [role="combobox"]'),
  categoryOption: (name: string) => Selector('[role="option"]').withText(name),
  firstCategoryOption: Selector('[role="option"]').nth(0),
  basePriceInput: Selector('[role="dialog"] input[placeholder="0.00"]').nth(0),
  stockInput: Selector('[role="dialog"] input[placeholder="0"]').nth(0),
  saveButton: Selector('[role="dialog"] button').withText(/Save Product|Save Changes/),
  row: (name: string) => Selector("tr").withText(name),
  editButton: (name: string) => Selector("tr").withText(name).find("button").withText("Edit"),
  deleteButton: (name: string) => Selector("tr").withText(name).find("button.text-destructive"),
};
