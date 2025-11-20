require('dotenv').config();
const axios = require('axios');
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const express = require('express');
const cors = require('cors');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const NaiveBayes = require('./nb');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require("bcryptjs");
const url = process.env.MONGODB_KEY
const client = new MongoClient(url);

const path = require('path');
const fs = require('fs');
async function start() {
  await client.connect();
  app.listen(5001);
}
start();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true if you use port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendVerificationEmail(userEmail, firstName, token) {
  const verifyUrl = `${API_BASE_URL}/api/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: userEmail,
    subject: 'Verify your Speed Dining account',
    html: `
      <h2>Hi ${firstName || ''}, welcome to Speed Dining!</h2>
      <p>Please verify your email by clicking the button below:</p>
      <p>
        <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#ec4899;color:#fff;border-radius:6px;text-decoration:none;">
          Verify my email
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p>${verifyUrl}</p>
    `
  };

  await transporter.sendMail(mailOptions);
}


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


app.post('/api/login', async (req, res, next) => {
  // incoming: login, password
  // outgoing: id, firstName, lastName, error
  const { login, password } = req.body;
  let error = '';

  try {
    const db = client.db('SpeedDining');
    const users = db.collection('Users');

    const norm = String(login).trim().toLowerCase();

    // look up by LoginLower or Login to be safe
    const user = await users.findOne({
      $or: [
        { LoginLower: norm },
        { Login: String(login).trim() }
      ]
    });

    if (!user) {
      return res.status(401).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Invalid login or password'
      });
    }
  
    const match = await bcrypt.compare(password, user.Password);

    if(!match) {
      return res.status(401).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Invalid login or password'
      });
    }

    if (!user.IsVerified) {
      return res.status(403).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Please verify your email before logging in.'
      });
    }

    const id = user.UserID;
    const fn = user.FirstName || '';
    const ln = user.LastName || '';

    return res.status(200).json({
      id,
      firstName: fn,
      lastName: ln,
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

app.post('/api/signup', async (req, res) => {
  try {
    const { login, password, firstName, lastName } = req.body || {};
    if (!login || !password || !firstName || !lastName) {
      return res.status(400).json({ id: -1, firstName: '', lastName: '', error: 'Missing fields' });
    }

    // Ideally, login is an email. You can later rename this to Email in DB/UI.
    const norm = String(login).trim().toLowerCase();

    const db = client.db('SpeedDining');
    const users = db.collection('Users');

    // duplicate check (prefer LoginLower if you have it)
    let existing = await users.findOne({ LoginLower: norm });
    if (!existing) existing = await users.findOne({ Login: String(login).trim() });
    if (existing) {
      return res.status(409).json({ id: -1, firstName: '', lastName: '', error: 'User already exists' });
    }

    const nextId = await getNextSeq(db, 'UserID');

    // generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
    const hashedPassword = bcrypt.hashSync(password, 10);

    const doc = {
      UserID: nextId,
      FirstName: String(firstName).trim(),
      LastName: String(lastName).trim(),
      Login: String(login).trim(),
      LoginLower: norm,
      Password: hashedPassword, 
      IsVerified: false,
      VerificationToken: verificationToken,
      VerificationTokenExpires: verificationExpires
    };

    const r = await users.insertOne(doc);
    if (!r.insertedId) throw new Error('Insert failed');

    try {
      await sendVerificationEmail(doc.Login, doc.FirstName, verificationToken);
    } catch (emailErr) {
      console.error('Error sending verification email:', emailErr);
      // Optional: you could delete the user here if email fails
      // await users.deleteOne({ _id: r.insertedId });
      return res.status(500).json({
        id: -1,
        firstName: '',
        lastName: '',
        error: 'Account created, but failed to send verification email. Please contact support.'
      });
    }

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

app.post('/api/deleteRestaurant', async (req, res, next) => {
    // incoming: userId, placeId
    // outgoing: error
    
    const { userId, placeId } = req.body;
    var error = '';

    try {
        const db = client.db('SpeedDining');
        // Delete the specific restaurant for this user
        const result = await db.collection('SavedRestaurants').deleteOne({ 
            UserId: userId, 
            PlaceId: placeId 
        });

        if (result.deletedCount === 0) {
            // If nothing was deleted, maybe it wasn't found?
            // We typically still treat this as a "success" (idempotent) or return a specific message
            console.log("No document matches the provided userId and placeId.");
        }

        res.status(200).json({ error: '' });

    } catch (e) {
        error = e.toString();
        res.status(500).json({ error: error });
    }
});

app.get('/api/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing token');
  }

  try {
    const db = client.db('SpeedDining');
    const users = db.collection('Users');

    const user = await users.findOne({ VerificationToken: token });
    if (!user) {
      return res.status(400).send('Invalid or already used token.');
    }

    if (user.VerificationTokenExpires && user.VerificationTokenExpires < new Date()) {
      return res.status(400).send('Verification link has expired. Please sign up again or request a new link.');
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: { IsVerified: true },
        $unset: { VerificationToken: "", VerificationTokenExpires: "" }
      }
    );

    // Simple HTML response (you can redirect to frontend if you want)
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h2>Email verified ✅</h2>
          <p>You can now close this tab and log in to Speed Dining.</p>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('Verify email error:', e);
    return res.status(500).send('Server error while verifying email.');
  }
});

app.post('/api/recommendations', async (req, res, next) => {
    const { userId, latitude, longitude, distance, cuisine, price } = req.body;
    
    if (latitude == null || longitude == null) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    const radius = distance ? parseInt(distance, 10) : 5000;

    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=restaurant&key=${GOOGLE_API_KEY}`;

    if (cuisine) url += `&keyword=${encodeURIComponent(cuisine)}`;

    if (price) {
        const priceLevel = parseInt(price, 10);
        if (priceLevel <= 2) url += `&maxprice=${priceLevel}`;
        else url += `&minprice=${priceLevel}`;
    }

    console.log(`Fetching from Google API: ${url}`);

    try {
        // 1. Fetch Google results
        const response = await axios.get(url);
        let results = response.data.results || [];

        // 2. Compute distance for each result
        const addDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371000;
            const dLat = (lat2 - lat1) * Math.PI/180;
            const dLon = (lon2 - lon1) * Math.PI/180;
            const a =
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
        };

        results = results.map(r => ({
            ...r,
            distance: addDistance(
                latitude,
                longitude,
                r.geometry.location.lat,
                r.geometry.location.lng
            )
        }));

        // 3. Shuffle results
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]];
        }

        // If no userId → return random results
        if (!userId) return res.status(200).json({ results });

        const db = client.db('SpeedDining');

        // 4. Get user's rated restaurants
        const userRest = await db.collection('SavedRestaurants')
            .find({ UserId: userId, UserRating: { $ne: 'pending' } })
            .toArray();

        // 4.1 Get all saved restaurants to prevent duplicates
        const savedIds = await db.collection('SavedRestaurants')
            .find({ UserId: userId })
            .project({ PlaceId: 1, _id: 0 })
            .toArray();

        const savedSet = new Set(savedIds.map(r => r.PlaceId));

        // 4.2 Filter out already saved restaurants
        results = results.filter(r => !savedSet.has(r.place_id));

        // If no training data → return random results (after duplicate removal)
        if (userRest.length === 0) return res.status(200).json({ results });

        // 5. Train NB
        const nb = new NaiveBayes();
        userRest.forEach(r => nb.train({
            name: r.Name,
            rating: r.Rating,
            types: r.Types,
            price: r.PriceLevel,
            distance: r.Distance,
            openNow: r.OpenNow,
            userRating: r.UserRating
        }));

        // 6. Score new Google results
        const scored = results.map(r => ({
            ...r,
            nbScore: nb.predict({
                name: r.name,
                rating: r.rating,
                types: r.types,
                price: r.price_level,
                distance: r.distance,
                openNow: r.opening_hours?.open_now ?? null
            })
        }));

        // 7. Sort by NB score
        scored.sort((a, b) => b.nbScore - a.nbScore);

        return res.status(200).json({ results: scored });

    } catch (e) {
        console.error('Google API error:', e.message);
        res.status(500).json({ error: 'Failed to fetch from Google API' });
    }
});


