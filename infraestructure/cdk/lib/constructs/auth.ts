import * as cdk from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthConstructOutput {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  domain: cognito.UserPoolDomain;
  domainUrl: string;
}

const sanitizeDomainPrefix = (value: string): string => {
  const cleanValue = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (cleanValue.length >= 3 && cleanValue.length <= 63) {
    return cleanValue;
  }

  return `restaurant-auth-${Date.now().toString().slice(-6)}`;
};

const parseRedirectUrls = (): string[] => {
  const rawValue = process.env.COGNITO_CALLBACK_URLS ?? 'http://localhost:5173';
  const parsed = rawValue
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : ['http://localhost:5173'];
};

const parseLogoutUrls = (): string[] => {
  const rawValue = process.env.COGNITO_LOGOUT_URLS ?? 'http://localhost:5173';
  const parsed = rawValue
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : ['http://localhost:5173'];
};

export class AuthConstruct extends Construct {
  public readonly output: AuthConstructOutput;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const userPool = new cognito.UserPool(this, 'RestaurantUserPool', {
      userPoolName: 'restaurant-user-pool',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      mfa: cognito.Mfa.OFF,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const callbackUrls = parseRedirectUrls();
    const logoutUrls = parseLogoutUrls();

    const userPoolClient = new cognito.UserPoolClient(this, 'RestaurantUserPoolClient', {
      userPool,
      userPoolClientName: 'restaurant-frontend-client',
      generateSecret: false,
      authFlows: {
        userPassword: false,
        userSrp: false,
      },
      oAuth: {
        callbackUrls,
        logoutUrls,
        flows: {
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
      },
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    const customPrefix = process.env.COGNITO_DOMAIN_PREFIX
      ?? `${cdk.Stack.of(this).stackName}-restaurant-auth`;

    const domainPrefix = sanitizeDomainPrefix(customPrefix);

    const domain = userPool.addDomain('RestaurantUserPoolDomain', {
      cognitoDomain: {
        domainPrefix,
      },
    });

    const domainUrl = domain.baseUrl();

    this.output = {
      userPool,
      userPoolClient,
      domain,
      domainUrl,
    };

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'RestaurantCognitoUserPoolId',
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'RestaurantCognitoUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: domainUrl,
      description: 'Cognito Hosted UI base URL',
      exportName: 'RestaurantCognitoDomainUrl',
    });
  }
}
