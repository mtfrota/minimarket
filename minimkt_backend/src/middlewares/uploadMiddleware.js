const fs = require("fs");
const path = require("path");
const multer = require("multer");

const productUploadDir = path.join(__dirname, "../../uploads/products");
fs.mkdirSync(productUploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, productUploadDir);
    },
    filename: (_req, file, cb) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        const safeExt = extension || ".jpg";
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
        cb(null, fileName);
    }
});

const fileFilter = (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
        const error = new Error("Apenas imagens sao permitidas");
        error.statusCode = 400;
        return cb(error);
    }

    return cb(null, true);
};

const uploadProductImageMiddleware = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).single("image");

module.exports = { uploadProductImageMiddleware };
