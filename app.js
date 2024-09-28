const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const app = express();
const PORT = process.env.PORT || 5000;

// Şablon motoru ve statik dosyalar
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Oturum ve flash mesaj ayarları
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true
}));
app.use(flash());

// Global değişkenler (flash mesajlar için)
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Veritabanı bağlantısı
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, task TEXT, FOREIGN KEY(user_id) REFERENCES users(id))");
});

// Ana sayfa (kayıt ve giriş formları)
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Kayıt sayfası
app.get('/register', (req, res) => {
    res.render('register', { 
        error_msg: req.flash('error_msg'), 
        success_msg: req.flash('success_msg') 
    });
});

// Kullanıcı kaydı
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        req.flash('error_msg', 'Lütfen tüm alanları doldurun.');
        return res.redirect('/register');
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) throw err;
        if (row) {
            req.flash('error_msg', 'Kullanıcı adı zaten mevcut.');
            return res.redirect('/register');
        } else {
            const hashedPassword = bcrypt.hashSync(password, 10);
            db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], (err) => {
                if (err) throw err;
                req.flash('success_msg', 'Kayıt başarılı! Giriş yapabilirsiniz.');
                return res.redirect('/');
            });
        }
    });
});

// Kullanıcı girişi
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        req.flash('error_msg', 'Lütfen tüm alanları doldurun.');
        return res.redirect('/');
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) throw err;
        if (!row) {
            req.flash('error_msg', 'Yanlış kullanıcı adı veya şifre.');
            return res.redirect('/');
        } else {
            if (bcrypt.compareSync(password, row.password)) {
                req.session.user = { id: row.id, username: row.username };
                req.flash('success_msg', 'Giriş başarılı!');
                return res.redirect('/dashboard');
            } else {
                req.flash('error_msg', 'Yanlış kullanıcı adı veya şifre.');
                return res.redirect('/');
            }
        }
    });
});

// Kullanıcı çıkışı
app.post('/logout', (req, res) => {
    req.flash('success_msg', 'Başarıyla çıkış yapıldı.');
    req.session.destroy((err) => {
        if (err) {
            console.error('Oturum sonlandırılamadı:', err);
        }
        res.redirect('/');
    });
});

// Görev paneli (Kullanıcı görevlerini gösterir)
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        req.flash('error_msg', 'Lütfen giriş yapın.');
        return res.redirect('/');
    }

    db.all("SELECT * FROM tasks WHERE user_id = ?", [req.session.user.id], (err, rows) => {
        if (err) throw err;
        res.render('dashboard', { user: req.session.user, tasks: rows });
    });
});

// Görev ekleme
app.post('/addtask', (req, res) => {
    const { task } = req.body;
    const userId = req.session.user.id;

    db.run("INSERT INTO tasks (user_id, task) VALUES (?, ?)", [userId, task], (err) => {
        if (err) throw err;
        req.flash('success_msg', 'Görev eklendi.');
        res.redirect('/dashboard');
    });
});

// Görev silme
app.post('/removetask', (req, res) => {
    const { taskId } = req.body;

    db.run("DELETE FROM tasks WHERE id = ?", [taskId], (err) => {
        if (err) throw err;
        req.flash('success_msg', 'Görev silindi.');
        res.redirect('/dashboard');
    });
});

// Görev düzenleme
app.post('/editTask', (req, res) => {
    const { taskId, task } = req.body;

    if (!taskId || !task) {
        req.flash('error_msg', 'Görev güncellenirken bir hata oluştu.');
        return res.redirect('/dashboard');
    }

    db.run("UPDATE tasks SET task = ? WHERE id = ?", [task, taskId], (err) => {
        if (err) throw err;
        req.flash('success_msg', 'Görev başarıyla güncellendi.');
        res.redirect('/dashboard');
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});