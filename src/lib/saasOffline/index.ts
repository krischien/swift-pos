export { cache } from "./cache";
export { syncQueue } from "./syncQueue";

export async function clearOfflineData(): Promise<void> {
  const { cache } = await import("./cache");
  const { syncQueue } = await import("./syncQueue");
  await cache.clear();
  await syncQueue.clear();
}
