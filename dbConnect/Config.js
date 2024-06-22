const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://mayankdubey2673:1SOAwv7YHahEmRkx@rageopenai.7ruzbru.mongodb.net/instaTagsDb?retryWrites=true&w=majority&appName=Rageopenai', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("DB Connection Successful");
    } catch (err) {
        console.log("Error while connecting to DB:", err);
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;
