import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface DatabaseConstructProps {
  /**
   * VPC to launch the database in. If not provided, a new VPC will be created.
   */
  vpc?: ec2.IVpc;
}

export interface DatabaseOutput {
  instance: rds.DatabaseInstance;
  host: string;
  port: number;
  username: string;
  iamUsername: string; // Username for IAM authentication
  instanceResourceId: string; // Required for rds-db:connect policy
  passwordSecret: secretsmanager.ISecret;
  securityGroup: ec2.ISecurityGroup;
  vpc: ec2.IVpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseConstruct extends Construct {
  public readonly output: DatabaseOutput;

  constructor(scope: Construct, id: string, props?: DatabaseConstructProps) {
    super(scope, id);

    let vpc = props?.vpc;
    if (!vpc) {
      vpc = new ec2.Vpc(this, 'Vpc', {
        maxAzs: 2, // RDS requires subnets in at least 2 AZs (still Free Tier)
        natGateways: 0, // No NAT Gateway - Free Tier (saves $32/month)
        subnetConfiguration: [
          {
            subnetType: ec2.SubnetType.PUBLIC,
            name: 'Public',
            cidrMask: 24,
          },
        ],
      });
    }

    // Security group for RDS - allow from anywhere (IAM auth still required)
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from anywhere (IAM auth required)',
    );

    // Master credentials
    const username = 'postgres';

    // Create RDS PostgreSQL Instance (Free Tier compatible)
    const dbInstance = new rds.DatabaseInstance(this, 'PostgresInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromUsername(username, {
        excludeCharacters: '/@"\'\\',
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroups: [dbSecurityGroup],
      publiclyAccessible: true, // Allow external access for Lambda and development
      iamAuthentication: true, // Enable IAM Database Authentication for Lambda
      multiAz: false, // Free Tier: no Multi-AZ
      allocatedStorage: 20, // Free Tier: 20GB included
      storageType: rds.StorageType.GP2,
      backupRetention: cdk.Duration.days(1), // Free Tier: minimal backup
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'mon:04:00-mon:05:00',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For testing - destroy DB on stack deletion
      deleteAutomatedBackups: true,
      databaseName: 'postgres',
    });

    // Get the secret that RDS creates automatically
    const passwordSecret = dbInstance.secret!;

    // Create IAM database user (for Lambda authentication)
    const iamUsername = 'iam_lambda_user';

    // Lambda function that sets up the IAM user
    const setupIAMUserLambda = new lambda.NodejsFunction(this, 'SetupIAMUserFunction', {
      entry: path.join(__dirname, 'setup-iam-user-handler.ts'),
      handler: 'handler',
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: [], // Bundle everything including aws-sdk
        minify: false,
      },
    });

    // Grant permissions to read the secret
    passwordSecret.grantRead(setupIAMUserLambda);

    // Create provider for the custom resource
    const provider = new cdk.custom_resources.Provider(
      this,
      'SetupIAMUserProvider',
      {
        onEventHandler: setupIAMUserLambda,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    // Create the custom resource
    const setupResource = new cdk.CustomResource(this, 'SetupIAMUserResource', {
      serviceToken: provider.serviceToken,
      properties: {
        DbHost: dbInstance.dbInstanceEndpointAddress,
        DbPort: dbInstance.dbInstanceEndpointPort,
        DbSecretArn: passwordSecret.secretArn,
        IamUsername: iamUsername,
      },
    });

    // Ensure dependencies
    setupResource.node.addDependency(dbInstance);

    this.output = {
      instance: dbInstance,
      host: dbInstance.dbInstanceEndpointAddress,
      port: dbInstance.dbInstanceEndpointPort as any as number,
      username,
      iamUsername,
      instanceResourceId: dbInstance.instanceResourceId!,
      passwordSecret,
      securityGroup: dbSecurityGroup,
      vpc,
      dbSecurityGroup,
    };

    // Output connection details
    new cdk.CfnOutput(this, 'DbHost', {
      value: this.output.host,
      description: 'RDS Database Host',
    });

    new cdk.CfnOutput(this, 'DbPort', {
      value: String(this.output.port),
      description: 'RDS Database Port',
    });

    new cdk.CfnOutput(this, 'DbUsername', {
      value: this.output.username,
      description: 'RDS Database Username',
    });

    new cdk.CfnOutput(this, 'DbPasswordSecretArn', {
      value: passwordSecret.secretArn,
      description: 'RDS Database Password Secret ARN',
    });
  }
}
