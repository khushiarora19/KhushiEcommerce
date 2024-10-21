const express = require('express');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://khushi:hareKrishna19_@cluster0.34lap.mongodb.net/test?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const { Schema } = mongoose;

// Customers Schema
const CustomerSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    country: { type: String },
  },
  order_history: [
    {
      order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
      order_date: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
      },
      total_amount: { type: Number },
    },
  ],
  created_at: { type: Date, default: Date.now },
});

// Orders Schema
const OrderSchema = new Schema({
  customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  products: [
    {
      product_id: { type: Schema.Types.ObjectId, ref: 'Product' },
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
    },
  ],
  total_amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Processing',
  },
  shipping_address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    country: { type: String },
  },
  payment_status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
  },
  order_date: { type: Date, default: Date.now },
  shipped_date: { type: Date },
  delivered_date: { type: Date },
  cancelled_date: { type: Date },
});

// Products Schema
const ProductSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  is_available: { type: Boolean, default: true },
  popularity: { type: Number },
  inventory: {
    last_updated: { type: Date, default: Date.now },
    quantity: { type: Number, required: true },
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date },
});

// Create Models
const Customer = mongoose.model('Customer', CustomerSchema);
const Order = mongoose.model('Order', OrderSchema);
const Product = mongoose.model('Product', ProductSchema);

const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const authenticate = async (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) return res.status(403).send('Token is required');

  try {
      const decoded = jwt.verify(token, "my-secret");
      req.customer = await Customer.findById(decoded.id); // Attach customer to the request
      next();
  } catch (error) {
      res.status(401).send('Invalid token');
  }
};

const app = express();
app.use(bodyParser.json())

// 1. Register a new customer
app.post('/api/v1/customers', async (req, res) => {
    const { name, email, password } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = new Customer({ name, email, password: hashedPassword });

    try {
        const newCustomer = await customer.save();
        res.status(201).json(newCustomer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 2. Customer login
app.post('/api/v1/customers/login', async (req, res) => {
    const { email, password } = req.body;

    const customer = await Customer.findOne({ email });
    if (!customer) return res.status(404).send('Customer not found');

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) return res.status(401).send('Invalid password');

    const token = jwt.sign({ id: customer._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// 3. Fetch all products
app.get('c', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

// 4. Add a new product (admin only)
app.post('/api/v1/products', authenticate, async (req, res) => {
    // Admin check can be added here

    const { name, description, category, price, stock } = req.body;
    const product = new Product({ name, description, category, price, stock });

    try {
        const newProduct = await product.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 5. Place a new order
app.post('/api/v1/orders', authenticate, async (req, res) => {
    const { products, shipping_address } = req.body;

    // Validate product data
    const total_amount = products.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const order = new Order({
        customer_id: req.customer._id,
        products,
        total_amount,
        shipping_address,
    });

    try {
        const newOrder = await order.save();
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 6. Retrieve a customer's order history
app.get('/api/v1/customers/:id/orders', authenticate, async (req, res) => {
    try {
        const orders = await Order.find({ customer_id: req.params.id });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 7. Update an order status (admin only)
app.put('/api/v1/orders/:id/status', authenticate, async (req, res) => {
    // Admin check can be added here

    const { status } = req.body;
    try {
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(updatedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 8. Delete a product (admin only)
app.delete('/api/v1/products/:id', authenticate, async (req, res) => {
    // Admin check can be added here

    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 9. Fetch product details by ID
app.get('/api/v1/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Product not found');
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 10. Update customer information
app.put('/api/v1/customers/:id', authenticate, async (req, res) => {
    try {
        const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedCustomer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

