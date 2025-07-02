const jsonServer = require("json-server");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const server = jsonServer.create();
const router = jsonServer.router("db.json");

const allowedOrigins = [
  "https://developclics.github.io",
  "http://localhost:5173",
];

// Middleware global pour logger toutes les requêtes et leurs headers
server.use((req, res, next) => {
  console.log(`Requête reçue : ${req.method} ${req.url}`);
  console.log("Headers:", req.headers);

  console.log(`Requête ${req.method} ${req.url} - Headers:`, req.headers);
  next();
});

// Variable en mémoire pour stocker l'utilisateur connecté (session simple)
let currentUser = null;

// Utilitaires lecture/écriture db.json
const readDb = () => JSON.parse(fs.readFileSync("db.json", "utf-8"));
const writeDb = (data) =>
  fs.writeFileSync("db.json", JSON.stringify(data, null, 2));

// Middleware Body Parser (json-server)
server.use(jsonServer.bodyParser);

// Middleware CORS
server.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // pour Postman, etc.
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "X-User-Id"], // <-- Ajouté pour autoriser ce header custom
  })
);
server.options("*", cors());

// LOGIN
server.post("/login", (req, res) => {
  const { id, password } = req.body;
  const db = readDb();
  const user = db.user.find((u) => u.id === id && u.password === password);

  if (user) {
    currentUser = { id: user.id, name: user.name };
    res.json({ message: "Connecté", user: currentUser });
  } else {
    res.status(401).json({ message: "Identifiants invalides" });
  }
});

// LOGOUT
server.post("/logout", (req, res) => {
  currentUser = null;
  res.json({ message: "Déconnecté" });
});

// Middleware json-server avec options (static: public, noCors: true car CORS géré avant)
const middlewares = jsonServer.defaults({
  static: "public",
  noCors: true,
});
server.use(middlewares);

// Route racine pour servir index.html
server.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Multer config pour upload images
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

// Validation produit
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

// Middleware pour routes admin : check si admin connecté
const checkAdmin = (req, res, next) => {
  const userId = req.get("X-User-Id")?.trim();
  console.log("checkAdmin - userId header:", userId);

  if (userId !== "admin") {
    return res.status(403).json({ message: "Accès refusé - admin uniquement" });
  }
  console.log("Accès autorisé - admin confirmé");
  next();
};
// Middleware création produit admin
server.post("/admin/products", checkAdmin, bodyParser, (req, res, next) => {
  req.body.createdAt = new Date().toISOString();

  if (req.files?.image?.[0]) {
    req.body.imageFilename = req.files.image[0].filename;
  }

  req.body.price = Number(req.body.price);

  const errors = validateProduct(req.body);
  if (Object.keys(errors).length > 0) return res.status(400).jsonp(errors);

  // Redirige vers la route json-server standard /products (POST)
  req.url = "/products";
  next();
});

// Middleware modification produit admin
server.patch(
  "/admin/products/:id",
  checkAdmin,
  bodyParser,
  (req, res, next) => {
    if (req.files?.image?.[0]) {
      req.body.imageFilename = req.files.image[0].filename;
    }

    if (req.body.price) {
      req.body.price = Number(req.body.price);
    }

    const errors = validateProduct(req.body);
    if (Object.keys(errors).length > 0) return res.status(400).jsonp(errors);

    req.url = `/products/${req.params.id}`;
    next();
  }
);

// Middleware suppression produit admin
// server.delete("/admin/products/:id", checkAdmin, (req, res, next) => {
//   req.url = `/products/${req.params.id}`;
//   next();
// });

server.delete("/admin/products/:id", checkAdmin, (req, res) => {
  const id = Number(req.params.id);
  const db = router.db; // accès low-level à la db json-server

  const product = db.get("products").find({ id }).value();

  if (!product) {
    return res.status(404).json({ message: "Produit non trouvé" });
  }

  db.get("products").remove({ id }).write();

  res.json({ message: "Produit supprimé" });
});

server.delete("/products/:id", (req, res) => {
  res.status(403).json({
    message:
      "Suppression interdite. Utilisez la route admin avec authentification.",
  });
});

// Utilise le routeur json-server (dernière chose)
server.use(router);

// Démarre le serveur
const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`JSON Server is running on port ${PORT}`);
});
