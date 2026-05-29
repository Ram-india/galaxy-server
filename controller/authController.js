import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

// Register Admin

export const registerAdmin = async (req, res) =>{
    try{
        const {username, email, password} = req.body;
        // check if admin already exist
        const exsitingAdmin = await Admin.findOne({email});
        if(exsitingAdmin){
            return res.status(400).json({message:"User already exists"});
        }
        // Hash Password

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // create new admin
        const admin = await Admin.create({
            username,
            email,
            password:hashedPassword

        });
        await admin.save();

        res.status(201).json({message:" Admin Register succesfully", admin});

    }catch(error){
        console.error("Error registering admin", error);
        res.status(500).json({message:"Server Error"});
    }
};

// Login Admin


export const loginAdmin = async(req, res) => {
    try{
        const { email, password } = req.body;

        // Check if admin exists
        const admin = await Admin.findOne({ email });
        if(!admin){
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if(!isMatch){
            return res.status(400).json(
                { message: "Invalid credentials" }
            );
        }
        // Generate JWT token
        const token = jwt.sign(
            {
             id: admin._id 
            }, 
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(200).json({ 
            message: "Admin logged in successfully", 
            admin:{
                id: admin._id,
                username: admin.username,
                email: admin.email
            },
            token 
        });
    } catch (error) {
        console.error("Error logging in admin:", error);
        res.status(500).json({ 
            message: "Server error",
            error: error.message
            });
    }
}

