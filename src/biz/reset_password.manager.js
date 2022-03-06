const utils = require('../constant/utils');
const ResetPasswordRepo = require('../repository/reset_password.repository');
const ValidationError = require('../exception/validation.error');
const msg = require('../constant/msg');
const custom_validation_list = require('../exception/custom-exception-list');
const InternalError = require('../exception/internal.error');
const { SNS, documentClient } = require('../services/aws.service');
const customerRepo = require('../repository/customer.repository');

const TABLE = require('../constant/table')

class ResetPassword{
    constructor(){
        // console.log('Log 1')
        // super(),
        this.reset_password = new ResetPasswordRepo();
        // console.log('Log 2')
        this.customerRepo = new customerRepo();
        this.utils = new utils();
    }

    async addNewResetReq({EmailID, OTP}) {
        try{

            // let queryParam = {
            //     TableName: TABLE.TABLE_CUSTOMER,
            //     FilterExpression: ` EmailID = :email `,
            //     ExpressionAttributeValues: {
            //         ':email': EmailID
            //     }
            // }
            
            let customerDetail = await this.customerRepo.getCustomerDetail(TABLE.TABLE_CUSTOMER,'ID', {EmailID: EmailID});
            if(customerDetail.Count) {
                const sanitize_data = {
                    ID: this.utils.generateUUID(),
                    CustomerID: customerDetail.Items[0].ID || "",
                    OTP: OTP || undefined,
                    GeneratedAt: this.utils.getCurrentTime() //new Date().toISOString()
                };
        
                if(!(sanitize_data.ID || sanitize_data.CustomerID || sanitize_data.OTP || sanitize_data.GeneratedAt)) {
                    throw new ValidationError(msg.VALIDATION_ERROR, `Provide all proper data {ID, CustomerID, OTP, GeneratedAt}`);
                }   
    
                if(!await this.reset_password.validateResetLimit(sanitize_data.CustomerID)) {
                    // password reset already requested for two times
                    throw new InternalError(msg.INTERNAL_ERROR, 'Reset Password already requested for Max limit times');
                }
                
                const addRes = await this.reset_password.newResetRequest(sanitize_data);
                const RespData = {
                    code: 200,
                    status: "Success",
                    data: addRes,
                    customerID: sanitize_data.CustomerID
                }
                return RespData;
            }
            throw new InternalError(msg.INTERNAL_ERROR, "Invalid Email ID");

        } catch(err) {
            // console.log(err.message);
            // console.log('This is error called')
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err);
        }
    }

    /**
     * 
     * @param {*} request.OTP | {4 digit numbers}
     * @param {*} request.EmailID | string
     * @param {*} request.NewPassword | string
     */
    async validateOTP(req, res) {
        try{
            const new_password = req.body.NewPassword;
            let EmailID = req.body.EmailID || undefined;
            if(!EmailID) {
                throw new ValidationError(msg.VALIDATION_ERROR, "EmailID required");
            }
            // get Customer ID
            let customerDetail = await this.customerRepo.getCustomerDetail(TABLE.TABLE_CUSTOMER, "ID", {EmailID: EmailID})
            
            if(!(customerDetail.Count > 0)) {
                throw new InternalError(msg.INTERNAL_ERROR, "Invalid EmailID");
            }
            var CustomerID = customerDetail.Items[0].ID;
            const sanitize_data = {
                OTP: req.body.OTP || undefined,
                CustomerID: CustomerID || undefined
                // NewPassword: req.body.Password || 
            };
            if(parseInt(sanitize_data.OTP).toString().length === 4 && new_password){
                var data = await this.reset_password.validateOTP(sanitize_data);
                // return data;
                console.log('OTP Received', data?.OTP);
                if(sanitize_data.OTP == (data?.OTP || undefined)) {
                    // otp matched
                    // change password
                    let res = await this.reset_password.updatePassword({CustomerID: sanitize_data.CustomerID, NewPassword: this.utils.generatePassword(new_password)});
                    if(res) {
                        console.log('Inside Condition', data?.ID);
                        // set VerifiedAt in reset password
                        let updatedParam = {
                            VerifiedAt: this.utils.getCurrentTime() //new Date().toISOString()
                        };
                        let resetReqUpdate = await this.reset_password.updateResetPasswordReq({updatedParam: updatedParam, ID: data?.ID})
                        let respData = {
                            code: 200
                        };
                        if(resetReqUpdate){
                            respData['status'] = "Success";
                            respData['data'] = "Password Changed Successfully";
                        } else {
                            respData['status'] = "Failed";
                            respData['data'] = "Something went wrong";
                        }
                        return respData;
                        // return "Something Went Wrong";
                    }
                    // console.log('Condition Failed');
                }
                throw new InternalError(msg.INTERNAL_ERROR, 'Invalid OTP')
                return data;
            }
            // if(parseInt(sanitize_data.OTP).toString().length === 4 && typeof sanitize_data.CustomerID === 'string'){
            //     let data = await this.reset_password.validateOTP(sanitize_data);
            //     return data;
            // }
            throw new InternalError(msg.INTERNAL_ERROR, 'Invalid Body passed {OTP, NewPassword}')
        } catch (err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }
    
    async forgetPassword(req, res) {
        try{
            if(!req.body.EmailID){
                throw new ValidationError(msg.VALIDATION_ERROR, "EmailID is required")
            }
            // let sanitize_data = {
            //     EmailId: req.body.EmailID
            // };

            var otp = await Math.floor(1000 + Math.random() * 9000);

            // let InsertionData = {
            //     'ID': this.utils.generateUUID(),
            //     'CustomerID': sanitize_data.CustomerID,
            //     'OTP': otp,
            //     'GeneratedAt': this.utils.getCurrentTime() //new Date().toISOString()
            // };
            var resp = await this.addNewResetReq({EmailID:req.body.EmailID, OTP: otp });

            var RespData = {
                code: 200,
                status: "Success"
                // data: sanitize_data
            }

            if(resp?.status == 'Success') {
                let passedObj = {EmailID:req.body.EmailID, CustomerID: resp.CustomerID, otp:otp }
                const response = await this.reset_password.forgetPassword(passedObj);
                RespData['response'] = {...response, message: "OTP Sent Successfully"};
            } else {
                throw resp;
            }

            
            return RespData;


        }catch(err) {
            console.log('Error Occured In ResetPassword Manager');
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
        
    }



    async resetPassword(req, res) {
        try{
            const sanitize_data = {
                OldPassword: req.body.OldPassword || undefined,
                NewPassword: req.body.NewPassword || undefined,
                EmailID: req.body.EmailID || undefined 
            };  
            if(sanitize_data.OldPassword && sanitize_data.NewPassword && sanitize_data.EmailID) {
                let resp = this.reset_password.resetPassword(sanitize_data);
                // return resp;
                if(resp) {
                    let response = {
                        code: 200,
                        status: "Success",
                        data: "Password Changed Successfully"
                    };
                    return response;
                }
            }
            throw new ValidationError(msg.VALIDATION_ERROR, "Invalid Body {OldPassword, NewPassword, Email}")
        }catch(err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }

    
}
module.exports = ResetPassword;