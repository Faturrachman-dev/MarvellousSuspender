/**
 * Vitest global Chrome API mocks.
 * Runs before every test file.
 */

// Minimal chrome.* stubs — extend per-test as needed via vi.mocked() or reassignment
global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, cb) => cb && cb({})),
      set: vi.fn((obj, cb) => cb && cb()),
      remove: vi.fn((keys, cb) => cb && cb()),
    },
    session: {
      get: vi.fn((keys, cb) => cb && cb({})),
      set: vi.fn((obj, cb) => cb && cb()),
    },
    sync: {
      get: vi.fn((keys, cb) => cb && cb({})),
      set: vi.fn((obj, cb) => cb && cb()),
    },
  },
  runtime: {
    id: 'test-extension-id-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    getURL: (path) => `chrome-extension://test-extension-id-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/${path}`,
    sendMessage: vi.fn(),
    connect: vi.fn(() => ({ disconnect: vi.fn() })),
    onMessage: { addListener: vi.fn() },
    onMessageExternal: { addListener: vi.fn() },
    lastError: null,
  },
  tabs: {
    get: vi.fn(),
    query: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    sendMessage: vi.fn(),
  },
  windows: {
    getLastFocused: vi.fn(),
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    get: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    onClicked: { addListener: vi.fn() },
  },
  commands: {
    onCommand: { addListener: vi.fn() },
    getAll: vi.fn((cb) => cb && cb([])),
  },
  permissions: {
    request: vi.fn(),
  },
  i18n: {
    getMessage: (key) => key,
  },
  extension: {
    inIncognitoContext: false,
    isAllowedFileSchemeAccess: vi.fn((cb) => cb && cb(false)),
  },
};
