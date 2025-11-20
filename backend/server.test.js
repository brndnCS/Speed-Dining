// server.test.js
const request = require('supertest');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

// 1. Mock external dependencies before requiring server.js
jest.mock('mongodb');
jest.mock('axios');
jest.mock('nodemailer');
// We don't strictly need to mock bcryptjs, but it speeds up tests
jest.mock('bcryptjs', () => ({
  hashSync: jest.fn(() => 'hashed_password'),
  compare: jest.fn(() => Promise.resolve(true)), // Default to true match
}));

// Mock Nodemailer transporter
const sendMailMock = jest.fn().mockResolvedValue(true);
nodemailer.createTransport.mockReturnValue({
  sendMail: sendMailMock,
});

// 2. Setup MongoDB Mocks
const mockDb = {
  collection: jest.fn(),
};
const mockClient = {
  connect: jest.fn().mockResolvedValue(true),
  db: jest.fn().mockReturnValue(mockDb),
  close: jest.fn(),
};
MongoClient.mockImplementation(() => mockClient);

// 3. Import the app AFTER mocks are set up
// Ensure process.env.NODE_ENV is 'test' to prevent server.js from auto-starting
process.env.NODE_ENV = 'test';
const app = require('./server'); // Adjust path if server.js is elsewhere

describe('Server API Tests', () => {
  // Reset mocks before each test to ensure clean state
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/ping', () => {
    it('should return 200 and Hello World', async () => {
      const res = await request(app).get('/api/ping');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: 'Hello World' });
    });
  });

  describe('POST /api/login', () => {
    it('should return 200 for valid verified user', async () => {
      // Mock finding a user
      const mockUser = {
        UserID: 1,
        Login: 'testUser',
        LoginLower: 'testuser',
        Password: 'hashed_password',
        FirstName: 'John',
        LastName: 'Doe',
        IsVerified: true,
      };
      
      const findOneMock = jest.fn().mockResolvedValue(mockUser);
      mockDb.collection.mockReturnValue({ findOne: findOneMock });
      
      // Force bcrypt compare to return true
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/login')
        .send({ login: 'testUser', password: 'password123' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        error: ''
      });
    });

    it('should return 401 for invalid password', async () => {
      const mockUser = {
        UserID: 1,
        Login: 'testUser',
        Password: 'hashed_password',
        IsVerified: true,
      };
      
      const findOneMock = jest.fn().mockResolvedValue(mockUser);
      mockDb.collection.mockReturnValue({ findOne: findOneMock });
      
      // Force bcrypt compare to return false
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/login')
        .send({ login: 'testUser', password: 'wrongpassword' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Invalid login or password');
    });

    it('should return 403 if user is not verified', async () => {
      const mockUser = {
        UserID: 1,
        Login: 'testUser',
        Password: 'hashed_password',
        IsVerified: false, // Not verified
      };
      
      const findOneMock = jest.fn().mockResolvedValue(mockUser);
      mockDb.collection.mockReturnValue({ findOne: findOneMock });
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/login')
        .send({ login: 'testUser', password: 'password123' });

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toContain('verify your email');
    });
  });

  describe('POST /api/signup', () => {
    it('should create a new user and send verification email', async () => {
      // Mock collections
      const usersCollection = {
        findOne: jest.fn().mockResolvedValue(null), // User doesn't exist
        insertOne: jest.fn().mockResolvedValue({ insertedId: 'new_id' }),
      };
      const countersCollection = {
        // Simulate getNextSeq logic
        findOneAndUpdate: jest.fn().mockResolvedValue({ value: { seq: 101 } }),
      };

      // Router mocks to collections based on name
      mockDb.collection.mockImplementation((name) => {
        if (name === 'Users') return usersCollection;
        if (name === 'Counters') return countersCollection;
        return { findOne: jest.fn() };
      });

      const res = await request(app)
        .post('/api/signup')
        .send({
          login: 'newUser',
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Doe',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.id).toBe(101);
      expect(usersCollection.insertOne).toHaveBeenCalled();
      expect(sendMailMock).toHaveBeenCalled(); // Check if email was sent
    });

    it('should return 409 if user already exists', async () => {
      const usersCollection = {
        findOne: jest.fn().mockResolvedValue({ Login: 'existingUser' }),
      };
      mockDb.collection.mockReturnValue(usersCollection);

      const res = await request(app)
        .post('/api/signup')
        .send({
          login: 'existingUser',
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Doe',
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('User already exists');
    });
  });

  describe('GET /api/verify-email', () => {
    it('should verify user successfully', async () => {
      const usersCollection = {
        findOne: jest.fn().mockResolvedValue({ 
            _id: 'some_id', 
            VerificationToken: 'valid_token',
            VerificationTokenExpires: new Date(Date.now() + 100000) // Future date
        }),
        updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      };
      mockDb.collection.mockReturnValue(usersCollection);

      const res = await request(app).get('/api/verify-email?token=valid_token');

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Email verified');
      expect(usersCollection.updateOne).toHaveBeenCalledWith(
        { _id: 'some_id' },
        expect.objectContaining({ $set: { IsVerified: true } })
      );
    });

    it('should return 400 for invalid token', async () => {
        const usersCollection = {
          findOne: jest.fn().mockResolvedValue(null), // Not found
        };
        mockDb.collection.mockReturnValue(usersCollection);
  
        const res = await request(app).get('/api/verify-email?token=invalid');
        expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/recommendations', () => {
    it('should return shuffled restaurants from Google API', async () => {
      // Mock Axios response
      const googleResponse = {
        data: {
          results: [
            { name: 'Rest A', place_id: '1' },
            { name: 'Rest B', place_id: '2' },
            { name: 'Rest C', place_id: '3' },
          ],
        },
      };
      axios.get.mockResolvedValue(googleResponse);

      const res = await request(app)
        .post('/api/recommendations')
        .send({
          latitude: 30.0,
          longitude: -80.0,
          cuisine: 'Italian',
          price: '2'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.results).toBeDefined();
      expect(res.body.results.length).toBe(3);
      expect(axios.get).toHaveBeenCalledTimes(1);
      // Verify URL parameters were constructed correctly
      const calledUrl = axios.get.mock.calls[0][0];
      expect(calledUrl).toContain('location=30,-80');
      expect(calledUrl).toContain('keyword=Italian');
      expect(calledUrl).toContain('maxprice=2');
    });

    it('should return 400 if lat/long missing', async () => {
        const res = await request(app).post('/api/recommendations').send({});
        expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/saveRestaurant', () => {
    it('should save restaurant to DB', async () => {
      const savedCollection = {
        insertOne: jest.fn().mockResolvedValue({ insertedId: 'doc_123' }),
      };
      mockDb.collection.mockReturnValue(savedCollection);

      const payload = {
        userId: 1,
        restaurant: {
            place_id: 'pid_1',
            name: 'Tasty Place',
            vicinity: '123 St',
            rating: 4.5
        }
      };

      const res = await request(app).post('/api/saveRestaurant').send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.id).toBe('doc_123');
      expect(savedCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
          UserId: 1,
          Name: 'Tasty Place'
      }));
    });
  });

  describe('POST /api/rateRestaurant', () => {
    it('should update user rating', async () => {
        const savedCollection = {
            updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
        };
        mockDb.collection.mockReturnValue(savedCollection);

        const res = await request(app)
            .post('/api/rateRestaurant')
            .send({ userId: 1, placeId: 'pid_1', rating: 5 });

        expect(res.statusCode).toBe(200);
        expect(savedCollection.updateOne).toHaveBeenCalled();
    });

    it('should return 404 if restaurant not found in saved list', async () => {
        const savedCollection = {
            updateOne: jest.fn().mockResolvedValue({ matchedCount: 0 }),
        };
        mockDb.collection.mockReturnValue(savedCollection);

        const res = await request(app)
            .post('/api/rateRestaurant')
            .send({ userId: 1, placeId: 'pid_1', rating: 5 });

        expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/myRestaurants', () => {
    it('should return list of saved restaurants', async () => {
        const mockData = [{ Name: 'A' }, { Name: 'B' }];
        const savedCollection = {
            find: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue(mockData)
            }),
        };
        mockDb.collection.mockReturnValue(savedCollection);

        const res = await request(app)
            .post('/api/myRestaurants')
            .send({ userId: 1 });

        expect(res.statusCode).toBe(200);
        expect(res.body.results).toEqual(mockData);
    });
  });

  describe('POST /api/deleteRestaurant', () => {
      it('should delete restaurant successfully', async () => {
          const savedCollection = {
              deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
          };
          mockDb.collection.mockReturnValue(savedCollection);

          const res = await request(app)
            .post('/api/deleteRestaurant')
            .send({ userId: 1, placeId: 'pid_1' });
          
          expect(res.statusCode).toBe(200);
          expect(savedCollection.deleteOne).toHaveBeenCalled();
      });
  });

  describe('GET /api/photo', () => {
      it('should redirect to google photo url', async () => {
          // Ensure ENV key is mocked for this test if undefined
          process.env.GOOGLE_MAPS_API_KEY = 'MOCK_KEY';
          
          const res = await request(app).get('/api/photo?ref=photoreference123');
          expect(res.statusCode).toBe(302); // Redirect status
          expect(res.headers.location).toContain('maps.googleapis.com');
          expect(res.headers.location).toContain('photo_reference=photoreference123');
      });

      it('should return 400 if ref is missing', async () => {
        const res = await request(app).get('/api/photo');
        expect(res.statusCode).toBe(400);
      });
  });
});