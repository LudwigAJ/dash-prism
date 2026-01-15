declare module '*.css';

declare namespace NodeJS {
  interface ProcessEnv {
    /** App version injected at build time from package.json */
    APP_VERSION: string;
  }
}
