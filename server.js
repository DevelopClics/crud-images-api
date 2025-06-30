const jsonServer = require("json-server");
const multer = require("multer");
const cors = require("cors");

const server = jsonServer.create();
const router = jsonServer.router("db.json");

const allowedOrigins = [
  "https://developclics.github.io",
  "http://localhost:5173",
];

// ✅ Middleware CORS (juste 1 seul bloc, pas doublé)
server.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // permet Postman, etc.
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
  })
);

// ✅ Middleware json-server (avec CORS désactivé côté json-server)
const middlewares = jsonServer.defaults({
  static: "public",
  noCors: true,
});

server.use(middlewares);

// ✅ Multer
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "public/images");
  },
  filename(req, file, cb) {
    const imageFilename = Date.now() + "_" + file.originalname;
    cb(null, imageFilename);
  },
});

const upload = multer({ storage });
const bodyParser = upload.fields([{ name: "image", maxCount: 1 }]);

// ✅ Validation produit
function validateProduct(body) {
  const errors = {};
  if (!body.name || body.name.length < 2)
    errors.name = "Il devrait y avoir un minimum de 2 caractères";
  if (!body.brand || body.brand.length < 2)
    errors.brand = "Il devrait y avoir un minimum de 2 caractères";
  if (!body.category || body.category.length < 2)
    errors.category = "Il devrait y avoir un minimum de 2 caractères";
  if (!body.price || Number(body.price) <= 0)
    errors.price = "Le prix n'est pas valide";
  if (!body.description || body.description.length < 10)
    errors.description = "Il devrait y avoir au moins 10 caractères";
  return errors;
}

// ✅ POST
server.post("/products", bodyParser, (req, res, next) => {
  if (!req.body) return res.status(400).json({ error: "Requête vide" });

  req.body.createdAt = new Date().toISOString();
  if (req.files?.image?.[0]) {
    req.body.imageFilename = req.files.image[0].filename;
  }

  req.body.price = Number(req.body.price);
  const errors = validateProduct(req.body);
  if (Object.keys(errors).length > 0) return res.status(400).jsonp(errors);

  next();
});

// ✅ PATCH
server.patch("/products/:id", bodyParser, (req, res, next) => {
  if (!req.body) return res.status(400).json({ error: "Requête vide" });

  if (req.files?.image?.[0]) {
    req.body.imageFilename = req.files.image[0].filename;
  }

  if (req.body.price) {
    req.body.price = Number(req.body.price);
  }

  const errors = validateProduct(req.body);
  if (Object.keys(errors).length > 0) return res.status(400).jsonp(errors);

  next();
});

// ✅ Routeur json-server
server.use(router);

// ✅ Port Render
const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`JSON Server is running on port ${PORT}`);
});
