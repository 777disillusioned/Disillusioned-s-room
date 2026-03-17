// ========== Wait for DOM ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready');

    // ========== GET ELEMENTS ==========
    const audio = document.getElementById('audio');
    const playPauseBtn = document.getElementById('play-pause');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const currentSongDisplay = document.getElementById('current-song');
    const playlistEl = document.getElementById('playlist');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeSpan = document.getElementById('current-time');
    const durationSpan = document.getElementById('duration');
    const volumeSlider = document.getElementById('volume-slider');
    const canvas = document.getElementById('visualizer');

    // Log to ensure elements exist
    console.log('audio:', audio);
    console.log('volumeSlider:', volumeSlider);
    console.log('progressBar:', progressBar);
    console.log('canvas:', canvas);

    if (!audio || !volumeSlider || !progressBar || !canvas) {
        console.error('Missing critical elements. Check IDs.');
        return;
    }

    // ========== PLAYLIST DATA ==========
    const songs = [
        { name: 'mineral - parking lot', file: 'songs/Parking Lot.mp3' },
        { name: 'american football - never meant', file: 'songs/Never Meant.mp3' },
        { name: 'sunny day real estate - in circles', file: 'songs/In Circles.mp3' },
        { name: 'shy the eternal - sixmas', file: 'songs/sixmas.mp3' },
        { name: 'mom jeans. - death cup', file: 'songs/Death Cup.mp3' },
        { name: 'deftones - entombed', file: 'songs/Entombed.mp3' },
        { name: 'dead calm - bleed', file: 'songs/Bleed.mp3' },
        { name: 'jaydes - poison', file: 'songs/poison.mp3' },
        { name: 'modern baseball - its cold out here', file: 'songs/It\'s Cold Out Here.mp3' }
    ];

    let currentSongIndex = 0;
    let isPlaying = false;

    // ========== HELPER FUNCTIONS ==========
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function loadSong(index) {
        const song = songs[index];
        audio.src = song.file;
        currentSongDisplay.textContent = song.name;
        // Highlight playlist item
        const items = playlistEl.querySelectorAll('li');
        items.forEach((item, i) => {
            if (i === index) item.classList.add('active-song');
            else item.classList.remove('active-song');
        });
        progressBar.value = 0;
        currentTimeSpan.textContent = '0:00';
        durationSpan.textContent = '0:00';
    }

    function playSong() {
        audio.play()
            .then(() => {
                isPlaying = true;
                playPauseBtn.textContent = '⏸';
                console.log('Playing');
            })
            .catch(e => {
                console.error('Play error:', e);
                isPlaying = false;
                playPauseBtn.textContent = '▶';
            });
    }

    function pauseSong() {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = '▶';
    }

    function togglePlayPause() {
        if (isPlaying) pauseSong();
        else playSong();
    }

    function nextSong() {
        currentSongIndex = (currentSongIndex + 1) % songs.length;
        loadSong(currentSongIndex);
        if (isPlaying) playSong();
    }

    function prevSong() {
        currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
        loadSong(currentSongIndex);
        if (isPlaying) playSong();
    }

    // ========== EVENT LISTENERS ==========
    // Volume slider (with both input and change for mobile)
    volumeSlider.addEventListener('input', function(e) {
        const val = parseFloat(e.target.value);
        audio.volume = val;
        console.log('Volume input:', val);
    });
    volumeSlider.addEventListener('change', function(e) {
        const val = parseFloat(e.target.value);
        audio.volume = val;
        console.log('Volume change:', val);
    });

    // Progress bar update
    audio.addEventListener('timeupdate', function() {
        if (audio.duration && isFinite(audio.duration)) {
            const percent = (audio.currentTime / audio.duration) * 100;
            progressBar.value = percent;
            currentTimeSpan.textContent = formatTime(audio.currentTime);
        }
    });

    audio.addEventListener('loadedmetadata', function() {
        durationSpan.textContent = formatTime(audio.duration);
    });

    // Seek
    progressBar.addEventListener('input', function(e) {
        if (audio.duration && isFinite(audio.duration)) {
            const seekTime = (e.target.value / 100) * audio.duration;
            audio.currentTime = seekTime;
            console.log('Seek to:', seekTime);
        }
    });

    // Playlist building
    songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.textContent = song.name;
        li.addEventListener('click', () => {
            currentSongIndex = index;
            loadSong(currentSongIndex);
            playSong();
        });
        playlistEl.appendChild(li);
    });

    playPauseBtn.addEventListener('click', togglePlayPause);
    nextBtn.addEventListener('click', nextSong);
    prevBtn.addEventListener('click', prevSong);
    audio.addEventListener('ended', nextSong);

    // Load first song
    loadSong(0);

