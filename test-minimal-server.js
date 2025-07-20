const express = require('express');
const app = express();
const PORT = process.env.PORT || 3838;

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.get('/dashboard', (req, res) => {
  res.send('Dashboard endpoint is working!');
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/dashboard`);
});