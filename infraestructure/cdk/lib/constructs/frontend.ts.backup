import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';
import * as exec from 'child_process';
import * as fs from 'fs';

interface FrontendConstructProps {
  restApi: apigateway.RestApi;
  apiKeyValue: string;
}

interface FrontendConstructOutput {
  bucketName: string;
  distributionUrl: string;
  distributionId: string;
}

export class FrontendConstruct extends Construct {
  public output: FrontendConstructOutput;

  constructor(scope: Construct, id: string, props: FrontendConstructProps) {
    super(scope, id);

    // ============================================================
    // 1. Create S3 Bucket for Static Assets
    // ============================================================
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // ============================================================
    // 2. Create CloudFront Distribution
    // ============================================================
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        '/orders*': {
          origin: new origins.HttpOrigin(`${props.restApi.restApiId}.execute-api.${cdk.Stack.of(this).region}.${cdk.Stack.of(this).urlSuffix}`, {
            originPath: `/${props.restApi.deploymentStage.stageName}`,
            customHeaders: {
              'x-api-key': props.apiKeyValue,
            },
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/inventory*': {
          origin: new origins.HttpOrigin(`${props.restApi.restApiId}.execute-api.${cdk.Stack.of(this).region}.${cdk.Stack.of(this).urlSuffix}`, {
            originPath: `/${props.restApi.deploymentStage.stageName}`,
            customHeaders: {
              'x-api-key': props.apiKeyValue,
            },
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/purchases*': {
          origin: new origins.HttpOrigin(`${props.restApi.restApiId}.execute-api.${cdk.Stack.of(this).region}.${cdk.Stack.of(this).urlSuffix}`, {
            originPath: `/${props.restApi.deploymentStage.stageName}`,
            customHeaders: {
              'x-api-key': props.apiKeyValue,
            },
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Free tier optimized
    });

    // ============================================================
    // 3. Build and Deploy Frontend
    // ============================================================
    const frontendPath = path.join(__dirname, '../../../../frontend');
    const distPath = path.join(frontendPath, 'dist');
    
    // Construct API endpoint manually to avoid token resolution issues
    const region = cdk.Stack.of(this).region;
    const urlSuffix = cdk.Stack.of(this).urlSuffix;
    const stageName = props.restApi.deploymentStage.stageName;
    const apiGatewayEndpoint = `https://${props.restApi.restApiId}.execute-api.${region}.${urlSuffix}/${stageName}`;

    console.log('📦 Building frontend for CloudFront + API proxy...');
    console.log(`🔗 Auto-generated API Endpoint: ${apiGatewayEndpoint}`);
    try {
      exec.execSync('npm run build', {
        cwd: frontendPath,
        stdio: 'inherit',
        env: {
          ...process.env,
          VITE_POLLING_INTERVAL: process.env.VITE_POLLING_INTERVAL || '5000',
          // Allow user to override with VITE_API_ENDPOINT env var
          // If not provided, use empty string for CloudFront same-origin mode
          // (CloudFront will add x-api-key to proxied requests)
          VITE_API_ENDPOINT: process.env.VITE_API_ENDPOINT || '',
          VITE_API_KEY: process.env.VITE_API_KEY || '',
        },
      });
    } catch (error) {
      console.error('❌ Frontend build failed:', error);
      throw error;
    }

    if (!fs.existsSync(distPath)) {
      throw new Error(`Frontend dist folder not found at ${distPath}`);
    }

    // Deploy to S3
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(distPath)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ============================================================
    // 4. Set Output
    // ============================================================
    this.output = {
      bucketName: bucket.bucketName,
      distributionUrl: distribution.domainName,
      distributionId: distribution.distributionId,
    };

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 Bucket for frontend',
      exportName: 'restaurant-frontend-bucket',
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.domainName}`,
      description: 'CloudFront Distribution URL',
      exportName: 'restaurant-frontend-url',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: 'restaurant-frontend-distribution-id',
    });
  }
}
