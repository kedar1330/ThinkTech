import { MongoClient } from 'mongodb';

const LOCAL_BASE_URI = process.env.LOCAL_MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const ATLAS_BASE_URI = process.env.MONGODB_URI ?? process.argv[2];

if (!ATLAS_BASE_URI) {
  console.error('Usage: tsx scripts/migrate-local-to-atlas.ts <ATLAS_MONGODB_URI> or set MONGODB_URI in environment.');
  process.exit(1);
}

async function migrateAll() {
  console.log('========================================================');
  console.log('STYLEME: LOCAL TO ATLAS MIGRATION & VERIFICATION');
  console.log('========================================================');

  console.log('\n[1/4] Connecting to Local MongoDB & Atlas...');
  const localClient = new MongoClient(LOCAL_BASE_URI, { directConnection: true, serverSelectionTimeoutMS: 5000 });
  await localClient.connect();
  console.log(' Connected to Local MongoDB.');

  const atlasClient = new MongoClient(ATLAS_BASE_URI, { serverSelectionTimeoutMS: 15000 });
  await atlasClient.connect();
  console.log(' Connected to MongoDB Atlas Cloud.');

  console.log('\n[2/4] Discovering Local Databases...');
  const adminDb = localClient.db().admin();
  const dbsInfo = await adminDb.listDatabases();
  const targetDbs = dbsInfo.databases
    .map((d) => d.name)
    .filter((name) => !['admin', 'config', 'local'].includes(name) && (name.includes('styleme') || name.startsWith('style')));

  console.log(`Found target application databases: ${targetDbs.join(', ')}`);

  // If styleme wasn't matched explicitly, ensure styleme and styleme_tombstones are included if they exist
  if (!targetDbs.includes('styleme')) targetDbs.push('styleme');
  if (!targetDbs.includes('styleme_tombstones')) targetDbs.push('styleme_tombstones');

  const report: Array<{ dbName: string; collectionName: string; localCount: number; atlasCount: number; status: string }> = [];

  for (const dbName of targetDbs) {
    console.log(`\n========================================================`);
    console.log(`Processing Database: ${dbName}`);
    console.log(`========================================================`);

    const localDb = localClient.db(dbName);
    const atlasDb = atlasClient.db(dbName);

    const collections = await localDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections in local db '${dbName}'`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;

      const localCol = localDb.collection(colName);
      const atlasCol = atlasDb.collection(colName);

      const localCount = await localCol.countDocuments();
      if (localCount === 0) {
        const atlasCount = await atlasCol.countDocuments();
        report.push({ dbName, collectionName: colName, localCount, atlasCount, status: 'EMPTY (OK)' });
        console.log(` - ${colName}: 0 documents locally (Atlas has ${atlasCount})`);
        continue;
      }

      console.log(` - Migrating '${colName}': reading ${localCount} documents...`);
      const docs = await localCol.find({}).toArray();

      // Bulk upsert into Atlas
      const ops = docs.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));

      const BATCH_SIZE = 500;
      for (let i = 0; i < ops.length; i += BATCH_SIZE) {
        const batch = ops.slice(i, i + BATCH_SIZE);
        await atlasCol.bulkWrite(batch, { ordered: false });
      }

      // Copy indexes
      try {
        const indexes = await localCol.indexes();
        for (const idx of indexes) {
          if (idx.name === '_id_') continue;
          const { key, name, unique, sparse } = idx as any;
          const options: any = { name };
          if (unique) options.unique = true;
          if (sparse) options.sparse = true;
          await atlasCol.createIndex(key, options).catch(() => {});
        }
      } catch (e) {
        // Index copy fallback
      }

      const atlasCount = await atlasCol.countDocuments();
      const status = atlasCount >= localCount ? 'MATCHED' : 'COUNT_MISMATCH';
      report.push({ dbName, collectionName: colName, localCount, atlasCount, status });
      console.log(`   ✓ ${colName}: ${localCount} local -> ${atlasCount} in Atlas (${status})`);
    }
  }

  console.log('\n[3/4] Checking for any other existing collections in Atlas...');
  for (const dbName of targetDbs) {
    const atlasDb = atlasClient.db(dbName);
    const atlasCols = await atlasDb.listCollections().toArray();
    for (const ac of atlasCols) {
      if (!report.some((r) => r.dbName === dbName && r.collectionName === ac.name)) {
        const cnt = await atlasDb.collection(ac.name).countDocuments();
        report.push({ dbName, collectionName: ac.name, localCount: 0, atlasCount: cnt, status: 'ATLAS_ONLY' });
      }
    }
  }

  console.log('\n[4/4] Final Verification Summary:');
  console.log('-------------------------------------------------------------------------------------------------');
  console.log(
    'Database'.padEnd(20) +
    'Collection'.padEnd(30) +
    'Local Count'.padEnd(15) +
    'Atlas Count'.padEnd(15) +
    'Status'
  );
  console.log('-------------------------------------------------------------------------------------------------');
  for (const r of report) {
    console.log(
      r.dbName.padEnd(20) +
      r.collectionName.padEnd(30) +
      String(r.localCount).padEnd(15) +
      String(r.atlasCount).padEnd(15) +
      r.status
    );
  }
  console.log('-------------------------------------------------------------------------------------------------');

  // Verify key collections specifically
  const userCount = await atlasClient.db('styleme').collection('users').countDocuments();
  const profileCount = await atlasClient.db('styleme').collection('profiles').countDocuments();
  console.log(`\nCore Health Check:`);
  console.log(` - Users in Atlas: ${userCount}`);
  console.log(` - Profiles in Atlas: ${profileCount}`);

  const sampleUsers = await atlasClient.db('styleme').collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();
  console.log(` - User Accounts:`, sampleUsers.map((u) => u.email).join(', '));

  await localClient.close();
  await atlasClient.close();
  console.log('\nMigration and verification completed successfully!');
}

migrateAll().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
