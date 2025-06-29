document.addEventListener('DOMContentLoaded', () => {
    const articleId = window.location.pathname.split('/')[2];
    if (!articleId) return;

    loadArticle(articleId);
});

async function loadArticle(id) {
    try {
        const response = await fetch(`/api/articles/${id}`);
        const article = await response.json();

        document.getElementById('article-title').textContent = article.title;
        document.getElementById('article-date').textContent = new Date(article.created_at).toLocaleDateString();
        document.getElementById('article-author').textContent = article.author_name || 'Неизвестный';
        document.querySelector('#article-image').style.backgroundImage = `url('${article.image_url || '/images/default-travel.jpg'}')`;
        document.getElementById('article-full-text').innerHTML = `<p>${article.content.replace(/\n/g, '</p><p>')}</p>`;

        const author = article.author_info || {};
        document.getElementById('author-name').textContent = author.username || 'Неизвестный';
        document.getElementById('author-bio').textContent = author.bio || 'Автор не предоставил информацию.';
        document.getElementById('author-avatar').style.backgroundImage = `url('${author.avatar || '/images/default-avatar.png'}')`;
        document.getElementById('subscriber-count').textContent = article.subscriber_count || 0;
        document.getElementById('subscribe-button').dataset.authorId = article.author_id || '';

        const commentsContainer = document.getElementById('comments-list');
        if (commentsContainer && article.comments?.length > 0) {
            commentsContainer.innerHTML = '';
            article.comments.forEach(comment => {
                const commentCard = createCommentCard(comment);
                commentsContainer.appendChild(commentCard);
            });
        } else {
            commentsContainer.innerHTML = '<p>Нет комментариев</p>';
        }

        AOS.refresh();
    } catch (error) {
        console.error('Ошибка:', error);
        document.querySelector('.article-page').innerHTML = '<p>Не удалось загрузить статью</p>';
    }
}

function createCommentCard(comment) {
    const card = document.createElement('div');
    card.className = 'comment-card';

    card.innerHTML = `
        <div class="comment-header">
            <div class="comment-user">
                <div class="comment-avatar" style="background-image: url('${comment.author_avatar || '/images/default-avatar.png'}')"></div>
                <span class="comment-author">${comment.author_name}</span>
            </div>
            <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
        </div>
        <div class="comment-body">
            <p>${comment.content}</p>
        </div>
        <div class="comment-actions">
            <button class="reply-btn">Ответить</button>
            <button class="edit-btn">Редактировать</button>
        </div>
    `;

    return card;
}

document.getElementById('comment-form')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const textarea = this.querySelector('textarea');
    const content = textarea.value.trim();
    const articleId = window.location.pathname.split('/')[2];

    if (!content) {
        alert('Введите текст комментария');
        return;
    }

    const author_id = 3;

    try {
        const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, article_id: articleId, author_id })
        });

        if (res.ok) {
            textarea.value = '';
            loadArticle(articleId);
        } else {
            const err = await res.json();
            alert(`Ошибка: ${err.error || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error('Ошибка отправки комментария:', error);
        alert('Произошла ошибка при отправке комментария');
    }
});