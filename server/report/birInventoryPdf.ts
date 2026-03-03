import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { InventoryList } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, "templates", "inventoryList.html");

function formatDateLong(isoDate: string): string {
  const d = new Date(isoDate);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generates BIR Annex A inventory list as PDF buffer using the HTML template.
 */
export async function generateBirInventoryListPdf(list: InventoryList): Promise<Buffer> {
  const template = readFileSync(TEMPLATE_PATH, "utf-8");

  const itemsRows = list.items
    .map(
      (item) =>
        `<tr>
          <td>${escapeHtml(item.productCode)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.locationAddress ?? "")}</td>
          <td>${escapeHtml(item.locationCode ?? "")}</td>
          <td>${escapeHtml(item.locationRemarks ?? "")}</td>
          <td>${escapeHtml(item.costingMethod ?? "FIFO")}</td>
          <td>${formatCurrency(item.unitCost)}</td>
          <td>${item.quantity}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(item.totalWeightVolume ?? "")}</td>
          <td>${formatCurrency(item.totalCost)}</td>
        </tr>`
    )
    .join("\n");

  const grandTotal = list.items.reduce((sum, i) => sum + i.totalCost, 0);

  const html = template
    .replace(/\{\{companyName\}\}/g, escapeHtml(list.company.name))
    .replace(/\{\{inventoryDateLong\}\}/g, formatDateLong(list.header.inventoryDate))
    .replace(/\{\{itemsRows\}\}/g, itemsRows)
    .replace(/\{\{totalCost\}\}/g, formatCurrency(grandTotal))
    .replace(/\{\{remarks\}\}/g, escapeHtml(list.header.remarks ?? ""))
    .replace(
      /\{\{tin\}\}/g,
      list.company.tin
        ? escapeHtml(list.company.tin)
        : "_________________________ (to be filled manually)"
    )
    .replace(/\{\{generatedOn\}\}/g, formatDateLong(new Date().toISOString().slice(0, 10)));

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
