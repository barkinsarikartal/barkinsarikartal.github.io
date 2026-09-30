document.querySelectorAll('[data-copy]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
        const field = document.getElementById(button.dataset.copy);
        const status = button.closest('.resource-panel').querySelector('.copy-status');
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(field.value);
            status.textContent = 'Kopyalandı.';
        } catch (_) {
            field.focus(); field.select(); field.setSelectionRange(0, field.value.length);
            status.textContent = 'Metin seçildi. Kopyalama kısayolunu veya telefonunun kopyala menüsünü kullan.';
        }
    });
});