const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');
const path = require('path');

const requiredVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

requiredVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const buildPublicId = (originalName) => {
  const name = path.parse(originalName).name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${name}`.slice(0, 80);
};

/**
 * SECURITY: multer's fileFilter only sees the client-supplied `Content-Type`
 * header for the part, which is fully attacker-controlled — renaming a
 * malicious file to declare `Content-Type: image/png` bypasses it trivially.
 * This checks the actual file *signature* (magic bytes) of the uploaded
 * buffer against known image formats, so what we send to Cloudinary is
 * verified to genuinely be an image regardless of what the client claimed.
 */
const IMAGE_SIGNATURES = [
  { format: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  { format: 'png',  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: 'gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP: 'RIFF' .... 'WEBP' — check both anchors
  { format: 'webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, extra: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 } },
];

const isValidImageSignature = (buffer) => {
  if (!buffer || buffer.length < 12) return false;

  return IMAGE_SIGNATURES.some(({ bytes, offset = 0, extra }) => {
    const primaryMatch = bytes.every((b, i) => buffer[offset + i] === b);
    if (!primaryMatch) return false;
    if (!extra) return true;
    return extra.bytes.every((b, i) => buffer[extra.offset + i] === b);
  });
};

const uploadImage = async (file, folder = 'ride-share/profile-pics') => {
  if (!file || !file.buffer) {
    throw new Error('No file buffer available for Cloudinary upload');
  }

  if (!isValidImageSignature(file.buffer)) {
    const err = new Error('The uploaded file is not a valid image (jpg, png, gif, or webp).');
    err.statusCode = 400;
    throw err;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: buildPublicId(file.originalname || 'profile-pic'),
        resource_type: 'image',
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    const stream = Readable.from(file.buffer);
    stream.pipe(uploadStream);
  });
};

module.exports = { uploadImage, isValidImageSignature };
