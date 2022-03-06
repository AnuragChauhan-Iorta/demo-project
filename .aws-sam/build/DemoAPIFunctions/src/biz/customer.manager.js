'use strict';
const AWS_S3 = require('../services/s3.services');
const utils = require('../constant/utils');
const bcrypt = require('bcryptjs');
const BaseManager = require('./base.manager');
const ValidationError = require('../exception/validation.error');
const InternalError = require('../exception/internal.error');
const NotFound = require('../exception/not-found.error');
const customer_repository = require('../repository/customer.repository.js');
const SCHEMA = require('../constant/schema');
const MSG = require("../constant/msg");
const custom_validation_list = require('../exception/custom-exception-list');
const req = require('express/lib/request');
const URL = require('../constant/url');
const fs = require('fs');

class Customer extends BaseManager {
    constructor(){
        super();
        this.CustomerRepository = new customer_repository();
        this.utils = new utils();
        this.aws_s3 = new AWS_S3();
    }

    async getCustomerList(req) {
        // return {test: "abcd unique", return_data: customer_repository()};
        try {
            const response = await this.CustomerRepository.CustomerList(req);
            const RespData = {
                status: 200,
                msg: "Success",
                data: response
            }
            return RespData;
        }catch(err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err);
        }
    }

    // generatePassword(str) {
    //     // return str;
    //     try {
    //         if(str) {
    //             // error
    //             const salt =  bcrypt.genSaltSync(10);
    //             return bcrypt.hashSync(str, salt);    
    //             // return str;
    //         }
    //         return undefined;
    //         // return new NotFound(MSG.NOT_FOUND, 'Not Found');

    //     } catch (err) {
    //         throw new InternalError(MSG.INTERNAL_ERROR, 'Password Hash Not Generated');
    //     }
    // }

    async addNewCustomer(req, res) {
        try {
            

            const sanitize_data = {
                ID: this.utils.generateUUID(),
                UserName: req.body.username || undefined,
                EmailID: req.body.emailid || undefined,
                ContactNumber: req.body.contact_number ? parseInt(req.body.contact_number) : undefined,
                // password: req.body.password ? bcrypt.hash(req.body.password, saltRounds) : "",
                Password: this.utils.generatePassword(req.body.password),
                LocationName: req.body.location_name || "",
                Isactive: true,
                
                VehicleID: this.sanitizeArray(req.body.vehicle_id),
                LoanID: this.sanitizeArray(req.body.loan_id),
                WhishlistID: this.sanitizeArray(req.body.whishlist_id),
                PurchasedAccessoriesID: this.sanitizeArray(req.body.purchased_accessories_id),

                LoanAgreementtemplate: req.body.loan_agreement_template || "",
                CreatedAt: new Date().toLocaleString(),
                Type: req.body.type || ""
            };
            const validationResult = this.validate(SCHEMA.ADD_CUSTOMER, sanitize_data);
            
            if(validationResult.valid) {
                const response = await this.CustomerRepository.addCustomer(sanitize_data);
                
                if(!response){
                    throw new InternalError(MSG.INTERNAL_ERROR, "Unable to add customer")
                }

                var customerProfileDetail;
                var file_Key;
                if(req.file){
                    // upload customer Profile to S3 bucket
                    let fileKey = req.file.filename;
                    let body = fs.createReadStream(req.file.path);
                    let contentType = req.file.mimetype;
                    
                    let s3_file_upload = await this.aws_s3.upload(fileKey, body, contentType);
                    customerProfileDetail = s3_file_upload;
                    file_Key = fileKey;
                }

                if(file_Key) {
                    var detailUpdateResp = await this.CustomerRepository.updateCustomer({CustomerProfileImage:customerProfileDetail.Location}, sanitize_data.ID);
                }

                const RespData = {
                    code: 200,
                    status: "Success",
                    data: "Customer Added Successfully",
                    profileImage: customerProfileDetail
                }
                return RespData;
            }
            
            throw new ValidationError(MSG.VALIDATION_ERROR, validationResult.errors);
        } catch(err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err);
        }
    }


    async authenticateUser(req, res) {
        try {
            const sanitize_data = {
                email: req.body.email,
                password: req.body.password
            };
            const validationResult = this.validate(SCHEMA.VALIDATE_USER, sanitize_data);
            if(validationResult.valid) {
                const passwordItem = await this.CustomerRepository.validateUser(sanitize_data);

                const password = passwordItem.Items[0]?.Password || "";
                
                const RespData = {
                    code: 200,
                    status: "Success",
                    // data: password,
                    res: bcrypt.compareSync(sanitize_data.password, password ),
                    // sanitize_data: sanitize_data
                }
                return RespData;
            }
            throw new ValidationError(MSG.VALIDATION_ERROR, validationResult.errors);
        } catch (err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err.message);
        }
    }

    sanitizeArray(data) {
        return (typeof data === "object" ? data : (typeof data === "string" ? Object.entries(JSON.parse(JSON.stringify(data))) : undefined));
    }

    async updateCustomerDetail(request) {
        try {
            if(!request.id) {
                throw new ValidationError(MSG.VALIDATION_ERROR, "Id is required");
                // throw new Error('TEST','this is error');
            }
            const sanitize_data = {
                UserName: request.username || undefined,
                EmailID: request.emailid || undefined,
                ContactNumber: request.contact_number ? parseInt(request.contact_number) : undefined,
                // password: request.password ? bcrypt.hash(request.password, saltRounds) : "",
                Password: this.utils.generatePassword(request.password),
                LocationName: request.location_name || undefined,
                Isactive: true,
                
                VehicleID: this.sanitizeArray(request.vehicle_id),
                LoanID: this.sanitizeArray(request.loan_id),
                WhishlistID: this.sanitizeArray(request.whishlist_id),
                PurchasedAccessoriesID: this.sanitizeArray(request.purchased_accessories_id),
                
                LoanAgreementtemplate: request.loan_agreement_template || undefined,
                // CreatedAt: new Date().toLocaleString(),
                Type: request.type || undefined
            }

            const validationResult = this.validate(SCHEMA.UPDATE_CUSTOMER, sanitize_data);
            if(validationResult.valid) {
                const updateRes = await this.CustomerRepository.updateCustomer(sanitize_data, request.id);
                const RespData = {
                    code: 200,
                    status: "Success",
                    data: updateRes,
                    sanitize_data: sanitize_data
                }
                return RespData;
            }
            throw new ValidationError(MSG.VALIDATION_ERROR, validationResult.errors);
        } catch (err) {
            if(custom_validation_list.includes(err.name || "")) {
                throw err;
            }
            throw new InternalError(MSG.INTERNAL_ERROR, err);
        }
    }

    // async resetPassword(req, res) {
    //     try{
    //         if(!req.body.EmailID || !req.body.CustomerID){
    //             throw new ValidationError(MSG.VALIDATION_ERROR, "CustomerID Or EmailID is required")
    //         }
    //         let sanitize_data = {
    //             EmailId: req.body.EmailID,
    //             CustomerID: req.body.CustomerID
    //         };

    //         let otp = Math.floor(1000 + Math.random() * 9000);

    //         const response = await this.CustomerRepository.resetPassword({...sanitize_data,otp:otp});
    //         const RespData = {
    //             code: 200,
    //             status: "Success",
    //             data: sanitize_data,
    //             response: response
    //         }
    //         return RespData;


    //     }catch(err) {
    //         console.log('Error Occured In Customer Manager');
    //         if(custom_validation_list.includes(err.name || "")) {
    //             return err;
    //         }
    //         return new InternalError(MSG.INTERNAL_ERROR, err.message);
    //     }
        
    // }
}
module.exports = Customer;