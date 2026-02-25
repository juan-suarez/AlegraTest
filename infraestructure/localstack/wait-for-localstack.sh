#!/bin/bash

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."

MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if awslocal sns list-topics > /dev/null 2>&1; then
    echo "✅ LocalStack is ready!"
    
    # Sleep a moment to ensure it's fully ready
    sleep 2
    
    # Now run the init script
    echo "🚀 Running initialization script..."
    if [ -f /docker-entrypoint-initaws.d/init-aws.sh ]; then
      chmod +x /docker-entrypoint-initaws.d/init-aws.sh
      bash /docker-entrypoint-initaws.d/init-aws.sh
      echo "✅ Initialization script completed"
    else
      echo "❌ Init script not found"
      exit 1
    fi
    
    exit 0
  fi
  
  ATTEMPT=$((ATTEMPT + 1))
  echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - LocalStack not ready yet..."
  sleep 1
done

echo "❌ LocalStack did not become ready in time"
exit 1
