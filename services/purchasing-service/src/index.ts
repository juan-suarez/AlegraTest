import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as dotenv from 'dotenv';
import pool, { closePool } from './db/connection';
import { EventBusLocal } from './infrastructure/messaging';
import { EventRouter } from './infrastructure/messaging/EventRouter';
import { PurchasingController } from './controllers/PurchasingController';
import { PurchaseHistoryRepository } from './repositories';

// Cargar variables de entorno
dotenv.config();

let eventBus: EventBusLocal | null = null;
let httpServer: http.Server | null = null;

function createEventBusInstance(): EventBusLocal {
  const config: any = {
    region: process.env.AWS_REGION || 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID,
    queueUrl: process.env.SQS_QUEUE_URL!,
    pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '10000'),
  };

  // Only use LocalStack endpoint in local development
  if (process.env.AWS_ENDPOINT && process.env.AWS_ENDPOINT.includes('localhost')) {
    config.endpoint = process.env.AWS_ENDPOINT;
    config.accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'test';
    config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'test';
  }
  // In Lambda/AWS, credentials come from IAM role (not passed explicitly)

  return new EventBusLocal(config);
}

async function initializeDatabase() {
  console.log('🚀 Inicializando purchasing-service...');

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
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error);
    throw error;
  }
}

async function initializeHttpServer(sharedEventBus: EventBusLocal) {
  console.log('\n🌐 Inicializando HTTP Server...');

  try {
    const purchaseHistoryRepository = new PurchaseHistoryRepository(pool);
    const purchasingController = new PurchasingController(purchaseHistoryRepository);

    const PORT = parseInt(process.env.SERVICE_PORT || '3003');

    httpServer = http.createServer(async (req, res) => {
      // Health check endpoint
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', service: 'purchasing-service' }));
        return;
      }

      // GET /purchases - List all purchases or filter by orderId/ingredientId
      if (req.method === 'GET' && req.url && req.url.startsWith('/purchases')) {
        if (req.url === '/purchases/stats') {
          await purchasingController.handleGetPurchaseStats(req, res);
        } else {
          const url = new URL(req.url, 'http://localhost');
          const queryParams = Object.fromEntries(url.searchParams);
          await purchasingController.handleGetPurchases(req, res, queryParams);
        }
        return;
      }

      // 404 para rutas no encontradas
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    httpServer.listen(PORT, () => {
      console.log(`✅ HTTP Server escuchando en puerto ${PORT}`);
      console.log(`📍 Endpoints disponibles:`);
      console.log(`   - GET  /health`);
      console.log(`   - GET  /purchases`);
      console.log(`   - GET  /purchases?orderId=xxx`);
      console.log(`   - GET  /purchases?ingredientId=xxx`);
      console.log(`   - GET  /purchases?limit=100`);
      console.log(`   - GET  /purchases/stats`);
    });
  } catch (error) {
    console.error('❌ Error al inicializar HTTP Server:', error);
    throw error;
  }
}

async function initializeEventBus(sharedEventBus: EventBusLocal) {
  console.log('\n🔌 Inicializando Event Bus...');

  try {
    // Usar la instancia compartida del EventBus
    eventBus = sharedEventBus;

    // Crear router (que crea handlers y use cases internamente)
    const eventRouter = new EventRouter(pool, eventBus);

    console.log('✅ Event Bus inicializado');
    console.log(`📬 Escuchando cola: ${process.env.SQS_QUEUE_URL}`);

    // Iniciar consumo de mensajes
    eventBus.startConsuming(eventRouter.getHandler()).catch((error) => {
      console.error('❌ Error en consumer:', error);
      process.exit(1);
    });

    console.log('✨ purchasing-service está listo para recibir eventos\n');
  } catch (error) {
    console.error('❌ Error al inicializar Event Bus:', error);
    throw error;
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Cerrando purchasing-service...');

  if (httpServer) {
    httpServer.close(() => {
      console.log('✅ HTTP Server cerrado');
    });
  }

  if (eventBus) {
    await eventBus.stop();
  }

  await closePool();
  console.log('✅ purchasing-service cerrado correctamente');
  process.exit(0);
}

// Manejar señales de terminación
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Iniciar aplicación
async function main() {
  const ENABLE_HTTP_SERVER = process.env.ENABLE_HTTP_SERVER !== 'false';
  const RUNTIME_MODE = ENABLE_HTTP_SERVER ? 'local (HTTP + EventBus)' : 'lambda (EventBus only)';
  
  try {
    console.log(`🎯 Iniciando en modo: ${RUNTIME_MODE}\n`);
    
    await initializeDatabase();
    
    // Crear una única instancia del EventBus compartida
    const sharedEventBus = createEventBusInstance();
    
    // Inicializar HTTP Server solo si está habilitado
    if (ENABLE_HTTP_SERVER) {
      await initializeHttpServer(sharedEventBus);
    } else {
      console.log('\n⏭️  HTTP Server deshabilitado (ENABLE_HTTP_SERVER=false)');
      console.log('📌 Modo Lambda: Solo EventBus activo');
    }
    
    // Inicializar Event Bus
    await initializeEventBus(sharedEventBus);
  } catch (error) {
    console.error('❌ Error fatal:', error);
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
