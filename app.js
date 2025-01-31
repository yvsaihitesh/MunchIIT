const express = require('express');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const flash = require('connect-flash');
const favicon = require('serve-favicon');
const { isLoggedIn , isReviewAuthor } = require('./middleware')
const methodOverride = require('method-override');

const User = require('./models/user');
const Item = require('./models/foodItem');
const Review = require('./models/reviews');
const Cart = require('./models/cart');

const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
mongoose.connect('mongodb://localhost:27017/canteen');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

app.engine('ejs', ejsMate);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const sessionConfig = {
    name: 'session',
    secret: "bettersecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
};
app.use(flash())
app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.currentUser = req.user
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

app.get('/', async (req, res) => {
    try {
        const items = await Item.find({});
        res.render('home', { items }); 
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/register', (req, res) => {
    res.render('users/register');
});

app.get('/cart', async (req, res) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to view your cart.');
        return res.redirect('/login'); 
    }
    console.log("User ID:", req.user._id); 
    try {
        const cart = await Cart.findOne({ user: req.user._id }).populate('items.item');
        if (!cart) {
            return res.render('cart', { cart: { items: [] } });
        }
        res.render('cart', { cart });
    } catch (error) {
        console.error("Error retrieving cart:", error); 
        req.flash('error', 'Failed to retrieve cart.');
        res.redirect('/');
    }
});

app.post('/register', async (req, res, next) => {
    console.log(req.body);
    try {
        const { username, email, password } = req.body;
        const user = new User({ username, email }); 
        const newUser  = await User.register(user, password); 
        const cart = new Cart({ user: newUser ._id, items: [] });
        await cart.save(); 
        req.login(newUser , err => {
            if (err) return next(err);
            res.redirect('/');
        });
    } catch (e) {
        console.error(e); 
        req.flash('error', 'Registration failed. Please try again.');
        res.redirect('/register');
    }
});

app.get('/login', (req, res) => {
    res.render('users/login');
});

app.get('/profile', (req, res) => {
    res.render('profile');
});

app.get('/chat', (req, res) => {
    res.render('chat');
});

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), async (req, res) => {
    console.log("Logged in user ID:", req.user._id); 
    res.redirect('/');
});

// app.get('/:id', async (req, res) => {
//     const id = req.params.id;
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).send('Invalid ID');
//     }
//     const item = await Item.findById(id).populate({
//         path: 'reviews',
//         populate: {
//             path: 'author'
//         }
//     });
//     if (!item) {
//         return res.status(404).send("Item not found");
//     }
//     res.render('item', { item }); 
// });

app.get('/:id', async (req, res) => {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send('Invalid ID');
    }
    const item = await Item.findById(id).populate({
        path: 'reviews',
        populate: {
            path: 'author'
        }
    });
    if (!item) {
        return res.status(404).send("Item not found");
    }
    res.render('item', { item, reviews: item.reviews }); 
});

app.post('/:id/reviews', isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const { rating, body } = req.body.review;
    const existingReview = await Review.findOne({ author: req.user._id, item: id });
    if (existingReview) {
        req.flash('error', 'You have already reviewed this item!');
        return res.redirect(`/${id}`);
    }
    const item = await Item.findById(id);
    const review = new Review({ rating, body, author: req.user._id, item: id });
    item.reviews.push(review);
    try {
        await review.save();
        await item.save();
        req.flash('success', 'Review added successfully!');
        res.redirect(`/${id}`);
    } catch (error) {
        console.error('Error adding review:', error);
        req.flash('error', 'Failed to add your review.');
        res.redirect(`/${id}`);
    }
});

app.delete('/:id/reviews/:reviewId', isLoggedIn, isReviewAuthor, async (req, res) => {
    console.log(req.params);
    const { id, reviewId } = req.params;
    console.log(id);  
    try {
        await Item.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
        await Review.findByIdAndDelete(reviewId);
        req.flash('success', 'Review deleted successfully');
        res.redirect(`/${id}`);
    } catch (error) {
        console.error('Error deleting review:', error);
        req.flash('error', 'An error occurred while deleting the review');
        res.redirect(`/${id}`);
    }
});

app.post('/cart/add/:id', async (req, res) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to add items to your cart.');
        return res.redirect('/login');
    }

    const itemId = req.params.id;
    const userId = req.user._id;
    const { quantity } = req.body;
    if (!quantity || isNaN(quantity) || quantity <= 0) {
        req.flash('error', 'Invalid quantity.');
        return res.redirect('/');
    }

    try {
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        const existingItemIndex = cart.items.findIndex(item => item.item.toString() === itemId);
        if (existingItemIndex > -1) {
            // Update existing item's quantity
            cart.items[existingItemIndex].quantity += parseInt(quantity, 10);
        } else {
            // Add new item to cart
            cart.items.push({ item: itemId, quantity: parseInt(quantity, 10) });
        }

        await cart.save();
        req.flash('success', 'Item added to cart!');
        res.redirect('/');
    } catch (error) {
        console.error('Error adding item to cart:', error);
        req.flash('error', 'Failed to add item to cart.');
        res.redirect('/');
    }
});

app.post('/cart/update/:id', async (req, res) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to update item quantities.');
        return res.redirect('/login');
    }

    const itemId = req.params.id;
    const userId = req.user._id;
    const { quantity } = req.body;

    // Validate quantity
    if (!quantity || isNaN(quantity) || quantity <= 0) {
        req.flash('error', 'Invalid quantity.');
        return res.redirect('/cart');
    }

    try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            req.flash('error', 'Cart not found.');
            return res.redirect('/cart');
        }
        const existingItemIndex = cart.items.findIndex(item => item.item.toString() === itemId);
        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity = parseInt(quantity, 10);
            await cart.save();
            req.flash('success', 'Quantity updated successfully!');
        } else {
            req.flash('error', 'Item not found in cart.');
        }

        res.redirect('/cart');
    } catch (error) {
        console.error('Error updating item quantity:', error);
        req.flash('error', 'Failed to update item quantity.');
        res.redirect('/cart');
    }
});

app.delete('/cart/delete/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user._id; // Use req.user._id to get the logged-in user's ID

        // Find the cart for the user and remove the item
        const result = await Cart.findOneAndUpdate(
            { user: userId }, // Correctly reference the user field
            { $pull: { items: { item: itemId } } }, // Remove the item based on its _id
            { new: true } // Return the updated document
        );

        if (result) {
            res.status(200).json({ message: 'Item deleted successfully' });
        } else {
            res.status(404).json({ error: 'Cart or item not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

app.listen('8080', () => {
    console.log("server is responding on 8080.");
});
