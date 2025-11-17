require('dotenv').config();

const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // true if you use port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const axios = require('axios');
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const express = require('express');
const cors = require('cors');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb+srv://sparshpandey06_db_user:q56faVzHcdrE9a0F@cluster0.ody1sc1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
const client = new MongoClient(url);
client.connect();


app.use(cors());
// app.use(bodyParser.json());
app.use(express.json());
app.use((req, res, next) => {
    app.get("/api/ping", (req, res, next) => {
        res.status(200).json({ message: "Hello World" });
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PATCH, DELETE, OPTIONS'
    );
    next();
});

app.post('/api/addcard', async (req, res, next) => {
    // incoming: userId, color
    // outgoing: error
    const { userId, card } = req.body;
    const newCard = { Card: card, UserId: userId };
    var error = '';
    try {
        const db = client.db('COP4331Cards');
        const result = db.collection('Cards').insertOne(newCard);
    }
    catch (e) {
        error = e.toString();
    }
    cardList.push(card);
    var ret = { error: error };
    res.status(200).json(ret);
});


app.post('/api/login', async (req, res) => {
  try {
    // incoming: login (username), password
    // outgoing: id, firstName, lastName, error
    const { login, password } = req.body || {};

    if (!login || !password) {
      return res.status(400).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Missing username or password'
      });
    }

    const db = client.db('COP4331');
    const users = db.collection('users');

    const username = String(login).trim();
    const pwd = String(password);

    // Find by username + password
    const user = await users.findOne({
      Login: username,
      Password: pwd   // (plaintext for now, to match your current setup)
    });

    // No user found
    if (!user) {
      return res.status(401).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Invalid username or password'
      });
    }

    if (user.IsVerified) {
      return res.status(403).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Email not verified. Please check your inbox.'
      });
    }

    // Successful login
    return res.status(200).json({
      id: user.UserID ?? -1,
      firstName: user.FirstName || '',
      lastName: user.LastName || '',
      error: ''
    });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({
      id: -1,
      firstName: '',
      lastName: '',
      error: 'Server error during login'
    });
  }
});




async function getNextSeq(db, name) {
  const counters = db.collection('Counters');
  let r;

  // Try v4+ option first
  try {
    r = await counters.findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (e) {
    // Fallback for v3.x
    if (String(e).includes('returnDocument')) {
      r = await counters.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { upsert: true, returnOriginal: false }
      );
    } else {
      throw e;
    }
  }

  // If we still didn’t get a doc (some older combos), read it back
  if (!r.value) {
    const doc = await counters.findOne({ _id: name });
    if (!doc) throw new Error('Counter document missing after upsert');
    return doc.seq;
  }
  return r.value.seq;
}

/*
app.post('/api/signup', async (req, res) => {
  try {
    const { login, password, firstName, lastName } = req.body || {};
    if (!login || !password || !firstName || !lastName) {
      return res.status(400).json({ id: -1, firstName: '', lastName: '', error: 'Missing fields' });
    }

    const db = client.db('COP4331');
    const users = db.collection('users');

    const norm = String(login).trim().toLowerCase();

    // duplicate check (prefer LoginLower if you have it)
    let existing = await users.findOne({ LoginLower: norm });
    if (!existing) existing = await users.findOne({ Login: String(login).trim() });
    if (existing) {
      return res.status(409).json({ id: -1, firstName: '', lastName: '', error: 'User already exists' });
    }

    const nextId = await getNextSeq(db, 'UserID');

    const doc = {
      UserID: nextId,
      FirstName: String(firstName).trim(),
      LastName: String(lastName).trim(),
      Login: String(login).trim(),
      LoginLower: norm,
      Password: String(password) // plaintext for now to match your current /api/login
    };

    const r = await users.insertOne(doc);
    if (!r.insertedId) throw new Error('Insert failed');

    return res.status(201).json({
      id: nextId,
      firstName: doc.FirstName,
      lastName: doc.LastName,
      error: ''
    });
  } catch (e) {
    console.error('Signup error:', e);
    return res.status(500).json({ id: -1, firstName: '', lastName: '', error: String(e.message || e) });
  }
});
*/

