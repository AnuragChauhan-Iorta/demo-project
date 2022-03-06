const { S3 } = require('./aws.service');
const BUCKET_NAME = "customer-profile-unique-name";

class AWS_S3{
    constructor() {
        this.BUCKET_NAME = BUCKET_NAME;
    }

    async upload(key, body, contentType, bucket = this.BUCKET_NAME) {
        return new Promise((resolve, reject) => {
            var params = {
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
                ACL: 'public-read'
            };
            // if(public) {
            //     params['ACL'] = 'public-read';
            // }
            // console.info(`File Upload - ${params}`);
            S3.upload(params, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Upload Success Data ${JSON.stringify(data)}`);
                    resolve(data);
                }
            });
        });
    }

    async getObject(fileKey,Bucket=this.BUCKET_NAME) {
        let downloadParams = {
            Key: fileKey,
            Bucket: Bucket
        }
        return S3.getObject(downloadParams).createReadStream();
    }


}

module.exports = AWS_S3;