import express, { Request, Response } from "express";
import { createProxyMiddleware, Options } from "http-proxy-middleware";
import cors from "cors";
import { IncomingMessage } from "http";

const app = express();
app.use(cors());

const proxyOptions: Options = {
  target: "https://www.google.com",
  changeOrigin: true,
  onProxyRes: (proxyRes: IncomingMessage, req: Request, res: Response) => {
    if (proxyRes.headers) {
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];
    }
  },
} as Options; // Type assertion se TypeScript error fix ho jayega

app.use("/", createProxyMiddleware(proxyOptions));

app.listen(3000, () => {
  console.log("Proxy server running on port 3000");
});
