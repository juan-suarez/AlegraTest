#!/bin/bash

echo "🚀 Deploying Frontend to S3..."

# Get stack outputs
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name RestaurantStack --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
API_KEY_ID=$(aws cloudformation describe-stacks --stack-name RestaurantStack --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayApiKeyId7AC13F75'].OutputValue" --output text)
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name RestaurantStack --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName47F7E0AE'].OutputValue" --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name RestaurantStack --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId6CBC2EDF'].OutputValue" --output text)

# Get actual API Key value
API_KEY=$(aws apigateway get-api-key --api-key $API_KEY_ID --include-value --query 'value' --output text)

echo "✅ API Endpoint: $API_ENDPOINT"
echo "✅ API Key ID: $API_KEY_ID"
echo "✅ Bucket: $BUCKET_NAME"
echo "✅ Distribution: $DISTRIBUTION_ID"

# Create .env.production
cd ../../../frontend
cat > .env.production << EOF
VITE_API_ENDPOINT=$API_ENDPOINT
VITE_API_KEY=$API_KEY
VITE_POLLING_INTERVAL=5000
EOF

echo "📦 Building frontend..."
npm run build

echo "📤 Uploading to S3..."
aws s3 sync dist/ s3://$BUCKET_NAME --delete

echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo "✅ Frontend deployed successfully!"
echo "🌐 URL: https://$(aws cloudformation describe-stacks --stack-name RestaurantStack --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionUrlD92A0E31'].OutputValue" --output text)"

# Clean up
rm .env.production
