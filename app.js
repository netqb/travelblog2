const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

const dbPath = path.join(__dirname, 'data', 'db.json');

function readData() {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
}

function writeData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


app.get('/api/articles', (req, res) => {
    const db = readData();
    const { page = 1, limit = 6 } = req.query;

    const articles = db.articles.map(article => {
        const author = db.users.find(u => u.id === article.author_id);
        return {
            ...article,
            author_name: author ? author.username : 'Неизвестный'
        };
    });

    const start = (page - 1) * limit;
    const end = page * limit;
    const paginatedArticles = articles.slice(start, end);

    res.json({
        articles: paginatedArticles,
        hasMore: end < articles.length
    });
});

app.get('/api/articles/:id', (req, res) => {
    const db = readData();
    const article = db.articles.find(a => a.id === parseInt(req.params.id));

    if (!article) {
        return res.status(404).json({ error: 'Статья не найдена' });
    }

    const author = db.users.find(u => u.id === article.author_id);
    const comments = db.comments
        .filter(c => c.article_id === article.id)
        .map(comment => {
            const commentAuthor = db.users.find(u => u.id === comment.author_id);
            return {
                ...comment,
                author_name: commentAuthor ? commentAuthor.username : 'Неизвестный'
            };
        });

    res.json({
        ...article,
        author_name: author ? author.username : 'Неизвестный',
        author_avatar: author ? author.avatar : '/images/default-avatar.png',
        comments
    });
});

app.get('/api/authors', (req, res) => {
    const db = readData();

    const authors = db.users
        .filter(user => db.articles.some(a => a.author_id === user.id))
        .map(user => {
            const articles = db.articles.filter(a => a.author_id === user.id);
            const subscriberCount = db.subscriptions.filter(s => s.author_id === user.id).length;
            return {
                ...user,
                article_count: articles.length,
                subscriber_count: subscriberCount
            };
        });

    res.json(authors);
});

app.get('/api/authors/:id', (req, res) => {
    const db = readData();
    const authorId = parseInt(req.params.id);
    const author = db.users.find(u => u.id === authorId);

    if (!author) {
        return res.status(404).json({ error: 'Автор не найден' });
    }

    const articles = db.articles
        .filter(a => a.author_id === authorId)
        .map(article => {
            const authorInfo = db.users.find(u => u.id === article.author_id);
            return {
                ...article,
                author_name: authorInfo ? authorInfo.username : 'Неизвестный',
                author_avatar: authorInfo ? authorInfo.avatar : '/images/default-avatar.png'
            };
        });

    const comments = db.comments
        .filter(comment => {
            return articles.some(article => article.id === comment.article_id);
        })
        .map(comment => {
            const commentAuthor = db.users.find(u => u.id === comment.author_id);
            return {
                ...comment,
                author_name: commentAuthor ? commentAuthor.username : 'Неизвестный'
            };
        });

    const subscriberCount = db.subscriptions.filter(s => s.author_id === authorId).length;

    res.json({
        author: {
            ...author,
            subscriber_count: subscriberCount
        },
        articles,
        comments
    });
});


const crypto = require('crypto');

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

app.post('/api/register', (req, res) => {
    const db = readData();
    const { username, email, password } = req.body;

    const existingUser = db.users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const newUser = {
        id: db.users.length + 1,
        username,
        email,
        password: password,
        avatar: '/images/default-avatar.png',
        created_at: new Date().toISOString()
    };

    db.users.push(newUser);
    writeData(db);

    const sessionToken = generateToken();
    db.sessions.push({
        token: sessionToken,
        user_id: newUser.id,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    writeData(db);

    res.status(201).json({
        user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            avatar: newUser.avatar
        },
        token: sessionToken
    });
});

app.post('/api/login', (req, res) => {
    const db = readData();
    const { email, password } = req.body;

    const user = db.users.find(u => u.email === email);
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const sessionToken = generateToken();
    db.sessions.push({
        token: sessionToken,
        user_id: user.id,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    writeData(db);

    res.json({
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar
        },
        token: sessionToken
    });
});
app.post('/api/logout', (req, res) => {
    const db = readData();
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
        db.sessions = db.sessions.filter(s => s.token !== token);
        writeData(db);
    }

    res.json({ success: true });
});

function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Необходима авторизация' });
    }

    const db = readData();
    const session = db.sessions.find(s => s.token === token);

    if (!session || new Date(session.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Сессия истекла или недействительна' });
    }

    const user = db.users.find(u => u.id === session.user_id);
    if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден' });
    }

    req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
    };

    next();
}

app.get('/api/me', authenticate, (req, res) => {
    res.json(req.user);
});

app.get('/profile', (req, res) => {
    const token = req.cookies?.session_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.redirect('/login');
    }

    const db = readData();
    const session = db.sessions.find(s => s.token === token);

    if (!session || new Date(session.expires_at) < new Date()) {
        return res.redirect('/login');
    }

    res.sendFile(path.join(__dirname, 'panels', 'profile.html'));
});

app.post('/api/comments', (req, res) => {
    const db = readData();
    const { content, article_id, author_id } = req.body;

    if (!content || !article_id || !author_id) {
        return res.status(400).json({ error: 'Необходимы content, article_id и author_id' });
    }

    const newComment = {
        id: db.comments.length > 0 ? Math.max(...db.comments.map(c => c.id)) + 1 : 1,
        content,
        article_id: parseInt(article_id),
        author_id: parseInt(author_id),
        created_at: new Date().toISOString()
    };

    db.comments.push(newComment);
    writeData(db);

    res.status(201).json(newComment);
});

app.delete('/api/comments/:id', (req, res) => {
    const db = readData();
    const commentId = parseInt(req.params.id);
    const { author_id } = req.body;

    const commentIndex = db.comments.findIndex(c => c.id === commentId);

    if (commentIndex === -1) {
        return res.status(404).json({ error: 'Комментарий не найден' });
    }

    const comment = db.comments[commentIndex];

    if (comment.author_id !== author_id) {
        return res.status(403).json({ error: 'Нет прав на удаление этого комментария' });
    }

    db.comments.splice(commentIndex, 1);
    writeData(db);

    res.json({ success: true });
});

app.post('/api/subscribe', (req, res) => {
    const db = readData();
    const { subscriber_id, author_id } = req.body;

    if (!subscriber_id || !author_id) {
        return res.status(400).json({ error: 'Необходимы subscriber_id и author_id' });
    }

    const existing = db.subscriptions.find(
        s => s.subscriber_id === subscriber_id && s.author_id === author_id
    );

    if (existing) {
        return res.status(400).json({ error: 'Вы уже подписаны на этого автора' });
    }

    const newSubscription = {
        id: db.subscriptions.length > 0 ? Math.max(...db.subscriptions.map(s => s.id)) + 1 : 1,
        subscriber_id: parseInt(subscriber_id),
        author_id: parseInt(author_id),
        created_at: new Date().toISOString()
    };

    db.subscriptions.push(newSubscription);
    writeData(db);

    res.status(201).json({
        message: 'Подписка успешно оформлена',
        new_subscriber_count: db.subscriptions.filter(s => s.author_id === author_id).length
    });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'index.html'));
});

app.get('/articles', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'articles.html'));
});

app.get('/articles/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'article.html'));
});

app.get('/authors', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'authors.html'));
});

app.get('/authors/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'author.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'reg.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'profile.html'));
});

app.get('/destinations', (req, res) => {
    res.sendFile(path.join(__dirname, 'panels', 'destinations.html'));
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});