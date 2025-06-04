const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 4000;
const API_KEY = process.env.REACT_APP_1INCH_API_KEY;

app.use(cors());

// Proxy para qualquer rota /api/1inch/*
app.use('/api/1inch', async (req, res) => {
  const url = `https://api.1inch.dev${req.originalUrl.replace('/api/1inch', '')}`;
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'accept': 'application/json',
      },
    });
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro no proxy: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy 1inch rodando em http://localhost:${PORT}`);
}); 