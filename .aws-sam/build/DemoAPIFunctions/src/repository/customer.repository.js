const { AWS, documentClient } = require('../services/aws.service');
const TABLE = require('../constant/table');
const InternalError = require('../exception/internal.error');
const MSG = require('../constant/msg');
const { TABLE_CUSTOMER } = require('../constant/table');
// const SNSService = require('../services/sns.service');
// const { SNS } = require('../services/aws.service');
const utils = require('../constant/utils');
const custom_validation_list = require('../exception/custom-exception-list');
// const ResetPasswordManager = require('../biz/reset_password.manager');

class CustomerRepository{
    constructor(){
        // this.sns_service = new SNSService();
        this.utils = new utils();
        // this.ResetPasswordManager = new ResetPasswordManager();
    }

    async CustomerList(req) {
        try{
            // this will load all customer data 
            const params = {
                TableName: TABLE.TABLE_CUSTOMER
            };
            if(req.params.id) {
                params.FilterExpression = " ID = :id ";
                params.ExpressionAttributeValues = {
                    ":id": req.params.id
                }
            }

            let scanResults = [];
            let data, Count = 0;
            do {
                data = await documentClient.scan(params).promise();
                scanResults.push(...data.Items);
                Count += data.Count;
                params.ExclusiveStartKey = data.LastEvaluatedKey;
            } while (data.LastEvaluatedKey);
            
            const Items = scanResults;
            // if (offset && limit) Items = scanResults.slice(offset, limit + offset);
            return { Items, LastEvaluatedKey: data.LastEvaluatedKey, Count };
        }catch(err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err.message);
        }
    }

    // async addCustomer() {

    //     return await {res: "In process"}
    // }
    async addCustomer(rquest) {
        try{
            console.log(`New Customer Adding: ${JSON.stringify(rquest)}`);
            const params = {
                TableName: TABLE.TABLE_CUSTOMER,
                Item: rquest
            };
            const data = await documentClient.put(params).promise();
            // console.log('Inserted New Customer: ', data);
            // console.log('Data res', data);
            if (data) return data;
            return null;
        }catch(err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err.message);
        }
        
    }

    async validateUser({email, password}) {
        try {
            const params = {
                TableName: TABLE.TABLE_CUSTOMER,
                ProjectionExpression: ['Password'],
                FilterExpression: " EmailID = :emailID ",
                ExpressionAttributeValues: {
                    ":emailID": email
                }
            };
            const data = await documentClient.scan(params).promise();
    
            if(data) return data;
            return null;
        } catch (err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err.message);
        }
        
    }

    async validCustomerId(id) {
        try{
            const params = {
                TableName: TABLE.TABLE_CUSTOMER,
                ProjectionExpression: ['ID'],
                FilterExpression: " ID = :id ",
                ExpressionAttributeValues: {
                    ":id": id
                }
            };
            const data = await documentClient.scan(params).promise();
    
            if(data) return (data.Items[0]?.ID == id);
            return null;
        }catch(err){
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err.message);
        }
        
    }

    async updateCustomer(data, id) {
        try{
            
            var { expression_list, expression_name, expression_value } = await this.utils.santize_expression_obj(data);
            
            const getSortKey = {
                TableName: TABLE.TABLE_CUSTOMER,
                ProjectionExpression: ['CreatedAt'],
                FilterExpression : " ID = :id ",
                ExpressionAttributeValues : {
                    ":id": id
                }
            }
            const CreatedAt_VALUE = await documentClient.scan(getSortKey).promise();
            // console.log(typeof CreatedAt_VALUE.Items.at(0))
            const params = {
                TableName: TABLE.TABLE_CUSTOMER,
                Key: {
                    "ID": id,
                    "CreatedAt" : CreatedAt_VALUE.Items[0].CreatedAt || ""
                },
                UpdateExpression: `SET ${expression_list.join(', ')} `,
                ExpressionAttributeNames: expression_name,
                ExpressionAttributeValues: expression_value,
                ReturnValues: "UPDATED_NEW"
            };
            // return params;
            const updateRes = await documentClient.update(params).promise();

            if(updateRes) return updateRes;
            return null;
        } catch(err) {
            // console.log('Error Raised Here', err.message);
            // throw new InternalError(MSG.INTERNAL_ERROR, err);
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err.message);
        }
        
    }

    // async santize_expression_obj(data) {
    //     var expression_list = [];
    //     var expression_name = {};
    //     var expression_value = {};

    //     // Object.entries(data).forEach()
    //     await Object.entries(data).map(([key,value], index) => {
    //         if(value) {
    //             expression_list.push(`#KEY_${index} = :VALUE_${index}`);
    //             expression_name[`#KEY_${index}`] = key;
    //             expression_value[`:VALUE_${index}`] = value;
    //         }
    //     });
    //     return {
    //         expression_list: expression_list,
    //         expression_name: expression_name,
    //         expression_value: expression_value
    //     }
    // }


    /**
     * @param {string} table_name dynamoDB Table Name 'Customer'{default}
     * @param {Array} projectionItemsArr Items/attributes to be return ['UserName', 'EmailID']
     * @param {Object} conditionItemsObj Items with value for condition {ID: "001"}
     */
    async getCustomerDetail(table_name = TABLE.TABLE_CUSTOMER, projectionItemsArr, conditionItemsObj) {
        try{
            var {expression_list, expression_name, expression_value} = await this.utils.santize_expression_obj(conditionItemsObj);

            const params = {
                TableName: table_name,
                ProjectionExpression: projectionItemsArr,
                FilterExpression: ` ${expression_list.join(', ')} `,
                ExpressionAttributeNames:expression_name,
                ExpressionAttributeValues: expression_value
            };
            let data = await documentClient.scan(params).promise();

            if(data) return data;
            return null;
        }catch(err){
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err.message);
        }
        
    }

    // async resetPassword({EmailID, CustomerID, otp}) {
    //     try{
            
    //         let customerDetail = await this.getCustomerDetail(
    //             TABLE.TABLE_CUSTOMER, 
    //             ['ID', 'UserName', 'EmailID', 'ContactNumber', 'Isactive'],
    //             {ID: CustomerID, EmailID: EmailID}    
    //         );
    //         let user_id = customerDetail.Items[0]?.ID || undefined;
    //         let user_name = customerDetail.Items[0]?.UserName || undefined;
    //         let user_email = customerDetail.Items[0]?.EmailID || undefined;
    //         var user_contact = customerDetail.Items[0]?.ContactNumber || undefined;
    //         let user_active = customerDetail.Items[0]?.Isactive || false;

    //         if(!user_active) {
    //             throw new InternalError(MSG.INTERNAL_ERROR, 'User is inactive');
    //         }
    //         // user_contact = '9030143660';
    //         // console.log('contact', user_contact);
    //         var params = {
    //             Message: `Hi,${user_name}.\n OTP: ${otp}`,
    //             PhoneNumber: '+91' + user_contact,
    //             MessageAttributes: {
    //                 'AWS.SNS.SMS.SenderID': {
    //                     'DataType': 'String',
    //                     'StringValue': `RESET`
    //                 }
    //             }
    //         };
    //         // console.log(params.PhoneNumber);

    //         let resp = await SNS.publish(params).promise();
    //         console.log(resp?.MessageId);
    //         console.log('OUTSIDE');
    //         if(resp?.MessageId) {
    //             console.log('Inside Condition');
    //             let InsertionData = {
    //                 'ID': this.utils.generateUUID(),
    //                 'CustomerID': CustomerID,
    //                 'OTP': otp,
    //                 'ContactNo': user_contact, 
    //                 'GeneratedAt': new Date().toISOString()
    //             };
    //             let resp = await this.ResetPasswordManager.addNewResetReq(InsertionData);

    //         }

    //         return resp;
    //         // console.log(tempRes);
    //         // return {
    //         //     code: 200,
    //         //     status: "Success",
    //         //     data: tempRes
    //         // };
    //         // // this.sns_service.publish(process.env.SNS_TOPIC, 
    //         // //     JSON.stringify({}))

    //     }catch(err) {
    //         // console.log('Error Occured');
    //         // console.log(err);
    //         throw new InternalError(MSG.INTERNAL_ERROR, err.message);
    //     }
    // }
}

module.exports = CustomerRepository;