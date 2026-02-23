-- Tabla para idempotencia (evitar procesamiento duplicado de eventos)
CREATE TABLE IF NOT EXISTS events_processed (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_events_processed_event_id ON events_processed(event_id);
