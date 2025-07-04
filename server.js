const jsonServer = require("json-server");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret123";
const refreshTokens = [];

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

// Vérifie et met à jour les utilisateurs (hash + rôle) au démarrage
function ensureUsersSecure() {
  const db = readDb();
  let modified = false;
  db.user.forEach((u) => {
    // Ajout rôle
    if (!u.role) {
      u.role = u.id === "admin" ? "admin" : "user";
      modified = true;
    }
    // Hachage si pas déjà fait (bcrypt hash commence par "$2")
    if (!u.password.startsWith("$2")) {
      u.password = bcrypt.hashSync(u.password, 10);
      modified = true;
    }
  });
  if (modified) writeDb(db);
}
ensureUsersSecure();

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
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
server.options("*", cors());

// LOGIN (avec génération JWT)
server.post("/login", (req, res) => {
    const { id, password } = req.body;
  const db = readDb();
  const user = db.user.find((u) => u.id === id);

  if (!user) return res.status(401).json({ message: "Identifiants invalides" });

  // Vérifie le mot de passe avec bcrypt
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok)
    return res.status(401).json({ message: "Identifiants invalides" });

  const payload = { id: user.id, role: user.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
  const refreshToken = crypto.randomUUID();
  refreshTokens.push({ token: refreshToken, userId: user.id });

  return res.json({ user: { id: user.id, name: user.name }, accessToken, refreshToken, expiresIn: 3600 });
    
});

// REFRESH token
server.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;
  const entry = refreshTokens.find((t) => t.token === refreshToken);
  if (!entry) return res.status(401).json({ message: "Refresh token invalide" });

    const dbRef = readDb();
  const user = dbRef.user.find((u) => u.id === entry.userId);
  const payload = { id: entry.userId, role: user ? user.role : "user" };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
  return res.json({ accessToken, expiresIn: 3600 });
});

// LOGOUT
server.post("/logout", (req, res) => {
    // Optionnel : retirer refreshToken de la liste
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    const idx = refreshTokens.findIndex((t) => t.token === refreshToken);
    if (idx !== -1) refreshTokens.splice(idx, 1);
  }
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

// Middleware JWT
function authenticate(req, res, next) {
  const auth = req.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Token manquant" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalide" });
  }
}

function checkAdmin(req, res, next) {
    if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Accès refusé - admin uniquement" });
  }
  next();
};
// Middleware création produit admin
server.post("/admin/products", authenticate, checkAdmin, bodyParser, (req, res, next) => {
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
  authenticate,
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

server.delete("/admin/products/:id", authenticate, checkAdmin, (req, res) => {
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
