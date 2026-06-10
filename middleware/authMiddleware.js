import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {

  try {
    // Allow CORS preflight requests through without authentication
    if (req.method === 'OPTIONS') return next();

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.admin = decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      message: "Invalid token"
    });
  }
};

export default authMiddleware;