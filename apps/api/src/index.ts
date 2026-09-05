import express from "express";
import dotenv from "dotenv";

dotenv.config()
const app = express();


app.get('/', (req, res) => {
  const ip = req.ip;
  res.json({
    message: 'Hello World',
    ip
  })
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})