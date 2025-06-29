// Проверка авторизации при загрузке страницы
async function checkAuth() {
    const token = document.cookie.split('; ').find(row => row.startsWith('session_token='))?.split('=')[1];

    if (!token) {
        if (window.location.pathname === '/profile') {
            window.location.href = '/login';
        }
        return null;
    }

    try {
        const response = await fetch('/api/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (window.location.pathname === '/profile') {
                window.location.href = '/login';
            }
            return null;
        }

        const user = await response.json();

        // Обновляем хедер для авторизованного пользователя
        updateHeader(true, user);

        return user;
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        return null;
    }
}

// Обновление хедера
function updateHeader(isLoggedIn, user = null) {
    const authButtons = document.querySelector('.auth-buttons');

    if (!authButtons) return;

    if (isLoggedIn && user) {
        authButtons.innerHTML = `
            <a href="/profile" class="btn-profile">
                <img src="${user.avatar || '/images/default-avatar.png'}" alt="${user.username}" class="avatar">
                ${user.username}
            </a>
            <button class="btn-logout" id="logout-btn">
                <i class="fas fa-sign-out-alt"></i>
            </button>
        `;

        document.getElementById('logout-btn').addEventListener('click', logout);
    } else {
        authButtons.innerHTML = `
            <a href="/login" class="btn-login"><i class="fas fa-user"></i> Войти</a>
            <a href="/register" class="btn-register">Регистрация</a>
        `;
    }
}

// Выход из системы
async function logout() {
    try {
        const token = document.cookie.split('; ').find(row => row.startsWith('session_token='))?.split('=')[1];

        await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Удаляем cookie
        document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

        // Обновляем хедер
        updateHeader(false);

        // Перенаправляем на главную
        window.location.href = '/';
    } catch (error) {
        console.error('Ошибка при выходе:', error);
    }
}

// Проверяем авторизацию при загрузке страницы
document.addEventListener('DOMContentLoaded', checkAuth);