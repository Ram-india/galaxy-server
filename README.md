# GPS Solar Admin Backend

Backend API server for the GPS Solar Admin Panel built using Node.js, Express.js, MongoDB, and JWT Authentication.

---

# 🚀 Tech Stack

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT Authentication
- bcryptjs
- dotenv
- cors
- multer

---

# 📁 Project Structure

```bash id="cv3n9m"
server/
│
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── uploads/
├── .env
├── server.js
└── package.json
```

---

# ✨ Features

- Admin Authentication
- JWT Token Authorization
- Protected Routes
- Solar Project CRUD API
- MongoDB Atlas Integration
- REST API Architecture
- Middleware Authentication
- Error Handling
- Modular Folder Structure

---

# ⚙️ Installation

## Clone Repository

```bash id="2w5vlr"
git clone <repository-url>
```

## Navigate to Server Folder

```bash id="u98xul"
cd server
```

## Install Dependencies

```bash id="f6vqeu"
npm install
```

---

# 🔥 Environment Variables

Create a `.env` file in the root folder.

```env id="p2x08y"
PORT=8000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key
```

---

# ▶️ Run Development Server

```bash id="7lfj0y"
npm run dev
```

Server runs on:

```bash id="klqndj"
http://127.0.0.1:8000
```

---

# 📦 API Base URL

```bash id="i2vq4n"
http://127.0.0.1:8000/api
```

---

# 🔐 Authentication APIs

## Register Admin

```http id="vcc7ee"
POST /api/auth/register
```

### Request Body

```json id="a4gk3v"
{
  "username": "Ram Kumar",
  "email": "ram@gmail.com",
  "password": "123456"
}
```

---

## Login Admin

```http id="0mjlwm"
POST /api/auth/login
```

### Request Body

```json id="2qrbw0"
{
  "email": "ram@gmail.com",
  "password": "123456"
}
```

---

# 📁 Project APIs

## Get All Projects

```http id="2ylf98"
GET /api/projects
```

---

## Create Project

```http id="9r6i2n"
POST /api/projects
```

### Headers

```bash id="l6m4u4"
Authorization: Bearer your_jwt_token
```

### Request Body

```json id="0epu2s"
{
  "projectName": "500KW Solar Plant",
  "clientName": "ABC Industries",
  "capacity": "500KW",
  "location": "Chennai",
  "projectType": "Industrial",
  "status": "Ongoing",
  "description": "Industrial rooftop solar project"
}
```

---

## Update Project

```http id="c9m2y8"
PUT /api/projects/:id
```

---

## Delete Project

```http id="v0syi7"
DELETE /api/projects/:id
```

---

# 🔒 Protected Routes

Protected APIs require JWT token.

Example Header:

```bash id="7h1kwx"
Authorization: Bearer your_token
```

---

# 🛡️ Middleware

## authMiddleware.js

Used for:

- Token verification
- Route protection
- Admin authentication

---

# 🧠 Learning Concepts

This backend project helps in learning:

- REST APIs
- JWT Authentication
- MongoDB CRUD Operations
- MVC Architecture
- Express Middleware
- API Security
- Error Handling
- Backend Folder Structure

---

# 🚀 Future Improvements

- File Upload System
- Role-Based Access Control
- Email Notifications
- Dashboard Analytics APIs
- Project Image Upload
- Pagination & Filtering
- Activity Logs
- Admin Roles

---

# 👨‍💻 Developer

Ram Kumar

MERN Stack Developer

---

# 📄 License

This project is licensed under the MIT Lice