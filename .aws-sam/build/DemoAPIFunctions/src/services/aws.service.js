const AWS = require("aws-sdk");

AWS.config.update({
    region: 'us-east-1'
});

module.exports = {
    AWS: AWS,
    S3: new AWS.S3(),
    documentClient: new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' }),
    SNS: new AWS.SNS({ apiVersion: '2010-03-31', region: "ap-south-1" }),
    STS: new AWS.STS(),
}