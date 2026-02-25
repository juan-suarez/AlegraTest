import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as http from 'http';
import pool from './db/connection';
import { EventBusLocal, EventRouter } from './infrastructure/messaging';
import { CreateOrderUseCase } from './use-cases';
import { OrderRepository } from './repositories';
import { OrderController } from './controllers';

// Cargar variables de entorno
dotenv.config();

let eventBus: EventBusLocal | null = null;
let httpServer: http.Server | null = null;

function createEventBusInstance(): EventBusLocal {
  return new EventBusLocal({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    queueUrl: process.env.SQS_QUEUE_URL!,
    pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '10000'),
  });
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

function initializeHttpServer(sharedEventBus: EventBusLocal) {
  console.log('\n🌐 Inicializando servidor HTTP...');

  try {
    // Instanciar dependencias
    const orderRepository = new OrderRepository(pool);

    // Crear use cases y controladores usando el EventBus compartido
    const createOrderUseCase = new CreateOrderUseCase(orderRepository, sharedEventBus);
    const orderController = new OrderController(createOrderUseCase);

    // Crear servidor HTTP
    httpServer = http.createServer(async (req, res) => {
      // Configurar CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Manejar preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Parsear URL
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const pathname = url.pathname;

      // Routing
      if (pathname === '/orders' && req.method === 'POST') {
        await orderController.handleCreateOrder(req, res);
      } else if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'order-service' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Not Found',
          path: pathname,
          method: req.method
        }));
      }
    });

    const port = parseInt(process.env.SERVICE_PORT || '3001', 10);
    httpServer.listen(port, () => {
      console.log(`✅ Servidor HTTP escuchando en puerto ${port}`);
      console.log(`📍 POST http://localhost:${port}/orders - Crear orden`);
      console.log(`📍 GET http://localhost:${port}/health - Health check`);
    });
  } catch (error) {
    console.error('❌ Error al inicializar servidor HTTP:', error);
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
    console.log(`📬 Escuchando cola: ${process.env.SQS_QUEUE_URL}`);

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
      console.log('✅ Servidor HTTP cerrado');
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
  try {
    await initializeDatabase();
    
    // Crear una única instancia del EventBus compartida
    const sharedEventBus = createEventBusInstance();
    
    // Pasar la instancia compartida a ambas funciones
    initializeHttpServer(sharedEventBus);
    await initializeEventBus(sharedEventBus);
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();

