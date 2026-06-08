import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/generate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Route for API requests
app.all('/api/generate', (req, res) => {
  handler(req, res).catch(err => {
    console.error('Error in handler:', err);
    res.status(500).json({ error: err.message });
  });
});

// Serve static files
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`\x1b[32m✔ QuizForge AI local dev server started!\x1b[0m`);
  console.log(`Server running at: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`To generate quizzes, please configure GEMINI_API_KEY or ANTHROPIC_API_KEY in your .env file.`);
});
