import mongoose, { type Connection } from 'mongoose';
import { registerModels, type Models } from './models/index';

export interface Database {
  main: Connection;
  tombstones: Connection;
  models: Models;
  close(): Promise<void>;
}

const CONNECTION_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 25,
  minPoolSize: 1,
};

/** Opens the main database and the separate tombstone store (D-85), and builds their indexes. */
export async function connectDatabase(mainUri: string, tombstoneUri: string): Promise<Database> {
  const main = await mongoose.createConnection(mainUri, CONNECTION_OPTIONS).asPromise();
  const tombstones = await mongoose.createConnection(tombstoneUri, CONNECTION_OPTIONS).asPromise();
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
