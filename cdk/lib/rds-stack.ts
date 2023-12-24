import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { Config, SubStackProps } from './utils';
import { Peer, Port, SubnetType, InstanceType, InstanceClass, InstanceSize, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class RdsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, config: Config, props: SubStackProps) {
        super(scope, id);

        // vpc
        const vpc = props.vpc;

        const privateSubnet = vpc.selectSubnets({
            subnetType: SubnetType.PRIVATE_ISOLATED,
        }).subnets

        const publicSubnet = vpc.selectSubnets({
            subnetType: SubnetType.PUBLIC,
        }).subnets

        // SubnetGroup
        const subnetGroup = new rds.SubnetGroup(this, 'subnetGroup', {
            description: `${config.appName}-${config.env}-subnetGroup`,
            vpc,
            vpcSubnets: {
                subnets: privateSubnet,
            },
        });

        // SecurityGroup
        const securityGroup = new SecurityGroup(this, 'securityGroup', {
            vpc,
            description: `${config.appName}-${config.env}-securityGroup`,
        });

        // SecurityGroupにインバウンドを許可
        publicSubnet.forEach(subnet => {
            securityGroup.addIngressRule(
                Peer.ipv4(subnet.ipv4CidrBlock),
                Port.tcp(3306),
                `${config.appName}-${config.env}-securityGroup`,
            );
        });


        /**
         * RDS Admin User Secret
         */
        const secretManagerName = '/test/postgres/admin';
        const EXCLUDE_CHARACTERS = ':@/" \'';
        const rdsAdminSecret = new Secret(this, `${config.appName}-${config.env}-RdsAdminSecret`, {
            secretName: secretManagerName,
            generateSecretString: {
                excludeCharacters: EXCLUDE_CHARACTERS,
                generateStringKey: 'password',
                passwordLength: 32,
                requireEachIncludedType: true,
                secretStringTemplate: '{"username": "postgresAdmin"}',
            },
        });

        let instanceClass;
        if (config.env === 'dev') {
            instanceClass = InstanceType.of(InstanceClass.T4G, InstanceSize.MEDIUM)
        } else {
            instanceClass = InstanceType.of(InstanceClass.T4G, InstanceSize.LARGE)
        }

        const parameterGroup = new rds.ParameterGroup(this, 'parameterGroup', {
            engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_3_05_1 }),
            description: `${config.appName}-${config.env}-parameter-group`,
        });

        const readerInstanceName = `${config.appName}-${config.env}-reader`.toLowerCase();
        const writerInstanceName = `${config.appName}-${config.env}-writer`.toLowerCase();

        // RDS
        const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
            engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_3_05_1 }),
            credentials: rds.Credentials.fromSecret(rdsAdminSecret),
            // defaultDatabaseName: `${config.appName}-${config.env}-db`,

            vpc,
            subnetGroup: subnetGroup,
            storageEncrypted: true,
            securityGroups: [securityGroup],
            readers: [
                rds.ClusterInstance.provisioned(readerInstanceName, {
                    instanceIdentifier: readerInstanceName,
                    instanceType: instanceClass,
                    parameterGroup
                }),
            ],
            writer: rds.ClusterInstance.provisioned(writerInstanceName, {
                instanceIdentifier: writerInstanceName,
                instanceType: instanceClass,
                parameterGroup
            }),

            deletionProtection: false,
            iamAuthentication: true,
            preferredMaintenanceWindow: 'mon:04:00-mon:05:00',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
}
