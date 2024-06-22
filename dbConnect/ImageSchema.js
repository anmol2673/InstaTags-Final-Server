const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
    imagePath: String,
    imageURL: String,
    language: String,
    tags: Number,
    keywords: String,
    model: String,
  });


  const Image = mongoose.model('Image', ImageSchema);
  module.exports = Image;