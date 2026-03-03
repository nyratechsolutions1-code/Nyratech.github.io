// simple Node/Express server that reads/writes chatbot-data.txt as JSON
// run with: node server.js

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_FILE = path.join(__dirname, 'chatbot-data.txt');

app.use(express.json());

// enable CORS if hosting front-end separately
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/api/data', (req, res) => {
  fs.readFile(DATA_FILE, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') return res.json({});
      return res.status(500).send(err.toString());
    }
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      res.status(500).send('invalid file');
    }
  });
});

app.post('/api/data', (req, res) => {
  const obj = req.body || {};
  fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8', err => {
    if (err) return res.status(500).send(err.toString());
    res.json({success: true});
  });
});

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
