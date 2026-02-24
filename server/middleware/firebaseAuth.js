// server/middleware/firebaseAuth.js
const admin = require('../firebaseAdmin');

// 👇 REPLACE THIS WITH YOUR REAL EMAIL 👇
const ADMIN_EMAILS = ['roybhaihai2000@gmail.com'];
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  // DEBUG LOG: Tell us if the header arrived
  console.log('--- Auth Debug ---');
  console.log('1. Header received:', authHeader ? 'Yes' : 'NO HEADER');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('2. Result: REJECTED (No Bearer token)');
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const idToken = authHeader.split(' ')[1];
  console.log('2. Token snippet:', idToken.substring(0, 10) + '...');
  
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    
    // Check if user is in our hardcoded Admin list OR has a Firebase custom claim
    const isAdmin = ADMIN_EMAILS.includes(decoded.email) || !!decoded.admin;

    console.log(`3. Result: SUCCESS for ${decoded.email} (Admin: ${isAdmin})`);
    
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      isAdmin: isAdmin 
    };
    
    next();
  } catch (err) {
    console.log('3. Result: FAILED verification');
    console.error('   Error details:', err.message);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};
const adminOnly = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin privileges required' });
  }
};

module.exports = { verifyToken, adminOnly };