const TABLE = require("../constant/table");
const custom_validation_list = require('../exception/custom-exception-list');
const ValidationError = require('../exception/validation.error')
const InternalError = require('../exception/internal.error')
const utils = require('../constant/utils');
const msg = require("../constant/msg");
const {documentClient} = require('../services/aws.service')
const customer_repository = require('./customer.repository');
const { SNS } = require('../services/aws.service');

class ResetPassword {
    constructor() {
        this.utils = new utils();
        this.customer_repository = new customer_repository();
    }

    async newResetRequest(request) {
        console.log(`New Reset Request Adding`); 
        const params = {
            TableName: TABLE.TABLE_RESET_PASSWORD,
            Item: request,
            ReturnValues: 'ALL_OLD'
        };
        const data = await documentClient.put(params).promise();
        if(data) return request;
        return null;
    }

    /**
     * Function to check that, is user already requested reset for 2 times in the period of 2 hrs!
     * {logic} if yes then user will block for 24 hrs
     * 
     * @param {string} CustomerID 
     * @returns TRUE|FALSE
     */
    async validateResetLimit(CustomerID){
        
        try{
            const MAX_RESET_LIMIT = 2;
            const MIN_HOUR = 24;

            var {expression_list, expression_name, expression_value} = await this.utils.santize_expression_obj({
                CustomerID: CustomerID
            });
            
            let current_time = this.utils.getCurrentTime(); //new Date().toISOString();
            let modify_time = new Date(current_time);
            modify_time.setHours(modify_time.getHours() - MIN_HOUR);
            let minus_one_hr = modify_time.toISOString();

            expression_list.push(' #GeneratedAt BETWEEN :START and :END ');
            let params = {
                TableName: TABLE.TABLE_RESET_PASSWORD,
                ProjectionExpression: ['ID', 'GeneratedAt'],
                FilterExpression: ` ${expression_list.join(' and ')}  `,
                ExpressionAttributeNames:{...expression_name, '#GeneratedAt': 'GeneratedAt'},
                ExpressionAttributeValues: {...expression_value, ':START': minus_one_hr, ':END': current_time},
                ScanIndexForward: true
            };
            // return params
            let data = await documentClient.scan(params).promise();
            // return data;
            console.log('LOG 1')
            if(data?.Count || undefined) {
                // return true if
                //      1. Difference between GeneratedAt and currenttime is greater than 24 hrs AND
                //      2. Items Cout is less than MAX_RESET_LIMIT
                // else 
                //      false
                if((data?.Count || MAX_RESET_LIMIT) >= MAX_RESET_LIMIT) {
                    // let current_time = new Date(new Date().toISOString()); 
                    let current_time = new Date(this.utils.getCurrentTime()); 
                    let MinLastResetReq = current_time.setHours(current_time.getHours() - MIN_HOUR);
                    
                    return (data?.Items[0]?.GeneratedAt < MinLastResetReq) && data?.Items[0]?.GeneratedAt;
                }
                return data?.Items[0]?.GeneratedAt;
                
                // data.Items[0]?.GeneratedAt 
                // return ((data?.Count || MAX_RESET_LIMIT) < MAX_RESET_LIMIT);
            }
            console.log('LOG 2')
            return true;
        } catch(err) {
            
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }

    async validateOTP({OTP, CustomerID}) {
        try{
            const MIN_HOUR = 24;

            var {expression_list, expression_name, expression_value} = await this.utils.santize_expression_obj({
                CustomerID: CustomerID
            });

            
            let params = {
                TableName: TABLE.TABLE_RESET_PASSWORD,
                // Items: {
                    // ProjectionExpression: ['ID', 'OTP', 'GeneratedAt', 'VerifiedAt'],
                    FilterExpression: ` ${expression_list.join(' and ')}  `,
                    // KeyConditionExpression: ` ${expression_list.join(' and ')}  `,
                    ExpressionAttributeNames:expression_name,
                    ExpressionAttributeValues: expression_value,
                    ScanIndexForward: true
                // }
            }
            // return params;
            let data = await documentClient.scan(params).promise();
            
            // return data;
            
            // check OTP generated Time lies between current to current - 24 hrs
            let max_time = this.utils.getCurrentTime(); //new Date().toISOString();
            let pre_time = new Date(max_time);
            pre_time.setHours(pre_time.getHours() - MIN_HOUR);
            let min_time = pre_time.toISOString();

            if((data.Items[data.Count - 1].GeneratedAt < max_time) && (data.Items[data.Count - 1].GeneratedAt > min_time) ){
            // if((data.Items[0].GeneratedAt < max_time) && (data.Items[0].GeneratedAt > min_time) ){                
                if(data.Items[data.Count - 1].VerifiedAt) {
                // if(data.Items[0].VerifiedAt) {
                    throw new InternalError(msg.INTERNAL_ERROR, 'OTP Already Validated');
                }
                return data.Items[data.Count - 1];
                // return data.Items[0];
            }
            throw new InternalError(msg.INTERNAL_ERROR, 'OTP Validity Exceeded, generate new one');
            // return null;

            // data.Items[data.Count - 1].GeneratedAt
            // return {data: data, last: data.Items[0]};
            // data.Items[0]?.GeneratedAt

        } catch(err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }

    async resetPassword({EmailID, CustomerID, otp}) {
        try{
            
            let customerDetail = await this.customer_repository.getCustomerDetail(
                TABLE.TABLE_CUSTOMER, 
                ['ID', 'UserName', 'EmailID', 'ContactNumber', 'Isactive'],
                {ID: CustomerID, EmailID: EmailID}    
            );
            let user_id = customerDetail.Items[0]?.ID || undefined;
            let user_name = customerDetail.Items[0]?.UserName || undefined;
            let user_email = customerDetail.Items[0]?.EmailID || undefined;
            var user_contact = customerDetail.Items[0]?.ContactNumber || undefined;
            let user_active = customerDetail.Items[0]?.Isactive || false;

            if(!user_active) {
                throw new InternalError(msg.INTERNAL_ERROR, 'User is inactive');
            }
            // user_contact = '9030143660';
            // console.log('contact', user_contact);
            var params = {
                Message: `Hi,${user_name}.\n OTP: ${otp}`,
                PhoneNumber: '+91' + user_contact,
                MessageAttributes: {
                    'AWS.SNS.SMS.SenderID': {
                        'DataType': 'String',
                        'StringValue': `RESET`
                    },
                    'AWS.SNS.SMS.SMSType': {
                        'DataType': 'String',
                        'StringValue': `Transactional`
                    }
                }
            };
            // console.log(params.PhoneNumber);

            let resp = await SNS.publish(params).promise();
            // console.log(resp?.MessageId);
            // console.log('OUTSIDE');
            

            return resp;
            // console.log(tempRes);
            // return {
            //     code: 200,
            //     status: "Success",
            //     data: tempRes
            // };
            // // this.sns_service.publish(process.env.SNS_TOPIC, 
            // //     JSON.stringify({}))

        }catch(err) {
            // console.log('Error Occured');
            // console.log(err);
            // console.log('Message Sent Error', err.message);
            // throw new InternalError(msg.INTERNAL_ERROR, err.message);
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }

    async updatePassword({CustomerID, NewPassword}) {
        try{

            var { expression_list, expression_name, expression_value } = await this.utils.santize_expression_obj({Password: NewPassword});
            
            const getSortKey = {
                TableName: TABLE.TABLE_CUSTOMER,
                ProjectionExpression: ['CreatedAt'],
                FilterExpression : " ID = :id ",
                ExpressionAttributeValues : {
                    ":id": CustomerID
                }
            }
            const CreatedAt_VALUE = await documentClient.scan(getSortKey).promise();


            let params = {
                TableName: TABLE.TABLE_CUSTOMER,
                Key: {
                    "ID": CustomerID,
                    "CreatedAt" : CreatedAt_VALUE.Items[0].CreatedAt || ""
                },
                UpdateExpression: `SET ${expression_list.join(', ')} `,
                ExpressionAttributeNames: expression_name,
                ExpressionAttributeValues: expression_value,
                ReturnValues: "UPDATED_NEW"
            };

            const updateRes = await documentClient.update(params).promise();
            if(updateRes) return updateRes;
            return null;
        }catch(err) {
            // throw new InternalError(msg.INTERNAL_ERROR, err.message);
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }

    /**
     * 
     * @param {*} updatedParam | {Values to be updated} 
     * @param {*} ID | {Updated TO this Reset_ID}
     */
    async updateResetPasswordReq({updatedParam, ID}) {
        try {

            var { expression_list, expression_name, expression_value } = await this.utils.santize_expression_obj(updatedParam);

            const getSortKey = {
                TableName: TABLE.TABLE_RESET_PASSWORD,
                ProjectionExpression: ['GeneratedAt'],
                FilterExpression : " ID = :id ",
                ExpressionAttributeValues : {
                    ":id": ID
                }
            }
            const GreatedAt_VALUE = await documentClient.scan(getSortKey).promise();

            let params = {
                TableName: TABLE.TABLE_RESET_PASSWORD,
                Key: {
                    "ID": ID,
                    "GeneratedAt" : GreatedAt_VALUE.Items[0].GeneratedAt || ""
                },
                UpdateExpression: `SET ${expression_list.join(', ')} `,
                ExpressionAttributeNames: expression_name,
                ExpressionAttributeValues: expression_value,
                ReturnValues: "UPDATED_NEW"
            };

            const updateRes = await documentClient.update(params).promise();
            if(updateRes) return updateRes;
            return null;
        } catch (err) {
            // throw new InternalError(msg.INTERNAL_ERROR, err.message);
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }
    
}
module.exports = ResetPassword;