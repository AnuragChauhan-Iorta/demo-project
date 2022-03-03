const utils = require('../constant/utils');
const ResetPasswordRepo = require('../repository/reset_password.repository');
const ValidationError = require('../exception/validation.error');
const msg = require('../constant/msg');
const custom_validation_list = require('../exception/custom-exception-list');
const InternalError = require('../exception/internal.error');
const { SNS } = require('../services/aws.service');

const TABLE = require('../constant/table')

class ResetPassword{
    constructor(){
        // console.log('Log 1')
        // super(),
        this.reset_password = new ResetPasswordRepo();
        // console.log('Log 2')
        this.utils = new utils();
    }

    async addNewResetReq(request) {
        try{
            const sanitize_data = {
                ID: this.utils.generateUUID(),
                CustomerID: request.CustomerID || "",
                OTP: request.OTP || undefined,
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
                response: addRes
            }
            return RespData;
            if(addRes) return addRes;
            return null;

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
     * @param {*} request.CustomerID | string
     */
    async validateOTP(req, res) {
        try{
            const new_password = req.body.NewPassword;
            const sanitize_data = {
                OTP: req.body.OTP || undefined,
                CustomerID: req.body.CustomerID || undefined
                // NewPassword: req.body.Password || 
            };
            if(parseInt(sanitize_data.OTP).toString().length === 4 && typeof sanitize_data.CustomerID === 'string' && new_password){
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
            throw new InternalError(msg.INTERNAL_ERROR, 'Invalid Body passed {OTP, CustomerID, NewPassword}')
        } catch (err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }
    
    async resetPassword(req, res) {
        try{
            if(!req.body.EmailID || !req.body.CustomerID){
                throw new ValidationError(msg.VALIDATION_ERROR, "CustomerID Or EmailID is required")
            }
            let sanitize_data = {
                EmailId: req.body.EmailID,
                CustomerID: req.body.CustomerID
            };

            var otp = await Math.floor(1000 + Math.random() * 9000);

            let InsertionData = {
                'ID': this.utils.generateUUID(),
                'CustomerID': sanitize_data.CustomerID,
                'OTP': otp,
                'GeneratedAt': this.utils.getCurrentTime() //new Date().toISOString()
            };
            var resp = await this.addNewResetReq(InsertionData);

            var RespData = {
                code: 200,
                status: "Success"
                // data: sanitize_data
            }

            if(resp?.status == 'Success') {
                const response = await this.reset_password.resetPassword({...sanitize_data,otp:otp});
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

    
}
module.exports = ResetPassword;