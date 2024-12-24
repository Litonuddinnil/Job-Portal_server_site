const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

//middle ware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const logger = (req,res,next)=>{
  console.log("inside the logger");
  next();
}

const verifyToken = (req,res,next)=>{
  console.log("Verify this token for the inside middle ware",req.cookies);
  const token = req?.cookies?.token;
  if(!token){
    return res.status(401).send({message: "Unauthorized Access!"})
  }
  jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({message: "Unauthorized Access"});
    }
    req.user = decoded;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.jc89u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // job related collection
    const jobCollection = client.db("jobPortal").collection("jobs");
    const jobApplicationCollection = client.db("jobPortal").collection("application_Job");

    //Auth related apis
    app.post("/jwt",async (req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.JWT_SECRET,{expiresIn:"1hr"});
      res.cookie('token',token,{
        httpOnly:true,
        secure: false , //because i am using localhost when this is production use the web application then it is true otherwise false.

      })
      .send({success: true});
    })
    app.post("/logout", (req,res)=>{
      res.clearCookie('token',{
        httpOnly:true,
        secure:false
      })
      .send({success:true})
    })

    //job related apis
    app.get("/jobAll", async (req, res) => {
      try {
        const email = req.query.email;
        const query = email ? { hr_email: email } : {};
        const jobs = await jobCollection.find(query).toArray();
        res.status(200).send(jobs);
      } catch (error) {
        console.error("Error fetching jobs:", error);
        res
          .status(500)
          .send({ message: "An error occurred while fetching jobs." });
      }
    });

    app.get("/jobs",logger, async (req, res) => {
      console.log('inside the callback')
      const cursor = jobCollection.find();
      const result = await cursor.limit(6).toArray();
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    app.get("/job-application",verifyToken, async (req, res) => {
      // console.log("job application working middle ware ")
      const email = req.query.email;
      const query = { applicant_email: email };
      // console.log("cookies paisi re mamu",req.cookies);
      if(req.user.email !== req.query.email){
        return res.status(403).send({message:"Forbidden Access"})
      }
      const result = await jobApplicationCollection.find(query).toArray();

      //fokira way
      for (const application of result) {
        // console.log(application.job_id);
        const id = application.job_id;
        const query1 = { _id: new ObjectId(id) };
        const job = await jobCollection.findOne(query1);
        if (job) {
          application.company = job.company;
          application.title = job.title;
          application.company_logo = job.company_logo;
        }
      }
      res.send(result);
    });
    app.get("/job-application/jobs/:job_id", async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    app.post("/job-application", async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);
      //Not the best way (user aggregate)
      //skip -> it
      const JobId = application.job_id;
      const query = { _id: new ObjectId(JobId) };
      const job = await jobCollection.findOne(query);
      let newCount = 0;
      if (job.applicationCount) {
        newCount = job.applicationCount + 1;
      } else {
        newCount = 1;
      }
      //now update the doc
      const filter = { _id: new ObjectId(JobId) };
      const updateDoc = {
        $set: {
          applicationCount: newCount,
        },
      };
      const updateResult = await jobCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/job-application/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await jobApplicationCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job portal website backend coming here!");
});

app.listen(port, () => {
  console.log(`Job portal backend read for the port:${port}`);
});
