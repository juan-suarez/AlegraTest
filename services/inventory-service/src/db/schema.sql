-- Tabla para idempotencia (evitar procesamiento duplicado de eventos)
CREATE TABLE IF NOT EXISTS events_processed (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_processed_event_id ON events_processed(event_id);

-- Tabla para rastrear órdenes que ya recibieron evento de fallo de compra
CREATE TABLE IF NOT EXISTS orders_purchase_failed_published (
    order_id UUID PRIMARY KEY,
    published_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_purchase_failed_published ON orders_purchase_failed_published(order_id);

-- Tabla de ingredientes (fuente de verdad del stock)
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);

-- Seed basic ingredients used by kitchen recipes
INSERT INTO ingredients (name, stock)
VALUES
    ('meat', 5),
    ('cheese', 5),
    ('tomato', 5),
    ('lettuce', 5),
    ('onion', 5),
    ('ketchup', 5),
    ('chicken', 5),
    ('rice', 5),
    ('lemon', 5),
    ('potato', 5)
ON CONFLICT (name) DO NOTHING;

-- Tipo enum para estado de reservas
DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('RESERVED', 'PURCHASE_PENDING', 'RELEASED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de reservas de ingredientes
CREATE TABLE IF NOT EXISTS ingredient_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity_needed INTEGER NOT NULL CHECK (quantity_needed > 0),
    quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    status reservation_status NOT NULL DEFAULT 'RESERVED',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_reservations_order_id ON ingredient_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_ingredient_id ON ingredient_reservations(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON ingredient_reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_order_status ON ingredient_reservations(order_id, status);
