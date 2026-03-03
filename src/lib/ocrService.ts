import { createWorker } from "tesseract.js";

/**
 * Process an image file with OCR and return extracted text lines.
 */
export async function processImage(imageFile: File): Promise<string[]> {
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: "6", // PSM 6: Assume a single uniform block of text
    });
    const result = await worker.recognize(imageFile);
    const page = result?.data;
    const linesArray = page?.lines;
    const lines = Array.isArray(linesArray)
      ? linesArray.map((line) => (line?.text ?? "").trim()).filter(Boolean)
      : (page?.text ?? "")
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
    return lines;
  } finally {
    await worker.terminate();
  }
}

/**
 * Parse OCR lines into menu items with name and price.
 * Supports formats: "Item Name $10.00", "Item Name ₱10", "Item Name 10.50", etc.
 */
export function parseMenuItems(lines: string[]): Array<{ name: string; price: number }> {
  const items: Array<{ name: string; price: number }> = [];
  const seen = new Set<string>();

  // Match price at end: digits with optional decimals, optional $ or ₱
  const priceRegex = /(\d+(?:\.\d{1,2})?)\s*[$₱]?\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(priceRegex);
    if (!match) continue;

    const priceStr = match[1];
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) continue;

    const name = trimmed.slice(0, match.index).trim();
    if (!name) continue;

    // Title-case name
    const formattedName = name
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    const key = formattedName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({ name: formattedName, price });
  }

  return items;
}
