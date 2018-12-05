const path = require('path');
const express = require('express');

const app = express();

app.use(express.static('./client'));

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'client', 'index.html')
  );
});

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log('Running at port ', PORT)
})