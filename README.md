# 🎵 YouTube to MP3 Downloader

A sleek and modern web application for downloading audio from YouTube videos in high-quality MP3 formats. Built with **React**, **TypeScript**, and **TailwindCSS**, and powered by the **Cobalt public API** for generating direct download streams.

This app features real-time progress tracking, video previews, beautiful UI animations, and seamless file saving via Blob streaming.

---

## 🚀 Features

### 🔍 Smart YouTube Link Detection

- Accepts full YouTube URLs, shortened links, or raw 11-character video IDs.
- Automatic video ID extraction using robust regex patterns.

### 🎬 Video Preview

- Fetches metadata via YouTube’s oEmbed API.
- Shows title, author, and high-resolution thumbnail.
- Clean, minimal video card UI with gradients and overlays.

### 🎧 Multi‑Quality MP3 Downloads

Choose from:

- **128 kbps**
- **192 kbps**
- **320 kbps (BEST)**

Each quality includes:

- Link fetching state
- Live download progress bar
- Final “Saved ✓” confirmation
- Per-quality tracking (download one at a time)

### ⚡ Real-Time Blob Downloading

- Streams MP3 data in chunks.
- Shows accurate percentage progress (if the server provides Content-Length).
- Saves files using a forced browser download via Blob object URLs.

### 🎨 Beautiful UI / UX

- TailwindCSS gradient backgrounds and glass effects.
- Smooth hover / active states.
- Animated skeleton loaders.
- Designed for clarity, speed, and visual polish.

---

## 🛠️ Tech Stack

| Technology             | Purpose                                |
| ---------------------- | -------------------------------------- |
| **React (TypeScript)** | App logic, components, hooks           |
| **TailwindCSS**        | UI styling + effects                   |
| **Cobalt API**         | YouTube → MP3 conversion + stream URLs |
| **YouTube oEmbed API** | Fetch video metadata                   |

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git

cd YOUR-REPO

# Install dependencies
npm install

# Start development server
npm run dev
```
