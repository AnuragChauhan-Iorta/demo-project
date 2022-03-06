const multer = require('multer');
const path = require('path');
const { FILE_LOCATION } = require('../constant/url');

// const path = require('path');
const img_validate_ext = require('../constant/image_ext_list');


// Set The Storage Engine
const storage = multer.diskStorage({
    destination: FILE_LOCATION,
    filename: function (req, file, cb) {
        console.info("uploaded file: ", file);
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const physicalFileUpload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (img_validate_ext.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(null, false);    
            return cb(new Error('Only .png, .jpg, .jpeg and .webp format allowed!'));
        }
    }
});

const base64_upload = multer({ 
    limits: { fileSize: 2 * 1024 * 1024 }, 
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (img_validate_ext.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(null, false);
          return cb(new Error('Only .png, .jpg, .jpeg and .webp format allowed!'));
        }
      }    
 });

module.exports = {
    physicalFileUpload : physicalFileUpload,
    base64FileUpload : base64_upload
};