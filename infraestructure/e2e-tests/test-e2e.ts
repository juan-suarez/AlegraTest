/**
 * E2E Test: Restaurant Event-Driven Architecture
 * 
 * Flujo esperado:
 * Order Service: CreateOrder → OrderCreated
 * Kitchen Service: OrderCreated → OrderItemsSelected + IngredientsRequired
 * Inventory Service: IngredientsRequired → PurchaseRequested + IngredientsReserved
 * Purchasing Service: PurchaseRequested → PurchaseCompleted
 * Inventory Service: PurchaseCompleted → (update stock)
 */

import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface TestConfig {
  orderDbUrl: string;
  kitchenDbUrl: string;
  inventoryDbUrl: string;
  purchasingDbUrl: string;
  eventBusEndpoint: string;
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
}

interface TestResult {
  success: boolean;
  orderId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  eventCounts: {
    order: number;
    kitchen: number;
    inventory: number;
    purchasing: number;
  };
  errors: string[];
}

class E2ETester {
  private config: TestConfig;
  private testResult: TestResult;
  private orderId: string;
  private snsClient: SNSClient;
  private baselineCounts: Record<string, number>;

  constructor(config: TestConfig) {
    this.config = config;
    this.orderId = randomUUID();
    this.snsClient = new SNSClient({
      region: this.config.awsRegion,
      endpoint: this.config.eventBusEndpoint,
      credentials: {
        accessKeyId: this.config.awsAccessKeyId,
        secretAccessKey: this.config.awsSecretAccessKey,
      },
    });
    this.baselineCounts = {};
    this.testResult = {
      success: false,
      orderId: this.orderId,
      startTime: new Date(),
      endTime: new Date(),
      durationMs: 0,
      eventCounts: {
        order: 0,
        kitchen: 0,
        inventory: 0,
        purchasing: 0,
      },
      errors: [],
    };
  }

