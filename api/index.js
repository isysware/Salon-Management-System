// api/index.js
// Vercel Serverless Function entry point for SalonOS Express Backend
import 'dotenv/config';
import app from '../backend/src/app.js';

export default function handler(req, res) {
  return app(req, res);
}
