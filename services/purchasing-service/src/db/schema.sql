-- Tabla para idempotencia (evitar procesamiento duplicado de eventos)
CREATE TABLE IF NOT EXISTS events_processed (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_processed_event_id ON events_processed(event_id);

-- Tabla de historial de compras
CREATE TABLE IF NOT EXISTS purchase_history (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    ingredient_id VARCHAR(255) NOT NULL,
    ingredient_name VARCHAR(255) NOT NULL,
    quantity_requested INT NOT NULL,
    quantity_purchased INT NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'COMPLETED' | 'FAILED'
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_history_order_id ON purchase_history(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_ingredient_id ON purchase_history(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_created_at ON purchase_history(created_at DESC);
