const mongoose = require('mongoose');


// Define the schema
const contentSchema = new mongoose.Schema({
    writeTopic: {
        type: String,
        required: true
    },
    response: {
        type: String,
        required: true
    },
    uniqueId: {
        type: String,
        required: true,
        unique: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Create the Content model
const Content = mongoose.model('Content', contentSchema);

module.exports = Content;
