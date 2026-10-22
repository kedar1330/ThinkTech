import { MongoMemoryServer } from 'mongodb-memory-server';

async function start() {
  const mongo = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbName: 'styleme',
    },
  });

  console.log(`[mongo] Local MongoDB running at ${mongo.getUri()}`);

  const shutdown = async () => {
    console.log('[mongo] Shutting down MongoDB...');
    await mongo.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('[mongo] Failed to start:', err);
  process.exit(1);
});
