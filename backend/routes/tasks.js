const express = require('express');
const router = express.Router();
const {
    getTasks, createTask, updateTask,
    deleteTask, getTask, addComment
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/project/:projectId', getTasks);
router.post('/project/:projectId', createTask);
router.get('/:id', getTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/comments', addComment);

module.exports = router;
