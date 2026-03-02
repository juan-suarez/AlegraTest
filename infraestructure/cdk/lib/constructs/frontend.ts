import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as path from 'path';
import * as exec from 'child_process';
import * as fs from 'fs';
import type { AuthConstructOutput } from './auth';

interface FrontendConstructProps {
  restApi: apigateway.RestApi;
  apiKeyValue: string;
  authOutput: AuthConstructOutput;
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
      websiteErrorDocument: 'index.html',
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
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // ============================================================
    // 3. Build and Deploy Frontend
    // ============================================================
    const frontendPath = path.join(__dirname, '../../../../frontend');
    const distPath = path.join(frontendPath, 'dist');

    const region = cdk.Stack.of(this).region;
    const urlSuffix = cdk.Stack.of(this).urlSuffix;
    const stageName = props.restApi.deploymentStage.stageName;
    const apiGatewayEndpoint = `https://${props.restApi.restApiId}.execute-api.${region}.${urlSuffix}/${stageName}`;
    const distributionUrl = `https://${distribution.domainName}`;

    console.log('📦 Building frontend for CloudFront + API proxy...');
    console.log(`🔗 API Endpoint: ${apiGatewayEndpoint}`);
    console.log('🔐 Cognito Domain provided via deploy environment variables');
    console.log(`🌍 Frontend URL: ${distributionUrl}`);

    try {
      exec.execSync('npm run build', {
        cwd: frontendPath,
        stdio: 'inherit',
        env: {
          ...process.env,
          VITE_POLLING_INTERVAL: process.env.VITE_POLLING_INTERVAL || '5000',
          VITE_API_ENDPOINT: process.env.VITE_API_ENDPOINT || '',
          VITE_API_KEY: process.env.VITE_API_KEY || '',
          VITE_AUTH_ENABLED: process.env.VITE_AUTH_ENABLED || 'false',
          VITE_COGNITO_DOMAIN: process.env.VITE_COGNITO_DOMAIN || '',
          VITE_COGNITO_CLIENT_ID: process.env.VITE_COGNITO_CLIENT_ID || '',
          VITE_COGNITO_REDIRECT_URI: process.env.VITE_COGNITO_REDIRECT_URI || '',
          VITE_COGNITO_LOGOUT_URI: process.env.VITE_COGNITO_LOGOUT_URI || '',
          VITE_COGNITO_SCOPES: process.env.VITE_COGNITO_SCOPES || 'openid email profile',
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
    const deployWebsite = new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(distPath)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    const runtimeConfigJson = cdk.Stack.of(this).toJsonString({
      auth: {
        enabled: true,
        cognitoDomain: props.authOutput.domainUrl,
        clientId: props.authOutput.userPoolClient.userPoolClientId,
        redirectUri: `${distributionUrl}/`,
        logoutUri: `${distributionUrl}/`,
        scopes: 'openid email profile',
      },
    });

    const runtimeConfigBody = cdk.Fn.join('', [
      'window.__APP_CONFIG__ = ',
      runtimeConfigJson,
      ';',
    ]);

    const runtimeConfigWriter = new cr.AwsCustomResource(this, 'RuntimeConfigWriter', {
      onCreate: {
        service: 'S3',
        action: 'putObject',
        parameters: {
          Bucket: bucket.bucketName,
          Key: 'runtime-config.js',
          Body: runtimeConfigBody,
          ContentType: 'application/javascript',
          CacheControl: 'no-store, max-age=0',
        },
        physicalResourceId: cr.PhysicalResourceId.of('RuntimeConfigWriter-v1'),
      },
      onUpdate: {
        service: 'S3',
        action: 'putObject',
        parameters: {
          Bucket: bucket.bucketName,
          Key: 'runtime-config.js',
          Body: runtimeConfigBody,
          ContentType: 'application/javascript',
          CacheControl: 'no-store, max-age=0',
        },
        physicalResourceId: cr.PhysicalResourceId.of('RuntimeConfigWriter-v1'),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [bucket.arnForObjects('runtime-config.js')],
        }),
      ]),
    });

    runtimeConfigWriter.node.addDependency(deployWebsite);

    // ============================================================
    // 4. Set Output
    // ============================================================
    this.output = {
      bucketName: bucket.bucketName,
      distributionUrl: distribution.domainName,
      distributionId: distribution.distributionId,
    };

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 Bucket for frontend',
      exportName: 'restaurant-frontend-bucket',
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: distributionUrl,
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
