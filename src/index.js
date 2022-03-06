'use strict'
const awsServerlessExpress = require('aws-serverless-express')
const bodyParser = require("body-parser");
const app = require("express")();
const helmet = require("helmet");
const cors = require('cors');
require("dotenv").config();
const multer = require('multer');


const { physicalFileUpload, base64FileUpload } = require('./services/multer.service');
// const temp = require('../src/repository/reset_password.repository')

const base64_upload = base64FileUpload;



//body parser 
// app.use(bodyParser.text());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(helmet());

// app.use(cors());

const {
    demoProjectApi,
    defaultHandler
} = require("./controller/index.js");

// get Customers/specific customer
app.get('/customer/:id?' ,demoProjectApi.getCustomerList);

// update Customer details
app.post('/updateCustomer', demoProjectApi.updateCustomerDetail );

// add new customer
app.post('/AddCustomer', physicalFileUpload.single('CustomerProfile'), demoProjectApi.addNewCustomer);

// validate user login
app.post('/validateLogin', demoProjectApi.validateLogin );

app.post('/forget-password', demoProjectApi.forgetPassword );

app.post('/validate-otp', demoProjectApi.validateOTP);

app.post('/reset-password', demoProjectApi.resetPassword );

// add new vehicle {contains base64 images}
app.post('/addVehicle', base64_upload.array('vehicle_images', 10), demoProjectApi.addNewVehicle);
app.get('/vehicle/customer/:id?', demoProjectApi.getVehicleList);

// vehicale Details along Imagedata
app.get('/vehicleDetails/:id', demoProjectApi.getVehicleById);


// app.get('/temp/:id',async (req, res) => {
//   const resp = await new temp().validateResetLimit(req.params.id);
//   res.send(resp);
// });



app.post('/userRating', demoProjectApi.addUserRating );

app.post('/bookTestDrive', demoProjectApi.bookTestDrive );

/**
 * 
 */
app.get('/popularVehicle', demoProjectApi.getPopularVehicleList );
// app.get('/getLatestVehicle', demoProjectApi.getLatestVehicle );


const server = awsServerlessExpress.createServer(app);
exports.handle = (event, context) => awsServerlessExpress.proxy(server, event, context);