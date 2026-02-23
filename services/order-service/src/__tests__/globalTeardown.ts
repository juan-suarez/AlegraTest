import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILE = path.join(__dirname, '.test-db-config.json');

export default async function globalTeardown() {
  console.log('\n🛑 [GLOBAL TEARDOWN] Stopping PostgreSQL container...');
  
  try {
    // Close any remaining pools first
    if ((global as any).__TEST_POOLS__) {
      const pools = (global as any).__TEST_POOLS__ as any[];
      for (const pool of pools) {
        try {
          await pool.end();
        } catch (e) {
          // Ignore errors while closing pools
        }
      }
    }

    // Give time for connections to close
    await new Promise(resolve => setTimeout(resolve, 500));

    const container = (global as any).__TEST_CONTAINER__;
    if (container) {
      await container.stop();
      console.log('✅ [GLOBAL TEARDOWN] PostgreSQL container stopped');
    }

    // Clean up config file
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    console.log('✅ [GLOBAL TEARDOWN] Cleanup complete\n');
  } catch (error) {
    console.error('⚠️  [GLOBAL TEARDOWN] Non-critical error:', (error as any).message);
    // Don't throw - allow tests to finish
  }
}




