const { AWS, documentClient } = require('../services/aws.service');
const TABLE = require('../constant/table');
const InternalError = require('../exception/internal.error');
const msg = require('../constant/msg');


class VehicleRepository {
    constructor() {  }

    async addVehicle(request) {
        try{
            console.log(`New Vehicle Adding: ${JSON.stringify(request)}`);
            const params = {
                TableName: TABLE.TABLE_VEHICLE,
                Item: request
            };
            const data = await documentClient.put(params).promise();
            console.log('Inserted New Vehicle: ', data); //{}
            if (data) return data;
            return null;
        } catch(err) {
            console.log('Erro Raised 1')
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
        
    }

    // function to upload images of vehicle
    async vehicleImageUpload(request) {
        try {
            request.forEach(async (obj) => {
                let params = {
                    TableName: TABLE.TABLE_VEHICLE_IMAGES,
                    Item: obj
                };
                let data = await documentClient.put(params).promise();
            });
            return {};

        } catch (err) {
            console.log('Erro Raised 2')
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }

    }

    async updateVehicleDetails(data, id) {
        try {
            var filtered_data = {};
            var expression_list = [];
            var expression_name = {};
            var expression_value = {};
            Object.entries(data).map(([key, value], index) => {
                if (value) {
                    filtered_data[key] = value;
                    expression_list.push(`#KEY_${index} = :VALUE_${index}`);
                    expression_name[`#KEY_${index}`] = key;
                    expression_value[`:VALUE_${index}`] = value;
                }
            });

            const getSortKey = {
                TableName: TABLE.TABLE_VEHICLE,
                ProjectionExpression: ['CreatedAt'],
                FilterExpression: " ID = :id ",
                ExpressionAttributeValues: {
                    ":id": id
                }
            }
            console.log('Inside Update 1')
            let CreatedAt_VALUE = await documentClient.scan(getSortKey).promise();
            console.log('Inside Update 2', CreatedAt_VALUE);
            const params = {
                TableName: TABLE.TABLE_VEHICLE,
                Key: {
                    "ID": id,
                    "CreatedAt": CreatedAt_VALUE.Items[0].CreatedAt || ""
                },
                UpdateExpression: `SET ${expression_list.join(', ')} `,
                ExpressionAttributeNames: expression_name,
                ExpressionAttributeValues: expression_value,
                ReturnValues: "UPDATED_NEW"
            };
            console.log('Inside update 3', params);
            const updateRes = await documentClient.update(params).promise();
            console.log('Inside update 4');

            if (updateRes) return updateRes;
            return null;
        } catch (err) {
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }

    }
    async VehicleList(req) {
        try {
            // this will load all vehicle data 
            const params = {
                TableName: TABLE.TABLE_VEHICLE
            };
            if (req.params.id) {
                params.FilterExpression = " CreatedBy = :id ";
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
            return Items;
            var index = 0;
            for(const item of Items){
                if (item.VehicleImage_ID) {
                    let ImageData = await this.VehicleImage(item.VehicleImage_ID)
                    Items[index]['IMAGES'] = ImageData;
                }
                index++;
            }
            return Items;
        }
        catch (err) {
            console.log('Error Raised Here', err.message);
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }
    async VehicleImage(ImageID_arr) {
        // will load vehicleImage data
        try{
            var image_res = [];
            for(const image_id of ImageID_arr) {
                let params = {
                    TableName: TABLE.TABLE_VEHICLE_IMAGES,
                    FilterExpression: " ID = :id ",
                    ExpressionAttributeValues: {
                        ":id": image_id
                    }
                };

                let scanResults = [];
                let data, Count = 0;
                do {
                    data = await documentClient.scan(params).promise();
                    scanResults.push(...data.Items);
                    Count += data.Count;
                    params.ExclusiveStartKey = data.LastEvaluatedKey;
                } while (data.LastEvaluatedKey);
                if(scanResults) {
                    image_res.push(scanResults[0]);
                }
            } 
            return image_res;
        } catch(err) {
            console.log('Error Raied', err.message);
        }
    }
    

    async bookTestDrive(request) {
        try {
            console.log(`New Slot Booking: ${JSON.stringify(request)}`);
            const params = {
                TableName: TABLE.TABLE_SLOT_BOOK,
                Item: request
            };
            const data = await documentClient.put(params).promise();
            if (data) return data;
            return null;
        } catch (err) {
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }


    async addUserRating(request) {
        try {
            console.log(`New User Rating: ${JSON.stringify(request)}`);
            let params = {
                TableName: TABLE.TABLE_USER_RATING,
                Item: request
            };
            const data = await documentClient.put(params).promise();
            if (data) return data;
            return null;
        } catch (err) {
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }   

    async calculateAvgRating(vehicleID, newRating) {
        try {
            let currentRating = {
                TableName: TABLE.TABLE_VEHICLE,
                ProjectionExpression: ['Rating'],
                FilterExpression: " ID = :id ",
                ExpressionAttributeValues: {
                    ":id": vehicleID
                }
            }
            let CURRENT_RATING = await documentClient.scan(currentRating).promise();
            let PreRating = CURRENT_RATING.Items[0]?.Rating || 2.5;

            return ((parseFloat(PreRating) + parseFloat(newRating)) / 2).toFixed(1) || 2.5;

        } catch (err) {
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }



    async getPopularVehicle(VehicleType_PARAM=undefined) {
        try {
            if(VehicleType_PARAM) {
                let QueryParam = {
                    TableName: TABLE.TABLE_VEHICLE,
                    IndexName: 'VehicleType-Rating-index',
                    KeyConditionExpression: " VehicleType = :vehicleType",
                    ExpressionAttributeValues: {
                        ":vehicleType": VehicleType_PARAM,
                    },
                    ScanIndexForward: false, // Descending
                    Limit: 5
                 }
             
                let CURRENT_RATING = await documentClient.query(QueryParam).promise();
                return CURRENT_RATING;
            }
            return null;
        } catch (err) {
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }

    async getLatestVehicle(){
        // this will load all last inserted of VehicleType and calculate latest among them
        try {
            var resp = [];
            for(const vehicle_type of ["car","bike","auto","tractor"]) {
                let QueryParam = {
                    TableName: TABLE.TABLE_VEHICLE,
                    IndexName: 'VehicleType-CreatedAt-index',
                    KeyConditionExpression: " VehicleType = :vehicleType",
                    ExpressionAttributeValues: {
                        ":vehicleType": vehicle_type,
                    },
                    ScanIndexForward: false, // Descending
                    Limit: 1
                }
                
                let LatestRecord = await documentClient.query(QueryParam).promise();
                if(LatestRecord.Items[0]) {
                    resp.push(LatestRecord.Items[0]);
                }
            }
            return await resp.sort((a,b) => {
                // let first_date = new Date(a.CreatedAt);
                // let sec_date = new Date(b.CreatedAt);
                if(a.CreatedAt == b.CreatedAt){
                    return 0;
                } else if(a.CreatedAt < b.CreatedAt) {
                    return 1;
                } else if(a.CreatedAt > b.CreatedAt) {
                    return -1;
                }

            }); 
            // return resp;
        } catch (err) {
            throw new InternalError(msg.INTERNAL_ERROR, err.message);
        }
    }

}

module.exports = VehicleRepository;