import { createWorker } from "tesseract.js";

export interface MenuItem {
  name: string;
  price?: number;
}

/**
 * Preprocess image to improve OCR accuracy
 * Converts to grayscale and increases contrast
 */
const preprocessImage = (imageFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(url);
        return;
      }
      
      // Set canvas dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Apply grayscale and contrast
      // Formula: contrast = (factor * (value - 128)) + 128
      const contrastFactor = 1.5; // Increase contrast by 50%
      
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale (weighted average)
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Apply contrast
        let value = contrastFactor * (gray - 128) + 128;
        // Clamp value
        value = Math.max(0, Math.min(255, value));
        
        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        // Alpha (data[i+3]) remains unchanged
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    
    img.src = url;
  });
};

/**
 * Capitalize item name to title case (first letter of each word capitalized)
 * Avoids all caps or all lowercase
 */
function capitalizeItemName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return word;
      // Capitalize first letter, lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Process an image file with OCR to extract text
 */
export async function processImage(imageFile: File): Promise<string> {
  const worker = await createWorker("eng");
  try {
    // 1. Preprocess the image (Grayscale + Contrast)
    const processedImage = await preprocessImage(imageFile);

    // 2. Configure Tesseract for better accuracy on menus/lists
    // PSM 6: Assume a single uniform block of text. Good for receipts/menus.
    await worker.setParameters({
      tessedit_pageseg_mode: "6" as any, 
    });

    const { data } = await worker.recognize(processedImage);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Parse OCR text to extract menu items with prices
 * Handles various formats:
 * - "Item Name $10.00"
 * - "Item Name 10.00"
 * - "Item Name - $10"
 * - "Item Name 10"
 */
export function parseMenuItems(ocrText: string): MenuItem[] {
  const lines = ocrText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const items: MenuItem[] = [];

  for (const line of lines) {
    // Skip lines that are clearly not menu items
    if (
      line.length < 2 ||
      line.toLowerCase().includes("menu") ||
      line.toLowerCase().includes("price") ||
      line.toLowerCase().includes("total") ||
      line.match(/^[^a-zA-Z]*$/) // Only numbers/symbols
    ) {
      continue;
    }

    // Try to extract price from the line
    // Patterns: $10.00, 10.00, $10, 10, ₱10.00, etc.
    const pricePatterns = [
      /[\$₱]?\s*(\d+\.?\d*)\s*$/, // Price at end: $10.00, 10.00, $10
      /[\$₱]?\s*(\d+\.?\d*)\s*[-–—]/, // Price after dash: Item - $10
      /(\d+\.\d{2})\s*$/, // Decimal price at end: 10.00
    ];

    let price: number | undefined;
    let name = line;

    for (const pattern of pricePatterns) {
      const match = line.match(pattern);
      if (match) {
        price = parseFloat(match[1]);
        // Remove price from name
        name = line.replace(pattern, "").trim();
        // Clean up trailing dashes, colons, etc.
        name = name.replace(/[-–—:]\s*$/, "").trim();
        break;
      }
    }

    // If no price found, check if line ends with just numbers
    if (!price) {
      const numberMatch = line.match(/(\d+)\s*$/);
      if (numberMatch && numberMatch.index && numberMatch.index > 5) {
        // Only treat as price if there's substantial text before it
        price = parseFloat(numberMatch[1]);
        name = line.substring(0, numberMatch.index).trim();
        name = name.replace(/[-–—:]\s*$/, "").trim();
      }
    }

    // Validate item name
    if (name.length < 2) {
      continue;
    }

    // Capitalize item name to title case
    name = capitalizeItemName(name);

    // Skip if price seems invalid (too high for a menu item, or negative)
    if (price !== undefined && (price < 0 || price > 10000)) {
      continue;
    }

    items.push({
      name,
      price,
    });
  }

  // Remove duplicates (same name)
  const uniqueItems = items.filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.name.toLowerCase() === item.name.toLowerCase())
  );

  return uniqueItems;
}

