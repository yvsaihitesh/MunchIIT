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
const cors = require('cors');
const { zonedTimeToUtc } = require('date-fns-tz');

const User = require('./models/user');
const Item = require('./models/foodItem');
const Review = require('./models/reviews');
const Cart = require('./models/cart');
const Order = require('./models/order');
const PreviousOrder = require('./models/previousOrder')

const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
mongoose.connect('mongodb://localhost:27017/canteen');
app.use(express.json());
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

// app.get('/register', (req, res) => {
//     res.render('users/register');
// });

// app.get('/orders', async (req, res) => {
//     if (!req.user) {
//         req.flash('error', 'You must be logged in to view your orders.');
//         return res.redirect('/login');
//     }

//     try {
//         const orders = await Order.find({ user: req.user._id }).populate('items.item');
//         res.render('orders', { orders });
//     } catch (error) {
//         console.error('Error retrieving orders:', error);
//         req.flash('error', 'Failed to retrieve orders.');
//         res.redirect('/');
//     }
// });
// app.get('/orders', async (req, res) => {
//     if (!req.user) {
//         req.flash('error', 'You must be logged in to view your orders.');
//         return res.redirect('/login');
//     }

//     try {
//         const orders = await Order.find({ user: req.user._id }).populate('items.item');
//         console.log(orders); // Log the orders to see their structure
//         res.render('orders', { orders });
//     } catch (error) {
//         console.error('Error retrieving orders:', error);
//         req.flash('error', 'Failed to retrieve orders.');
//         res.redirect('/');
//     }
// });
app.get('/orders', async (req, res) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to view your orders.');
        return res.redirect('/login');
    }

    try {
        const orders = await Order.find({ user: req.user._id }).populate('items.item');
        console.log(orders); // Log the orders to see their structure
        res.render('orders', { orders });
    } catch (error) {
        console.error('Error retrieving orders:', error);
        req.flash('error', 'Failed to retrieve orders.');
        res.redirect('/');
    }
});
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash('success', 'Logged out successfully');
        res.redirect('/');
    });
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
            req.flash('success', 'Registration completed.');
            if(newUser.username === 'AdminIITDH'){
                return res.redirect('/admin')
            }
            res.redirect('/');
        });
    } catch (e) {
        console.error(e); 
        req.flash('error', 'Registration failed. Please try again.');
        res.redirect('/register');
    }
});

app.post('/admin/addItem', async (req, res) => {
    try {
        const { ItemName, Price, ingredients, Category, image, status } = req.body;

        // Validate required fields
        if (!ItemName || !image || !Price || !ingredients || !Category) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Parse ingredients if provided as a string
        const ingredientsArray = ingredients.split(',').map(ing => ing.trim());

        const newItem = new Item({
            ItemName,
            image,
            Price: parseFloat(Price),
            ingredients: ingredientsArray,
            Category,
            status: status || 'In Stock',
        });

        await newItem.save();
        req.flash('success', 'Item added successfully.');
        res.redirect('/adminModify');
    } catch (error) {
        console.error('Error adding new item:', error);
        req.flash('error', 'Failed to add item.');
        res.redirect('/adminModify');
    }
});

app.delete('/admin/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedItem = await Item.findByIdAndDelete(id);

        if (!deletedItem) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.status(200).json({ message: 'Item deleted successfully', item: deletedItem });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ message: 'Failed to delete item', error });
    }
});


app.get('/login', (req, res) => {
    res.render('users/loginRegister');
});

app.post('/adminModify/:id', async (req, res) => {
    const { id } = req.params;
    const { status, Price } = req.body; 
    try {
        // Update both status and price
        await Item.findByIdAndUpdate(id, { status: status, Price: parseFloat(Price) });
        req.flash('success', 'Item status and price updated successfully.');
        res.redirect('/adminModify');
    } catch (error) {
        console.error('Error updating item status and price:', error);
        req.flash('error', 'Failed to update item status and price.');
        res.redirect('/adminModify');
    }
});

app.get('/profile', async (req, res) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to view your profile.');
        return res.redirect('/login');
    }
    try {
        const user = await User.findById(req.user._id);
        const previousOrders = await PreviousOrder.find({ user: req.user._id }).populate('items.item');
        res.render('profile', { user, previousOrders });
    } catch (error) {
        console.error('Error fetching user data:', error);
        req.flash('error', 'Failed to fetch user data.');
        res.redirect('/');
    }
});

app.get('/orderHistory', async (req, res) => {
    try {
        // Fetch all previous orders and populate user and item details
        const previousOrders = await PreviousOrder.find({})
            .populate('user', 'username email') // Populate user details
            .populate('items.item', 'ItemName image Price'); // Populate item details

        // Render the orderHistory.ejs template with the fetched data
        res.render('orderHistory', { previousOrders });
    } catch (error) {
        console.error('Error fetching previous orders:', error);
        res.status(500).send('Failed to fetch previous orders.');
    }
});

