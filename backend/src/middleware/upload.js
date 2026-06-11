// ============================================================
// File Upload Middleware
// Multer + Sharp + Magic Byte Validation
// ============================================================

import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { v4 as uuidv4 } from 'uuid';

// Multer config - store in memory for processing
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, PDF`), false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter,
});

// Upload for profile photos (images only)
export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
  },
});

// Upload for PDFs only
export const uploadPdf = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for PDFs
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Magic byte validation - validate actual file content
export const validateFileMagicBytes = async (req, res, next) => {
  if (!req.file && (!req.files || req.files.length === 0)) return next();

  const files = req.files || (req.file ? [req.file] : []);
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  try {
    for (const file of files) {
      const type = await fileTypeFromBuffer(file.buffer);
      if (!type || !allowed.includes(type.mime)) {
        return res.status(400).json({
          error: 'Invalid file content',
          message: 'File type mismatch detected. The file content does not match its extension.',
        });
      }
      file.validatedMime = type.mime;
    }
    if (req.file) {
      const type = await fileTypeFromBuffer(req.file.buffer);
      if (!type || !allowed.includes(type.mime)) {
        return res.status(400).json({
          error: 'Invalid file content',
          message: 'File type mismatch detected.',
        });
      }
      req.file.validatedMime = type.mime;
    }
    next();
  } catch (error) {
    console.error('Magic byte validation error:', error);
    return res.status(400).json({ error: 'File validation failed' });
  }
};

// Process image: strip EXIF, resize, convert to WebP
export const processImage = async (buffer, options = {}) => {
  const {
    width = 800,
    height = 800,
    fit = 'inside',
    quality = 85,
  } = options;

  return sharp(buffer)
    .rotate() // Auto-rotate based on EXIF (then strip it)
    .resize(width, height, { fit, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
};

// Process profile photo: square crop, smaller size
export const processProfilePhoto = async (buffer) => {
  return sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
};

// Generate secure random filename
export const generateSecureFilename = (ext = 'webp') => {
  return `${uuidv4()}.${ext}`;
};

// Handle multer errors
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({ error: error.message });
  }
  next(error);
};
