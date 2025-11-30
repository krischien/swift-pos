/**
 * Formats a number as Philippine Peso currency
 * @param value - The numeric value to format
 * @returns Formatted string with peso sign (e.g., "₱1,234.56")
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) {
    return "₱0.00";
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return "₱0.00";
  }
  return `₱${num.toFixed(2)}`;
};

/**
 * Formats a number as currency without the symbol (for printer receipts)
 * @param value - The numeric value to format
 * @returns Formatted string without symbol (e.g., "1,234.56")
 */
export const formatCurrencyValue = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) {
    return "0.00";
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return "0.00";
  }
  return num.toFixed(2);
};

