module.exports = {
  hostname: "localhost",
  baseUrl: "http://localhost:8080",
  pageRequestTimeout: 15000,
  assertionTimeout: 10000,
  selectorTimeout: 10000,
  disableNativeAutomation: true,
  skipJsErrors: false,
  reporter: ["spec"],
  retryTestPages: true,
  quarantineMode: true,
};
