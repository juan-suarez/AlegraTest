-- Event processing queries
-- name: IsEventProcessed :one
SELECT 1 FROM events_processed WHERE event_id = $1;

-- name: MarkEventAsProcessed :exec
INSERT INTO events_processed (event_id)
VALUES ($1)
ON CONFLICT (event_id) DO NOTHING;