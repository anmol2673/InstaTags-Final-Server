const mongoose = require('mongoose');


const apiKey = new mongoose.Schema({
   
    apiKey : String
    
    
   
});

module.exports = mongoose.model("apiKey",keySchema);
