declare module '*.css';

declare namespace NodeJS {
  interface ProcessEnv {
    /** App version injected at build time from package.json */
    APP_VERSION: string;
  }
}

// The type declarations of redux-persist 6 omit an option that its code reads.
declare module 'redux-persist/es/types' {
  interface PersistorOptions {
    /** Makes persistStore wait for persistor.persist() before it loads the stored state. */
    manualPersist?: boolean;
  }
}
