import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import projectRoutes from './routes/projectsRoutes.js';


dotenv.config();

const app = express();
// Middle ware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

connectDB();

app.get("/", (req,res)=>{
    res.send({ message:"API Running!"    });
});
app.use('/api/auth',authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);

const PORT = process.env.PORT || 5000 ;

app.listen(PORT, ()=> {
    console.log(`Server RUnning on port ${PORT}`);
});