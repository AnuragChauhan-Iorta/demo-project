'use strict';
const { 
    v4: uuidv4,
  } = require('uuid');
  
const BaseManager = require('./base.manager');
const ValidationError = require('../exception/validation.error');
const NotFound = require('../exception/not-found.error');
const vehicle_repository = require('../repository/vehicle.repository');
const customer_repository = require('../repository/customer.repository');
const SCHEMA = require('../constant/schema');
const MSG = require("../constant/msg");
const custom_validation_list = require('../exception/custom-exception-list');
const req = require('express/lib/request');

class Vehicle extends BaseManager {
    constructor(){
        super();
        this.VehicleRepository = new vehicle_repository();
        this.CustomerRepository = new customer_repository();
    }
    
    sanitizeArray(data) {
        return (typeof data === "object" ? data : (typeof data === "string" ? Object.entries(JSON.parse(JSON.stringify(data))) : undefined));
    }

    async addNewVehicle(req,res) {
        try {
            // steps:
            // Add Details in vehicle table
            // put images in images table
            // update vehicle table with images id 

        // return  req.body;
            const sanitize_data = {
                ID:this.generateUUID(), 
                VehicleServiceType: req.body.VehicleServiceType || "",
                VehicleType: req.body.VehicleType || "",
                VehicleNumber: req.body.VehicleNumber || "" ,
                Make: req.body.Make || "",
                Model: req.body.Model || "",
                Varient: req.body.Varient || "",
                Year: req.body.Year || "",
                Color: req.body.Color || "",
                RegistrationPlace: req.body.RegistrationPlace || "",
                Currentlocation: req.body.Currentlocation || "",
                Fueltype: req.body.Fueltype || "",
                Transmissiontype: req.body.Transmissiontype || "",
                Gares: req.body.Gares || "",
                Price: req.body.Price || "",
                VehicleCategory: req.body.VehicleCategory || "",
                NoOfOwners: (req.body.NoOfOwners ? parseInt(req.body.NoOfOwners) : 0),
                EngineCapcityCC: req.body.EngineCapcityCC || "",
                VehicleFullDetails: this.sanitizeArray(req.body.VehicleFullDetails),
                VehicleImage_ID: this.sanitizeArray(req.body.VehicleImage_ID),
                CreatedAt: new Date().toLocaleString(),
                CreatedBy: req.body.CreatedBy || ""
            };

            

            // return sanitize_data
            const validationResult = this.validate(SCHEMA.ADD_Vehical, sanitize_data);
            if(validationResult.valid) {
                if(!await this.CustomerRepository.validCustomerId(sanitize_data.CreatedBy)) {
                    throw new ValidationError(MSG.VALIDATION_ERROR, "Invalid Customer Id");
                }

                const response = await this.VehicleRepository.addVehicle(sanitize_data);
                // let response = "test_success";
                // return {response:response}
                const RespData = {
                    code: 200,
                    status: "Success",
                    data: response
                }


                var images_id_list = [];
                var image_validation_status = [];
                var table_params = [];
                req.files.forEach(async (element) => {
                    // loop through each file and call Image repos/lamda function to insert that
                    try {
                        let IMAGE_SANITIZE_DATA = {
                            ID: this.generateUUID(),
                            ImageName: element.originalname,
                            ImageFile: element.buffer.toString('base64'), // "data:image/jpeg;base64," -- removed
                            CreatedAt: new Date().toLocaleDateString(),
                            Uploadedat: new Date().toLocaleDateString(),
                            Uploadedby: ""
                        };

                        let validationIMAGESCHEMA = this.validate(SCHEMA.VEHICLE_IMAGE, IMAGE_SANITIZE_DATA);
                        if(validationIMAGESCHEMA.valid) {
                            table_params.push(IMAGE_SANITIZE_DATA);
                            images_id_list.push(IMAGE_SANITIZE_DATA.ID);
                        } else {
                            image_validation_status.push({
                                FILE_NAME: element.originalname,
                                STATUS: "FAILED",
                                MSG: validationIMAGESCHEMA.errors
                            });
                        }
                    } catch (err) {
                        image_validation_status.push({
                            FILE_NAME: element.originalname,
                            STATUS: "FAILED",
                            MSG: err
                        });
                    }
                });
                
                let imageUploadRes = await this.VehicleRepository.vehicleImageUpload(table_params);
                
                if(image_validation_status.length) {
                    RespData['ImageUploadStatus'] = image_validation_status;
                }

                // update Vehicle Image Id Array
                if(images_id_list.length) {
                    // call vehicle Update Detail repository/lamda functuon
                    let updateRes = await this.VehicleRepository.updateVehicleDetails({VehicleImage_ID: images_id_list}, sanitize_data.ID);
                
                }

                return RespData;
            }
            throw new ValidationError(MSG.VALIDATION_ERROR, validationResult.errors);
        }catch(err) {
            if(custom_validation_list.includes(err.name || "")) {
                return err;
            }
            return new InternalError(MSG.INTERNAL_ERROR, err);
        }
    }
    generateUUID(){
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g , function(c) {
            var rnd = Math.random()*16 |0, v = c === 'x' ? rnd : (rnd&0x3|0x8) ;
            return v.toString(16);
        });
    }
}
module.exports = Vehicle;