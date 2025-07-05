import express, { Router } from 'express';
import { createPoll } from '../../controllers/pollController';

const router: Router = express.Router();

router.post('/polls', createPoll);

export default router;