// backend/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Authenticate with Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Set up the Storage Engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'rajchavin_crm_uploads', // All files will go into this folder in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'], // Allow images and PDFs
  },
});

// 3. Create the Multer Middleware
const upload = multer({ storage: storage });

// Add this helper function to delete files

const deleteFromCloudinary = async (fileUrl) => {
  try {
    if (!fileUrl || typeof fileUrl !== 'string') return;

    // This regex pulls the 'folder/filename' regardless of the URL versioning
    const regex = /\/v\d+\/([^/]+\/[^/.]+)\./;
    const match = fileUrl.match(regex);

    if (match && match[1]) {
      const publicId = match[1];
      const result = await cloudinary.uploader.destroy(publicId);
      console.log("Cloudinary Wipe Status:", result.result === 'ok' ? "SUCCESS" : "NOT FOUND", publicId);
    }
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};

module.exports = { upload, cloudinary, deleteFromCloudinary };