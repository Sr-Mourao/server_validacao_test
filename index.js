const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const port = process.env.PORT || 5000;
const app = express();

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: false, limit: "10mb" }));
app.use(cors({ origin: "*" }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    res.status(400).json({ error: "Payload too large" });
  }
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const clientSockets = {};

io.on("connection", (socket) => {
  socket.on("registerClient", (idClient) => {
    clientSockets[idClient] = socket;
    console.log(`Cliente registrado com ID externo: ${idClient}`);
  });

  socket.on("disconnect", () => {
    const idClient = Object.keys(clientSockets).find(
      (key) => clientSockets[key] === socket
    );
    if (idClient) {
      delete clientSockets[idClient];
      console.log(`Cliente com ID externo ${idClient} desconectado`);
    }
  });
});

const removeSpecialCharacters = (str) => {
  return str.replace(/[^\w\s]/gi, "");
};

function formatNomeCompleto(name, lastname) {
  name = name.replace(/^\s+|\s+$/g, "");
  lastname = lastname.replace(/^\s+|\s+$/g, "").replace(/\s+/g, "");
  return { name, lastname };
}

app.post("/generate-url", (req, res) => {
  const { nome, sobrenome, cpfcnpj, dataNascimento, idExternoCliente } =
    req.body;
  let nameCompleto = formatNomeCompleto(nome, sobrenome);
  let cpfcnpjSemCharacters = removeSpecialCharacters(cpfcnpj);
  try {
    const mountedUrl = `https://validahomol.sdsign.com.br/#/sdliveness3d?nome=${nameCompleto.name}%20${nameCompleto.lastname}&cpf=${cpfcnpjSemCharacters}&nascimento=${dataNascimento}&idExternoCliente=${idExternoCliente}&urlCallback=http://localhost:5000/result`;
    res.status(200).json({ mountedUrl });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Erro ao processar");
  }
});

app.post("/result", (req, res) => {
  try {
    if (!req.body) {
      throw new Error("Dados do webhook ausentes");
    }

    const resultStatus = JSON.parse(req.body.resultStatus);
    const idClient = resultStatus.idExternoCliente;
    const userSocket = clientSockets[idClient];

    if (userSocket) {
      userSocket.emit("resultData", req.body);
      res.status(200).json(req.body);
      console.log(req.body);
    } else {
      throw new Error(`Cliente com ID externo ${idClient} não encontrado`);
    }
  } catch (error) {
    console.error("Erro ao processar o webhook:", error.message);
    res.status(500).send("Erro ao processar o webhook");
  }
});

server.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
