const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// MongoDB Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const taskSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed'],
            default: 'Pending',
        },
        dueDate: { type: Date, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link task to a specific user
    },
    { timestamps: true }
);

// Models
const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);

// JWT Secret Key
const JWT_SECRET = 'your_secret_key';

// Authentication Middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// **Root Route for "/"**
app.get('/', (req, res) => {
    res.send('Welcome to the Task Manager API');
});

// Routes: User Authentication
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error creating user', error: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    } catch (err) {
        res.status(500).json({ message: 'Error logging in', error: err.message });
    }
});

// Routes: Task Management
app.post('/tasks', authenticate, async (req, res) => {
    const { title, description, status, dueDate } = req.body;

    try {
        const newTask = new Task({
            title,
            description,
            status,
            dueDate,
            userId: req.userId,
        });
        await newTask.save();
        res.status(201).json({ message: 'Task created successfully', task: newTask });
    } catch (err) {
        res.status(500).json({ message: 'Error creating task', error: err.message });
    }
});

app.get('/tasks', authenticate, async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.userId });
        res.json({ success: true, tasks });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching tasks', error: err.message });
    }
});

app.get('/tasks/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    try {
        const task = await Task.findById(id);
        if (!task || task.userId.toString() !== req.userId)
            return res.status(404).json({ message: 'Task not found' });

        res.json({ success: true, task });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching task', error: err.message });
    }
});

app.put('/tasks/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { title, description, status, dueDate } = req.body;

    try {
        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, userId: req.userId },
            { title, description, status, dueDate },
            { new: true, runValidators: true }
        );

        if (!updatedTask)
            return res.status(404).json({ message: 'Task not found or unauthorized' });

        res.json({ message: 'Task updated successfully', task: updatedTask });
    } catch (err) {
        res.status(500).json({ message: 'Error updating task', error: err.message });
    }
});

app.delete('/tasks/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    try {
        const deletedTask = await Task.findOneAndDelete({ _id: id, userId: req.userId });

        if (!deletedTask)
            return res.status(404).json({ message: 'Task not found or unauthorized' });

        res.json({ message: 'Task deleted successfully', task: deletedTask });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting task', error: err.message });
    }
});

// Connect to MongoDB
mongoose
    .connect('mongodb://localhost:27017/taskmanager')
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(6080, () => console.log('Server is running on port 6080'));
    })
    .catch((err) => console.log('DB connection error:', err));
