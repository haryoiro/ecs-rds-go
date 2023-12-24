import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IpAddresses, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Config } from './utils';

export class VpcStack extends cdk.Stack {

    public readonly vpc: Vpc;

    constructor(scope: Construct, id: string, config: Config, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpcName = "cdk-vpc";
        this.vpc = new Vpc(this, "VPC", {
            vpcName,
            ipAddresses: IpAddresses.cidr("10.1.0.0/16"),
            maxAzs: 2,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: `${config.appName}-${config.env}-public`,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: `${config.appName}-${config.env}-private`,
                    subnetType: SubnetType.PRIVATE_ISOLATED,
                },
            ],
        })

    }
}
