// ========== Wait for DOM ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready');

    // ========== GET ELEMENTS ==========
    const audio = document.getElementById('audio');
    const playPauseBtn = document.getElementById('play-pause');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const shuffleBtn = document.getElementById('shuffle');
    const currentSongDisplay = document.getElementById('current-song');
    const playlistEl = document.getElementById('playlist');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeSpan = document.getElementById('current-time');
    const durationSpan = document.getElementById('duration');
    const volumeSlider = document.getElementById('volume-slider');
    const canvas = document.getElementById('visualizer');
    const viewCountSpan = document.getElementById('site-view-count');
    const aboutBadge = document.getElementById('about-badge');

    if (!audio || !volumeSlider || !progressBar || !canvas) {
        console.error('Missing critical elements. Check IDs.');
        return;
    }

    // ========== SUPABASE SETUP ==========
    const supabaseUrl = 'https://mdpjutdhxreyeocbvnbn.supabase.co';
    const supabaseKey = 'sb_publishable_CqqVEZ_M6GO7cGlJYGtZPQ_6b0MgRCM';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // ========== PLAYLIST – LOAD FROM SUPABASE ==========
    let songs = [];
    let currentSongIndex = 0;
    let isPlaying = false;

    async function loadSongsFromDB() {
        const { data, error } = await supabase
            .from('songs')
            .select('*')
            .order('display_order', { ascending: true });
        if (error) {
            console.error('Error loading songs:', error);
            return;
        }
        songs = data.map(song => ({ id: song.id, name: song.name, file: song.file }));
        rebuildPlaylistUI();
        if (songs.length > 0) {
            if (currentSongIndex >= songs.length) currentSongIndex = 0;
            loadSong(currentSongIndex);
        }
    }

    // ========== HELPER FUNCTIONS ==========
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function rebuildPlaylistUI() {
        playlistEl.innerHTML = '';
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
        const items = playlistEl.querySelectorAll('li');
        if (items[currentSongIndex]) items[currentSongIndex].classList.add('active-song');
    }

    function loadSong(index) {
        const song = songs[index];
        audio.src = song.file;
        currentSongDisplay.textContent = song.name;
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

    function shufflePlaylist() {
        for (let i = songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [songs[i], songs[j]] = [songs[j], songs[i]];
        }
        currentSongIndex = 0;
        rebuildPlaylistUI();
        loadSong(currentSongIndex);
        if (isPlaying) playSong();
    }

    // ========== EVENT LISTENERS ==========
    volumeSlider.addEventListener('input', function(e) {
        audio.volume = parseFloat(e.target.value);
    });
    volumeSlider.addEventListener('change', function(e) {
        audio.volume = parseFloat(e.target.value);
    });

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

    progressBar.addEventListener('input', function(e) {
        if (audio.duration && isFinite(audio.duration)) {
            const seekTime = (e.target.value / 100) * audio.duration;
            audio.currentTime = seekTime;
        }
    });

    playPauseBtn.addEventListener('click', togglePlayPause);
    nextBtn.addEventListener('click', nextSong);
    prevBtn.addEventListener('click', prevSong);
    shuffleBtn.addEventListener('click', shufflePlaylist);
    audio.addEventListener('ended', nextSong);

    // ========== VISUALIZER ==========
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

    const originalPlaySong = playSong;
    playSong = function() {
        if (!webAudioSupported && !audioCtx) initWebAudio();
        originalPlaySong();
    };

    playPauseBtn.addEventListener('click', function() {
        if (!webAudioSupported && !audioCtx) initWebAudio();
    }, { once: true });

    function draw() {
        requestAnimationFrame(draw);
        if (webAudioSupported && analyser && !audio.paused) {
            analyser.getByteFrequencyData(dataArray);
        }
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#993333';
        ctx.beginPath();
        ctx.moveTo(0, h/2);
        ctx.lineTo(w, h/2);
        ctx.stroke();
        const barCount = 64;
        const barWidth = w / barCount;
        for (let i = 0; i < barCount; i++) {
            let barHeight;
            if (webAudioSupported && !audio.paused && dataArray) {
                const idx = Math.floor(i * (dataArray.length / barCount));
                barHeight = dataArray[idx] / 2;
            } else {
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
            markGuestbookRead();
        }
    };

    // ========== GUESTBOOK ==========
    const guestbookForm = document.getElementById('guestbook-form');
    const guestbookEntries = document.getElementById('guestbook-entries');
    const nameInput = document.getElementById('guest-name');
    const messageInput = document.getElementById('guest-message');
    const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xgonpvbl';

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function loadGuestbookFromDB() {
        const { data, error } = await supabase
            .from('guestbook_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) {
            console.error('Error loading guestbook:', error);
            return;
        }
        guestbookEntries.innerHTML = data.map(entry => `
            <div class="guestbook-entry">
                <span class="name">${escapeHtml(entry.name)}</span>
                <div class="message">${escapeHtml(entry.message)}</div>
            </div>
        `).join('');

        if (data.length > 0) {
            const latestTimestamp = data[0].created_at;
            const lastViewed = localStorage.getItem('lastGuestbookView');
            if (!lastViewed || new Date(latestTimestamp) > new Date(lastViewed)) {
                aboutBadge.style.display = 'inline';
            } else {
                aboutBadge.style.display = 'none';
            }
        }
    }

    async function saveGuestbookToDB(name, message) {
        const { error } = await supabase
            .from('guestbook_messages')
            .insert([{ name, message }]);
        return !error;
    }

    function markGuestbookRead() {
        localStorage.setItem('lastGuestbookView', new Date().toISOString());
        aboutBadge.style.display = 'none';
    }

    guestbookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        const message = messageInput.value.trim();
        if (!name || !message) return;
        
        const submitBtn = guestbookForm.querySelector('button');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'saving...';
        submitBtn.disabled = true;
        
        const saved = await saveGuestbookToDB(name, message);
        
        if (saved) {
            try {
                await fetch(FORMSPREE_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, message })
                });
            } catch (e) {
                console.log('Email send failed (non-critical)');
            }
            
            guestbookForm.reset();
            await loadGuestbookFromDB();
            markGuestbookRead();
            
            submitBtn.textContent = 'sent!';
            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 2000);
        } else {
            submitBtn.textContent = 'error';
            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 2000);
        }
    });

    loadGuestbookFromDB();

    // ========== PAGE VIEW TRACKING ==========
    async function trackOverallView() {
        if (sessionStorage.getItem('viewCounted')) return;
        
        const { error } = await supabase.rpc('increment_site_view');
        if (error) {
            console.error('Error tracking view:', error);
            return;
        }
        sessionStorage.setItem('viewCounted', 'true');
        fetchViewCount();
    }

    async function fetchViewCount() {
        const { data, error } = await supabase
            .from('site_stats')
            .select('view_count')
            .eq('id', 1)
            .single();
        if (!error && data) {
            viewCountSpan.textContent = `visitors: ${data.view_count}`;
        }
    }

    // ========== LINKS SECTION (public) ==========
    async function loadLinks() {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .order('display_order', { ascending: true });
        if (error) {
            console.error('Error loading links:', error);
            return;
        }
        const linksList = document.getElementById('links-list');
        linksList.innerHTML = data.map(link => `
            <li>
                ${link.icon_url 
                    ? `<img src="${link.icon_url}" class="link-icon-img" alt="${link.title}">` 
                    : `<span class="link-icon">${link.icon || '🔗'}</span>`}
                <a href="${link.url}" target="_blank" rel="noopener">${link.title}</a>
            </li>
        `).join('');
    }

    // ========== ADMIN PANEL ==========
    // Get admin elements
    const adminTrigger = document.getElementById('admin-trigger');
    const adminModal = document.getElementById('admin-modal');
    const closeModal = document.getElementById('close-modal');
    const adminLoginBtn = document.getElementById('admin-login');
    const adminPassword = document.getElementById('admin-password');
    const adminPanel = document.getElementById('admin-panel');
    const adminLinksList = document.getElementById('admin-links-list');
    const adminSongsList = document.getElementById('admin-songs-list');
    const addLinkBtn = document.getElementById('add-link');
    const addSongBtn = document.getElementById('add-song');
    const newLinkTitle = document.getElementById('new-link-title');
    const newLinkUrl = document.getElementById('new-link-url');
    const newLinkIcon = document.getElementById('new-link-icon');
    const addLinkSubmit = document.getElementById('add-link-submit');

    // Site settings elements
    const bgUpload = document.getElementById('bg-upload');
    const uploadBgBtn = document.getElementById('upload-bg');
    const bgPreview = document.getElementById('bg-preview');
    const bgOpacitySlider = document.getElementById('bg-opacity');
    const bgOpacityVal = document.getElementById('bg-opacity-val');
    const surfaceOpacitySlider = document.getElementById('surface-opacity');
    const surfaceOpacityVal = document.getElementById('surface-opacity-val');
    const noteOpacitySlider = document.getElementById('note-opacity');
    const noteOpacityVal = document.getElementById('note-opacity-val');
    const playlistOpacitySlider = document.getElementById('playlist-opacity');
    const playlistOpacityVal = document.getElementById('playlist-opacity-val');
    const guestbookOpacitySlider = document.getElementById('guestbook-opacity');
    const guestbookOpacityVal = document.getElementById('guestbook-opacity-val');
    const saveOpacityBtn = document.getElementById('save-opacity');
    const blurSlider = document.getElementById('blur-intensity');
    const blurVal = document.getElementById('blur-val');
    const saveBlurBtn = document.getElementById('save-blur');
    const saveAllBtn = document.getElementById('save-all-settings');

    // Color pickers
    const colorBg = document.getElementById('color-bg');
    const colorSurface = document.getElementById('color-surface');
    const colorText = document.getElementById('color-text');
    const colorMuted = document.getElementById('color-muted');
    const colorAccent = document.getElementById('color-accent');
    const colorAccentDim = document.getElementById('color-accent-dim');
    const colorBorder = document.getElementById('color-border');
    const saveColorsBtn = document.getElementById('save-colors');

    const ADMIN_PASSWORD = '8738Trev!@#';

    // Admin modal controls
    adminTrigger.addEventListener('click', () => {
        adminModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', () => {
        adminModal.style.display = 'none';
        adminPassword.value = '';
        adminPanel.style.display = 'none';
    });

    adminLoginBtn.addEventListener('click', () => {
        if (adminPassword.value === ADMIN_PASSWORD) {
            adminPanel.style.display = 'block';
            loadAdminLinks();
            loadAdminSongs();
            adminPassword.value = '';
        } else {
            alert('Wrong password');
        }
    });

    // Keyboard shortcuts
    adminPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            adminLoginBtn.click();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && adminModal.style.display === 'flex') {
            closeModal.click();
        }
    });

    // ===== ADMIN LINK FUNCTIONS =====
    async function loadAdminLinks() {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .order('display_order', { ascending: true });
        if (error) {
            console.error('Error loading links for admin:', error);
            return;
        }
        adminLinksList.innerHTML = data.map(link => `
            <li data-id="${link.id}">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div class="link-icon-preview" style="width:32px; height:32px; position:relative;">
                        ${link.icon_url ? `<img src="${link.icon_url}" style="width:100%; height:100%; object-fit: contain;">` : ''}
                        <span class="fallback-emoji" style="${link.icon_url ? 'display:none;' : ''}">${link.icon || '🔗'}</span>
                    </div>
                    <input type="text" value="${escapeHtml(link.title)}" placeholder="title" class="link-title" style="flex:2;">
                    <input type="text" value="${escapeHtml(link.url)}" placeholder="url" class="link-url" style="flex:3;">
                    <input type="file" accept="image/*" class="upload-icon" style="display: none;" data-id="${link.id}">
                    <button class="upload-icon-btn" data-id="${link.id}">📷</button>
                    <button class="save-link" data-id="${link.id}">💾</button>
                    <button class="delete-link" data-id="${link.id}">🗑️</button>
                </div>
            </li>
        `).join('');

        document.querySelectorAll('.save-link').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const li = e.target.closest('li');
                const id = li.dataset.id;
                const title = li.querySelector('.link-title').value;
                const url = li.querySelector('.link-url').value;
                const { error } = await supabase
                    .from('links')
                    .update({ title, url })
                    .eq('id', id);
                if (error) console.error('Error updating link:', error);
                else {
                    loadLinks();
                    loadAdminLinks();
                }
            });
        });

        document.querySelectorAll('.delete-link').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const li = e.target.closest('li');
                const id = li.dataset.id;
                const { error } = await supabase
                    .from('links')
                    .delete()
                    .eq('id', id);
                if (error) console.error('Error deleting link:', error);
                else {
                    li.remove();
                    loadLinks();
                }
            });
        });

        document.querySelectorAll('.upload-icon-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                const id = this.dataset.id;
                const fileInput = document.querySelector(`.upload-icon[data-id="${id}"]`);
                fileInput.click();
            });
        });

        document.querySelectorAll('.upload-icon').forEach(input => {
            input.addEventListener('change', async function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const id = this.dataset.id;
                const fileName = `icon-${id}-${Date.now()}.${file.name.split('.').pop()}`;
                const { data, error } = await supabase.storage
                    .from('link-icons')
                    .upload(fileName, file, { cacheControl: '3600', upsert: true });
                if (error) {
                    console.error('Upload error:', error);
                    alert('Failed to upload image');
                    return;
                }
                const { publicURL } = supabase.storage.from('link-icons').getPublicUrl(fileName);
                const { error: updateError } = await supabase
                    .from('links')
                    .update({ icon_url: publicURL })
                    .eq('id', id);
                if (updateError) {
                    console.error('Error updating link with icon:', updateError);
                    alert('Image uploaded but failed to save to DB');
                } else {
                    loadAdminLinks();
                    loadLinks();
                }
            });
        });
    }

    // Add new link via form
    addLinkSubmit.addEventListener('click', async () => {
        const title = newLinkTitle.value.trim();
        const url = newLinkUrl.value.trim();
        const icon = newLinkIcon.value.trim() || '🔗';
        if (!title || !url) {
            alert('Please enter both name and URL');
            return;
        }
        const { error } = await supabase
            .from('links')
            .insert([{ title, url, icon, display_order: 999 }]);
        if (error) {
            console.error('Error adding link:', error);
            alert('Failed to add link');
        } else {
            newLinkTitle.value = '';
            newLinkUrl.value = '';
            newLinkIcon.value = '🔗';
            loadAdminLinks();
            loadLinks();
        }
    });

    if (addLinkBtn) {
        addLinkBtn.addEventListener('click', async () => {
            const { error } = await supabase
                .from('links')
                .insert([{ title: 'New Link', url: 'https://', icon: '🔗', display_order: 999 }]);
            if (error) console.error('Error adding link:', error);
            else loadAdminLinks();
        });
    }

    // ===== ADMIN SONG FUNCTIONS (using Supabase) =====
    async function loadAdminSongs() {
        const { data, error } = await supabase
            .from('songs')
            .select('*')
            .order('display_order', { ascending: true });
        if (error) {
            console.error('Error loading songs for admin:', error);
            return;
        }
        adminSongsList.innerHTML = data.map(song => `
            <li data-id="${song.id}">
                <input type="text" value="${escapeHtml(song.name)}" placeholder="song name" class="song-name">
                <input type="text" value="${escapeHtml(song.file)}" placeholder="file path" class="song-file">
                <button class="save-song">💾</button>
                <button class="delete-song">🗑️</button>
            </li>
        `).join('');

        document.querySelectorAll('.save-song').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const li = e.target.closest('li');
                const id = li.dataset.id;
                const name = li.querySelector('.song-name').value;
                const file = li.querySelector('.song-file').value;
                const { error } = await supabase
                    .from('songs')
                    .update({ name, file })
                    .eq('id', id);
                if (error) {
                    console.error('Error saving song:', error);
                    alert('Failed to save song');
                } else {
                    await loadSongsFromDB();   // reload player songs
                    loadAdminSongs();           // refresh admin list
                }
            });
        });

        document.querySelectorAll('.delete-song').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const li = e.target.closest('li');
                const id = li.dataset.id;
                const { error } = await supabase
                    .from('songs')
                    .delete()
                    .eq('id', id);
                if (error) {
                    console.error('Error deleting song:', error);
                    alert('Failed to delete song');
                } else {
                    await loadSongsFromDB();
                    loadAdminSongs();
                }
            });
        });
    }

    addSongBtn.addEventListener('click', async () => {
        const name = prompt('Enter song name:');
        if (!name) return;
        const file = prompt('Enter file path (e.g., songs/NewSong.mp3):');
        if (!file) return;
        const { error } = await supabase
            .from('songs')
            .insert([{ name, file, display_order: 999 }]);
        if (error) {
            console.error('Error adding song:', error);
            alert('Failed to add song');
        } else {
            await loadSongsFromDB();
            loadAdminSongs();
        }
    });

    // ========== SITE SETTINGS (Opacity, Blur, Upload, Colors) ==========
    async function loadSiteSettings() {
        const { data, error } = await supabase
            .from('site_settings')
            .select('*')
            .eq('id', 1)
            .single();
        if (error) {
            console.error('Error loading site settings:', error);
            return;
        }
        if (data) {
            if (data.background_image_url) {
                document.documentElement.style.setProperty('--bg-image', `url(${data.background_image_url})`);
                bgPreview.innerHTML = `<img src="${data.background_image_url}" style="max-width:100%; max-height:100px;">`;
            }
            bgOpacitySlider.value = data.bg_opacity || 1;
            bgOpacityVal.textContent = data.bg_opacity || 1;
            document.documentElement.style.setProperty('--bg-opacity', data.bg_opacity);

            surfaceOpacitySlider.value = data.surface_opacity || 1;
            surfaceOpacityVal.textContent = data.surface_opacity || 1;
            document.documentElement.style.setProperty('--surface-opacity', data.surface_opacity);

            noteOpacitySlider.value = data.note_opacity || 1;
            noteOpacityVal.textContent = data.note_opacity || 1;
            document.documentElement.style.setProperty('--note-opacity', data.note_opacity);

            playlistOpacitySlider.value = data.playlist_opacity || 1;
            playlistOpacityVal.textContent = data.playlist_opacity || 1;
            document.documentElement.style.setProperty('--playlist-opacity', data.playlist_opacity);

            guestbookOpacitySlider.value = data.guestbook_opacity || 1;
            guestbookOpacityVal.textContent = data.guestbook_opacity || 1;
            document.documentElement.style.setProperty('--guestbook-opacity', data.guestbook_opacity);

            blurSlider.value = data.blur_intensity || 0;
            blurVal.textContent = data.blur_intensity || 0;
            document.documentElement.style.setProperty('--blur-intensity', (data.blur_intensity || 0) + 'px');

            // Colors
            if (data.color_bg) {
                colorBg.value = data.color_bg;
                document.documentElement.style.setProperty('--bg', data.color_bg);
            }
            if (data.color_surface) {
                colorSurface.value = data.color_surface;
                document.documentElement.style.setProperty('--surface', data.color_surface);
            }
            if (data.color_text) {
                colorText.value = data.color_text;
                document.documentElement.style.setProperty('--text', data.color_text);
            }
            if (data.color_muted) {
                colorMuted.value = data.color_muted;
                document.documentElement.style.setProperty('--text-muted', data.color_muted);
            }
            if (data.color_accent) {
                colorAccent.value = data.color_accent;
                document.documentElement.style.setProperty('--accent', data.color_accent);
            }
            if (data.color_accent_dim) {
                colorAccentDim.value = data.color_accent_dim;
                document.documentElement.style.setProperty('--accent-dim', data.color_accent_dim);
            }
            if (data.color_border) {
                colorBorder.value = data.color_border;
                document.documentElement.style.setProperty('--border', data.color_border);
            }
        }
    }

    // Update slider displays
    bgOpacitySlider.addEventListener('input', () => bgOpacityVal.textContent = bgOpacitySlider.value);
    surfaceOpacitySlider.addEventListener('input', () => surfaceOpacityVal.textContent = surfaceOpacitySlider.value);
    noteOpacitySlider.addEventListener('input', () => noteOpacityVal.textContent = noteOpacitySlider.value);
    playlistOpacitySlider.addEventListener('input', () => playlistOpacityVal.textContent = playlistOpacitySlider.value);
    guestbookOpacitySlider.addEventListener('input', () => guestbookOpacityVal.textContent = guestbookOpacitySlider.value);
    blurSlider.addEventListener('input', () => blurVal.textContent = blurSlider.value);

    // Save opacity
    saveOpacityBtn.addEventListener('click', async () => {
        const updates = {
            bg_opacity: parseFloat(bgOpacitySlider.value),
            surface_opacity: parseFloat(surfaceOpacitySlider.value),
            note_opacity: parseFloat(noteOpacitySlider.value),
            playlist_opacity: parseFloat(playlistOpacitySlider.value),
            guestbook_opacity: parseFloat(guestbookOpacitySlider.value)
        };
        const { error } = await supabase
            .from('site_settings')
            .update(updates)
            .eq('id', 1);
        if (error) {
            console.error('Error saving opacity:', error);
            alert('Failed to save opacity');
        } else {
            Object.entries(updates).forEach(([key, val]) => {
                if (key === 'bg_opacity') document.documentElement.style.setProperty('--bg-opacity', val);
                if (key === 'surface_opacity') document.documentElement.style.setProperty('--surface-opacity', val);
                if (key === 'note_opacity') document.documentElement.style.setProperty('--note-opacity', val);
                if (key === 'playlist_opacity') document.documentElement.style.setProperty('--playlist-opacity', val);
                if (key === 'guestbook_opacity') document.documentElement.style.setProperty('--guestbook-opacity', val);
            });
            alert('Opacity saved');
        }
    });

    // Save blur
    saveBlurBtn.addEventListener('click', async () => {
        const blur = parseInt(blurSlider.value);
        const { error } = await supabase
            .from('site_settings')
            .update({ blur_intensity: blur })
            .eq('id', 1);
        if (error) {
            console.error('Error saving blur:', error);
            alert('Failed to save blur');
        } else {
            document.documentElement.style.setProperty('--blur-intensity', blur + 'px');
            alert('Blur saved');
        }
    });

    // Upload background image
    uploadBgBtn.addEventListener('click', async () => {
        const file = bgUpload.files[0];
        if (!file) {
            alert('Select a file first');
            return;
        }
        const fileName = `bg-${Date.now()}.${file.name.split('.').pop()}`;
        const { data, error } = await supabase.storage
            .from('site-assets')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });
        if (error) {
            console.error('Upload error:', error);
            alert('Upload failed: ' + error.message);
            return;
        }
        const { publicURL } = supabase.storage.from('site-assets').getPublicUrl(fileName);
        const { error: dbError } = await supabase
            .from('site_settings')
            .update({ background_image_url: publicURL })
            .eq('id', 1);
        if (dbError) {
            console.error('DB update error:', dbError);
            alert('Image uploaded but failed to save to DB');
        } else {
            document.documentElement.style.setProperty('--bg-image', `url(${publicURL})`);
            bgPreview.innerHTML = `<img src="${publicURL}" style="max-width:100%; max-height:100px;">`;
            alert('Background updated!');
        }
    });

    // Save colors
    saveColorsBtn.addEventListener('click', async () => {
        const colors = {
            color_bg: colorBg.value,
            color_surface: colorSurface.value,
            color_text: colorText.value,
            color_muted: colorMuted.value,
            color_accent: colorAccent.value,
            color_accent_dim: colorAccentDim.value,
            color_border: colorBorder.value
        };
        const { error } = await supabase
            .from('site_settings')
            .update(colors)
            .eq('id', 1);
        if (error) {
            console.error('Error saving colors:', error);
            alert('Failed to save colors');
        } else {
            document.documentElement.style.setProperty('--bg', colors.color_bg);
            document.documentElement.style.setProperty('--surface', colors.color_surface);
            document.documentElement.style.setProperty('--text', colors.color_text);
            document.documentElement.style.setProperty('--text-muted', colors.color_muted);
            document.documentElement.style.setProperty('--accent', colors.color_accent);
            document.documentElement.style.setProperty('--accent-dim', colors.color_accent_dim);
            document.documentElement.style.setProperty('--border', colors.color_border);
            alert('Colors saved');
        }
    });

    // Save all settings
    saveAllBtn.addEventListener('click', async () => {
        const settings = {
            bg_opacity: parseFloat(bgOpacitySlider.value),
            surface_opacity: parseFloat(surfaceOpacitySlider.value),
            note_opacity: parseFloat(noteOpacitySlider.value),
            playlist_opacity: parseFloat(playlistOpacitySlider.value),
            guestbook_opacity: parseFloat(guestbookOpacitySlider.value),
            blur_intensity: parseInt(blurSlider.value),
            color_bg: colorBg.value,
            color_surface: colorSurface.value,
            color_text: colorText.value,
            color_muted: colorMuted.value,
            color_accent: colorAccent.value,
            color_accent_dim: colorAccentDim.value,
            color_border: colorBorder.value
        };
        const { error } = await supabase
            .from('site_settings')
            .update(settings)
            .eq('id', 1);
        if (error) {
            console.error('Error saving all settings:', error);
            alert('Failed to save');
        } else {
            // Apply all
            document.documentElement.style.setProperty('--bg-opacity', settings.bg_opacity);
            document.documentElement.style.setProperty('--surface-opacity', settings.surface_opacity);
            document.documentElement.style.setProperty('--note-opacity', settings.note_opacity);
            document.documentElement.style.setProperty('--playlist-opacity', settings.playlist_opacity);
            document.documentElement.style.setProperty('--guestbook-opacity', settings.guestbook_opacity);
            document.documentElement.style.setProperty('--blur-intensity', settings.blur_intensity + 'px');
            document.documentElement.style.setProperty('--bg', settings.color_bg);
            document.documentElement.style.setProperty('--surface', settings.color_surface);
            document.documentElement.style.setProperty('--text', settings.color_text);
            document.documentElement.style.setProperty('--text-muted', settings.color_muted);
            document.documentElement.style.setProperty('--accent', settings.color_accent);
            document.documentElement.style.setProperty('--accent-dim', settings.color_accent_dim);
            document.documentElement.style.setProperty('--border', settings.color_border);
            alert('All settings saved!');
        }
    });

    // ========== INIT ==========
    trackOverallView();
    fetchViewCount();
    loadLinks();
    loadSongsFromDB();   // load songs from DB
    loadSiteSettings();
    navigate('home');
    console.log('All systems go with Supabase + new features');
});