// ========== VISUALIZER (FALLBACK) ==========
const w = 500;
const h = 100;
canvas.width = w;
canvas.height = h;
const ctx = canvas.getContext('2d');

let audioCtx, analyser, dataArray;
let webAudioSupported = false;

function initWebAudio() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        source.connect(analyser);
        source.connect(audioCtx.destination);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        webAudioSupported = true;
        console.log('Web Audio OK');
    } catch (e) {
        console.warn('Web Audio blocked, using animated fallback');
    }
}

// Call initWebAudio on first play attempt (any method)
const originalPlaySong = playSong;
playSong = function() {
    if (!webAudioSupported && !audioCtx) initWebAudio(); // try to init on first play
    originalPlaySong();
};

// Also keep the button click listener as a backup (though playSong already covers it)
playPauseBtn.addEventListener('click', function() {
    if (!webAudioSupported && !audioCtx) initWebAudio();
}, { once: true });

function draw() {
    requestAnimationFrame(draw);

    if (webAudioSupported && analyser && !audio.paused) {
        analyser.getByteFrequencyData(dataArray);
    }

    // Background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = '#993333';
    ctx.beginPath();
    ctx.moveTo(0, h/2);
    ctx.lineTo(w, h/2);
    ctx.stroke();

    // Draw bars
    const barCount = 64;
    const barWidth = w / barCount;
    for (let i = 0; i < barCount; i++) {
        let barHeight;
        if (webAudioSupported && !audio.paused && dataArray) {
            const idx = Math.floor(i * (dataArray.length / barCount));
            barHeight = dataArray[idx] / 2;
        } else {
            // Animated fallback
            barHeight = 20 + Math.sin(i * 0.5 + Date.now() * 0.005) * 15;
        }
        const gray = 100 + i;
        ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        ctx.fillRect(i * barWidth, h/2 - barHeight/2, barWidth - 2, barHeight);
    }
}
draw();

    // ========== NAVIGATION ==========
    window.navigate = function(page) {
        const home = document.getElementById('home');
        const about = document.getElementById('about');
        const navHome = document.getElementById('nav-home');
        const navAbout = document.getElementById('nav-about');
        
        home.classList.remove('active-section');
        about.classList.remove('active-section');
        navHome.classList.remove('active');
        navAbout.classList.remove('active');
        
        if (page === 'home') {
            home.classList.add('active-section');
            navHome.classList.add('active');
        } else if (page === 'about') {
            about.classList.add('active-section');
            navAbout.classList.add('active');
        }
    };

    // ========== GUESTBOOK ==========
    const guestbookForm = document.getElementById('guestbook-form');
    const guestbookEntries = document.getElementById('guestbook-entries');
    const nameInput = document.getElementById('guest-name');
    const messageInput = document.getElementById('guest-message');

    const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xgonpvbl';

    function loadGuestbook() {
        const entries = JSON.parse(localStorage.getItem('guestbook') || '[]');
        guestbookEntries.innerHTML = entries.map(entry => `
            <div class="guestbook-entry">
                <span class="name">${escapeHtml(entry.name)}</span>
                <div class="message">${escapeHtml(entry.message)}</div>
            </div>
        `).join('');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    guestbookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        const message = messageInput.value.trim();
        
        if (!name || !message) return;
        
        const submitBtn = guestbookForm.querySelector('button');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'sending...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch(FORMSPREE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, message })
            });
            
            if (response.ok) {
                const entries = JSON.parse(localStorage.getItem('guestbook') || '[]');
                entries.unshift({ name, message });
                if (entries.length > 15) entries.pop();
                localStorage.setItem('guestbook', JSON.stringify(entries));
                
                loadGuestbook();
                guestbookForm.reset();
                
                submitBtn.textContent = 'sent!';
                setTimeout(() => {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error('Formspree error');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            submitBtn.textContent = 'error';
            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 2000);
        }
    });

    loadGuestbook();

    // Initialize home section
    navigate('home');
    console.log('All systems go');
});