-- Order queries
-- name: CreateOrder :one
INSERT INTO orders (id, total_dishes, status)
VALUES ($1, $2, 'CREATED')
RETURNING *;

-- name: FindOrderById :one
SELECT * FROM orders WHERE id = $1;

-- name: UpdateOrderStatus :one
UPDATE orders
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CreateOrderItems :many
INSERT INTO order_items (id, order_id, recipe_id, quantity)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: FindOrderItemsByOrderId :many
SELECT * FROM order_items WHERE order_id = $1;