app.post("/api/rateRestaurant", async (req, res) => {
  try {
    const { userId, placeId, rating } = req.body;

    if (!userId || !placeId || rating == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const db = client.db("SpeedDining");
    const savedRestaurants = db.collection("SavedRestaurants");

    const result = await savedRestaurants.updateOne(
      { UserId: userId, PlaceId: placeId },
      { $set: { UserRating: rating } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Restaurant not found for this user" });
    }

    return res.status(200).json({ error: "" });
  } catch (e) {
    console.error("Rating error:", e);
    return res.status(500).json({ error: "Server error while rating" });
  }
});

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
        Rating: restaurant.rating,                        // Google rating
        PriceLevel: restaurant.price_level ?? null,       // <--- NEW
        Types: restaurant.types ?? [],                    // <--- NEW (cuisines/categories)
        Distance: restaurant.distance ?? null,            // <--- NEW (optional)
        OpenNow: restaurant.opening_hours?.open_now ?? null,  // <--- NEW
        UserRating: 'pending'                             // user will rate later
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

// Replace your saved-based-recommendation endpoint with this version for debugging:

app.post('/api/saved-based-recommendation', async (req, res) => {
    const { userId, latitude, longitude } = req.body;

    if (!userId || latitude == null || longitude == null) {
        return res.status(400).json({ error: 'userId, latitude, and longitude required.' });
    }

    try {
        const db = client.db("SpeedDining");

        // 1. Get user's **rated** restaurants
        const userRest = await db.collection("SavedRestaurants")
            .find({ UserId: userId, UserRating: { $ne: "pending" } })
            .toArray();

        console.log("\nRated restaurants (UserRating != 'pending'):", userRest.length);
        console.log("Rated restaurant details:");
        userRest.forEach((r, idx) => {
            console.log(`  ${idx + 1}. ${r.Name} - Rating: ${r.UserRating}`);
        });
        
        if (userRest.length < 3) {
            console.log("\n❌ ERROR: Not enough rated restaurants");
            console.log(`   Found: ${userRest.length}, Need: at least 3`);
            console.log("===========================================\n");
            return res.status(200).json({ 
                error: "Not enough rated restaurants to generate personalized suggestions." 
            });
        }
        
        console.log("\n✅ SUCCESS: Enough rated restaurants found");
        console.log("===========================================\n");

        // 2. Also get ALL saved restaurants → to prevent recommending duplicates
        const savedIds = await db.collection("SavedRestaurants")
            .find({ UserId: userId })
            .project({ PlaceId: 1 })
            .toArray();

        const savedSet = new Set(savedIds.map(x => x.PlaceId));

        // 3. Fetch 50 random nearby restaurants from Google
        const radius = 80000; // ~5 miles, adjustable
        const url =
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}` +
            `&radius=${radius}&type=restaurant&key=${GOOGLE_API_KEY}`;

        const response = await axios.get(url);
        let candidates = response.data.results || [];

        // Shuffle + limit to 50
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        candidates = candidates.slice(0, 50);

        // 4. Compute distance helper
        const addDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371000;
            const dLat = (lat2 - lat1) * Math.PI/180;
            const dLon = (lon2 - lon1) * Math.PI/180;
            const a =
                Math.sin(dLat/2) ** 2 +
                Math.cos(lat1*Math.PI/180) *
                Math.cos(lat2*Math.PI/180) *
                Math.sin(dLon/2) ** 2;
            return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        };

        candidates = candidates.map(r => ({
            ...r,
            distance: addDistance(
                latitude,
                longitude,
                r.geometry.location.lat,
                r.geometry.location.lng
            )
        }));

        // 5. Remove restaurants the user already saved
        candidates = candidates.filter(r => !savedSet.has(r.place_id));

        if (candidates.length === 0) {
            return res.status(200).json({ error: "No new restaurants nearby." });
        }

        // 6. Train NB
        const nb = new NaiveBayes();
        userRest.forEach(r => nb.train({
            name: r.Name,
            rating: r.Rating,
            types: r.Types,
            price: r.PriceLevel,
            distance: r.Distance,
            openNow: r.OpenNow,
            userRating: r.UserRating
        }));

        // 7. Score all candidates
        const scored = candidates.map(r => ({
            ...r,
            nbScore: nb.predict({
                name: r.name,
                rating: r.rating,
                types: r.types,
                price: r.price_level,
                distance: r.distance,
                openNow: r.opening_hours?.open_now ?? null
            })
        }));

        // Sort by score descending
        scored.sort((a, b) => b.nbScore - a.nbScore);

        // return top 3 (or fewer if less than 3 scored items)
        const recommended = scored.slice(0, 3);

        return res.status(200).json({ recommended });


    } catch (err) {
        console.error("Saved-based recommendation error:", err);
        res.status(500).json({ error: "Failed to generate saved-based recommendation." });
    }
});

// Get a restaurant photo
app.get('/api/photo', async (req, res) => {
    const photoReference = req.query.ref;

    if (!photoReference) {
        return res.status(400).json({ error: 'Photo reference is required.' });
    }

    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: 'Google API Key not configured on server.' });
    }

    // Google Places Photo API URL
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=411&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;

    try {
        // Request the image from Google
        const response = await axios({
            url: photoUrl,
            method: 'GET',
            responseType: 'stream',
            validateStatus: () => true // we handle status manually
        });

        // If Google says 429 → fallback
        if (response.status === 429) {
            console.log("Google API rate limit hit → serving fallback image");
            return res.sendFile(path.join(__dirname, 'public/stockRestaurant.jpg'));
        }

        // Pipe Google’s image back to the client
        res.setHeader('Content-Type', response.headers['content-type']);
        response.data.pipe(res);

    } catch (error) {
        console.error('Photo fetch error:', error);

        // In case of unexpected errors, fallback too
        return res.sendFile(path.join(__dirname, 'public/stock-image.jpg'));
    }
});

app.post('/api/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const norm = String(email).trim().toLowerCase();
    const db = client.db("SpeedDining");
    const users = db.collection("Users");

    const user = await users.findOne({ LoginLower: norm });

    // Always respond success for security
    if (!user) {
      return res.status(200).json({ ok: true });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          ResetToken: resetToken,
          ResetTokenExpires: resetExpires
        }
      }
    );

    const resetUrl = `${API_BASE_URL}/api/reset-password?token=${resetToken}`;

    // Email
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: user.Login,
      subject: "Reset your Speed Dining password",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the button below to reset your password:</p>
        <p>
          <a href="${resetUrl}" style="padding:10px 15px;background:#ec4899;color:white;text-decoration:none;border-radius:6px;">
            Reset Password
          </a>
        </p>
        <p>If the button doesn't work, copy this link:</p>
        <p>${resetUrl}</p>
      `
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Reset request error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get('/api/reset-password', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing token');
  }

  try {
    const db = client.db("SpeedDining");
    const users = db.collection("Users");

    const user = await users.findOne({ ResetToken: token });
    if (!user) {
      return res.status(400).send('Invalid or already used token.');
    }

    if (user.ResetTokenExpires && user.ResetTokenExpires < new Date()) {
      return res.status(400).send('Reset link has expired. Please request a new one.');
    }

    // Serve an HTML form to reset password
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reset Password - Speed Dining</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              background: linear-gradient(135deg, #ec4899 0%, #ef4444 50%, #f97316 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              margin: 0;
            }
            .container {
              background: white;
              border-radius: 24px;
              padding: 40px;
              max-width: 400px;
              width: 100%;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            h1 {
              color: #1f2937;
              margin-bottom: 10px;
              font-size: 28px;
            }
            p {
              color: #6b7280;
              margin-bottom: 24px;
            }
            label {
              display: block;
              color: #374151;
              font-weight: 600;
              margin-bottom: 8px;
              font-size: 14px;
            }
            input {
              width: 100%;
              padding: 12px 16px;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              font-size: 16px;
              margin-bottom: 16px;
              box-sizing: border-box;
              transition: border-color 0.2s;
            }
            input:focus {
              outline: none;
              border-color: #ec4899;
            }
            button {
              width: 100%;
              padding: 14px;
              background: linear-gradient(135deg, #ec4899, #ef4444);
              color: white;
              border: none;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 700;
              cursor: pointer;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            button:hover {
              transform: translateY(-2px);
              box-shadow: 0 10px 20px rgba(236, 72, 153, 0.3);
            }
            button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
              transform: none;
            }
            .message {
              padding: 12px;
              border-radius: 8px;
              margin-bottom: 16px;
              font-size: 14px;
              display: none;
            }
            .message.error {
              background: #fee;
              color: #c00;
              border-left: 4px solid #c00;
            }
            .message.success {
              background: #efe;
              color: #060;
              border-left: 4px solid #060;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Reset Password</h1>
            <p>Enter your new password below</p>
            
            <div id="message" class="message"></div>
            
            <form id="resetForm">
              <div>
                <label>New Password</label>
                <input type="password" id="password" placeholder="At least 6 characters" required minlength="6">
              </div>
              
              <div>
                <label>Confirm Password</label>
                <input type="password" id="confirmPassword" placeholder="Re-enter password" required>
              </div>
              
              <button type="submit" id="submitBtn">Reset Password</button>
            </form>
          </div>

          <script>
            const form = document.getElementById('resetForm');
            const message = document.getElementById('message');
            const submitBtn = document.getElementById('submitBtn');

            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const password = document.getElementById('password').value;
              const confirmPassword = document.getElementById('confirmPassword').value;

              if (password !== confirmPassword) {
                message.textContent = 'Passwords do not match';
                message.className = 'message error';
                message.style.display = 'block';
                return;
              }

              if (password.length < 6) {
                message.textContent = 'Password must be at least 6 characters';
                message.className = 'message error';
                message.style.display = 'block';
                return;
              }

              submitBtn.disabled = true;
              submitBtn.textContent = 'Resetting...';

              try {
                const response = await fetch('/api/reset-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: '${token}', password })
                });

                const data = await response.json();

                if (response.ok) {
                  message.textContent = 'Password reset successfully! Redirecting to login...';
                  message.className = 'message success';
                  message.style.display = 'block';
                  
                  setTimeout(() => {
                    window.location.href = 'http://localhost:5173';
                  }, 2000);
                } else {
                  message.textContent = data.error || 'Failed to reset password';
                  message.className = 'message error';
                  message.style.display = 'block';
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Reset Password';
                }
              } catch (error) {
                message.textContent = 'Connection error. Please try again.';
                message.className = 'message error';
                message.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Reset Password';
              }
            });
          </script>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('Reset password page error:', e);
    return res.status(500).send('Server error while loading reset page.');
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const db = client.db("SpeedDining");
    const users = db.collection("Users");

    const user = await users.findOne({ ResetToken: token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or already used token' });
    }

    if (user.ResetTokenExpires && user.ResetTokenExpires < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    await users.updateOne(
      { _id: user._id },
      {
        $set: { Password: hashedPassword },
        $unset: { ResetToken: "", ResetTokenExpires: "" }
      }
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Reset password error:', e);
    return res.status(500).json({ error: 'Server error while resetting password' });
  }
});
