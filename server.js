import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/generate-paragraph.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// API route for AI paragraph generation
app.all('/api/generate-paragraph', async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('API route error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
});

// Serve static assets
app.use(express.static(__dirname));

// Single-page application fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
