Object.defineProperty(navigator, "webdriver", {
  get: () => false,
});

const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
  parameters.name === "notifications"
    ? Promise.resolve({ state: Notification.permission })
    : originalQuery(parameters);

// Overwrite the `plugins` property to use a custom getter.
Object.defineProperty(navigator, "plugins", {
  // This just needs to have `length > 0` for the current test,
  // but we could mock the plugins too if necessary.
  get: () => [1, 2, 3, 4, 5],
});

// Overwrite the `plugins` property to use a custom getter.
Object.defineProperty(navigator, "languages", {
  get: () => ["en-US", "en"],
});
