const express = require('express');
const { registerUser, loginUser, getUserProfile,verifyOtp,resendOtp } = require('../Controllers/TeacherAuthController');

const { authenticateToken } = require('../authMiddleware'); 





const router = express.Router();

router.post('/tSignup', registerUser);
router.post('/tLogin', loginUser);
router.get('/tProfile', authenticateToken, getUserProfile);
router.post('/verify-otp', verifyOtp); 
router.post('/resend-otp', resendOtp);



module.exports = router;