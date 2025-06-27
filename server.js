const jsonServer = require("json-server");
// npm i multer pour personnaliser le bodyparser
const multer = require("multer");

const server = jsonServer.create();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults();

// Pour écouter sur le serveur Render ou en localhost
const PORT = process.env.PORT || 3004;

// Set default middlewares (logger, static, cors and no-cache)
server.use(middlewares);

//Utilisation de multer pour utiliser le diskstorage et on le modifie
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/images");
  },
  filename: function (req, file, cb) {
    // const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Ajout de code
    let date = new Date();
    let imageFilename = date.getTime() + "_" + file.originalname;
    req.body.imageFilename = imageFilename;
    //
    cb(null, imageFilename);
  },
});

const bodyParser = multer({ storage: storage }).any();
// ----------------------

// Add custom routes before JSON Server router
// server.get('/echo', (req, res) => {
//   res.jsonp(req.query)
// })

// To handle POST, PUT and PATCH you need to use a body-parser
// You can use the one used by JSON Server

// modif de use par post + ajout de la route
server.use(bodyParser);
server.post("/products", (req, res, next) => {
  //   if (req.method === "POST") {
  //     req.body.createdAt = Date.now();
  //   }
  let date = new Date();
  req.body.createdAt = date.toISOString();
  if (req.body.price) {
    req.body.price = Number(req.body.price);
  }

  // implementation de validation
  let hasErrors = false;
  let errors = {};

  if (req.body.name.length < 2) {
    hasErrors = true;
    errors.name = "Il devrait y avoir un minimum de 2 caractères";
  }
  if (req.body.brand.length < 2) {
    hasErrors = true;
    errors.brand = "Il devrait y avoir un minimum de 2 caractères";
  }
  if (req.body.category.length < 2) {
    hasErrors = true;
    errors.category = "Il devrait y avoir un minimum de 2 caractères";
  }
  if (req.body.price <= 0) {
    hasErrors = true;
    errors.price = "Le prix n'est pas valide ";
  }
  if (req.body.description.length < 10) {
    hasErrors = true;
    errors.description = "Il devrait y avoir au moins 10 caractères";
  }

  if (hasErrors) {
    // return bas request 400 with validation errors
    res.status(400).jsonp(errors);
    return;
  }

  // Continue to JSON Server router
  next();
});

// Use default router
server.use(router);
server.listen(PORT, () => {
  console.log("JSON Server is running");
});