app.post('/api/signup', async (req, res) => {
  try {
    const { login, email, password, firstName, lastName } = req.body || {};

    // Basic validation
    if (!login || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Missing required fields'
      });
    }

    const username = String(login).trim();
    const emailNorm = String(email).trim().toLowerCase();

    // Very simple email sanity check
    if (!emailNorm.includes('@')) {
      return res.status(400).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Invalid email address'
      });
    }

    const db = client.db('COP4331');
    const users = db.collection('users');

    // Duplicate checks: username AND email unique
    const existingByUsername = await users.findOne({ Login: username });
    if (existingByUsername) {
      return res.status(409).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Username already exists'
      });
    }

    const existingByEmail = await users.findOne({ EmailLower: emailNorm });
    if (existingByEmail) {
      return res.status(409).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Email already in use'
      });
    }

    // Get next user id
    const nextId = await getNextSeq(db, 'UserID');

    // Generate verification token + expiry
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // User document to insert
    const doc = {
      UserID: nextId,
      FirstName: String(firstName).trim(),
      LastName: String(lastName).trim(),
      Login: username,          // username for login
      Email: emailNorm,         // store normalized email
      EmailLower: emailNorm,    // duplicate-safe field
      Password: String(password), // (plaintext for now, match your current login logic)
      IsVerified: false,
      VerificationToken: verificationToken,
      VerificationExpires: verificationExpires,
      CreatedAt: new Date()
    };

    const insertResult = await users.insertOne(doc);
    if (!insertResult.insertedId) {
      throw new Error('Insert failed');
    }

    // Build verify URL for frontend route
    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    // Send verification email
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: emailNorm,
        subject: 'Verify your Speed Dining account',
        html: `
          <p>Hi ${doc.FirstName},</p>
          <p>Thanks for signing up for <strong>Speed Dining</strong>!</p>
          <p>Please verify your email by clicking the link below:</p>
          <p><a href="${verifyUrl}">Verify my email</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create this account, you can ignore this email.</p>
        `
      });
    } catch (mailErr) {
      console.error('Error sending verification email:', mailErr);
      // You can decide if you want to fail signup or not. For now, we keep the account.
    }

    // Successful signup response
    return res.status(201).json({
      id: nextId,
      firstName: doc.FirstName,
      lastName: doc.LastName,
      error: '',
      requiresVerification: true
    });
  } catch (e) {
    console.error('Signup error:', e);
    return res.status(500).json({
      id: -1,
      firstName: '',
      lastName: '',
      error: e.message || 'Server error'
    });
  }
});


app.get('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing token' });
    }

    const db = client.db('COP4331');
    const users = db.collection('users');

    const now = new Date();

    const user = await users.findOne({
      VerificationToken: String(token),
      VerificationExpires: { $gt: now }
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: { IsVerified: true },
        $unset: { VerificationToken: '', VerificationExpires: '' }
      }
    );

    // Option 1: send JSON
    return res.status(200).json({ success: true });

    // Option 2: instead of JSON, redirect to frontend success page:
    // return res.redirect(`${process.env.FRONTEND_BASE_URL}/verify-email-success`);
  } catch (e) {
    console.error('Verify email error:', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});


app.post('/api/searchcards', async (req, res, next) => {
    // incoming: userId, search
    // outgoing: results[], error
    var error = '';
    const { userId, search } = req.body;
    var _search = search.trim();
    const db = client.db('COP4331Cards');
    const results = await db.collection('Cards').find({ "Card": { $regex: _search + '.*', $options: 'i' } }).toArray();
    var _ret = [];
    for (var i = 0; i < results.length; i++) {
        _ret.push(results[i].Card);
    }
    var ret = { results: _ret, error: error };
    res.status(200).json(ret);
});

