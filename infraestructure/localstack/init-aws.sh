#!/bin/bash

# Exit on first error to catch problems
set -e

# Use AWS CLI with LocalStack endpoint
export AWS_ENDPOINT_URL_SNS=${AWS_ENDPOINT_URL_SNS:-http://localstack:4566}
export AWS_ENDPOINT_URL_SQS=${AWS_ENDPOINT_URL_SQS:-http://localstack:4566}
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-1}
export AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-test}
export AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-test}

echo ""
echo "=========================================="
echo "  🚀 LocalStack Initialization Started"
echo "=========================================="
echo ""

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
for i in {1..60}; do
  if aws sns list-topics --endpoint-url $AWS_ENDPOINT_URL_SNS --output json 2>/dev/null | grep -q "Topics"; then
    echo "✅ LocalStack is ready!"
    sleep 2
    break
  fi
  echo "   Attempt $i/60 - waiting for LocalStack..."
  sleep 1
done

echo ""
echo "📋 STEP 1: Purging & Creating SQS Queues"
echo "========================================"

# Create or get SQS Queues - store URLs in array
declare -A queue_urls
for queue in order-service-queue kitchen-service-queue inventory-service-queue purchasing-service-queue; do
  # Try to create - may fail if exists, that's ok
  aws sqs create-queue --queue-name "$queue" --endpoint-url $AWS_ENDPOINT_URL_SQS 2>/dev/null || true
  
  # Get the queue URL - this should work regardless
  url=$(aws sqs get-queue-url --queue-name "$queue" --endpoint-url $AWS_ENDPOINT_URL_SQS --output text 2>/dev/null || echo "")
  
  if [ -z "$url" ] || ! echo "$url" | grep -q "queue"; then
    echo "❌ ERROR: Failed to get URL for queue: $queue"
    exit 1
  fi
  
  queue_urls[$queue]=$url
  echo "✓ Queue ready: $queue → $url"
done

echo ""
echo "📢 STEP 2: Creating SNS Topics"
echo "=============================="

# Create SNS Topics and get ARNs
declare -A topic_arns
for topic in OrderCreated OrderItemsSelected IngredientsRequired IngredientsReserved PurchaseRequested PurchaseCompleted PurchaseFailed IngredientsPurchaseFailed OrderCompleted; do
  # Try to create - may fail if exists, that's ok
  arn=$(aws sns create-topic --name "$topic" --endpoint-url $AWS_ENDPOINT_URL_SNS --output text 2>/dev/null || echo "")
  
  # If create failed or returned empty, list and find it
  if [ -z "$arn" ] || ! echo "$arn" | grep -q ":"; then
    arn=$(aws sns list-topics --endpoint-url $AWS_ENDPOINT_URL_SNS --output text 2>/dev/null | grep "$topic" | awk '{print $2}' || true)
  fi
  
  if [ -z "$arn" ] || ! echo "$arn" | grep -q ":"; then
    echo "❌ ERROR: Could not find or create topic: $topic"
    exit 1
  fi
  
  topic_arns[$topic]=$arn
  echo "✓ Topic ready: $topic → $arn"
done

echo ""
echo "🔗 STEP 3: Creating SNS → SQS Subscriptions"
echo "=========================================="

# Function to subscribe queue to topic
subscribe_queue_to_topic() {
  local topic=$1
  local queue=$2
  
  local topic_arn="${topic_arns[$topic]}"
  local queue_url="${queue_urls[$queue]}"
  
  if [ -z "$topic_arn" ]; then
    echo "❌ ERROR: Missing topic ARN for $topic"
    return 1
  fi
  
  if [ -z "$queue_url" ]; then
    echo "❌ ERROR: Missing queue URL for $queue"
    return 1
  fi
  
  # Get queue ARN
  local queue_arn=$(aws sqs get-queue-attributes --queue-url "$queue_url" --attribute-names QueueArn --endpoint-url $AWS_ENDPOINT_URL_SQS --output text 2>&1 | awk '{print $2}')
  
  if [ -z "$queue_arn" ] || ! echo "$queue_arn" | grep -q ":"; then
    echo "❌ ERROR: Could not get ARN for queue $queue (url: $queue_url)"
    return 1
  fi
  
  # Subscribe queue to topic (ignore if already subscribed)
  aws sns subscribe --topic-arn "$topic_arn" --protocol sqs --notification-endpoint "$queue_arn" --endpoint-url $AWS_ENDPOINT_URL_SNS --output text 2>/dev/null || true
  
  echo "✓ Subscribed $queue ← $topic"
}

# Define subscriptions based on EventRouter analysis:
# order-service consumes: IngredientsReserved, IngredientsPurchaseFailed, OrderCompleted, OrderItemsSelected
subscribe_queue_to_topic "IngredientsReserved" "order-service-queue"
subscribe_queue_to_topic "IngredientsPurchaseFailed" "order-service-queue"
subscribe_queue_to_topic "OrderCompleted" "order-service-queue"
subscribe_queue_to_topic "OrderItemsSelected" "order-service-queue"

# kitchen-service consumes: OrderCreated, IngredientsReserved
subscribe_queue_to_topic "OrderCreated" "kitchen-service-queue"
subscribe_queue_to_topic "IngredientsReserved" "kitchen-service-queue"

# inventory-service consumes: IngredientsRequired, PurchaseCompleted, PurchaseFailed
subscribe_queue_to_topic "IngredientsRequired" "inventory-service-queue"
subscribe_queue_to_topic "PurchaseCompleted" "inventory-service-queue"
subscribe_queue_to_topic "PurchaseFailed" "inventory-service-queue"

# purchasing-service consumes: PurchaseRequested
subscribe_queue_to_topic "PurchaseRequested" "purchasing-service-queue"

echo ""
echo "=========================================="
echo "  ✅ LocalStack Initialization Complete"
echo "=========================================="
echo ""
echo "⏳ Waiting 2 seconds before releasing services..."
sleep 2

exit 0

