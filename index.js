const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");

// Load environment variables from .env file
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
const decodedKey = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pkaqrby.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
    }
});

let articlesCollection, usersCollection, publishersCollection;

async function verifyFirebaseToken(req, res, next) {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized Token" })
    }
    const idToken = authHeader.split(' ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next()
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" })
    }
}

async function run() {
    try {
        // Connect the client to the server
        // await client.connect();

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // Initialize collections (GLOBAL)
        const db = client.db("newspaperDB");
        articlesCollection = db.collection("articles");
        usersCollection = db.collection("users");
        publishersCollection = db.collection("publishers");


    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}
run().catch(console.dir);

// ================== ARTICLE ROUTES ================== //

// Backend route for filtered articles
app.get('/articles', async (req, res) => {
    try {
        let query = { status: 'approved' };

        // Search by title
        if (req.query.search) {
            query.title = { $regex: req.query.search, $options: 'i' };
        }

        // Filter by publisher
        if (req.query.publisher) {
            query.publisher = req.query.publisher;
        }

        // Filter by tags
        if (req.query.tags) {
            const tagsArray = req.query.tags.split(',');
            query.tags = { $in: tagsArray };
        }

        const articles = await articlesCollection.find(query).toArray();
        res.send(articles);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Add a new endpoint to get all unique publishers for filter dropdown
app.get('/publishers', async (req, res) => {
    try {
        if (!articlesCollection) {
            return res.status(500).send({ message: "Database not initialized yet" });
        }

        const publishers = await articlesCollection.distinct("publisher", { status: 'approved' });
        res.send(publishers);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

app.get('/tags', async (req, res) => {
    try {
        if (!articlesCollection) {
            return res.status(500).send({ message: "Database not initialized yet" });
        }

        const tags = await articlesCollection.distinct("tags", { status: 'approved' });

        const normalizedTags = tags
            .filter(Boolean)
            .flatMap(tag => Array.isArray(tag) ? tag : [tag]);

        const uniqueTags = [...new Set(normalizedTags)];
        res.send(uniqueTags);
    } catch (error) {
        console.error("Tags API Error:", error);
        res.status(500).send({ message: error.message });
    }
});


// ================== ARTICLE DETAILS ROUTE ================== //
app.get('/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid article ID" });
        }

        const article = await articlesCollection.findOne({
            _id: new ObjectId(id),
            status: 'approved'
        });

        if (!article) {
            return res.status(404).send({ message: "Article not found" });
        }


        await articlesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { views: 1 } }
        )

        res.send(article);

    } catch (error) {
        console.error('Article details error:', error);
        res.status(500).send({ message: error.message });
    }
});
// articles  add 
app.post('/articles', verifyFirebaseToken, async (req, res) => {
    try {
        const { title, image, publisher, tags, description } = req.body;

        // Validation
        if (!title || !image || !publisher || !tags || !description) {
            return res.status(400).send({ message: "All fields are required" });
        }

        const article = {
            title,
            image,
            publisher,
            tags: Array.isArray(tags) ? tags : [tags],
            description,
            status: 'pending', // Admin approve korbe
            author: req.user.email,
            authorId: req.user.uid,
            createdAt: new Date(),
            views: 0,
            isPremium: false
        };

        const result = await articlesCollection.insertOne(article);
        res.status(201).send({
            message: "Article submitted successfully! Waiting for admin approval.",
            articleId: result.insertedId
        });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Get user's articles with decline reason
app.get('/my-articles', verifyFirebaseToken, async (req, res) => {
    try {
        const articles = await articlesCollection.find({
            authorId: req.user.uid
        }).sort({ createdAt: -1 }).toArray();

        res.send(articles);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Delete article
app.delete('/article/:id', verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid article ID" });
        }

        const article = await articlesCollection.findOne({
            _id: new ObjectId(id),
            authorId: req.user.uid
        });

        if (!article) {
            return res.status(404).send({ message: "Article not found" });
        }

        // Only allow delete if article is pending or declined
        if (article.status === 'approved') {
            return res.status(400).send({ message: "Cannot delete approved articles" });
        }

        await articlesCollection.deleteOne({ _id: new ObjectId(id) });
        res.send({ message: "Article deleted successfully" });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// Update article
app.put('/articles/:id', verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, tags } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid article ID" });
        }

        const article = await articlesCollection.findOne({
            _id: new ObjectId(id),
            authorId: req.user.uid
        });

        if (!article) {
            return res.status(404).send({ message: "Article not found" });
        }

        // Only allow update if article is pending or declined
        if (article.status === 'approved') {
            return res.status(400).send({ message: "Cannot update approved articles" });
        }

        const updateData = {
            title,
            description,
            tags: Array.isArray(tags) ? tags : [tags],
            updatedAt: new Date()
        };

        await articlesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        res.send({ message: "Article updated successfully" });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});


// Get article by ID (details view)
app.get('/my-article/:id', verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid article ID" });
        }

        const article = await articlesCollection.findOne({
            _id: new ObjectId(id),
            authorId: req.user.uid
        });

        if (!article) {
            return res.status(404).send({ message: "Article not found" });
        }

        res.send(article);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});
// app.get('/articles/trending', async (req, res) => {
//     try {
//         if (!articlesCollection) {
//             return res.status(500).send({ message: "Database not initialized yet" });
//         }

//         const articles = await articlesCollection.find({ status: 'approved' })
//             .sort({ views: -1 })
//             .limit(6)
//             .toArray();
//         res.send(articles);
//     } catch (error) {
//         res.status(500).send({ message: error.message });
//     }
// });



// Sample route
app.get('/', (req, res) => {
    res.send('Newspaper FullStack Server is running smoothly!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is up and running on port ${port}`);
});