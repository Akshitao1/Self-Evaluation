// localStorage polyfill for SSR
// This prevents errors when localStorage is accessed during server-side rendering

if (typeof window === 'undefined') {
    // Create a no-op localStorage implementation for SSR
    const noopStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
  
    // @ts-ignore - Polyfill for SSR
    global.localStorage = noopStorage;
    // @ts-ignore - Polyfill for SSR
    global.sessionStorage = noopStorage;
  }
  
  export {};
  
  