import { resolve } from 'node:path';

/** The installed Electron app persists outside Program Files. Vite uses the project folder. */
export const DATA_DIRECTORY = process.env.STDQ_DATA_DIR
  ? resolve(process.env.STDQ_DATA_DIR)
  : resolve(process.cwd(), '.stdq-runtime');
export const STATIC_DIRECTORY = process.env.STDQ_STATIC_DIR
  ? resolve(process.env.STDQ_STATIC_DIR)
  : resolve(process.cwd(), 'public');
