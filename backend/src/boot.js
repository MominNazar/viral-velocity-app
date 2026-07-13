import { restoreDatabaseIfNeeded, startBackupScheduler, backupDatabase, enableBackups } from './lib/persist.js';
import { hydrateAllMissingFiles } from './lib/files.js';

async function run() {
  const restore = await restoreDatabaseIfNeeded();
  console.log('[persist] restore result:', restore);

  const { runMigrations } = await import('./migrate.js');
  runMigrations({ close: false });

  const { runSeed } = await import('./seed.js');
  await runSeed({ close: false });

  const { db } = await import('./db.js');
  // Prefer DELETE journal when using remote snapshots (single-file backup)
  try {
    db.pragma('journal_mode = DELETE');
  } catch {
    /* ignore */
  }
  hydrateAllMissingFiles();
  enableBackups();
  startBackupScheduler(db);

  const { createApp } = await import('./app.js');
  const { config } = await import('./config.js');
  const { startSubscriptionMaintenance } = await import('./jobs/subscriptionMaintenance.js');

  const app = createApp();
  startSubscriptionMaintenance();

  process.on('SIGTERM', () => {
    backupDatabase(db, { force: true }).finally(() => process.exit(0));
  });

  app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `Viral Velocity API listening on http://0.0.0.0:${config.port} (DATA_DIR=${config.dataDir})`
    );
  });
}

run().catch((err) => {
  console.error('Boot failed:', err);
  process.exit(1);
});
