import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as dotenv from 'dotenv';
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { OrderController } from './controllers/OrderController';
import { CreateOrderUseCase } from './use-cases/CreateOrderUseCase';
import { OrderRepository } from './repositories/OrderRepository';
import { globalConfig } from './config/globalConfig';

// Cargar variables de entorno
dotenv.config();

let eventBus: EventBusLocal | null = null;
let httpServer: http.Server | null = null;

function createEventBusInstance(): EventBusLocal {
  return new EventBusLocal(globalConfig.createEventBusConfig());
}

async function initializeDatabase() {
  console.log('🚀 Inicializando order-service...');

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

async function initializeHttpServer(sharedEventBus: EventBusLocal) {
  console.log('\n🌐 Inicializando HTTP Server...');

  try {
    const orderRepository = new OrderRepository(pool);
    const createOrderUseCase = new CreateOrderUseCase(orderRepository, sharedEventBus);
    const orderController = new OrderController(createOrderUseCase);

    const PORT = globalConfig.servicePort;

    httpServer = http.createServer(async (req, res) => {
      // Health check endpoint
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', service: 'order-service' }));
        return;
      }

      // POST /orders endpoint
      if (req.method === 'POST' && req.url === '/orders') {
        await orderController.handleCreateOrder(req, res);
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
      console.log(`   - POST /orders`);
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
    const eventRouter = new EventRouter(pool);

    console.log('✅ Event Bus inicializado');
    console.log(`📬 Escuchando cola: ${globalConfig.sqsQueueUrl}`);

    // Iniciar consumo de mensajes
    eventBus.startConsuming(eventRouter.getHandler()).catch((error) => {
      console.error('❌ Error en consumer:', error);
      process.exit(1);
    });

    console.log('✨ order-service está listo para recibir eventos\n');
  } catch (error) {
    console.error('❌ Error al inicializar Event Bus:', error);
    throw error;
  }
}

async function gracefulShutdown() {
  console.log('\n🛑 Cerrando order-service...');

  if (httpServer) {
    httpServer.close(() => {
      console.log('✅ HTTP Server cerrado');
    });
  }

  if (eventBus) {
    eventBus.stop();
  }

  await pool.end();
  console.log('✅ order-service cerrado correctamente');
  process.exit(0);
}

// Manejar señales de terminación
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Iniciar aplicación
async function main() {
  const ENABLE_HTTP_SERVER = globalConfig.enableHttpServer;
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

main();

