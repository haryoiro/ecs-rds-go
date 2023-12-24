#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Config, Environment, getEnv, getEnvName } from '../lib/utils';
import { SubStackProps } from '../lib/utils';
import { VpcStack } from '../lib/vpc-stack';
import { EcspressoStack } from '../lib/ecspresso-stack';
import { RdsStack } from '../lib/rds-stack';

const app = new cdk.App();

const env: cdk.Environment = getEnv(app);

const config: Config = {
  env: getEnvName(app) as Environment,
  appName: "cdk_ecspresso",
}

const vpcStack = new VpcStack(app, `${config.appName}-${config.env}-vpc`, config, { env });

const props: SubStackProps = {
  vpc: vpcStack.vpc,
}

new EcspressoStack(app, `${config.appName}-${config.env}-ecspresso`, config, props);

new RdsStack(app, `${config.appName}-${config.env}-rds`, config, props);
