#!/bin/bash

set -e

echo "=== Initializing LocalStack ==="
echo "Creating SNS Topics..."

# Create SNS Topics
awslocal sns create-topic --name OrderCreated
awslocal sns create-topic --name IngredientsRequired
awslocal sns create-topic --name IngredientsReserved
awslocal sns create-topic --name PurchaseRequested
awslocal sns create-topic --name PurchaseCompleted
awslocal sns create-topic --name PurchaseFailed
awslocal sns create-topic --name IngredientsPurchaseFailed
awslocal sns create-topic --name OrderCompleted

echo "Creating SQS Queues..."

# Create SQS Queues
awslocal sqs create-queue --queue-name order-service-queue
awslocal sqs create-queue --queue-name kitchen-service-queue
awslocal sqs create-queue --queue-name inventory-service-queue
awslocal sqs create-queue --queue-name purchasing-service-queue

echo "Creating SNS to SQS Subscriptions..."

# Helper function to subscribe topic to queue
subscribe_topic_to_queue() {
  local topic_name=$1
  local queue_name=$2

  # Get Topic ARN
  local topic_arn=$(awslocal sns list-topics --query "Topics[?contains(TopicArn, '${topic_name}')].TopicArn" --output text)
  
  # Get Queue URL and ARN
  local queue_url=$(awslocal sqs get-queue-url --queue-name "${queue_name}" --query 'QueueUrl' --output text)
  local queue_arn=$(awslocal sqs get-queue-attributes --queue-url "${queue_url}" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

  # Set queue policy to allow SNS to send messages
  local policy="{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Principal\": \"*\",
        \"Action\": \"sqs:SendMessage\",
        \"Resource\": \"${queue_arn}\",
        \"Condition\": {
          \"ArnEquals\": {
            \"aws:SourceArn\": \"${topic_arn}\"
          }
        }
      }
    ]
  }"

  awslocal sqs set-queue-attributes --queue-url "${queue_url}" --attributes Policy="${policy}"

  # Subscribe queue to topic
  awslocal sns subscribe --topic-arn "${topic_arn}" --protocol sqs --notification-endpoint "${queue_arn}"

  echo "✓ Subscribed ${topic_name} → ${queue_name}"
}

# Subscribe Topics to Queues
subscribe_topic_to_queue "OrderCreated" "order-service-queue"
subscribe_topic_to_queue "OrderCreated" "kitchen-service-queue"

subscribe_topic_to_queue "IngredientsRequired" "inventory-service-queue"

subscribe_topic_to_queue "IngredientsReserved" "order-service-queue"
subscribe_topic_to_queue "IngredientsReserved" "kitchen-service-queue"

subscribe_topic_to_queue "PurchaseRequested" "purchasing-service-queue"

subscribe_topic_to_queue "PurchaseCompleted" "inventory-service-queue"

subscribe_topic_to_queue "PurchaseFailed" "inventory-service-queue"
subscribe_topic_to_queue "PurchaseFailed" "order-service-queue"

subscribe_topic_to_queue "IngredientsPurchaseFailed" "order-service-queue"

subscribe_topic_to_queue "OrderCompleted" "order-service-queue"

echo "=== LocalStack Initialization Complete ==="
echo "SNS Endpoint: http://localhost:4566"
echo "SQS Endpoint: http://localhost:4566"
