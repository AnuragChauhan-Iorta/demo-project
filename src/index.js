'use strict'
const awsServerlessExpress = require('aws-serverless-express')
const bodyParser = require("body-parser");
const app = require("express")();
const helmet = require("helmet");
const cors = require('cors');
require("dotenv").config();
const multer = require('multer');
const path = require('path');
const storage = multer.memoryStorage();
const img_validate_ext = require('./constant/image_ext_list');

const temp = require('../src/repository/reset_password.repository')

const base64_upload = multer({ 
    limits: { fileSize: 2 * 1024 * 1024 }, 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (img_validate_ext.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(null, false);
          return cb(new Error('Only .png, .jpg, .jpeg and .webp format allowed!'));
        }
      }    
 });

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
app.get('/customer/:id?', demoProjectApi.getCustomerList);

// update Customer details
app.post('/updateCustomer', demoProjectApi.updateCustomerDetail );

// add new customer
app.post('/AddCustomer', demoProjectApi.addNewCustomer);

// validate user login
app.post('/validateLogin', demoProjectApi.validateLogin );

app.post('/reset-password', demoProjectApi.resetPassword );

app.post('/validate-otp', demoProjectApi.validateOTP);

// add new vehicle {contains base64 images}
app.post('/addVehicle', base64_upload.array('vehicle_images', 10), demoProjectApi.addNewVehicle);
app.get('/vehicle/customer/:id', demoProjectApi.getVehicleList);


app.get('/temp/:id',async (req, res) => {
  const resp = await new temp().validateResetLimit(req.params.id);
  res.send(resp);
});



app.post('/userRating', demoProjectApi.addUserRating );

app.post('/bookTestDrive', demoProjectApi.bookTestDrive );




const server = awsServerlessExpress.createServer(app);
exports.handle = (event, context) => awsServerlessExpress.proxy(server, event, context);