//restaurant recommendations
app.post('/api/recommendations', async (req, res, next) => {
    //incoming: latitude, longitude, distance, cuisine, price
    //outgoing: array of restaurant results or error
    
    // 1. Get all values from the body, including new filters
    const { latitude, longitude, distance, cuisine, price } = req.body;
    
    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    // 2. Set a default radius (in meters) if distance isn't provided
    //    We use parseInt to make sure it's a number.
    const radius = distance ? parseInt(distance, 10) : 5000; // 5000m (5km) default

    // 3. Dynamically build the URL
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=restaurant&key=${GOOGLE_API_KEY}`;

    // 4. Add filters to the URL if they were provided
    if (cuisine) {
        // Use the 'keyword' param for cuisine types like "American"
        url += `&keyword=${encodeURIComponent(cuisine)}`;
    }

    if (price) {
        // Assuming price is a number string: "1", "2", "3", or "4"
        const priceLevel = parseInt(price, 10);
        
        if (priceLevel <= 2) {
            // maxprice=1 is Budget, maxprice=2 is Moderate
            url += `&maxprice=${priceLevel}`;
        } else {
            // minprice=3 is Upscale, minprice=4 is Very Upscale
            url += `&minprice=${priceLevel}`;
        }
    }

    console.log(`Fetching from Google API: ${url}`); // Good for debugging

    try {
        const response = await axios.get(url);

        //shuffle results
        let results = response.data.results || [];
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]];
        }
        
        res.status(200).json({ results: results });

    } catch (e) {
        console.error('Google API error:', e.message);
        res.status(500).json({ error: 'Failed to fetch from Google API' });
    }
});

//save a restaurant aka if yes is clicked
app.post('/api/saveRestaurant', async (req, res, next) => {
    //incoming: userId, restaurant (object)
    //outgoing: { id: newDocumentId } or { error: ... }
    
    const { userId, restaurant } = req.body;

    //restaurant object to save
    const newSavedRestaurant = {
        UserId: userId,
        PlaceId: restaurant.place_id,
        Name: restaurant.name,
        Vicinity: restaurant.vicinity,
        Rating: restaurant.rating,
        UserRating: 'pending'
    };
    
    var error = '';
    
    try {
        const db = client.db('SpeedDining'); // Using a new DB for this app
        const result = await db.collection('SavedRestaurants').insertOne(newSavedRestaurant);
        
        if (!result.insertedId) {
            throw new Error('Insert failed');
        }

        res.status(201).json({ id: result.insertedId, error: '' });

    } catch (e) {
        error = e.toString();
        res.status(500).json({ error: error });
    }
});

//get the user's saved list
app.post('/api/myRestaurants', async (req, res, next) => {
    //incoming: userId
    //outgoing: { results: [] } or { error: ... }

    const { userId } = req.body;
    var error = '';

    try {
        const db = client.db('SpeedDining');
        //get all restaurants saved by user
        const results = await db.collection('SavedRestaurants').find({ UserId: userId }).toArray();
        
        res.status(200).json({ results: results, error: '' });

    } catch (e) {
        error = e.toString();
        res.status(500).json({ error: error });
    }
});

// Get a restaurant photo
app.get('/api/photo', (req, res, next) => {
    const photoReference = req.query.ref;
    
    if (!photoReference) {
        return res.status(400).json({ error: 'Photo reference is required.' });
    }

    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: 'Google API Key not configured on server.' });
    }

    // Construct the Google Places Photo API URL. 
    // maxwidth=411 is a good default for a mobile card view.
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=411&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;

    // Redirect the client's request to the Google API URL
    // The browser will then load the image from Google directly.
    res.redirect(302, photoUrl);
});

app.listen(5001); // start Node + Express server on port 5000
