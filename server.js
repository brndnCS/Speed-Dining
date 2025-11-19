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

async function start() {
  await client.connect();
  app.listen(5001);
}
start();

const API_BASE_URL = process.env.API_BASE_URL || 'hhttp://127.0.0.1:5001';

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


//restaurant recommendations
/*
app.post('/api/recommendations', async (req, res, next) => {
    //incoming: latitude, longitude, distance, cuisine, price
    //outgoing: array of restaurant results or error
    
    // 1. Get all values from the body, including new filters
    const { latitude, longitude, distance, cuisine, price } = req.body;
    
    if (latitude == null || longitude == null) {
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

*/
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

