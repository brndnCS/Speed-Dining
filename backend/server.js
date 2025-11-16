require('dotenv').config();
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


app.post('/api/login', async (req, res, next) => {
    // incoming: login, password
    // outgoing: id, firstName, lastName, error
    var error = '';
    const { login, password } = req.body;
    var id = -1;
    var fn = '';
    var ln = '';

    const db = client.db('COP4331');
    const results = await db.collection('users').find({ Login: login, Password: password }).toArray();

    var id = -1;
    var fn = '';
    var ln = '';


    if (results.length > 0) {
        id = results[0].UserID;
        fn = results[0].fn;
        ln = results[0].ln;
    }
    var ret = { id: id, firstName: fn, lastName: ln, error: '' };
    res.status(200).json(ret);
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
