import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { globalConfig } from './config/globalConfig';

// Cargar variables de entorno
dotenv.config();

let eventBus: EventBusLocal | null = null;
const READY_FILE_PATH = '/tmp/kitchen-ready';

async function initializeDatabase() {
  console.log('🚀 Inicializando kitchen-service...');

  try {
    // Verificar conexión
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexión a BD establecida:', result.rows[0].now);

    // Leer y ejecutar schema
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    console.log('📊 Ejecutando migraciones...');
    await pool.query(schema);
    console.log('✅ Base de datos inicializada correctamente');

    // Verificar que las tablas existen
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas creadas:');
    tablesResult.rows.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error);
    throw error;
  }
}

async function initializeEventBus() {
  console.log('\n🔌 Inicializando Event Bus...');

  try {
    // Crear EventBusLocal
    const config = globalConfig.createEventBusConfig();
    
    eventBus = new EventBusLocal(config);

    // Crear router (que crea handlers y use cases internamente)
    const eventRouter = new EventRouter(pool, eventBus);

    console.log('✅ Event Bus inicializado');
    console.log(`📬 Escuchando cola: ${globalConfig.sqsQueueUrl}`);

    // Iniciar consumo de mensajes
    eventBus.startConsuming(eventRouter.getHandler()).catch((error) => {
      console.error('❌ Error en consumer:', error);
      process.exit(1);
    });

    await fs.promises.writeFile(READY_FILE_PATH, 'ready');

    console.log('✨ kitchen-service está listo para recibir eventos\n');
  } catch (error) {
    console.error('❌ Error al inicializar Event Bus:', error);
    throw error;
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Cerrando kitchen-service...');

  if (eventBus) {
    eventBus.stop();
  }

  try {
    await fs.promises.unlink(READY_FILE_PATH);
  } catch {}

  await pool.end();
  console.log('✅ kitchen-service cerrado correctamente');
  process.exit(0);
}

// Manejar señales de terminación
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Iniciar aplicación
async function main() {
  try {
    try {
      await fs.promises.unlink(READY_FILE_PATH);
    } catch {}

    await initializeDatabase();
    await initializeEventBus();
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
