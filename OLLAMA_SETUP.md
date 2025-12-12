# Ollama Setup for AI Video Analysis

This guide shows you how to set up **free AI-powered video analysis** using Ollama with vision models.

## Why Ollama?

- ✅ **100% Free** - No API costs, no billing account required
- ✅ **Local or Remote** - Run on your machine or connect to a remote server
- ✅ **Privacy** - Your videos never leave your infrastructure
- ✅ **Open Source** - Uses models like LLaVA (vision language model)

## Installation

### Option 1: Local Ollama (on your Mac)

1. **Install Ollama:**
   ```bash
   # Download from https://ollama.ai or use Homebrew:
   brew install ollama
   ```

2. **Start Ollama service:**
   ```bash
   ollama serve
   ```
   
   This starts Ollama on `http://localhost:11434`

3. **Install vision model (LLaVA):**
   ```bash
   # LLaVA 7B (smaller, faster - recommended)
   ollama pull llava
   
   # Or LLaVA 13B (larger, more accurate)
   ollama pull llava:13b
   
   # Or BakLLaVA (alternative vision model)
   ollama pull bakllava
   ```

4. **Test it works:**
   ```bash
   ollama list
   # Should show llava in the list
   ```

### Option 2: Remote Ollama Server

If you have Ollama running on another machine:

1. Find the Ollama server URL (e.g., `http://your-server:11434`)

2. Update your configuration to point to the remote server

## Configuration

### For Docker (Recommended)

Update `docker-compose.yml`:

```yaml
services:
  clip-manager:
    environment:
      # ... other env vars ...
      - OLLAMA_HOST=http://host.docker.internal:11434  # For local Ollama
      # Or for remote: OLLAMA_HOST=http://your-server:11434
      - OLLAMA_MODEL=llava
      - FRAMES_TO_ANALYZE=3
      - ENABLE_CONTENT_MODERATION=true
      - ENABLE_AUTO_TAGGING=true
```

Then restart:
```bash
podman-compose down
podman-compose up -d
```

### For Local Installation

Update `.env`:
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llava
FRAMES_TO_ANALYZE=3
ENABLE_CONTENT_MODERATION=true
ENABLE_AUTO_TAGGING=true
```

## How It Works

1. **Frame Extraction**: When a video is uploaded, FFmpeg extracts 3 key frames
2. **Vision Analysis**: Each frame is sent to Ollama's LLaVA model
3. **Tag Generation**: The model describes what it sees, and tags are extracted
4. **Content Moderation**: The model checks for inappropriate content
5. **Cleanup**: Temporary frames are deleted

## Example Output

When you upload a video, you might get tags like:
- `person`, `car`, `street`, `daytime`, `urban`, `walking`
- `landscape`, `mountains`, `sunset`, `nature`, `outdoor`
- `animation`, `cartoon`, `colorful`, `fantasy`

## Performance

- **LLaVA 7B**: ~2-3 seconds per frame on modern CPU
- **With GPU**: Much faster (1 second per frame)
- **Total per video**: ~6-10 seconds for 3 frames

## Troubleshooting

### "Ollama not available"

1. Check Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Check if vision model is installed:
   ```bash
   ollama list
   ```

3. If not, install it:
   ```bash
   ollama pull llava
   ```

### "No vision model installed"

```bash
ollama pull llava
```

### Docker can't reach Ollama on host

Use `host.docker.internal` instead of `localhost`:
```env
OLLAMA_HOST=http://host.docker.internal:11434
```

For Podman on Linux, you may need to add:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### Slow performance

- Use smaller model: `llava` instead of `llava:13b`
- Reduce frames: `FRAMES_TO_ANALYZE=2`
- Consider GPU acceleration if available

## Alternative: Remote Ollama API

You can also run Ollama on a more powerful machine and connect to it:

1. **On the powerful machine:**
   ```bash
   # Install Ollama
   ollama serve --host 0.0.0.0
   ollama pull llava
   ```

2. **On your clip-manager:**
   ```env
   OLLAMA_HOST=http://powerful-machine-ip:11434
   ```

## Model Recommendations

- **llava** (7B): Best balance of speed/quality - **Recommended**
- **llava:13b**: More accurate but slower
- **llava:34b**: Best quality but very slow
- **bakllava**: Alternative with different training

## Disabling AI Analysis

If you don't want to use AI analysis:

```env
ENABLE_CONTENT_MODERATION=false
ENABLE_AUTO_TAGGING=false
```

The app will still work with basic tag extraction from filenames and metadata.

## Privacy Note

When using Ollama:
- ✅ Everything runs locally or on your own server
- ✅ No data sent to external APIs
- ✅ No tracking or logging
- ✅ Complete privacy and control
