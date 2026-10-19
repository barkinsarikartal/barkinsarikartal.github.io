document.addEventListener('DOMContentLoaded', () => {
    // Halloween ghost for the landing page, two weeks either side of Oct 31 (Oct 17 - Nov 14).
    // The date comes from the visitor's own device, so it switches itself on and off every year.
    const toggleBtn = document.getElementById('ghost-toggle');
    const today = new Date();
    const inSeason = today >= new Date(today.getFullYear(), 9, 17) && today < new Date(today.getFullYear(), 10, 15);

    if (!toggleBtn || !inSeason) return;

    const IMG_DIR = 'img/halloween/';
    const POSES = ['idle', 'blink', 'shy', 'peek', 'boo', 'giggle', 'blush', 'dizzy'];
    const HIDEOUTS = '.card, .profile-placeholder';
    const PACES = {
        calm: { k: 1.4, max: 180 },
        quick: { k: 4, max: 420 },
        fast: { k: 7, max: 950 }
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const navbar = document.querySelector('.navbar');
    const onIcon = toggleBtn.querySelector('.ghost-on-icon');
    const offIcon = toggleBtn.querySelector('.ghost-off-icon');
    let ghost = null;

    // 1. Toggle button (remembers each visitor's choice, the ghost is on by default)
    toggleBtn.hidden = false;
    setEnabled(localStorage.getItem('ghost') !== 'off', true);

    toggleBtn.addEventListener('click', () => {
        const enabled = !ghost;
        localStorage.setItem('ghost', enabled ? 'on' : 'off');
        setEnabled(enabled, false);
    });

    function setEnabled(enabled, onLoad) {
        onIcon.style.display = enabled ? 'block' : 'none';
        offIcon.style.display = enabled ? 'none' : 'block';
        toggleBtn.setAttribute('aria-pressed', String(enabled));
        toggleBtn.title = enabled ? 'Hide the ghost' : 'Show the ghost';

        if (enabled && !ghost) {
            ghost = createGhost(onLoad);
        } else if (!enabled && ghost) {
            ghost.destroy();
            ghost = null;
        }
    }

    // 2. The ghost
    function createGhost(onLoad) {
        const el = document.createElement('div');
        const body = document.createElement('div');
        const bubble = document.createElement('img');
        const poses = {};

        el.className = 'ghost is-gone';
        el.setAttribute('aria-hidden', 'true');
        body.className = 'ghost-body';
        POSES.forEach(name => {
            const img = document.createElement('img');
            img.src = `${IMG_DIR}ghost-${name}.svg`;
            img.alt = '';
            img.draggable = false;
            poses[name] = img;
            body.appendChild(img);
        });
        bubble.className = 'ghost-bubble';
        bubble.src = `${IMG_DIR}boo-bubble.svg`;
        bubble.alt = '';
        el.append(body, bubble);
        document.body.appendChild(el);

        let W = el.offsetWidth;
        let H = el.offsetHeight;
        const pos = { x: 0, y: 0 };
        const target = { x: 0, y: 0 };
        let tilt = 0;
        let pose = '';
        let mode = 'off';
        let pace = PACES.calm;
        let modeUntil = 0;
        let steps = [];
        let stepClasses = [];
        let hideout = null;
        let entrySide = 'left';
        let peekSide = '';
        let peekT = 0.5;
        let pointer = null;
        let fleeAfter = 0;      // the cursor is ignored until this time
        let nextTrickAt = 0;    // next surprise hide-and-peek or boo
        let nextWanderAt = 0;
        let nextBlinkAt = 0;
        let lastSparkleAt = 0;
        let lastScrollY = window.scrollY;
        let lastFrame = 0;
        let frameId = 0;

        const rand = (min, max) => min + Math.random() * (max - min);
        const pick = list => list[Math.floor(Math.random() * list.length)];
        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
        const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const center = () => ({ x: pos.x + W / 2, y: pos.y + H / 2 });
        const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const isRound = node => node.classList.contains('profile-placeholder');
        const pointerNear = now => pointer && now >= fleeAfter && distance(pointer, center()) < W * 1.2;

        function bounds() {
            const navBottom = navbar.getBoundingClientRect().bottom;
            return {
                navBottom,
                minX: 8,
                maxX: window.innerWidth - W - 8,
                minY: navBottom + 8,
                maxY: window.innerHeight - H - 8
            };
        }

        function setPose(name) {
            if (name === pose) return;
            if (pose) poses[pose].classList.remove('is-active');
            poses[name].classList.add('is-active');
            pose = name;
        }

        function setBehind(behind) {
            el.classList.toggle('is-behind', behind);
        }

        // 3. Hiding spots: the cards and the profile photo
        function hideouts() {
            return Array.from(document.querySelectorAll(HIDEOUTS), node => ({ node, rect: node.getBoundingClientRect() }));
        }

        function hideSpot(node, rect) {
            const x = rect.left + (rect.width - W) / 2;
            if (isRound(node)) return { x, y: rect.top + (rect.height - H) / 2 };

            const visibleTop = Math.max(rect.top, bounds().navBottom);
            const visibleBottom = Math.min(rect.bottom, window.innerHeight);
            return { x, y: clamp((visibleTop + visibleBottom - H) / 2, rect.top + 4, rect.bottom - H - 4) };
        }

        function isUsable(node, rect) {
            const spot = hideSpot(node, rect);
            return rect.width > W + 16 && rect.height > H + 8
                && spot.y >= bounds().navBottom && spot.y + H <= window.innerHeight;
        }

        function peekSpot(side, node, rect) {
            const spot = hideSpot(node, rect);
            if (side === 'left') return { x: rect.left - W * 0.65, y: spot.y };
            if (side === 'right') return { x: rect.right - W * 0.35, y: spot.y };

            const x = isRound(node) ? spot.x : rect.left + 16 + peekT * (rect.width - W - 32);
            return { x, y: rect.top - H * 0.6 };
        }

        // Sides it can peek from while staying on screen and clear of the other cards
        function peekSides(node, rect, all) {
            const b = bounds();
            return ['left', 'right', 'top'].filter(side => {
                const p = peekSpot(side, node, rect);
                const box = { left: p.x, right: p.x + W, top: p.y, bottom: p.y + H };
                const onScreen = p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
                return onScreen && !all.some(other => other.node !== node && overlaps(box, other.rect));
            });
        }

        // The nearest hideout, avoiding the one under the cursor and ones it can't peek out of
        function pickHideout() {
            const all = hideouts();
            const from = center();
            let best = null;
            let bestScore = Infinity;

            all.forEach(({ node, rect }) => {
                if (!isUsable(node, rect)) return;
                const spot = hideSpot(node, rect);
                let score = Math.hypot(spot.x + W / 2 - from.x, spot.y + H / 2 - from.y);
                if (pointer && overlaps(rect, { left: pointer.x, right: pointer.x, top: pointer.y, bottom: pointer.y })) score += 2000;
                if (!peekSides(node, rect, all).length) score += 1000;
                if (score < bestScore) {
                    best = node;
                    bestScore = score;
                }
            });
            return best;
        }

        function nearestSide(rect) {
            const c = center();
            const gaps = {
                left: Math.abs(c.x - rect.left),
                right: Math.abs(c.x - rect.right),
                top: Math.abs(c.y - rect.top),
                bottom: Math.abs(c.y - rect.bottom)
            };
            return Object.keys(gaps).reduce((a, b) => (gaps[a] <= gaps[b] ? a : b));
        }

        // Just outside the hideout's edge, where it slips behind
        function entrySpot(rect) {
            const b = bounds();
            const x = clamp(pos.x, rect.left, rect.right - W);
            const y = clamp(pos.y, rect.top, rect.bottom - H);
            const spot = {
                left: { x: rect.left - W - 4, y },
                right: { x: rect.right + 4, y },
                top: { x, y: rect.top - H - 4 },
                bottom: { x, y: rect.bottom + 4 }
            }[entrySide];
            return { x: clamp(spot.x, b.minX, b.maxX), y: clamp(spot.y, b.minY, b.maxY) };
        }

        // 4. Behaviour
        function wander(now) {
            mode = 'wander';
            pace = PACES.calm;
            setPose('idle');
            fleeAfter = Math.max(fleeAfter, now + 900);
            nextTrickAt = now + rand(9000, 18000);
            nextWanderAt = 0;
        }

        function pickWanderTarget(now) {
            const b = bounds();
            target.x = rand(b.minX, b.maxX);
            target.y = rand(b.minY, b.maxY);
            nextWanderAt = now + rand(3500, 7000);
        }

        // The cursor got too close: a moment of panic (and a chance to catch it) before it runs
        function startle(now, ms) {
            el.classList.remove(...stepClasses);
            stepClasses = [];
            mode = 'startled';
            modeUntil = now + ms;
            setPose('shy');
            el.classList.add('is-shaking');
            target.x = pos.x;
            target.y = pos.y;
        }

        function flee(now) {
            el.classList.remove('is-shaking');
            hideout = pickHideout();
            if (hideout) return sneakTo(now, PACES.fast);

            // Nowhere to hide: dash to the far side of the screen instead
            const b = bounds();
            const from = pointer || center();
            target.x = from.x < window.innerWidth / 2 ? b.maxX : b.minX;
            target.y = rand(b.minY, b.maxY);
            pace = PACES.fast;
            fleeAfter = now + 2500;
            play(now, [{ pose: 'shy', ms: 1200 }]);
        }

        function sneakTo(now, sneakPace) {
            mode = 'hiding';
            pace = sneakPace;
            setPose(sneakPace === PACES.fast ? 'shy' : 'idle');
            modeUntil = now + 2500;
            entrySide = nearestSide(hideout.getBoundingClientRect());
        }

        function hide(now, ms) {
            mode = 'hidden';
            pace = PACES.quick;
            modeUntil = now + ms;
            setBehind(true);
            el.classList.remove('is-peeking');
        }

        function peek(now) {
            const all = hideouts();
            const rect = hideout.getBoundingClientRect();

            if (!isUsable(hideout, rect)) {
                const next = pickHideout();
                if (!next) return comeBack(now);
                // Slip over to another hideout while out of sight
                hideout = next;
                Object.assign(pos, hideSpot(next, next.getBoundingClientRect()));
                return hide(now, 600);
            }

            peekT = Math.random();
            const sides = peekSides(hideout, rect, all);
            if (!sides.length) return boo(now);

            const fresh = sides.filter(side => side !== peekSide);
            peekSide = pick(fresh.length ? fresh : sides);
            mode = 'peeking';
            modeUntil = now + rand(1600, 2800);
            setPose('peek');
            el.classList.add('is-peeking');
            el.classList.toggle('is-flipped', peekSide === 'left' || (peekSide === 'top' && Math.random() < 0.5));
        }

        // Its hideout scrolled away: float back into view from the edge
        function comeBack(now) {
            const b = bounds();
            setBehind(false);
            pos.x = clamp(pos.x, b.minX - W, b.maxX + W);
            pos.y = clamp(pos.y, b.minY - H, b.maxY + H);
            wander(now);
        }

        function boo(now) {
            const b = bounds();
            setBehind(false);
            el.classList.remove('is-peeking', 'is-shaking');
            pace = PACES.calm;
            // Leave room for the speech bubble above and to the right
            target.x = clamp(pos.x, b.minX, Math.min(b.maxX, window.innerWidth - W * 1.45 - 8));
            target.y = clamp(pos.y, Math.max(b.minY, b.navBottom + W * 0.4 + 8), b.maxY);
            play(now, [
                { pose: 'boo', ms: 1100, classes: ['is-booing', 'is-popping'] },
                { pose: 'giggle', ms: 1300 }
            ]);
        }

        function caught(now) {
            setBehind(false);
            el.classList.remove('is-peeking', 'is-shaking');
            target.x = pos.x;
            target.y = pos.y;
            pace = PACES.calm;
            fleeAfter = now + 4000;

            if (reduceMotion || Math.random() < 0.5) {
                play(now, [{ pose: 'blush', ms: 1800, classes: ['is-popping'] }]);
            } else {
                play(now, [
                    { pose: 'idle', ms: 900, classes: ['is-spinning'] },
                    { pose: 'dizzy', ms: 1700, classes: ['is-dizzy'] }
                ]);
            }
        }

        function trick(now) {
            hideout = Math.random() < 0.6 ? pickHideout() : null;
            if (hideout) sneakTo(now, PACES.quick);
            else boo(now);
        }

        // A short sequence of poses, e.g. boo then giggle
        function play(now, list) {
            mode = 'show';
            steps = list.slice();
            nextStep(now);
        }

        function nextStep(now) {
            el.classList.remove(...stepClasses);
            const step = steps.shift();
            if (!step) return wander(now);

            stepClasses = step.classes || [];
            el.classList.add(...stepClasses);
            setPose(step.pose);
            modeUntil = now + step.ms;
        }

        function blink(now) {
            if (now < nextBlinkAt) return;
            if (pose === 'idle') {
                setPose('blink');
                nextBlinkAt = now + 150;
            } else if (pose === 'blink') {
                setPose('idle');
                nextBlinkAt = now + rand(2500, 5500);
            }
        }

        // Reduced motion: it sits in the corner and only changes its face
        function sitStill(now) {
            const b = bounds();
            target.x = b.maxX;
            target.y = b.maxY;
            if (pointer && distance(pointer, center()) < W * 1.2) setPose('shy');
            else if (pose === 'shy') setPose('idle');
            else blink(now);
        }

        function update(now) {
            if (reduceMotion && mode !== 'show') return sitStill(now);

            if (mode === 'wander') {
                if (pointerNear(now)) return startle(now, 450);
                if (now >= nextTrickAt) return trick(now);
                if (now >= nextWanderAt) pickWanderTarget(now);
                blink(now);
            } else if (mode === 'startled') {
                if (now >= modeUntil) flee(now);
            } else if (mode === 'hiding') {
                Object.assign(target, entrySpot(hideout.getBoundingClientRect()));
                if (distance(pos, target) < 8 || now >= modeUntil) hide(now, rand(1400, 2600));
            } else if (mode === 'hidden') {
                Object.assign(target, hideSpot(hideout, hideout.getBoundingClientRect()));
                if (now >= modeUntil) peek(now);
            } else if (mode === 'peeking') {
                Object.assign(target, peekSpot(peekSide, hideout, hideout.getBoundingClientRect()));
                if (pointerNear(now)) {
                    // Spotted while peeking: duck back and try another side
                    setPose('shy');
                    hide(now, rand(1000, 1800));
                } else if (now >= modeUntil) {
                    boo(now);
                }
            } else if (mode === 'show' && now >= modeUntil) {
                nextStep(now);
            }
        }

        // Glides toward its target, returns the speed in px/s
        function move(dt) {
            if (reduceMotion) {
                pos.x = target.x;
                pos.y = target.y;
                return 0;
            }

            const ease = 1 - Math.exp(-pace.k * dt);
            let dx = (target.x - pos.x) * ease;
            let dy = (target.y - pos.y) * ease;
            const step = Math.hypot(dx, dy);
            const maxStep = pace.max * dt;
            if (step > maxStep) {
                dx *= maxStep / step;
                dy *= maxStep / step;
            }
            pos.x += dx;
            pos.y += dy;

            if (mode === 'wander' || mode === 'show') {
                // Stay (mostly) on screen while drifting along with the scroll
                const b = bounds();
                pos.x = clamp(pos.x, b.minX - W / 2, b.maxX + W / 2);
                pos.y = clamp(pos.y, b.minY - H / 2, b.maxY + H / 2);
            }

            const vx = dx / dt;
            tilt += (clamp(vx * 0.04, -10, 10) - tilt) * Math.min(1, dt * 5);
            if (mode !== 'peeking') {
                if (vx < -50) el.classList.add('is-flipped');
                else if (vx > 50) el.classList.remove('is-flipped');
            }
            return Math.hypot(dx, dy) / dt;
        }

        function sparkle() {
            const size = rand(9, 16);
            const x = pos.x + W / 2 + rand(-0.3, 0.3) * W - size / 2;
            const y = pos.y + H * 0.85 + rand(-6, 6) - size / 2;
            const s = document.createElement('img');
            s.className = 'ghost-sparkle';
            s.src = `${IMG_DIR}sparkle.svg`;
            s.alt = '';
            s.setAttribute('aria-hidden', 'true');
            s.style.width = `${size}px`;
            s.style.height = `${size}px`;
            // Placed with left/top so the twinkle's rotate and scale stay centred on the sparkle itself
            s.style.left = `${x}px`;
            s.style.top = `${y}px`;
            s.addEventListener('animationend', () => s.remove());
            document.body.appendChild(s);
        }

        function render(now, speed) {
            el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${tilt}deg)`;
            if (!reduceMotion && speed > 60 && now - lastSparkleAt > 110 && !el.classList.contains('is-behind')) {
                lastSparkleAt = now;
                sparkle();
            }
        }

        function frame(now) {
            const dt = Math.max(Math.min((now - lastFrame) / 1000, 0.05), 0.001);
            lastFrame = now;
            update(now);
            render(now, move(dt));
            frameId = requestAnimationFrame(frame);
        }

        // 5. Page events
        function onScroll() {
            const dy = window.scrollY - lastScrollY;
            lastScrollY = window.scrollY;
            if (reduceMotion) return;

            // The scroll carries it along with the page for a moment, then it floats back into view
            pos.y -= dy;
            if (mode === 'wander') {
                const b = bounds();
                target.y = clamp(target.y - dy * 0.4, b.minY, b.maxY);
            }
        }

        function onResize() {
            W = el.offsetWidth;
            H = el.offsetHeight;
        }

        function onPointerMove(e) {
            if (e.pointerType === 'mouse') pointer = { x: e.clientX, y: e.clientY };
        }

        function onMouseOut(e) {
            if (!e.relatedTarget) pointer = null;
        }

        el.addEventListener('pointerdown', e => {
            e.preventDefault();
            const now = performance.now();
            // Phones have no cursor to run from, so a tap either scares it into hiding or catches it
            if (e.pointerType !== 'mouse' && !reduceMotion && Math.random() < 0.5) {
                fleeAfter = 0;
                startle(now, 300);
            } else {
                caught(now);
            }
        });
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('mouseout', onMouseOut);

        function begin() {
            const now = performance.now();
            const profile = document.querySelector('.profile-placeholder');
            const b = bounds();

            lastFrame = now;
            lastScrollY = window.scrollY;
            setPose('idle');
            pos.x = clamp((window.innerWidth - W) / 2, b.minX, b.maxX);
            pos.y = clamp(window.innerHeight * 0.4, b.minY, b.maxY);

            if (onLoad && !reduceMotion) {
                hideout = profile && isUsable(profile, profile.getBoundingClientRect()) ? profile : pickHideout();
            }
            if (hideout) {
                // On page load it starts hidden behind the photo (or a card), then peekaboo
                Object.assign(pos, hideSpot(hideout, hideout.getBoundingClientRect()));
                Object.assign(target, pos);
                hide(now, 900);
            } else if (reduceMotion) {
                wander(now);
            } else {
                boo(now);
            }

            render(now, 0);
            el.classList.remove('is-gone');
            frameId = requestAnimationFrame(frame);
        }

        // Give the page's own fade-in a moment to finish on first load
        const startTimer = setTimeout(begin, onLoad ? 1000 : 0);

        return {
            destroy() {
                clearTimeout(startTimer);
                cancelAnimationFrame(frameId);
                window.removeEventListener('scroll', onScroll);
                window.removeEventListener('resize', onResize);
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('mouseout', onMouseOut);
                setBehind(false);
                setPose('shy');
                el.classList.add('is-gone');
                setTimeout(() => el.remove(), 400);
            }
        };
    }
});
