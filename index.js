require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const path = require('path');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const logger = require('./config/winston.js');
const db = require('./config/db');

const app = express();
const port = 80;

// Session Store Configuration
const dbOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  checkExpirationInterval: 5 * 60 * 1000,
  expiration: 3 * 60 * 60 * 1000
};

const sessionStore = new MySQLStore(dbOptions);

// Middleware
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security and Rate Limiting
const limiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 500 });
// app.use(helmet());
app.use(limiter);

app.use(compression());
// app.use(morgan('combined', { stream: logger.stream }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false, 
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 5 * 60 * 60 * 1000
    }
  })
);

app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const chartRoutes = require('./routes/charts');
const propositionRoutes = require('./routes/propositions');
const votingSessionRoutes = require('./routes/votes');
const imageRoutes = require('./routes/images');
const userRoutes = require('./routes/users');
const fonctionsRoutes = require('./routes/functions');
const { router: authRoutes, isAuthenticated } = require('./routes/auth');
const isJury = require('./middleware/checkUserJury');
const isAdmin = require('./middleware/checkUserAdmin');

app.use('/charts', isAuthenticated, isAdmin, chartRoutes);
app.use('/propositions', isAuthenticated, propositionRoutes);
app.use('/voting-sessions', isAuthenticated, votingSessionRoutes);
app.use('/images', isAuthenticated, imageRoutes);
app.use('/users', isAuthenticated, isAdmin, userRoutes);
app.use('/functions', isAuthenticated, isAdmin, fonctionsRoutes);
app.use('/auth', authRoutes);
app.use('/', authRoutes);

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
