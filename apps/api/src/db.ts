import mongoose, { type Connection } from 'mongoose';
import { registerModels, type Models } from './models/index';

export interface Database {
  main: Connection;
  tombstones: Connection;
  models: Models;
  close(): Promise<void>;
}

/** Opens the main database and the separate tombstone store (D-85), and builds their indexes. */
export async function connectDatabase(mainUri: string, tombstoneUri: string): Promise<Database> {
  const main = await mongoose.createConnection(mainUri).asPromise();
  const tombstones = await mongoose.createConnection(tombstoneUri).asPromise();
  const models = registerModels(main, tombstones);
  await Promise.all(Object.values(models).map((m) => m.init()));
  return {
    main,
    tombstones,
    models,
    async close() {
      await Promise.all([main.close(), tombstones.close()]);
    },
  };
}
