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

// Processing modal elements
const processingModal = document.getElementById('processingModal');
const processingStatus = document.getElementById('processingStatus');
const processingProgress = document.getElementById('processingProgress');

// Auth elements
const adminBtn = document.getElementById('adminBtn');
const loginModal = document.getElementById('loginModal');
const loginBackdrop = document.getElementById('loginBackdrop');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
let isAuthenticated = false;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadVideos();
    loadPopularTags();
    checkAuthStatus();
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

    // Auth
    adminBtn.addEventListener('click', handleAdminClick);
    closeLoginModal.addEventListener('click', hideLoginModal);
    loginBackdrop.addEventListener('click', hideLoginModal);
    loginForm.addEventListener('submit', handleLogin);

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

                // Show processing modal when upload reaches 100%
                if (percent === 100) {
                    uploadProgress.classList.add('hidden');
                    showProcessingModal();
                }
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);

                // Hide processing modal and show success
                hideProcessingModal();
                showStatus('Video uploaded successfully! 🎉', 'success');

                // Reset form
                uploadForm.reset();
                clearFileSelection();
                titleInput.value = '';

                // Reload videos
                loadVideos();
                loadPopularTags();
            } else {
                hideProcessingModal();
                const error = JSON.parse(xhr.responseText);
                showStatus(error.error || 'Upload failed', 'error');
            }

            uploadBtn.disabled = false;
            progressBar.style.width = '0%';
            progressPercent.textContent = '0%';
        });

        xhr.addEventListener('error', () => {
            hideProcessingModal();
            showStatus('Network error. Please try again.', 'error');
            uploadBtn.disabled = false;
            uploadProgress.classList.add('hidden');
        });

        xhr.open('POST', `${API_BASE}/api/upload`);
        xhr.send(formData);

    } catch (error) {
        console.error('Upload error:', error);
        hideProcessingModal();
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

    const contentRating = video.content_rating || 'SAFE';
    const needsBlur = (contentRating === 'R' || contentRating === 'XXX');
    const ratingClass = `rating-${contentRating.toLowerCase().replace('-', '')}`;

    card.innerHTML = `
    <div class="video-thumbnail relative ${needsBlur ? 'thumbnail-blurred' : ''}" ${needsBlur ? `onclick="event.stopPropagation(); this.classList.toggle('revealed')"` : ''}>
      <video preload="metadata">
        <source src="${videoUrl}#t=0.5" type="video/mp4">
      </video>
      <div class="play-overlay">
        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
        </svg>
      </div>
      ${needsBlur ? `
      <div class="mature-warning text-white">
        <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <p class="text-sm font-semibold">${contentRating} Content</p>
        <p class="text-xs mt-1">Click to reveal</p>
      </div>
      ` : ''}
      <span class="rating-badge ${ratingClass} absolute top-2 left-2 z-10">${contentRating}</span>
    </div>
    <div class="p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-semibold text-white truncate flex-1">${escapeHtml(video.title)}</h3>
        ${isAuthenticated ? `
        <button class="ml-2 p-1 text-red-400 hover:text-red-300 transition-colors" data-video-id="${video.id}" onclick="event.stopPropagation(); deleteVideo(${video.id})" title="Delete video">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
        ` : ''}
      </div>
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
        <div><span class="text-dark-400">Views:</span> <span class="text-white">${video.views || 0}</span></div>
  `;

    // Render ComfyUI metadata if available
    const comfyMetadata = video.metadata?.comfyui;
    const modalComfyMetadata = document.getElementById('modalComfyMetadata');

    // Check if we need to parse the prompt (for old videos with raw JSON)
    let parsedComfy = comfyMetadata;
    if (comfyMetadata?.prompt && typeof comfyMetadata.prompt === 'string') {
        // Try to detect if it's raw JSON workflow
        if (comfyMetadata.prompt.trim().startsWith('{') && comfyMetadata.prompt.includes('class_type')) {
            // It's a raw workflow JSON - parse it client-side
            parsedComfy = parseComfyUIWorkflowClient(comfyMetadata.prompt);
        }
    }

    if (parsedComfy && Object.values(parsedComfy).some(v => v !== null && v !== '' && (Array.isArray(v) ? v.length > 0 : true))) {
        const comfyContent = document.getElementById('comfyMetadataContent');
        let html = '';

        // Add download workflow button if workflow exists
        if (comfyMetadata?.workflow || parsedComfy.workflow) {
            html += `
                <div class="mb-3 flex justify-end">
                    <a href="/api/videos/${video.id}/workflow" 
                       download="${video.title.replace(/[^a-z0-9]/gi, '_')}_workflow.json"
                       class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded transition-colors">
                        <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                        Download Workflow
                    </a>
                </div>
            `;
        }

        // Prompt (formatted nicely)
        if (parsedComfy.prompt && typeof parsedComfy.prompt === 'string') {
            html += `
                <div class="mb-3">
                    <div class="text-sm font-semibold text-primary-400 mb-1">Prompt</div>
                    <div class="text-sm text-white bg-dark-900/70 rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto">${escapeHtml(parsedComfy.prompt)}</div>
                </div>
            `;
        }

        // Negative Prompt  
        if (parsedComfy.negativePrompt && typeof parsedComfy.negativePrompt === 'string') {
            html += `
                <div class="mb-3">
                    <div class="text-sm font-semibold text-red-400 mb-1">Negative Prompt</div>
                    <div class="text-sm text-dark-300 bg-dark-900/70 rounded p-2 text-xs max-h-24 overflow-y-auto">${escapeHtml(parsedComfy.negativePrompt.substring(0, 300))}${parsedComfy.negativePrompt.length > 300 ? '...' : ''}</div>
                </div>
            `;
        }

        // Generation settings grid
        html += '<div class="grid grid-cols-2 gap-2 text-sm mb-3">';

        if (parsedComfy.model) {
            const modelName = parsedComfy.model.split('/').pop().replace('.safetensors', '');
            html += `<div><span class="text-dark-400">Model:</span> <span class="text-white text-xs">${escapeHtml(modelName)}</span></div>`;
        }

        if (parsedComfy.generationType) {
            html += `<div><span class="text-dark-400">Type:</span> <span class="text-primary-400">${escapeHtml(parsedComfy.generationType)}</span></div>`;
        }

        if (parsedComfy.steps) {
            html += `<div><span class="text-dark-400">Steps:</span> <span class="text-white">${parsedComfy.steps}</span></div>`;
        }

        if (parsedComfy.cfg) {
            html += `<div><span class="text-dark-400">CFG:</span> <span class="text-white">${parsedComfy.cfg}</span></div>`;
        }

        if (parsedComfy.seed !== null && parsedComfy.seed !== undefined) {
            html += `<div><span class="text-dark-400">Seed:</span> <span class="text-white">${parsedComfy.seed}</span></div>`;
        }

        if (parsedComfy.scheduler) {
            html += `<div><span class="text-dark-400">Scheduler:</span> <span class="text-white">${escapeHtml(parsedComfy.scheduler)}</span></div>`;
        }

        if (parsedComfy.resolution) {
            html += `<div><span class="text-dark-400">Resolution:</span> <span class="text-white">${parsedComfy.resolution}</span></div>`;
        }

        if (parsedComfy.frameRate) {
            html += `<div><span class="text-dark-400">Frame Rate:</span> <span class="text-white">${parsedComfy.frameRate} fps</span></div>`;
        }

        if (parsedComfy.numFrames) {
            html += `<div><span class="text-dark-400">Frames:</span> <span class="text-white">${parsedComfy.numFrames}</span></div>`;
        }

        html += '</div>';

        // LoRAs
        if (parsedComfy.loras && parsedComfy.loras.length > 0) {
            html += '<div class="mb-2"><div class="text-sm font-semibold text-primary-400 mb-1">LoRAs</div>';
            parsedComfy.loras.forEach(lora => {
                const loraName = lora.name.replace('.safetensors', '');
                html += `<div class="text-xs text-white bg-dark-900/50 rounded px-2 py-1 mb-1">
                    ${escapeHtml(loraName)} <span class="text-dark-400">(${lora.strength})</span>
                </div>`;
            });
            html += '</div>';
        }

        // VAE and CLIP models
        const models = [];
        if (parsedComfy.vaeModel) {
            models.push(`VAE: ${parsedComfy.vaeModel.replace('.safetensors', '')}`);
        }
        if (parsedComfy.clipModel) {
            models.push(`CLIP: ${parsedComfy.clipModel.replace('.safetensors', '')}`);
        }
        if (models.length > 0) {
            html += `<div class="text-xs text-dark-400 mt-2">${escapeHtml(models.join(' • '))}</div>`;
        }

        comfyContent.innerHTML = html;
        modalComfyMetadata.classList.remove('hidden');
    } else {
        modalComfyMetadata.classList.add('hidden');
    }

    videoModal.classList.remove('hidden');
    videoModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Client-side ComfyUI workflow parser (for old videos with raw JSON)
function parseComfyUIWorkflowClient(workflowData) {
    const parsed = {
        prompt: null,
        negativePrompt: null,
        model: null,
        loras: [],
        steps: null,
        cfg: null,
        seed: null,
        scheduler: null,
        resolution: null,
        frameRate: null,
        numFrames: null
    };

    // If it's a string, try to parse it
    if (typeof workflowData === 'string') {
        try {
            workflowData = JSON.parse(workflowData);
        } catch (e) {
            // Not JSON, treat as plain prompt
            parsed.prompt = workflowData;
            return parsed;
        }
    }

    if (!workflowData || typeof workflowData !== 'object') {
        return parsed;
    }

    // Iterate through all nodes to extract information
    Object.values(workflowData).forEach(node => {
        if (!node || !node.inputs) return;

        const inputs = node.inputs;
        const classType = node.class_type;

        // Extract positive prompt from ImpactWildcardProcessor
        if (classType === 'ImpactWildcardProcessor' && inputs.populated_text) {
            parsed.prompt = inputs.populated_text;
        }

        // Extract prompt from CLIPTextEncode (fallback)
        if (!parsed.prompt && classType === 'CLIPTextEncode' && inputs.text) {
            const text = inputs.text;
            if (typeof text === 'string' && text.length > 10 && !text.includes('低质量') && !text.includes('worst quality')) {
                parsed.prompt = text;
            } else if (typeof text === 'string' && (text.includes('低质量') || text.includes('worst quality'))) {
                parsed.negativePrompt = text;
            }
        }

        // Extract model information
        if (classType === 'WanVideoModelLoader' && inputs.model) {
            if (!parsed.model || inputs.model.includes('HIGH')) {
                parsed.model = inputs.model;
            }
        }

        // Extract LoRA information
        if (classType === 'WanVideoLoraSelect' && inputs.lora && inputs.lora !== 'none') {
            parsed.loras.push({
                name: inputs.lora,
                strength: inputs.strength || 1.0
            });
        }

        // Extract sampler settings
        if (classType === 'WanVideoSampler') {
            if (inputs.steps) parsed.steps = inputs.steps;
            if (inputs.cfg) parsed.cfg = inputs.cfg;
            if (inputs.seed !== undefined) parsed.seed = inputs.seed;
            if (inputs.scheduler) parsed.scheduler = inputs.scheduler;
        }

        // Extract video settings
        if (classType === 'VHS_VideoCombine' && inputs.frame_rate) {
            parsed.frameRate = inputs.frame_rate;
        }

        // Extract frame count and resolution
        if (classType === 'WanVideoEmptyEmbeds') {
            if (inputs.num_frames) parsed.numFrames = inputs.num_frames;
            if (inputs.width && inputs.height) {
                parsed.resolution = `${inputs.width}x${inputs.height}`;
            }
        }

        // Extract aspect ratio
        if (classType === 'Width and height from aspect ratio 🦴' && inputs.aspect_ratio) {
            parsed.aspectRatio = inputs.aspect_ratio;
        }

        // Extract INTConstant for steps
        if (classType === 'INTConstant' && inputs.value && !parsed.steps) {
            if (inputs.value >= 1 && inputs.value <= 50) {
                parsed.steps = inputs.value;
            }
        }
    });

    // If steps is still an array reference, try to resolve it
    if (!parsed.steps) {
        Object.values(workflowData).forEach(node => {
            if (node?.inputs?.steps && typeof node.inputs.steps === 'object' && Array.isArray(node.inputs.steps)) {
                const refNodeId = node.inputs.steps[0];
                const refNode = workflowData[refNodeId];
                if (refNode?.inputs?.value) {
                    parsed.steps = refNode.inputs.value;
                }
            }
        });
    }

    return parsed;
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

// ===== Authentication Functions =====

async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/status`);
        const data = await response.json();
        isAuthenticated = data.isAuthenticated;
        updateAuthUI();
    } catch (error) {
        console.error('Error checking auth status:', error);
        isAuthenticated = false;
        updateAuthUI();
    }
}

function updateAuthUI() {
    if (isAuthenticated) {
        adminBtn.textContent = 'Logout';
        adminBtn.classList.remove('bg-primary-600', 'hover:bg-primary-700');
        adminBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
        adminBtn.textContent = 'Admin Login';
        adminBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        adminBtn.classList.add('bg-primary-600', 'hover:bg-primary-700');
    }
}

function handleAdminClick() {
    if (isAuthenticated) {
        // Logout
        logout();
    } else {
        // Show login modal
        showLoginModal();
    }
}

function showLoginModal() {
    loginModal.classList.remove('hidden');
    loginError.classList.add('hidden');
    loginForm.reset();
}

function hideLoginModal() {
    loginModal.classList.add('hidden');
    loginError.classList.add('hidden');
}

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    loginError.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            isAuthenticated = true;
            updateAuthUI();
            hideLoginModal();
            loadVideos(); // Reload to show delete buttons
        } else {
            showLoginError(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('Network error. Please try again.');
    }
}

async function logout() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST'
        });

        if (response.ok) {
            isAuthenticated = false;
            updateAuthUI();
            loadVideos(); // Reload to hide delete buttons
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}

async function deleteVideo(videoId) {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/videos/${videoId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            // Reload videos
            loadVideos();
        } else {
            alert(data.error || 'Failed to delete video');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete video. Please try again.');
    }
}

// Processing Modal Functions
function showProcessingModal() {
    processingModal.classList.remove('hidden');
    processingProgress.style.width = '0%';
    processingStatus.textContent = 'Analyzing content and generating tags...';

    // Animate progress bar
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // Cap at 90% until actually done
        processingProgress.style.width = `${progress}%`;

        // Update status text
        if (progress < 30) {
            processingStatus.textContent = 'Extracting video frames...';
        } else if (progress < 50) {
            processingStatus.textContent = 'Generating tags and ratings...';
        } else if (progress < 80) {
            processingStatus.textContent = 'Checking content moderation...';
        } else {
            processingStatus.textContent = 'Analyzing content with AI...';
        }
    }, 300);

    // Store interval ID to clear it later
    processingModal.dataset.intervalId = interval;
}

function hideProcessingModal() {
    // Complete the progress bar
    processingProgress.style.width = '100%';
    processingStatus.textContent = 'Complete!';

    // Clear animation interval
    const intervalId = processingModal.dataset.intervalId;
    if (intervalId) {
        clearInterval(parseInt(intervalId));
    }

    // Hide modal after brief delay
    setTimeout(() => {
        processingModal.classList.add('hidden');
    }, 500);
}
