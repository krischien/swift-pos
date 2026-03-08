/**
 * Standalone health check - no app/Prisma load. Handles GET /api/health.
 */
export default function handler(_req: unknown, res: { status: (n: number) => { json: (o: object) => void } }) {
  res.status(200).json({ status: "ok", mode: "saas" });
}
