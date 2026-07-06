export const API_BASE_URL =
  process.env.API_TEST_BASE_URL ??
  process.env.VITE_SAAS_API_URL ??
  "http://localhost:4001";
