import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { createCanvas } from "canvas";

/**
 * Generate a barcode image (CODE128 format) from Item Code
 * Returns base64-encoded PNG image data URI
 */
export async function generateBarcode(itemCode: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = createCanvas(200, 100);
      // JsBarcode works with node-canvas
      JsBarcode(canvas as any, itemCode, {
        format: "CODE128",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
      });
      const base64 = canvas.toDataURL("image/png");
      resolve(base64);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate a QR code image from Item Code
 * Returns base64-encoded PNG image data URI
 */
export async function generateQRCode(itemCode: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(itemCode, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    return dataUrl;
  } catch (error) {
    throw error;
  }
}

