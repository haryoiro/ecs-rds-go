import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export type Environment = 'dev' | 'prod';
export interface Config {
    env: Environment;
    appName: string;
}

export interface SubStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
}

/**
 * 引数で渡したenviromentの値を取得する
 * https://dev.classmethod.jp/articles/aws-cdk-multi-environment-config/
 * @param app
 * @returns
 */
export const getEnvName = (app: cdk.App): string => {
    const argContext = "environment";
    const envKey = app.node.tryGetContext(argContext);
    if (!envKey) {
        throw new Error(`-c ${argContext}=dev|prod is required`);
    }
    return envKey;
}

/**
 * cdk.jsonのcontextで指定した値を取得する
 * https://dev.classmethod.jp/articles/aws-cdk-multi-environment-config/
 * @param app
 * @returns
 */
export const getEnv = (app: cdk.App): cdk.Environment => {
    const envKey = getEnvName(app);
    const envVals = app.node.tryGetContext(envKey);
    if (!envVals) {
        throw new Error(`-c ${envKey}=dev|prod is required`);
    }

    return { account: envVals["env"]["account"], region: envVals["env"]["region"] }
}
