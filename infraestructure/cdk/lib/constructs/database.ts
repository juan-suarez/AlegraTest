import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

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
  passwordSecret: secretsmanager.ISecret;
  securityGroup: ec2.ISecurityGroup;
}

export class DatabaseConstruct extends Construct {
  public readonly output: DatabaseOutput;

  constructor(scope: Construct, id: string, props?: DatabaseConstructProps) {
    super(scope, id);

    let vpc = props?.vpc;
    if (!vpc) {
      vpc = new ec2.Vpc(this, 'Vpc', {
        maxAzs: 1, // Free Tier: Single AZ
      });
    }

    // Security group for RDS - allow PostgreSQL from anywhere
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from anywhere',
    );

    // Master credentials
    const username = 'postgres';

    // Create RDS PostgreSQL Instance (Free Tier compatible)
    const dbInstance = new rds.DatabaseInstance(this, 'PostgresInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_3,
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

    this.output = {
      instance: dbInstance,
      host: dbInstance.dbInstanceEndpointAddress,
      port: dbInstance.dbInstanceEndpointPort as any as number,
      username,
      passwordSecret,
      securityGroup: dbSecurityGroup,
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
