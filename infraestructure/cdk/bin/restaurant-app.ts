#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { RestaurantStack } from '../lib/restaurant-stack';

const app = new cdk.App();
new RestaurantStack(app, 'RestaurantStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
