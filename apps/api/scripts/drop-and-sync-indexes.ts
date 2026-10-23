import { MongoClient } from 'mongodb';
import { connectDatabase } from '../src/db';
import { loadConfig } from '../src/config/env';

async function main() {
  const config = loadConfig();
  const ATLAS_MAIN_URI = config.MONGODB_URI;
  const ATLAS_TOMB_URI = config.TOMBSTONE_STORE_URI;

  console.log('1. Dropping existing custom indexes on Atlas to eliminate conflicts...');
  for (const uri of [ATLAS_MAIN_URI, ATLAS_TOMB_URI]) {
    const client = new MongoClient(uri);
    await client.connect();
    const dbName = uri.split('/').pop()?.split('?')[0]!;
    const db = client.db(dbName);
    console.log(`Checking ${dbName}...`);
    const collections = await db.listCollections().toArray();
    for (const c of collections) {
      const col = db.collection(c.name);
      const indexes = await col.indexes();
      for (const idx of indexes) {
        if (idx.name === '_id_' || !idx.name) continue;
        console.log(`  Dropping ${idx.name} on ${c.name}...`);
        await col.dropIndex(idx.name);
      }
    }
    await client.close();
  }

  console.log('\n2. Rebuilding all indexes cleanly via Mongoose schemas...');
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  console.log('Successfully connected to database and initialized all Mongoose models with pristine indexes!');
  await db.close();
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
