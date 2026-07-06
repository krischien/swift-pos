import { ApiClient } from "./client.js";
import { DEMO_CREDENTIALS } from "../fixtures/users.js";

/** Reset demo passwords and optionally re-seed full demo catalog (3 stores incl. F&B). */
export async function ensureDemoData(client: ApiClient): Promise<ReturnType<ApiClient["login"]>> {
  await client.resetDemoPasswords();
  await client.login(DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.owner.password);
  try {
    await client.seedDemo();
  } catch {
    // seed may fail if not owner/super_admin — continue with existing data
  }
  return client.login(DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.owner.password);
}

export async function ownerClient(): Promise<ApiClient> {
  const client = new ApiClient();
  await ensureDemoData(client);
  return client;
}

export async function adminClient(): Promise<ApiClient> {
  const client = new ApiClient();
  await client.resetDemoPasswords();
  await client.login(DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.admin.password);
  return client;
}

export async function cashierClient(): Promise<ApiClient> {
  const client = new ApiClient();
  await client.resetDemoPasswords();
  await client.login(DEMO_CREDENTIALS.cashier.email, DEMO_CREDENTIALS.cashier.password);
  return client;
}
