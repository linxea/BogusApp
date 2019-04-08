// Import libraries for my cool app
import http from "http";
import express from "express";
import WebSocket from "ws";
import uuidv4 from "uuid/v4";
import path from "path";
import { WebSocketActions, ErrorMessages, SuccessMessages } from "./enums.mjs";

const app = express();
const server = http.createServer(app);

// Handle only the URLs that we provide for the users
// We are using mjs because we are fancy but now we cannot use __dirname directly, oh man
// https://stackoverflow.com/questions/46745014/alternative-for-dirname-in-node-when-using-the-experimental-modules-flag
const __dirname = path.resolve();

// Use process.env.PORT because heroku defines its own PORT
const port = process.env.PORT || 8080;

app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.get("/web", (req, res) => res.sendFile(__dirname + "/web.html"));
app.get("/mobile-camera", (req, res) =>
  res.sendFile(__dirname + "/mobile-camera.html")
);
app.get("/mobile", (req, res) => res.sendFile(__dirname + "/mobile.html"));
app.use("/static", express.static("public"));

// Everything else should go to 404 because we simply don't care
app.get("*", (req, res) => res.sendFile(__dirname + "/404.html"));

server.listen(port, () => console.log(`Server listening on port ${port}!`));

// Handle websocket connections
const webSocketConnections = {};
const validQRCodes = [];
const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
  // Create a unique id for each websocket connection
  // For simplicity, the unique id (uuid) will be our QR code
  const uuid = uuidv4();
  validQRCodes.push(uuid);

  // Store each connection in an object so we can send response to the same connection
  webSocketConnections[uuid] = ws;

  ws.on("message", response => {
    // WebSocket passes string in the response so we need to parse the stringified response
    const payload = JSON.parse(response);
    const { action } = payload;

    switch (action) {
      case WebSocketActions.getQRCode:
        payload.qrCode = uuid;
        ws.send(JSON.stringify(payload));

        log({ action: payload.action, qrCode: payload.qrCode });
        break;

      case WebSocketActions.validateQRCode:
        const { qrCode, username } = payload;
        const isValidQRCode = validQRCodes.includes(qrCode);

        if (isValidQRCode) {
          payload.message = SuccessMessages.loginSuccess;
          payload.action = WebSocketActions.verifiedAccount;

          const payloadJSONString = JSON.stringify(payload);
          // Update both the web and mobile websocket connections that login is a success
          ws.send(payloadJSONString);
          webSocketConnections[qrCode].send(payloadJSONString);

          // Remove QR Code from list and remove web connection
          validQRCodes.splice([validQRCodes.indexOf(qrCode)], 1);
          delete webSocketConnections[qrCode];

          log({ action: payload.action, qrCode, username });
        } else {
          payload.action = WebSocketActions.invalidQRCode;
          payload.message = ErrorMessages.invalidQRCode;
          // Update mobile connection that QR code is invalid
          ws.send(JSON.stringify(payload));

          log({ action: payload.action, qrCode });
        }
        break;

      default:
        payload.action = WebSocketActions.invalidAction;
        payload.message = ErrorMessages.genericError;
        ws.send(JSON.stringify(action));

        log({ action: payload.action, qrCode });
    }
  });

  ws.on("close", (code, reason) => {
    validQRCodes.splice([validQRCodes.indexOf(uuid)], 1);
    delete webSocketConnections[uuid];
    console.log(
      `Websocket connection is closed, status code ${code}, request: ${reason}, uuid: ${uuid}`
    );
  });
});

const log = ({ action = "", qrCode = "", username = "" }) => {
  const actionString = action && `Action: ${action}`;
  const qrCodeString = qrCode && `QR Code: ${qrCode}`;
  const usernameString = username && `Username: ${username}`;
  console.log(`${actionString}, ${qrCodeString} ${usernameString}`);
};
