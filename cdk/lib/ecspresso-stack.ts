import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Config, SubStackProps } from './utils';



export class EcspressoStack extends cdk.Stack {
    constructor(scope: Construct, id: string, config: Config, props: SubStackProps) {
        super(scope, id);

        // VPC
        const vpc = props.vpc;

        const privateSubnet = vpc.selectSubnets({
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }).subnets

        // セキュリティグループ
        const albSg = new ec2.SecurityGroup(this, 'albSg', {
            vpc,
            allowAllOutbound: false,
        });
        const containerSg = new ec2.SecurityGroup(this, 'containerSg', {
            vpc,
        });
        albSg.addIngressRule(ec2.Peer.ipv4("0.0.0.0/0"), ec2.Port.tcp(8080)); // インバウンドを許可
        albSg.connections.allowTo(containerSg, ec2.Port.tcp(80)); // ALB ⇔ コンテナ間の通信を許可

        // ALB
        const alb = new elbv2.ApplicationLoadBalancer(this, 'alb', {
            vpc,
            internetFacing: true,
            securityGroup: albSg,
        });

        // TargetGroup
        const containerTg = new elbv2.ApplicationTargetGroup(this, 'containerTg', {
            targetType: elbv2.TargetType.IP,
            port: 80,
            vpc,
        });

        // ALBリスナー
        alb.addListener('listener', {
            defaultTargetGroups: [containerTg],
            open: true,
            port: 8080,
        });

        // ECSクラスター
        const cluster = new ecs.Cluster(this, 'cluster', {
            vpc,
            clusterName: `${config.appName}-${config.env}-cluster`,
        });

        // タスクロール
        const taskRole = new iam.Role(this, 'taskRole', {
            roleName: `${config.appName}-${config.env}-task-role`,
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        // タスク実行ロール
        const taskExecutionRole = new iam.Role(this, 'taskExecutionRole', {
            roleName: `${config.appName}-${config.env}-task-execution-role`,
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        // ロググループ
        const logGroup = new logs.LogGroup(this, 'logGroup', {
            logGroupName: `${config.appName}-${config.env}-log-group`,
        });

        const repository = new ecr.Repository(this, 'repository', {
            repositoryName: `${config.appName}-repository`,
        });

        repository.grantPull(taskExecutionRole);
        logGroup.grantWrite(taskExecutionRole);

        new ssm.StringParameter(this, "TaskRoleParam", { parameterName: `/ecs/${config.env}/${config.appName}/task-role`, stringValue: taskRole.roleArn });
        new ssm.StringParameter(this, "TaskExecutionRoleParam", { parameterName: `/ecs/${config.env}/${config.appName}/task-execution-role`, stringValue: taskExecutionRole.roleArn });
        new ssm.StringParameter(this, "ContainerSubnet1Param", { parameterName: `/ecs/${config.env}/${config.appName}/container-subnet-a`, stringValue: privateSubnet[0].subnetId });
        new ssm.StringParameter(this, "ContainerSubnet2Param", { parameterName: `/ecs/${config.env}/${config.appName}/container-subnet-c`, stringValue: privateSubnet[1].subnetId });
        new ssm.StringParameter(this, "ContainerSecurityGroupParam", { parameterName: `/ecs/${config.env}/${config.appName}/container-sg`, stringValue: containerSg.securityGroupId });
        new ssm.StringParameter(this, "ContainerTargetGroupParam", { parameterName: `/ecs/${config.env}/${config.appName}/container-tg`, stringValue: containerTg.targetGroupArn });
        new ssm.StringParameter(this, "LogGroupParam", { parameterName: `/ecs/${config.env}/${config.appName}/container-log-group`, stringValue: logGroup.logGroupName });
    }
}
