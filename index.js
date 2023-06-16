const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const { ObjectId } = require('mongodb');
// middleware
app.use(cors());
app.use(express.json());

// Secret key used to sign and verify JWT tokens
// const secretKey = process.env.ACCESS_TOKEN_SECRET;

// // Middleware to authenticate JWT tokens
// const authenticateToken = (req, res, next) => {
//   const token = req.headers.authorization?.split(' ')[1];
//   if (token) {
//     jwt.verify(token, secretKey, (err, decodedToken) => {
//       if (err) {
//         return res.sendStatus(403);
//       }
//       req.user = decodedToken;
//       next();
//     });
//   } else {
//     res.sendStatus(401);
//   }
// };

// // Route to generate and return a JWT token
// app.post('/login', (req, res) => {
//   const { username, password } = req.body;
//   // TODO: Implement your own logic to validate the username and password

//   if (username === 'admin' && password === 'password') {
//     const token = jwt.sign({ username }, secretKey);
//     res.json({ token });
//   } else {
//     res.status(401).json({ message: 'Invalid username or password' });
//   }
// });

// // Protected route that requires authentication
// app.get('/protected', authenticateToken, (req, res) => {
//   res.json({ message: 'Protected data', user: req.user });
// });

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vwsamp9.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db('sportsDb');
    const SportCollection = db.collection('sports');
    const usersCollection = db.collection('users');
    const classesCollection= db.collection('classes');
    console.log('Database connected');

    



    app.post('/addClass', async (req, res) => {
      const body = req.body;

      // Insert the class data into your MongoDB collection
      const result = await SportCollection.insertOne(body);
      console.log(result);
      res.send(result);
    });

    app.get("/allData", async (req, res) => {
      const result = await SportCollection.find({}).toArray();
      res.send(result);
    });

    app.get(`/allData/:id`, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await SportCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error('Error retrieving document:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });


    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Endpoint for saving user data
    app.post("/users", (req, res) => {
      const userData = req.body.users;
      users.push(userData);
      res.status(200).json({ message: "User data saved successfully!" });
    });

    // Endpoint for fetching all saved users
    app.get("/users", (req, res) => {
      res.status(200).json(users);
    });


    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch(
      "/users/instructor/:id",

      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "instructor",
          },
        };

        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // class feedback
    app.patch(
      "/classes/feedback/:id",

      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            feedback: req.body.feedback,
          },
        };

        try {
          const result = await SportCollection.updateOne(filter, updateDoc);
          res.send(result);
        } catch (error) {
          console.log("An error occurred:", error);
          res.status(500).send("Error updating class feedback.");
        }
      }
    );



    app.patch("/classes/:id",  async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: req.body,
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    
    app.post("/selectedclasses",  async (req, res) => {
      const classData = req.body;
      const result = await classesCollection.insertOne(classData);
      res.send(result);
    });

    app.get("/selectedclasses",  async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.get(
      "/selectedclasses/:email",

      async (req, res) => {
        const email = req.params.email;
        const result = await classesCollection
          .find({ studentEmail: email })
          .toArray();
        res.send(result);
      }
    );
    app.get(
      "/selectedclasses/id/:id",

      async (req, res) => {
        const result = await classesCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      }
    );
    app.get("/allclass", (req, res) => {
      res.json(classes);
    });





    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('sports is start');
});

app.listen(port, () => {
  console.log(`sports is start on port ${port}`);
});
