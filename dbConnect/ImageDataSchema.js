// models/ImageData.js
const mongoose = require('mongoose');

const imageDataSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('ImageData', imageDataSchema);
