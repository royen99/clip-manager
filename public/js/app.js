// Clip Manager - Frontend Application

const API_BASE = window.location.origin;
let allVideos = [];
let currentVideo = null;

// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const dropZone = document.getElementById('dropZone');
const videoInput = document.getElementById('videoInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFile = document.getElementById('removeFile');
const titleInput = document.getElementById('titleInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const searchInput = document.getElementById('searchInput');
const popularTags = document.getElementById('popularTags');
const videoGrid = document.getElementById('videoGrid');
const loading = document.getElementById('loading');
const noResults = document.getElementById('noResults');
const videoCount = document.getElementById('videoCount');
const refreshBtn = document.getElementById('refreshBtn');
const videoModal = document.getElementById('videoModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModal = document.getElementById('closeModal');
const statsBtn = document.getElementById('statsBtn');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadVideos();
    loadPopularTags();
});

// Event Listeners
function setupEventListeners() {
    // File upload
    dropZone.addEventListener('click', () => videoInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    videoInput.addEventListener('change', handleFileSelect);
    removeFile.addEventListener('click', clearFileSelection);
    uploadForm.addEventListener('submit', handleUpload);

    // Search
    searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Refresh
    refreshBtn.addEventListener('click', () => {
        loadVideos();
        loadPopularTags();
    });

    // Modal
    closeModal.addEventListener('click', hideModal);
    modalBackdrop.addEventListener('click', hideModal);

    // Stats
    statsBtn.addEventListener('click', showStats);
}

// File Upload Handlers
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drop-zone-active');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drop-zone-active');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drop-zone-active');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        videoInput.files = files;
        handleFileSelect();
    }
}

function handleFileSelect() {
    const file = videoInput.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    if (!validTypes.includes(file.type)) {
        showStatus('Please select a valid video file (MP4, MOV, AVI, WebM, MKV)', 'error');
        return;
    }

    // Validate file size (100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
        showStatus('File size must be less than 100MB', 'error');
        return;
    }

    // Display file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
}

function clearFileSelection() {
    videoInput.value = '';
    fileInfo.classList.add('hidden');
    uploadStatus.classList.add('hidden');
}

async function handleUpload(e) {
    e.preventDefault();

    const file = videoInput.files[0];
    if (!file) {
        showStatus('Please select a video file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', titleInput.value || file.name);

    uploadBtn.disabled = true;
    uploadProgress.classList.remove('hidden');
    uploadStatus.classList.add('hidden');

    try {
        const xhr = new XMLHttpRequest();

        // Upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                showStatus('Video uploaded successfully! 🎉', 'success');

                // Reset form
                uploadForm.reset();
                clearFileSelection();
                titleInput.value = '';

                // Reload videos
                setTimeout(() => {
                    loadVideos();
                    loadPopularTags();
                }, 1000);
            } else {
                const error = JSON.parse(xhr.responseText);
                showStatus(error.error || 'Upload failed', 'error');
            }

            uploadBtn.disabled = false;
            uploadProgress.classList.add('hidden');
            progressBar.style.width = '0%';
            progressPercent.textContent = '0%';
        });

        xhr.addEventListener('error', () => {
            showStatus('Network error. Please try again.', 'error');
            uploadBtn.disabled = false;
            uploadProgress.classList.add('hidden');
        });

        xhr.open('POST', `${API_BASE}/api/upload`);
        xhr.send(formData);

    } catch (error) {
        console.error('Upload error:', error);
        showStatus('Upload failed. Please try again.', 'error');
        uploadBtn.disabled = false;
        uploadProgress.classList.add('hidden');
    }
}

