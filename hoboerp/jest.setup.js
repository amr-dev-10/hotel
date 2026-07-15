/* global jest */
require('@testing-library/jest-native/extend-expect');

const mockAsyncStorage = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(key => Promise.resolve(mockAsyncStorage.get(key) ?? null)),
    setItem: jest.fn((key, value) => {
      mockAsyncStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      mockAsyncStorage.delete(key);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      mockAsyncStorage.clear();
      return Promise.resolve();
    }),
  },
}));

const mockMessagingInstance = {
  getToken: jest.fn(() => Promise.resolve('mock-fcm-token-1234567890')),
  onMessage: jest.fn(() => jest.fn()),
  onTokenRefresh: jest.fn(() => jest.fn()),
  registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
  requestPermission: jest.fn(() => Promise.resolve(1)),
  setBackgroundMessageHandler: jest.fn(),
};

jest.mock('@react-native-firebase/messaging', () => {
  const messaging = jest.fn(() => mockMessagingInstance);
  messaging.AuthorizationStatus = {
    AUTHORIZED: 1,
    DENIED: 0,
    NOT_DETERMINED: -1,
    PROVISIONAL: 2,
  };
  return {
    __esModule: true,
    default: messaging,
  };
});
