import { MongoMemoryServer } from 'mongodb-memory-server';
import { localMongoDbPath } from './lib/local-mongo-path';

// Local MongoDB for development (#112), kept on disk (#140): accounts, sessions and looks survive restarts.
//
//   pnpm --filter @styleme/api db:local        data in apps/api/.mongo-data/ (git-ignored)
//   LOCAL_MONGO_DBPATH=~/my-data pnpm --filter @styleme/api db:local

async function start() {
  const dbPath = localMongoDbPath();
  const mongo = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbName: 'styleme',
      dbPath,
      storageEngine: 'wiredTiger',
    },
  });

  console.log(`[mongo] Local MongoDB running at ${mongo.getUri()}`);
  console.log(`[mongo] Data is kept in ${dbPath} between restarts`);

  const shutdown = async () => {
    console.log('[mongo] Shutting down MongoDB (data is kept)...');
    // Never delete the data folder: that is what made every account disappear.
    await mongo.stop({ doCleanup: false });
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('[mongo] Failed to start:', err);
  process.exit(1);
});
