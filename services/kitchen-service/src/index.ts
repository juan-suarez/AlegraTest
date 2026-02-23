import * as fs from 'fs';
import * as path from 'path';
import pool, { closePool } from './db/connection';

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

    console.log('\n✨ kitchen-service está listo para recibir eventos');
  } catch (error) {
    console.error('❌ Error al inicializar:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

initializeDatabase();
