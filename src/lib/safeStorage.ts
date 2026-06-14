const createSafeStorage = (type: 'localStorage' | 'sessionStorage') => {
  const memoryStore: Record<string, string> = {};
  
  const checkSupport = () => {
    try {
      if (typeof window === 'undefined') return false;
      const storage = window[type];
      if (!storage) return false;
      const testKey = '__test_storage_support__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  };

  const isSupported = checkSupport();

  return {
    getItem: (key: string): string | null => {
      if (isSupported) {
        try {
          return window[type].getItem(key);
        } catch {
          // Fall through to memoryStore
        }
      }
      return key in memoryStore ? memoryStore[key] : null;
    },
    setItem: (key: string, value: string): void => {
      if (isSupported) {
        try {
          window[type].setItem(key, value);
          return;
        } catch {
          // Fall through to memoryStore
        }
      }
      memoryStore[key] = String(value);
    },
    removeItem: (key: string): void => {
      if (isSupported) {
        try {
          window[type].removeItem(key);
          return;
        } catch {
          // Fall through to memoryStore
        }
      }
      delete memoryStore[key];
    }
  };
};

export const safeLocalStorage = createSafeStorage('localStorage');
export const safeSessionStorage = createSafeStorage('sessionStorage');
