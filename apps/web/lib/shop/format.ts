// Rupee amounts in the Indian grouping: ₹1,299 and ₹1,299.50 (paise only when there are any).
export function formatInr(amount: number): string {
  const paise = !Number.isInteger(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
