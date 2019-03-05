const express = require("express");
const WebSocket = require("ws");
const uuidv4 = require("uuid/v4");
const http = require("http");

const port = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);

// The URLs that we care
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.get("/web", (req, res) => res.sendFile(__dirname + "/web.html"));
app.get("/desktop-mobile", (req, res) => res.sendFile(__dirname + "/desktop-mobile.html"));
app.get("/mobile", (req, res) => res.sendFile(__dirname + "/mobile.html"));
app.use("/static", express.static("public"));

// Everything else go to 404
app.get("*", (req, res) => res.sendFile(__dirname + "/404.html"));
server.listen(port, () => console.log(`Server listening on port ${port}!`));

const queueOfConnections = {};
const validQRCodes = [];

const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
  // Create a unique id for each websocket connection and store each connection in a queue
  const id = uuidv4();
  validQRCodes.push(id);
  queueOfConnections[id] = ws;

  ws.on("message", response => {
    const payload = JSON.parse(response);
    const { action } = payload;

    switch (action) {
      case "get_qr_code":
        payload.qrCode = id;
        ws.send(JSON.stringify(payload));
        console.log(`Action: ${action}, QR Code: ${payload.qrCode}`);
        break;
      case "validate_qr_code":
        const { qrCode, username } = payload;
        console.log(
          "valid",
          validQRCodes,
          qrCode,
          validQRCodes.includes(qrCode)
        );

        if (validQRCodes.includes(qrCode)) {
          payload.message = "Login successfully!";
          payload.action = "validated_qr_code";

          const validatePayload = JSON.stringify(payload);

          // Once QR Code is validated, update both mobile and web connections,
          // remove id from queueOfConnections and validQRCode and close websocket connection
          ws.send(validatePayload);
          queueOfConnections[qrCode].send(validatePayload);
          delete validQRCodes[validQRCodes.indexOf(qrCode)];
          delete queueOfConnections[qrCode];

          console.log(`Username: ${username}, QR Code: ${qrCode}`);
        } else {
          payload.action = "error";
          payload.message =
            "Aiya, there's a problem with your QR code! Scan again!";
          ws.send(JSON.stringify(payload));

          console.log(`QR Code is invalid, QR Code : ${qrCode}`);
        }
        break;
      default:
        payload.action = "invalid_action";
        ws.send(JSON.stringify(action));
        console.log(`Invalid action, QR Code : ${qrCode}`);
    }
  });
});
