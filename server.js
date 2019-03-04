const http = require("http");
var fs = require("fs");
const WebSocket = require("ws");

const port = 8080;

const requestHandler = (request, response) => {
	const url = request.url;

	if (url == "/web") {
		response.writeHead(200, { "Content-Type": "text/html" });
		var webHtml = fs.readFileSync("web.html");
		response.end(webHtml);
	} else if (url == "/mobile") {
		response.writeHead(200, { "Content-Type": "text/html" });
		var mobileHtml = fs.readFileSync("mobile.html");
		response.end(mobileHtml);
	} else {
		response.end("Hello you are on the server, go to /web or /mobile");
	}
};

const server = http.createServer(requestHandler);

server.listen(port, err => {
	if (err) {
		return console.log("Something went wrong.", err);
	}

	console.log(`Server is listening on ${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
	ws.on("message", response => {
		const payload = JSON.parse(response);
		const { action } = payload;

		switch (action) {
			case "get_qr_code":
				payload.qrCode = "12345";
				ws.send(JSON.stringify(payload));
				console.log(`Action: ${action}, QR Code: ${payload.qrCode}`);
				break;
			case "validate_qr_code":
				const { qrCode, username } = payload;
				if (qrCode === "12345") {
					payload.message = "Login successfully!";
					payload.action = "validated_qr_code";
					ws.send(JSON.stringify(payload));
					console.log(`Username: ${username}, QR Code: ${qrCode}`);
				} else {
					payload.message = "Login Error!";
					payload.action = "error";
					ws.send(JSON.stringify(payload));
					console.log(`QR Code is invalid, QR Code : ${qrCode}`);
				}
				break;
			default:
				ws.send("Invalid action");
		}
	});
});