// Video Loading
async function loadVideos(searchQuery = null) {
    loading.classList.remove('hidden');
    videoGrid.innerHTML = '';
    noResults.classList.add('hidden');

    try {
        let url = `${API_BASE}/api/videos`;
        if (searchQuery) {
            url = `${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        allVideos = data.videos || [];
        loading.classList.add('hidden');

        if (allVideos.length === 0) {
            noResults.classList.remove('hidden');
            videoCount.textContent = '';
            return;
        }

        videoCount.textContent = `(${allVideos.length} ${allVideos.length === 1 ? 'video' : 'videos'})`;
        renderVideos(allVideos);

    } catch (error) {
        console.error('Error loading videos:', error);
        loading.classList.add('hidden');
        showStatus('Failed to load videos', 'error');
    }
}

function renderVideos(videos) {
    videoGrid.innerHTML = '';

    videos.forEach((video, index) => {
        const card = createVideoCard(video, index);
        videoGrid.appendChild(card);
    });
}

function createVideoCard(video, index) {
    const card = document.createElement('div');
    card.className = 'video-card bg-dark-800/50 backdrop-blur-xl rounded-xl border border-dark-700 overflow-hidden cursor-pointer';
    card.style.animationDelay = `${index * 0.05}s`;

    const videoUrl = `${API_BASE}/uploads/${video.filename}`;
    const uploadDate = new Date(video.upload_date).toLocaleDateString();

    card.innerHTML = `
    <div class="video-thumbnail">
      <video preload="metadata">
        <source src="${videoUrl}#t=0.5" type="video/mp4">
      </video>
      <div class="play-overlay">
        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
        </svg>
      </div>
    </div>
    <div class="p-4">
      <h3 class="font-semibold text-white mb-2 truncate">${escapeHtml(video.title)}</h3>
      <div class="flex items-center justify-between text-sm text-dark-400 mb-3">
        <span>${uploadDate}</span>
        <span>${video.duration ? formatDuration(video.duration) : 'N/A'}</span>
      </div>
      <div class="flex flex-wrap gap-1 mb-2">
        ${video.tags.slice(0, 3).map(tag => `
          <span class="tag text-xs">${escapeHtml(tag.name)}</span>
        `).join('')}
        ${video.tags.length > 3 ? `<span class="text-xs text-dark-500">+${video.tags.length - 3} more</span>` : ''}
      </div>
      ${video.views ? `<div class="text-xs text-dark-500 mt-2">${video.views} views</div>` : ''}
    </div>
  `;

    card.addEventListener('click', () => showVideoModal(video));

    return card;
}

// Video Modal
function showVideoModal(video) {
    currentVideo = video;
    const videoUrl = `${API_BASE}/uploads/${video.filename}`;

    document.getElementById('modalTitle').textContent = video.title;
    document.getElementById('modalVideoSource').src = videoUrl;
    document.getElementById('modalVideo').load();

    // Render tags
    const modalTags = document.getElementById('modalTags');
    modalTags.innerHTML = video.tags.map(tag => `
    <span class="tag" onclick="searchByTag('${escapeHtml(tag.name)}')">${escapeHtml(tag.name)}</span>
  `).join('');

    // Render metadata
    const metadataContent = document.getElementById('metadataContent');
    const metadata = video.metadata?.basic || {};
    metadataContent.innerHTML = `
    <div><span class="text-dark-400">Duration:</span> <span class="text-white">${metadata.duration ? formatDuration(metadata.duration) : 'N/A'}</span></div>
    <div><span class="text-dark-400">Resolution:</span> <span class="text-white">${metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : 'N/A'}</span></div>
    <div><span class="text-dark-400">Format:</span> <span class="text-white">${metadata.format || 'N/A'}</span></div>
    <div><span class="text-dark-400">Size:</span> <span class="text-white">${formatFileSize(video.file_size)}</span></div>
    <div><span class="text-dark-400">Uploaded:</span> <span class="text-white">${new Date(video.upload_date).toLocaleString()}</span></div>
    <div><span class="text-dark-400">Views:</span> <span class="text-white">${video.views || 0}</span></div>
  `;

    // Render ComfyUI metadata if available
    const comfyMetadata = video.metadata?.comfyui;
    const modalComfyMetadata = document.getElementById('modalComfyMetadata');
    if (comfyMetadata && Object.values(comfyMetadata).some(v => v !== null)) {
        const comfyContent = document.getElementById('comfyMetadataContent');
        comfyContent.innerHTML = Object.entries(comfyMetadata)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => `
        <div><span class="text-dark-400">${key}:</span> <span class="text-white">${escapeHtml(String(value))}</span></div>
      `).join('');
        modalComfyMetadata.classList.remove('hidden');
    } else {
        modalComfyMetadata.classList.add('hidden');
    }

    videoModal.classList.remove('hidden');
    videoModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal() {
    videoModal.classList.add('hidden');
    videoModal.classList.remove('show');
    document.body.style.overflow = 'auto';
    document.getElementById('modalVideo').pause();
}

// Search
function handleSearch(e) {
    const query = e.target.value.trim();
    if (query) {
        loadVideos(query);
    } else {
        loadVideos();
    }
}

function searchByTag(tag) {
    searchInput.value = tag;
    loadVideos(tag);
    hideModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Popular Tags
async function loadPopularTags() {
    try {
        const response = await fetch(`${API_BASE}/api/tags`);
        const data = await response.json();

        const tags = data.tags || [];
        popularTags.innerHTML = tags.slice(0, 10).map(tag => `
      <button class="tag" onclick="searchByTag('${escapeHtml(tag.tag_name)}')">
        ${escapeHtml(tag.tag_name)} (${tag.count})
      </button>
    `).join('');
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

// Stats
function showStats() {
    const totalVideos = allVideos.length;
    const totalViews = allVideos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalSize = allVideos.reduce((sum, v) => sum + (v.file_size || 0), 0);
    const avgDuration = allVideos.reduce((sum, v) => sum + (v.duration || 0), 0) / totalVideos;

    alert(`📊 Statistics\n\nTotal Videos: ${totalVideos}\nTotal Views: ${totalViews}\nTotal Size: ${formatFileSize(totalSize)}\nAverage Duration: ${formatDuration(avgDuration)}`);
}

// Utility Functions
function showStatus(message, type = 'success') {
    uploadStatus.className = `status-${type}`;
    uploadStatus.textContent = message;
    uploadStatus.classList.remove('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
