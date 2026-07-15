type LogPayload = unknown[];

const isDebugEnabled = typeof __DEV__ !== 'undefined' && __DEV__;

export const logger = {
  debug: (...payload: LogPayload) => {
    if (isDebugEnabled) {
      console.debug(...payload);
    }
  },
  info: (...payload: LogPayload) => {
    if (isDebugEnabled) {
      console.info(...payload);
    }
  },
  warn: (...payload: LogPayload) => {
    console.warn(...payload);
  },
  error: (...payload: LogPayload) => {
    console.error(...payload);
  },
};
