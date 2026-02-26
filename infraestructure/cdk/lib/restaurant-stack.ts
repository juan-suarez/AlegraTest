import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class RestaurantStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // TODO: Add constructs here
    // 1. Database construct
    // 2. Event Bus construct (SNS + SQS)
    // 3. Lambda Services construct
    // 4. API Gateway construct
  }
}
