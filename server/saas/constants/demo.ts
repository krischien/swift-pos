/** Free-trial length for Demo Organization (seed + bootstrap). */
export const DEMO_TRIAL_DAYS = 15;

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
