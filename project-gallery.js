document.querySelectorAll('.project-gallery').forEach(gallery => {
    const thumbnails = [...gallery.querySelectorAll('.gallery-thumbnail')];
    const stage = gallery.querySelector('.gallery-stage');
    const image = stage.querySelector('img');
    const caption = gallery.querySelector('.gallery-caption');
    let current = 0;

    function show(index) {
        current = (index + thumbnails.length) % thumbnails.length;
        const selected = thumbnails[current];
        image.src = selected.dataset.src;
        image.alt = selected.dataset.caption;
        stage.href = selected.dataset.src;
        caption.textContent = `${current + 1} / ${thumbnails.length} · ${selected.dataset.caption}`;
        thumbnails.forEach((thumbnail, i) => {
            thumbnail.setAttribute('aria-pressed', String(i === current));
        });
        selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    thumbnails.forEach((thumbnail, index) => {
        thumbnail.addEventListener('click', () => show(index));
    });
    gallery.querySelector('[data-gallery-prev]').addEventListener('click', () => show(current - 1));
    gallery.querySelector('[data-gallery-next]').addEventListener('click', () => show(current + 1));
    gallery.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            show(current + (event.key === 'ArrowRight' ? 1 : -1));
        }
    });
});
