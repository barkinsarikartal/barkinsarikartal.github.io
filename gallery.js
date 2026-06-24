document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 1. Theme Toggle (shared with main site)
    // =========================================================
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');

    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        htmlElement.setAttribute('data-theme', savedTheme);
        updateIcons(savedTheme);
    } else if (systemPrefersDark) {
        htmlElement.setAttribute('data-theme', 'dark');
        updateIcons('dark');
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateIcons(newTheme);
        });
    }

    function updateIcons(theme) {
        if (!sunIcon || !moonIcon) return;
        if (theme === 'dark') {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    }

    // =========================================================
    // 2. Photo Manifest
    // =========================================================
    // Add your photo filenames here.
    // Photos: saved as "hd_pic_N.jpg" in gallery/photos/
    //
    // Simply add or remove filenames from this array.
    // They will be automatically sorted newest-first (highest N).

    const PHOTO_FILES = [
        'hd_pic_70.jpg', 'hd_pic_144.jpg', 'hd_pic_145.jpg', 'hd_pic_203.jpg', 'hd_pic_211.jpg', 'hd_pic_230.jpg', 'hd_pic_231.jpg', 'hd_pic_235.jpg', 'hd_pic_313.jpg'
    ];

    const PHOTO_DIR = 'gallery/photos/';

    // =========================================================
    // 3. Sorting Logic (highest number first)
    // =========================================================
    function extractNumber(filename) {
        const match = filename.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function sortDescending(files) {
        return [...files].sort((a, b) => extractNumber(b) - extractNumber(a));
    }

    // =========================================================
    // 4. Build Gallery
    // =========================================================
    const photosGrid = document.getElementById('gallery-photos');
    const emptyState = document.getElementById('gallery-empty');
    const photoCountLabel = document.getElementById('photo-count-label');

    const sortedPhotos = sortDescending(PHOTO_FILES);

    // Show photo count
    if (sortedPhotos.length > 0) {
        photoCountLabel.textContent = `${sortedPhotos.length} photo${sortedPhotos.length !== 1 ? 's' : ''}`;
    }

    // Build photo items
    sortedPhotos.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.setAttribute('data-index', index);
        item.innerHTML = `
            <img src="${PHOTO_DIR}${file}" alt="${file}" loading="lazy">
            <div class="gallery-item-overlay">
                <span>${file}</span>
            </div>
        `;
        item.addEventListener('click', () => openLightbox(index));
        photosGrid.appendChild(item);
    });

    // Show empty state if no photos
    if (sortedPhotos.length === 0) {
        emptyState.style.display = 'block';
    }

    // =========================================================
    // 5. Lightbox
    // =========================================================
    const lightbox = document.getElementById('lightbox');
    const lightboxContent = lightbox.querySelector('.lightbox-content');
    const lightboxCaption = lightbox.querySelector('.lightbox-caption');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    const lightboxPrev = lightbox.querySelector('.lightbox-prev');
    const lightboxNext = lightbox.querySelector('.lightbox-next');

    let currentIndex = 0;

    function openLightbox(index) {
        currentIndex = index;
        updateLightbox();
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
    }

    function updateLightbox() {
        const file = sortedPhotos[currentIndex];
        lightboxContent.innerHTML = `<img src="${PHOTO_DIR}${file}" alt="${file}">`;
        lightboxCaption.textContent = `${file}  ·  ${currentIndex + 1} / ${sortedPhotos.length}`;

        // Hide nav arrows if only one item
        lightboxPrev.style.display = sortedPhotos.length > 1 ? 'flex' : 'none';
        lightboxNext.style.display = sortedPhotos.length > 1 ? 'flex' : 'none';
    }

    function navigate(direction) {
        currentIndex = (currentIndex + direction + sortedPhotos.length) % sortedPhotos.length;
        updateLightbox();
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', () => navigate(-1));
    lightboxNext.addEventListener('click', () => navigate(1));

    // Close on background click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (lightbox.style.display !== 'flex') return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
    });
});
