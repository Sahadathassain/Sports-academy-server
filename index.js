require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");

const app = express();

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());
app.use(express.json());

/* =========================================================
   ENVIRONMENT VARIABLES
========================================================= */

if (!process.env.DB_USER || !process.env.DB_PASS) {
  console.error(
    "Missing DB_USER or DB_PASS in environment variables."
  );

  process.exit(1);
}

/* =========================================================
   MONGODB CONNECTION
========================================================= */

const username = encodeURIComponent(
  process.env.DB_USER
);

const password = encodeURIComponent(
  process.env.DB_PASS
);

const uri = `mongodb+srv://${username}:${password}@cluster0.dmwoexh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },

  serverSelectionTimeoutMS: 15000,
});

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

let initialized = false;
let initializationPromise = null;

async function initializeDatabase() {
  if (initialized) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        /* ---------------------------------------------------
           CONNECT MONGODB
        --------------------------------------------------- */

        await client.connect();

        await client
          .db("admin")
          .command({ ping: 1 });

        console.log(
          "MongoDB connected successfully!"
        );

        /* ---------------------------------------------------
           DATABASE
        --------------------------------------------------- */

        const db = client.db("sportsDb");

        /* ---------------------------------------------------
           COLLECTIONS
        --------------------------------------------------- */

        const SportCollection =
          db.collection("sports");

        const usersCollection =
          db.collection("users");

        const classesCollection =
          db.collection("classes");

        const selectedClassesCollection =
          db.collection("selectedClasses");

        const enrolledClassesCollection =
          db.collection("enrolledClasses");

        /* ===================================================
           USER PROFILE
        =================================================== */

        app.patch(
          "/users/profile/:email",
          async (req, res) => {
            try {
              const email = decodeURIComponent(
                req.params.email
              ).toLowerCase();

              const {
                name,
                phone,
                address,
              } = req.body;

              const result =
                await usersCollection.updateOne(
                  { email },
                  {
                    $set: {
                      name: name || "",
                      phone: phone || "",
                      address: address || "",
                    },
                  }
                );

              if (result.matchedCount === 0) {
                return res.status(404).json({
                  message: "User not found",
                });
              }

              return res.status(200).json({
                message:
                  "Profile updated successfully",
                result,
              });
            } catch (error) {
              console.error(
                "Profile update error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to update profile",
                error: error.message,
              });
            }
          }
        );

        /* ===================================================
           USERS
        =================================================== */

        /* ---------------------------------------------------
           CREATE USER
        --------------------------------------------------- */

        app.post(
          "/users",
          async (req, res) => {
            try {
              const user = req.body;

              if (!user.email) {
                return res.status(400).json({
                  message:
                    "Email is required",
                });
              }

              const email =
                user.email.toLowerCase();

              const existingUser =
                await usersCollection.findOne({
                  email,
                });

              if (existingUser) {
                return res.status(200).json({
                  message:
                    "User already exists",
                  existingUser: true,
                  user: existingUser,
                });
              }

              const newUser = {
                ...user,
                email,

                /*
                 * Public registration should create
                 * students only.
                 */
                role: "student",

                createdAt:
                  user.createdAt ||
                  new Date(),
              };

              const result =
                await usersCollection.insertOne(
                  newUser
                );

              return res.status(201).json({
                message: "User created",
                result,
              });
            } catch (error) {
              console.error(
                "Create user error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to add user",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           GET ALL USERS
        --------------------------------------------------- */

        app.get(
          "/users",
          async (req, res) => {
            try {
              const result =
                await usersCollection
                  .find({})
                  .sort({
                    createdAt: -1,
                  })
                  .toArray();

              return res.status(200).json(
                result
              );
            } catch (error) {
              console.error(
                "Fetch users error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to fetch users",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           GET USER ROLE
        --------------------------------------------------- */

        app.get(
          "/users/role/:email",
          async (req, res) => {
            try {
              const email =
                decodeURIComponent(
                  req.params.email
                ).toLowerCase();

              const user =
                await usersCollection.findOne({
                  email,
                });

              if (!user) {
                return res.status(404).json({
                  error:
                    "User not found",
                });
              }

              return res.status(200).json({
                role:
                  user.role ||
                  "student",
              });
            } catch (error) {
              console.error(
                "Get role error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to get user role",
                error: error.message,
              });
            }
          }
        );

        /* ===================================================
           ROLE MANAGEMENT
           
           ADMIN IS FIXED.
           
           Allowed:
           Student -> Instructor
           Instructor -> Student
           
           Not allowed:
           Student -> Admin
           Instructor -> Admin
           Admin -> Student
           Admin -> Instructor
        =================================================== */

        /* ---------------------------------------------------
           STUDENT -> INSTRUCTOR
        --------------------------------------------------- */

        app.patch(
          "/users/make-instructor/:email",
          async (req, res) => {
            try {
              const email =
                decodeURIComponent(
                  req.params.email
                ).toLowerCase();

              const user =
                await usersCollection.findOne({
                  email,
                });

              if (!user) {
                return res.status(404).json({
                  message:
                    "User not found",
                });
              }

              if (user.role === "admin") {
                return res.status(403).json({
                  message:
                    "Admin role cannot be changed.",
                });
              }

              if (user.role !== "student") {
                return res.status(400).json({
                  message:
                    "Only a student can be changed to instructor.",
                });
              }

              const result =
                await usersCollection.updateOne(
                  { email },
                  {
                    $set: {
                      role: "instructor",
                    },
                  }
                );

              return res.status(200).json({
                message:
                  "User role changed to instructor",
                result,
              });
            } catch (error) {
              console.error(
                "Instructor role error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to update user role",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           INSTRUCTOR -> STUDENT
        --------------------------------------------------- */

        app.patch(
          "/users/make-student/:email",
          async (req, res) => {
            try {
              const email =
                decodeURIComponent(
                  req.params.email
                ).toLowerCase();

              const user =
                await usersCollection.findOne({
                  email,
                });

              if (!user) {
                return res.status(404).json({
                  message:
                    "User not found",
                });
              }

              if (user.role === "admin") {
                return res.status(403).json({
                  message:
                    "Admin role cannot be changed.",
                });
              }

              if (user.role !== "instructor") {
                return res.status(400).json({
                  message:
                    "Only an instructor can be changed to student.",
                });
              }

              const result =
                await usersCollection.updateOne(
                  { email },
                  {
                    $set: {
                      role: "student",
                    },
                  }
                );

              return res.status(200).json({
                message:
                  "User role changed to student",
                result,
              });
            } catch (error) {
              console.error(
                "Student role error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to update user role",
                error: error.message,
              });
            }
          }
        );

        /* ===================================================
           SPORTS
        =================================================== */

        /* ---------------------------------------------------
           GET ALL SPORTS
        --------------------------------------------------- */

        app.get(
          "/allData",
          async (req, res) => {
            try {
              const result =
                await SportCollection
                  .find({})
                  .toArray();

              return res.status(200).json(
                result
              );
            } catch (error) {
              console.error(
                "Sports fetch error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to fetch data",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           GET SPORT BY ID
        --------------------------------------------------- */

        app.get(
          "/allData/:id",
          async (req, res) => {
            try {
              const { id } =
                req.params;

              if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                  message:
                    "Invalid ID",
                });
              }

              const result =
                await SportCollection.findOne({
                  _id: new ObjectId(id),
                });

              if (!result) {
                return res.status(404).json({
                  message:
                    "Sport not found",
                });
              }

              return res.status(200).json(
                result
              );
            } catch (error) {
              console.error(
                "Sport details error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to retrieve sport",
                error: error.message,
              });
            }
          }
        );

        /* ===================================================
           CLASSES
        =================================================== */

        /* ---------------------------------------------------
           ADD CLASS
        --------------------------------------------------- */

        app.post(
          "/addClass",
          async (req, res) => {
            try {
              const classData =
                req.body;

              if (!classData.name) {
                return res.status(400).json({
                  message:
                    "Class name is required",
                });
              }

              const newClass = {
                ...classData,

                availableSeats:
                  Number(
                    classData.availableSeats ||
                      0
                  ),

                price:
                  Number(
                    classData.price || 0
                  ),

                status: "pending",

                enrolledStudents: [],

                createdAt: new Date(),
              };

              const result =
                await classesCollection.insertOne(
                  newClass
                );

              return res.status(201).json({
                message:
                  "Class submitted successfully",
                result,
              });
            } catch (error) {
              console.error(
                "Add class error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to add class",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           GET ALL CLASSES
        --------------------------------------------------- */

        app.get(
          "/classes",
          async (req, res) => {
            try {
              const result =
                await classesCollection
                  .find({
                    deleted: {
                      $ne: true,
                    },
                  })
                  .sort({
                    createdAt: -1,
                  })
                  .toArray();

              return res.status(200).json(
                result
              );
            } catch (error) {
              console.error(
                "Fetch classes error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to fetch classes",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           UPDATE CLASS
        --------------------------------------------------- */

        app.patch(
          "/classes/:id",
          async (req, res) => {
            try {
              const { id } =
                req.params;

              if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                  message:
                    "Invalid class ID",
                });
              }

              const updateData = {
                ...req.body,
                updatedAt: new Date(),
              };

              const result =
                await classesCollection.updateOne(
                  {
                    _id: new ObjectId(id),
                  },
                  {
                    $set: updateData,
                  }
                );

              return res.status(200).json({
                message:
                  "Class updated successfully",
                result,
              });
            } catch (error) {
              console.error(
                "Update class error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to update class",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           APPROVE CLASS
        --------------------------------------------------- */

        app.patch(
          "/classes/approve/:id",
          async (req, res) => {
            try {
              const { id } =
                req.params;

              if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                  message:
                    "Invalid class ID",
                });
              }

              const result =
                await classesCollection.updateOne(
                  {
                    _id: new ObjectId(id),
                  },
                  {
                    $set: {
                      status: "approved",
                      approvedAt: new Date(),
                    },
                  }
                );

              return res.status(200).json({
                message:
                  "Class approved successfully",
                result,
              });
            } catch (error) {
              console.error(
                "Approve class error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to approve class",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           DENY CLASS
        --------------------------------------------------- */

        app.patch(
          "/classes/deny/:id",
          async (req, res) => {
            try {
              const { id } =
                req.params;

              if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                  message:
                    "Invalid class ID",
                });
              }

              const result =
                await classesCollection.updateOne(
                  {
                    _id: new ObjectId(id),
                  },
                  {
                    $set: {
                      status: "denied",
                      feedback:
                        req.body.feedback ||
                        "",
                      deniedAt: new Date(),
                    },
                  }
                );

              return res.status(200).json({
                message:
                  "Class denied successfully",
                result,
              });
            } catch (error) {
              console.error(
                "Deny class error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to deny class",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           UPDATE FEEDBACK
        --------------------------------------------------- */

        app.patch(
          "/classes/feedback/:id",
          async (req, res) => {
            try {
              const { id } =
                req.params;

              if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                  message:
                    "Invalid class ID",
                });
              }

              const result =
                await classesCollection.updateOne(
                  {
                    _id: new ObjectId(id),
                  },
                  {
                    $set: {
                      feedback:
                        req.body.feedback ||
                        "",
                      updatedAt:
                        new Date(),
                    },
                  }
                );

              return res.status(200).json({
                message:
                  "Feedback updated successfully",
                result,
              });
            } catch (error) {
              console.error(
                "Feedback update error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to update feedback",
                error: error.message,
              });
            }
          }
        );

        /* ===================================================
           SELECTED CLASSES
        =================================================== */

        /* ---------------------------------------------------
           ADD SELECTED CLASS
        --------------------------------------------------- */

        app.post(
          "/selectedclasses",
          async (req, res) => {
            try {
              const data = req.body;

              if (
                !data.studentEmail ||
                !data.classId
              ) {
                return res.status(400).json({
                  message:
                    "Student email and class ID are required",
                });
              }

              const existing =
                await selectedClassesCollection.findOne(
                  {
                    studentEmail:
                      data.studentEmail,
                    classId:
                      data.classId,
                  }
                );

              if (existing) {
                return res.status(409).json({
                  message:
                    "Class already selected",
                });
              }

              const result =
                await selectedClassesCollection.insertOne(
                  {
                    ...data,
                    createdAt:
                      new Date(),
                  }
                );

              return res.status(201).json({
                message:
                  "Class selected successfully",
                result,
              });
            } catch (error) {
              console.error(
                "Selected class error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to select class",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           GET ALL SELECTED CLASSES
        --------------------------------------------------- */

        app.get(
          "/selectedclasses",
          async (req, res) => {
            try {
              const result =
                await selectedClassesCollection
                  .find({})
                  .sort({
                    createdAt: -1,
                  })
                  .toArray();

              return res.status(200).json(
                result
              );
            } catch (error) {
              console.error(
                "Selected classes error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to fetch selected classes",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           GET SELECTED CLASSES BY STUDENT
        --------------------------------------------------- */

        app.get(
          "/selectedclasses/:email",
          async (req, res) => {
            try {
              const email =
                decodeURIComponent(
                  req.params.email
                ).toLowerCase();

              const result =
                await selectedClassesCollection
                  .find({
                    studentEmail:
                      email,
                  })
                  .sort({
                    createdAt: -1,
                  })
                  .toArray();

              return res.status(200).json(
                result
              );
            } catch (error) {
              console.error(
                "Student selected classes error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to fetch selected classes",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           DELETE SELECTED CLASS
        --------------------------------------------------- */

        app.delete(
          "/selectedclasses/:id",
          async (req, res) => {
            try {
              const { id } =
                req.params;

              if (!ObjectId.isValid(id)) {
                return res.status(400).json({
                  message:
                    "Invalid selected class ID",
                });
              }

              const result =
                await selectedClassesCollection.deleteOne(
                  {
                    _id: new ObjectId(id),
                  }
                );

              return res.status(200).json({
                message:
                  "Selected class removed",
                result,
              });
            } catch (error) {
              console.error(
                "Delete selected class error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to delete selected class",
                error: error.message,
              });
            }
          }
        );

        /* ===================================================
           ENROLLMENTS
        =================================================== */

        /* ---------------------------------------------------
           CREATE ENROLLMENT
        --------------------------------------------------- */

        app.post(
          "/enrollments",
          async (req, res) => {
            try {
              const {
                studentEmail,
                studentName,
                classId,
                className,
                category,
                instructor,
                instructorEmail,
                price,
                paymentMethod,
                paymentStatus,
              } = req.body;

              if (
                !studentEmail ||
                !classId ||
                !className
              ) {
                return res.status(400).json({
                  message:
                    "Student email, class ID and class name are required",
                });
              }

              const normalizedEmail =
                studentEmail.toLowerCase();

              /* ---------------------------------------------
                 CHECK DUPLICATE
              --------------------------------------------- */

              const existingEnrollment =
                await enrolledClassesCollection.findOne(
                  {
                    studentEmail:
                      normalizedEmail,
                    classId,
                  }
                );

              if (existingEnrollment) {
                return res.status(409).json({
                  message:
                    "Student is already enrolled in this class",
                  existingEnrollment,
                });
              }

              /* ---------------------------------------------
                 CREATE ENROLLMENT
              --------------------------------------------- */

              const enrollment = {
                studentEmail:
                  normalizedEmail,

                studentName:
                  studentName || "",

                classId,

                className,

                category:
                  category || "",

                instructor:
                  instructor || "",

                instructorEmail:
                  instructorEmail
                    ? instructorEmail.toLowerCase()
                    : "",

                price:
                  Number(price || 0),

                paymentMethod:
                  paymentMethod ||
                  "demo",

                paymentStatus:
                  paymentStatus ||
                  "paid",

                enrollmentStatus:
                  "active",

                enrolledAt:
                  new Date(),
              };

              const result =
                await enrolledClassesCollection.insertOne(
                  enrollment
                );

              /* ---------------------------------------------
                 UPDATE CLASS SEATS
              --------------------------------------------- */

              if (
                ObjectId.isValid(classId)
              ) {
                await classesCollection.updateOne(
                  {
                    _id:
                      new ObjectId(classId),

                    availableSeats: {
                      $gt: 0,
                    },
                  },
                  {
                    $inc: {
                      availableSeats: -1,
                    },

                    $addToSet: {
                      enrolledStudents:
                        normalizedEmail,
                    },
                  }
                );
              }

              return res.status(201).json({
                message:
                  "Enrollment successful",

                insertedId:
                  result.insertedId,

                enrollment,
              });
            } catch (error) {
              console.error(
                "Enrollment error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to create enrollment",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           GET ALL ENROLLMENTS
        --------------------------------------------------- */

        app.get(
          "/enrollments/all",
          async (req, res) => {
            try {
              const result =
                await enrolledClassesCollection
                  .find({})
                  .sort({
                    enrolledAt: -1,
                  })
                  .toArray();

              return res.status(200).json(
                result
              );
            } catch (error) {
              console.error(
                "All enrollments error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to fetch enrollments",
                error: error.message,
              });
            }
          }
        );

        /* ---------------------------------------------------
           GET ENROLLMENTS BY STUDENT
        --------------------------------------------------- */

        app.get(
          "/enrollments/:email",
          async (req, res) => {
            try {
              const email =
                decodeURIComponent(
                  req.params.email
                ).toLowerCase();

              const result =
                await enrolledClassesCollection
                  .find({
                    studentEmail:
                      email,
                  })
                  .sort({
                    enrolledAt: -1,
                  })
                  .toArray();

              return res.status(200).json(
                result
              );
            } catch (error) {
              console.error(
                "Student enrollments error:",
                error
              );

              return res.status(500).json({
                message:
                  "Failed to fetch enrollments",
                error: error.message,
              });
            }
          }
        );

        /* ===================================================
           HEALTH CHECK
        =================================================== */

        app.get(
          "/",
          (req, res) => {
            return res
              .status(200)
              .send(
                "Sports Academy server is running"
              );
          }
        );

        /* ===================================================
           GLOBAL 404
        =================================================== */

        app.use(
          (req, res) => {
            return res.status(404).json({
              message:
                "Route not found",
              path: req.originalUrl,
            });
          }
        );

        initialized = true;

        console.log(
          "Sports Academy API routes loaded"
        );
      } catch (error) {
        console.error(
          "MongoDB initialization failed:",
          error
        );

        initializationPromise = null;

        throw error;
      }
    })();
  }

  return initializationPromise;
}

/* =========================================================
   VERCEL SERVERLESS HANDLER
========================================================= */

module.exports = async (req, res) => {
  try {
    await initializeDatabase();

    return app(req, res);
  } catch (error) {
    console.error(
      "Server initialization error:",
      error
    );

    return res.status(500).json({
      message:
        "Server initialization failed",
      error: error.message,
    });
  }
};