app.get('/admin', async (req, res) => {
    if(res.locals.currentUser && res.locals.currentUser.username !== 'AdminIITDH'){
        req.flash('error',"you don't have permission to access this page .")
        return res.redirect('/login')
    }
    try {
        const orders = await Order.find({})
            .populate('user', 'username email')
            .populate('items.item', 'ItemName image Price ingredients Category'); 
        res.render('admin', { orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Failed to fetch orders.');
    }
});

app.get('/adminModify', async (req, res) => {
    if(res.locals.currentUser && res.locals.currentUser.username !== 'AdminIITDH'){
        req.flash('error',"you don't have permission to access this page .")
        return res.redirect('/login')
    }
    try {
        const items = await Item.find({});
        res.render('adminModify', { items });
    } catch (error) {
        console.error('Error fetching items:', error);
        req.flash('error', 'Failed to fetch items.');
        res.redirect('/admin');
    }
});

app.post('/adminModify/:id', async (req, res) => {
    const { id } = req.params;
    const { status, Price } = req.body; 
    try {
        // Update both status and price
        await Item.findByIdAndUpdate(id, { status: status, Price: parseFloat(Price) });
        req.flash('success', 'Item status and price updated successfully.');
        res.redirect('/adminModify');
    } catch (error) {
        console.error('Error updating item status and price:', error);
        req.flash('error', 'Failed to update item status and price.');
        res.redirect('/adminModify');
    }
});

app.get('/previous-orders', async (req, res) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to view your previous orders.');
        return res.redirect('/login');
    }
    try {
        const previousOrders = await PreviousOrder.find({ user: req.user._id }).populate('items.item');
        res.render('previousOrders', { previousOrders });
    } catch (error) {
        console.error('Error retrieving previous orders:', error);
        req.flash('error', 'Failed to retrieve previous orders.');
        res.redirect('/');
    }
});

app.get('/admin_menuPage', async (req, res) => {
    try {
        const items = await Item.find({});
        res.render('admin_menuPage', { items }); 
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), async (req, res) => {
    if(req.user.username == "AdminIITDH"){
        return res.redirect('/admin');
    }
    res.redirect('/');
});

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

app.post('/orders/:id/deliver', async (req, res) => {
    const { id } = req.params;
    try {
        const order = await Order.findById(id);
        if (!order) {
            req.flash('error', 'Order not found.');
            return res.redirect('/admin');
        }
        const previousOrder = new PreviousOrder({
            user: order.user,
            items: order.items,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            confirmationMessage: 'Order has been delivered.'
        });
        await previousOrder.save(); 
        await Order.findByIdAndDelete(id); 
        req.flash('success', 'Order marked as delivered and moved to previous orders.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Error updating order status:', error);
        req.flash('error', 'Failed to update order status.');
        res.redirect('/admin');
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
            cart.items[existingItemIndex].quantity += parseInt(quantity, 10);
        } else {
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
        const userId = req.user._id;
        const result = await Cart.findOneAndUpdate(
            { user: userId }, 
            { $pull: { items: { item: itemId } } }, 
            { new: true } 
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

app.post('/cart/place-order', async (req, res) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to place an order.');
        return res.redirect('/login');
    }
    const userId = req.user._id;
    try {
        const cart = await Cart.findOne({ user: userId }).populate('items.item');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ error: 'Your cart is empty.' });
        }
        let totalAmount = 0;
        cart.items.forEach(food => {
            totalAmount += food.item.Price * food.quantity;
        });
        const order = new Order({
            user: userId,
            items: cart.items,
            totalAmount: totalAmount
        });
        await order.save();
        await Cart.findOneAndDelete({ user: userId });
        req.flash('success', 'Order placed successfully!');
        res.redirect('/orders'); 
    } catch (error) {
        console.error('Error placing order:', error);
        req.flash('error', 'Failed to place order');
        res.redirect('/cart');
    }
});

app.post('/orders/:id/receive', async (req, res) => {
    const { id } = req.params;
    try {
        const order = await Order.findByIdAndUpdate(id, { status: 'Received', confirmationMessage: 'Order has been received.' });
        req.flash('success', 'Order marked as received.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Error updating order status:', error);
        req.flash('error', 'Failed to update order status.');
        res.redirect('/admin');
    }
});

app.post('/orders/:id/complete', async (req, res) => {
    const { id } = req.params;
    try {
        const order = await Order.findByIdAndUpdate(id, { status: 'Completed' });
        req.flash('success', 'Order marked as completed.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Error updating order status:', error);
        req.flash('error', 'Failed to update order status.');
        res.redirect('/admin');
    }
});

app.post('/orders/:id/deliver', async (req, res) => {
    const { id } = req.params;
    try {
        const order = await Order.findById(id);
        await Order.findByIdAndDelete(id); 
        req.flash('success', 'Order marked as delivered and removed from current orders.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Error updating order status:', error);
        req.flash('error', 'Failed to update order status.');
        res.redirect('/admin');
    }
});


app.listen('8080', () => {
    console.log("server is responding on 8080.");
});
