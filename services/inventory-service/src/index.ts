import * as fs from 'fs';
import * as path from 'path';
import pool, { closePool } from './db/connection';
import { EventBusLocal } from './infrastructure/messaging';
import { EventRouter } from './infrastructure/messaging/EventRouter';

let eventBus: EventBusLocal;
let eventRouter: EventRouter;

async function main() {
  console.log('🚀 Inicializando inventory-service...');

  try {
    // Verificar conexión a BD
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexión a BD establecida:', result.rows[0].now);

    // Leer y ejecutar schema
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    console.log('📊 Ejecutando migraciones...');
    await pool.query(schema);
    console.log('✅ Base de datos inicializada correctamente');

    // Verificar tablas
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas:');
    tablesResult.rows.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });

    // Inicializar EventBus
    console.log('\n📡 Inicializando EventBus...');
    const eventBusConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      queueUrl: process.env.SQS_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/000000000000/inventory-service-queue',
      pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '1000', 10),
    };
    eventBus = new EventBusLocal(eventBusConfig);

    // Inicializar EventRouter
    console.log('🔀 Inicializando EventRouter...');
    eventRouter = new EventRouter(pool, eventBus);

    // Conectar handler
    const handler = eventRouter.getHandler();
    await eventBus.startConsuming(handler);
    console.log('✅ EventBus escuchando eventos...');

    console.log('\n✨ inventory-service listo');
  } catch (error) {
    console.error('❌ Error al inicializar:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Recibido SIGTERM, cerrando gracefully...');
  if (eventBus) {
    await eventBus.stop();
  }
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Recibido SIGINT, cerrando gracefully...');
  if (eventBus) {
    await eventBus.stop();
  }
  await closePool();
  process.exit(0);
});

main();
