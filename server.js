require('dotenv').config();
const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const { OpenAI } = require('openai');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
// Endpoint to generate image description
const axios = require('axios');
const nodemailer = require('nodemailer');
const connectDB = require('./dbConnect/Config'); // Correct path to the config file
const Image = require('./dbConnect/ImageSchema');
const ImageData = require('./dbConnect/ImageDataSchema');
const User = require('./dbConnect/User'); // Ensure correct path to User model
const crypto = require('crypto');

// Express setup
const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// AWS S3 setup
const s3Client = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
});

// Multer setup for AWS S3
const upload = multer({
  storage: multerS3({
    
    s3: s3Client,
    bucket: process.env.BUCKET_NAME,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      cb(null, file.originalname);
    },
  }),
}).single('image');

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is not set.');
  process.exit(1);
}

let newUrl = '';
// Endpoint to handle image uploads
app.post('/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('Error uploading file:', err);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    const file = req.file;
    const fileName = file.originalname;
    let imageUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${fileName}`;
    newUrl=imageUrl;

    console.log(newUrl);

    // Save image details to MongoDB
    const newImage = new Image({ name: fileName, url: imageUrl });
    await newImage.save();

    res.status(200).json({ message: 'File uploaded successfully', imageUrl });
  });
});



// Endpoint to generate image description
app.post('/api/generate-description', async (req, res) => {
  const { model } = req.body; // Ensure you're getting imageUrl from request body
  console.log(model);
  console.log('Image URL:', newUrl);
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What’s in this image?" },
            {
              type: "image_url",
              image_url: {
                "url": newUrl,
              },
            },
          ],
        },
      ],
    });
    console.log(response.choices[0]);
    const imageDescription = response.choices[0].message.content;
    res.json({ message: 'Image description generated successfully', description: imageDescription });
  } catch (error) {
    console.error('Error generating image description with OpenAI:', error);
    res.status(500).json({ error: 'Internal server error' });
}

 
});



//save endpoint 

app.post('/save', async (req, res) => {
  const { description, imageUrl } = req.body;
 
  try {
    const newImageData = new ImageData({ imageUrl, description });
    await newImageData.save();
    console.log("data saved");
    res.status(201).json(newImageData);
  } catch (error) {
    res.status(500).json({ message: 'Failed to save data', error });
  }
});


 
app.get('/api/images', async (req, res) => {
  try {
    const images = await ImageData.find();
    res.json(images); // Send the images as JSON response
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
      user: process.env.EMAIL, // Your email
      pass: process.env.EMAIL_PASSWORD // Your email password
  }
});


// Generate OTP
const generateOTP = () => {
  return crypto.randomBytes(3).toString('hex'); // Generates a 6-character OTP
};

// Forget password endpoint
app.post('/forget-password', async (req, res) => {
  const { email } = req.body;

  console.log(`Received email: ${email}`);

  try {
      const user = await User.findOne({ email });
      console.log(`User found: ${user}`);

      if (!user) {
          console.log(`User not found for email: ${email}`);
          return res.status(404).json({ message: 'User not found' });
      }

      const otp = generateOTP();
      user.otp = otp;
      user.otpExpiry = Date.now() + 3600000; // OTP valid for 1 hour
      await user.save();

      const mailOptions = {
          from: process.env.EMAIL,
          to: email,
          subject: 'Password Reset OTP',
          text: `Your OTP for password reset is: ${otp}`
      };

      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              console.error('Error sending email:', error);
              return res.status(500).json({ message: 'Error sending email' });
          } else {
              console.log('Email sent:', info.response);
              res.status(200).json({ message: 'OTP sent to email' });
          }
      });
  } catch (error) {
      console.error('Error during forget password process:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify OTP and reset password endpoint
app.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
      const user = await User.findOne({ email });

      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      if (user.otp !== otp || user.otpExpiry < Date.now()) {
          return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      user.password = newPassword; // Will be hashed in pre-save middleware
      user.otp = undefined;
      user.otpExpiry = undefined;
      await user.save();

      res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
      console.error('Error during password reset process:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});


// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log("Received login request:", { username, password });

  try {
      const user = await User.findOne({ username });
      console.log('User found:', user);

      if (!user) {
          console.log('User not found');
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const isPasswordMatch = await user.comparePassword(password);
      console.log('Password match:', isPasswordMatch);

      if (!isPasswordMatch) {
          console.log('Invalid password');
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      console.log('Login successful');
      res.json({ success: true, message: 'Login successful', user: { username: user.username } });
  } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  
  try {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
          return res.status(400).json({ message: 'Username already exists' });
      }

      const newUser = new User({ username, password, email });
      await newUser.save();
      console.log( 'User registered successfully');

      res.status(201).json({ message: 'User registered successfully' });

  } catch (error) {
      console.error('Error during registration:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

  

// Connect to the database and start the server
const port = process.env.PORT || 9000;
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
