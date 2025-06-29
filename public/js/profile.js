document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    document.getElementById('username').textContent = user.username;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-avatar').src = user.avatar || '/images/default-avatar.png';

    try {
        const response = await fetch(`/api/authors/${user.id}`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('articles-count').textContent = data.articles.length;
            document.getElementById('followers-count').textContent = data.author.subscriber_count || 0;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }

    document.querySelectorAll('.profile-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.profile-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.profile-tab-content').forEach(c => c.style.display = 'none');

            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).style.display = 'block';
        });
    });

    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
    });
});