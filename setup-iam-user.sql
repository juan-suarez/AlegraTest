-- SQL commands to enable IAM authentication for Lambda
-- Execute these commands connected as the 'postgres' user

-- Create the IAM database user
CREATE USER iam_lambda_user;

-- Grant the rds_iam role (enables PostgreSQL IAM Database Authentication)
GRANT rds_iam TO iam_lambda_user;

-- Grant database-level permissions (allows connection)
GRANT CONNECT ON DATABASE postgres TO iam_lambda_user;
GRANT CONNECT ON DATABASE order_service TO iam_lambda_user;
GRANT CONNECT ON DATABASE kitchen_service TO iam_lambda_user;
GRANT CONNECT ON DATABASE inventory_service TO iam_lambda_user;
GRANT CONNECT ON DATABASE purchasing_service TO iam_lambda_user;

-- Grant schema-level permissions
GRANT USAGE ON SCHEMA public TO iam_lambda_user;

-- Grant table-level permissions (for all current and future tables)
ALTER DEFAULT PRIVILEGES FOR USER postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO iam_lambda_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO iam_lambda_user;

-- Grant sequence permissions (for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iam_lambda_user;
ALTER DEFAULT PRIVILEGES FOR USER postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO iam_lambda_user;

-- Verify setup
SELECT usename, usecanlogin, ARRAY(SELECT b.rolname FROM pg_auth_members a JOIN pg_roles b ON a.roleid = b.oid WHERE a.member = u.usesysid) as roles
FROM pg_user u WHERE u.usename = 'iam_lambda_user';
