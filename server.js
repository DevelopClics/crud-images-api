const jsonServer = require("json-server");
const multer = require("multer");

const server = jsonServer.create();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults();

// Pour Render ou localhost
const PORT = process.env.PORT || 3004;

// Middleware JSON Server (logger, cors, etc.)
server.use(middlewares);

// 🔧 Configuration de Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/images");
  },
  filename: function (req, file, cb) {
    let date = new Date();
    let imageFilename = date.getTime() + "_" + file.originalname;
    req.body.imageFilename = imageFilename;
    cb(null, imageFilename);
  },
});

// Initialisation de Multer après la définition de "storage"
const upload = multer({ storage: storage });
const bodyParser = upload.fields([{ name: "image", maxCount: 1 }]);
