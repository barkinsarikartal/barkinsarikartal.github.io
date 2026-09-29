(() => {
    const themeButton = document.getElementById('resource-theme');
    let savedTheme;
    try { savedTheme = localStorage.getItem('theme'); } catch (_) { /* Storage may be unavailable in in-app browsers. */ }
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    function setTheme(theme) {
        document.documentElement.dataset.theme = theme;
        themeButton.textContent = theme === 'dark' ? 'Açık tema' : 'Koyu tema';
        themeButton.setAttribute('aria-label', themeButton.textContent + 'ya geç');
    }
    setTheme(['light', 'dark'].includes(savedTheme) ? savedTheme : preferred);
    themeButton.addEventListener('click', () => {
        const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        setTheme(theme);
        try { localStorage.setItem('theme', theme); } catch (_) { /* Theme still works without persistence. */ }
    });

    const field = document.getElementById('prompt-text');
    if (!field) return;
    const button = document.getElementById('copy-prompt');
    const status = document.getElementById('prompt-status');
    fetch('prompt.txt', { cache: 'no-cache' })
        .then(response => {
            if (!response.ok) throw new Error('Prompt could not be loaded');
            return response.text();
        })
        .then(text => {
            if (!text.trim()) {
                status.textContent = 'Prompt henüz eklenmedi. Hazır olduğunda bu sayfada yer alacak.';
                return;
            }
            field.value = text;
            field.hidden = false;
            button.disabled = false;
            status.textContent = 'Kopyaladıktan sonra kendi projen için düzenleyebilirsin.';
        })
        .catch(() => { status.textContent = 'Prompt yüklenemedi. Lütfen sayfayı yenileyip tekrar dene.'; });
    button.addEventListener('click', async () => {
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(field.value);
            status.textContent = 'Prompt kopyalandı.';
        } catch (_) {
            field.focus();
            field.select();
            field.setSelectionRange(0, field.value.length);
            status.textContent = 'Otomatik kopyalama kullanılamıyor. Seçili metni basılı tutarak veya kopyalama kısayoluyla kopyalayabilirsin.';
        }
    });
})();