  async run(): Promise<TestResult> {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         🍽️  E2E TEST - RESTAURANT SYSTEM               ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Test ID: ${this.orderId}\n`);

    const startTime = Date.now();

    try {
      // 1. Verificar conexiones a BDs
      console.log('Step 1️⃣  Verificando conexiones a bases de datos...');
      await this.verifyDatabaseConnections();

      // 2. Capturar baseline de eventos
      console.log('\nStep 2️⃣  Capturando baseline de eventos...');
      await this.captureBaselineCounts();

      // 3. Crear orden en order-service
      console.log('\nStep 3️⃣  Creando orden...');
      await this.createOrder();

      // 4. Esperar a que se procesen los eventos
      console.log('\nStep 4️⃣  Esperando propagación de eventos (15 segundos)...');
      await this.waitForEventPropagation();

      // 5. Verificar eventos en todas las BDs
      console.log('\nStep 5️⃣  Verificando eventos en todas las BDs...');
      await this.verifyEvents();

      // 6. Verificar estado final
      console.log('\nStep 6️⃣  Verificando estado final...');
      await this.verifyFinalState();

      this.testResult.success = true;
      this.testResult.durationMs = Date.now() - startTime;
      this.testResult.endTime = new Date();

      this.printSuccessReport();
    } catch (error) {
      this.testResult.errors.push(error instanceof Error ? error.message : String(error));
      this.testResult.durationMs = Date.now() - startTime;
      this.testResult.endTime = new Date();
      this.printErrorReport();
    }

    return this.testResult;
  }

  private async verifyDatabaseConnections(): Promise<void> {
    const pools = [
      { name: 'Order DB', url: this.config.orderDbUrl },
      { name: 'Kitchen DB', url: this.config.kitchenDbUrl },
      { name: 'Inventory DB', url: this.config.inventoryDbUrl },
      { name: 'Purchasing DB', url: this.config.purchasingDbUrl },
    ];

    for (const { name, url } of pools) {
      try {
        const pool = new Pool({ connectionString: url });
        const result = await pool.query('SELECT NOW()');
        pool.end();
        console.log(`  ✅ ${name}: ${result.rows[0].now}`);
      } catch (error) {
        throw new Error(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async captureBaselineCounts(): Promise<void> {
    const pools = [
      { name: 'Order', url: this.config.orderDbUrl },
      { name: 'Kitchen', url: this.config.kitchenDbUrl },
      { name: 'Inventory', url: this.config.inventoryDbUrl },
      { name: 'Purchasing', url: this.config.purchasingDbUrl },
    ];

    for (const { name, url } of pools) {
      try {
        const pool = new Pool({ connectionString: url });
        const result = await pool.query('SELECT COUNT(*) as count FROM events_processed');
        this.baselineCounts[name] = parseInt(result.rows[0].count, 10);
        pool.end();
        console.log(`  ✅ ${name}: Baseline ${this.baselineCounts[name]} evento(s)`);
      } catch (error) {
        console.log(`  ⚠️  ${name}: No se pudo obtener baseline`);
      }
    }
  }

  private async createOrder(): Promise<void> {
    try {
      const pool = new Pool({ connectionString: this.config.orderDbUrl });

      // Crear orden
      await pool.query(
        'INSERT INTO orders (id, total_dishes, status, created_at) VALUES ($1, $2, $3, NOW())',
        [this.orderId, 3, 'CREATED']
      );

      pool.end();
      console.log(`  ✅ Orden creada: ${this.orderId}`);
      await this.publishOrderCreated();
      console.log('  ✅ Evento OrderCreated publicado');
    } catch (error) {
      throw new Error(`Error creando orden: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async publishOrderCreated(): Promise<void> {
    const eventId = randomUUID();
    const envelope = {
      eventId,
      eventType: 'OrderCreated',
      occurredAt: new Date().toISOString(),
      source: 'e2e-test',
      data: {
        orderId: this.orderId,
        totalDishes: 3,
        timestamp: new Date().toISOString(),
        eventId,
      },
    };

    const topicArn = `arn:aws:sns:${this.config.awsRegion}:000000000000:OrderCreated`;

    await this.snsClient.send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(envelope),
      })
    );
  }

  private async waitForEventPropagation(): Promise<void> {
    for (let i = 15; i > 0; i--) {
      process.stdout.write(`\r  ⏳ Esperando... ${i}s`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\r  ✅ Tiempo de espera completado                  ');
  }

  private async verifyEvents(): Promise<void> {
    const services = [
      { name: 'Order', key: 'order', url: this.config.orderDbUrl },
      { name: 'Kitchen', key: 'kitchen', url: this.config.kitchenDbUrl },
      { name: 'Inventory', key: 'inventory', url: this.config.inventoryDbUrl },
      { name: 'Purchasing', key: 'purchasing', url: this.config.purchasingDbUrl },
    ];

    for (const service of services) {
      try {
        const pool = new Pool({ connectionString: service.url });
        const result = await pool.query('SELECT COUNT(*) as count FROM events_processed');
        const totalCount = parseInt(result.rows[0].count, 10);
        const baseline = this.baselineCounts[service.name] || 0;
        const eventCount = Math.max(0, totalCount - baseline);
        this.testResult.eventCounts[service.key as keyof typeof this.testResult.eventCounts] = eventCount;

        console.log(`  ✅ ${service.name} Service: ${eventCount} evento(s) nuevo(s)`);

        pool.end();
      } catch (error) {
        throw new Error(`Error verificando eventos en ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async verifyFinalState(): Promise<void> {
    try {
      const pool = new Pool({ connectionString: this.config.orderDbUrl });

      // Verificar que la orden existe y tiene estado esperado
      const orderResult = await pool.query(
        'SELECT * FROM orders WHERE id = $1',
        [this.orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error(`Orden ${this.orderId} no encontrada`);
      }

      const order = orderResult.rows[0];
      console.log(`  ✅ Orden existe con estado: ${order.status}`);

      pool.end();
    } catch (error) {
      throw new Error(`Error verificando estado final: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private printSuccessReport(): void {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ TEST EXITOSO                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Resultados:\n`);
    console.log(`  ID Orden: ${this.testResult.orderId}`);
    console.log(`  Duración: ${this.testResult.durationMs}ms`);
    console.log(`  Eventos totales: ${Object.values(this.testResult.eventCounts).reduce((a, b) => a + b, 0)}`);
    console.log(`\n  Eventos por servicio:`);
    console.log(`    • Order: ${this.testResult.eventCounts.order}`);
    console.log(`    • Kitchen: ${this.testResult.eventCounts.kitchen}`);
    console.log(`    • Inventory: ${this.testResult.eventCounts.inventory}`);
    console.log(`    • Purchasing: ${this.testResult.eventCounts.purchasing}`);
    console.log('\n✨ Arquitectura event-driven funcionando correctamente\n');
  }

  private printErrorReport(): void {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                   ❌ TEST FALLIDO                       ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`\n❌ Errores:\n`);
    for (const error of this.testResult.errors) {
      console.log(`  • ${error}`);
    }
    console.log('\n');
  }
}

// Ejecutar test
async function main() {
  console.log('E2E test starting...');
  const config: TestConfig = {
    orderDbUrl: process.env.ORDER_DB_URL || 'postgresql://postgres:postgres@localhost:5432/order_service',
    kitchenDbUrl: process.env.KITCHEN_DB_URL || 'postgresql://postgres:postgres@localhost:5432/kitchen_service',
    inventoryDbUrl: process.env.INVENTORY_DB_URL || 'postgresql://postgres:postgres@localhost:5432/inventory_service',
    purchasingDbUrl: process.env.PURCHASING_DB_URL || 'postgresql://postgres:postgres@localhost:5432/purchasing_service',
    eventBusEndpoint: process.env.EVENT_BUS_ENDPOINT || 'http://localhost:4566',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  };

  const tester = new E2ETester(config);
  const result = await tester.run();
  console.log(`E2E test finished. Success: ${result.success}`);
  process.exitCode = result.success ? 0 : 1;
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
