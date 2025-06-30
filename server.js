const jsonServer = require("json-server");
const multer = require("multer");
const cors = require("cors");

const server = jsonServer.create();
const router = jsonServer.router("db.json");

<<<<<<< Updated upstream
// Middleware JSON Server avec options CORS (remplace cors() séparé)
const middlewares = jsonServer.defaults({
  static: "public",
  cors: {
    origin: "https://developclics.github.io", // autorise ton front GitHub Pages
    credentials: true,
  },
=======
// Middleware CORS configuré avant tout
server.use(
  cors({
    origin: "https://developclics.github.io",
    credentials: true,
  })
);

// Désactive CORS intégré de json-server
const middlewares = jsonServer.defaults({
  static: "public",
  noCors: true, // désactive le CORS interne de json-server pour éviter conflit
>>>>>>> Stashed changes
});

server.use(middlewares);

// Multer setup pour upload d'images
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

// Validation produit (identique)
function validateProduct(body) {
  let errors = {};
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

// POST /products
server.post("/products", bodyParser, (req, res, next) => {
  if (!req.body) {
    return res
      .status(400)
      .json({ error: "Corps de requête vide ou mal formé" });
  }

  req.body.createdAt = new Date().toISOString();

  if (req.files && req.files.image && req.files.image.length > 0) {
    req.body.imageFilename = req.files.image[0].filename;
  }

  req.body.price = Number(req.body.price);

  const errors = validateProduct(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).jsonp(errors);
  }

  next();
});

// PATCH /products/:id
server.patch("/products/:id", bodyParser, (req, res, next) => {
  if (!req.body) {
    return res
      .status(400)
      .json({ error: "Corps de requête vide ou mal formé" });
  }

  if (req.files && req.files.image && req.files.image.length > 0) {
    req.body.imageFilename = req.files.image[0].filename;
  }

  if (req.body.price) {
    req.body.price = Number(req.body.price);
  }

  const errors = validateProduct(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).jsonp(errors);
  }

  next();
});

// Utilise le routeur JSON Server
server.use(router);

const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`JSON Server is running on port ${PORT}`);
});
