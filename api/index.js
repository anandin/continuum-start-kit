// Vercel Serverless Function — wraps the Express app from the esbuild dist.
// This file is kept as plain JS to avoid Vercel's strict TS compiler issues.
// The actual app is built by the buildCommand in vercel.json.

let handler;

module.exports = async function (req, res) {
  if (!handler) {
    const { createApp } = await import("../artifacts/api-server/dist/serverless.mjs");
    handler = await createApp();
  }
  return handler(req, res);
};
