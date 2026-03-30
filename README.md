# DocuMind AI

A full-stack AI document assistant with two modes:

1. **PDF Chat (RAG)** — Upload PDF documents and ask questions about their content using natural language
2. **Image/PDF OCR** — Extract text from images or scanned PDFs using AI vision

Powered entirely by local models via Ollama — no API keys required.

## Architecture

- **Backend**: Spring Boot 3.4 + Spring AI 1.0.5 (Java 17, Gradle)
- **Frontend**: React 19 (Vite)
- **Models** (all via Ollama):
  - `llama3.2` — chat/answer generation
  - `nomic-embed-text` — text embeddings (768 dimensions)
  - `qwen2.5vl` — vision model for OCR
- **Vector Database**: PostgreSQL 16 + pgvector extension
- **PDF Parsing**: Spring AI's `PagePdfDocumentReader` + Apache PDFBox

### How PDF Chat Works

1. **Upload** — PDF is parsed page-by-page, then split into ~800-token chunks
2. **Embed** — Each chunk is converted to a 768-dimensional vector using `nomic-embed-text`
3. **Store** — Vectors are stored in PostgreSQL via pgvector with HNSW indexing
4. **Query** — User questions are embedded and matched against stored chunks using cosine similarity
5. **Generate** — Top-5 matching chunks are sent as context to `llama3.2`, which generates an answer

### How Image OCR Works

1. **Upload** — User uploads an image (PNG, JPG, WEBP, GIF) or a scanned PDF
2. **Render** — For PDFs, each page is rendered as a 200 DPI PNG image via PDFBox
3. **Extract** — Each image is sent to `qwen2.5vl` with a structured extraction prompt
4. **Display** — Extracted text is shown on screen with a copy-to-clipboard button

## Prerequisites

- **Java 17+** — verify with `java -version`
- **Node.js 18+** — verify with `node -v`
- **Docker & Docker Compose** — for PostgreSQL + pgvector
- **Ollama** — install via `brew install ollama` (macOS) or see [ollama.ai](https://ollama.ai)

## Setup

### 1. Start PostgreSQL with pgvector

```bash
docker compose up -d
```

This starts a PostgreSQL 16 instance with the pgvector extension on port 5432.

### 2. Install and start Ollama models

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
ollama pull qwen2.5vl
ollama serve   # if not already running
```

Verify Ollama is accessible:

```bash
curl http://localhost:11434/api/tags
```

### 3. Start the Spring Boot backend

```bash
cd backend
./gradlew bootRun
```

> If you don't have the Gradle wrapper, use `gradle bootRun` (requires Gradle installed) or generate it with `gradle wrapper`.

The backend starts at `http://localhost:8080`.

### 4. Start the React frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173` and proxies `/api` calls to the backend.

## Usage

### PDF Chat

1. Open `http://localhost:5173` in your browser
2. Ensure the **PDF Chat** tab is selected in the sidebar
3. Upload a PDF using the upload area (drag-and-drop or click)
4. Wait for processing — text extraction and embedding may take a few seconds depending on PDF size
5. Select the uploaded document from the sidebar
6. Type a question in the chat input and press Enter
7. View the AI-generated answer along with expandable source references

### Image OCR

1. Switch to the **Image OCR** tab in the sidebar
2. Upload an image or scanned PDF (drag-and-drop or click)
3. Wait for the vision model to extract text
4. View the extracted text in the main panel
5. Use the **Copy** button to copy to clipboard, or **New extraction** to process another file

## API Endpoints

| Method | Path              | Description                                          |
| ------ | ----------------- | ---------------------------------------------------- |
| POST   | `/api/pdf/upload` | Upload a PDF file for RAG (multipart/form-data)      |
| GET    | `/api/pdf/list`   | List all uploaded documents                          |
| DELETE | `/api/pdf/{id}`   | Delete a document and its vector store chunks        |
| POST   | `/api/chat`       | Send a question (`{ documentId, question }`)         |
| POST   | `/api/ocr/extract`| Extract text from an image or scanned PDF            |

## Project Structure

```
chat-with-pdf/
├── backend/                        # Spring Boot app
│   ├── build.gradle
│   └── src/main/
│       ├── java/.../
│       │   ├── ChatWithPdfApplication.java
│       │   ├── config/AiConfig.java
│       │   ├── controller/
│       │   │   ├── PdfController.java
│       │   │   ├── ChatController.java
│       │   │   └── OcrController.java
│       │   ├── service/
│       │   │   ├── PdfIngestionService.java
│       │   │   ├── ChatService.java
│       │   │   └── OcrService.java
│       │   ├── model/PdfDocument.java
│       │   └── repository/PdfDocumentRepository.java
│       └── resources/application.yml
├── frontend/                       # React app (Vite)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── api/chatApi.js
│       └── components/
│           ├── PdfUploader.jsx
│           ├── ChatWindow.jsx
│           ├── MessageBubble.jsx
│           ├── ImageUploader.jsx
│           └── TextPreview.jsx
├── docker-compose.yml              # PostgreSQL + pgvector
└── README.md
```

## Key Concepts

- **RAG Pattern** — Retrieve relevant context from vector DB, augment the prompt, generate with LLM
- **Embeddings** — `nomic-embed-text` converts text to 768-dimensional vectors for semantic search
- **Vector Similarity** — pgvector uses cosine similarity with HNSW indexing for fast nearest-neighbor search
- **Chunking** — Text is split into manageable pieces so the LLM receives focused, relevant context
- **Prompt Engineering** — System prompts instruct the LLM to answer only from provided context
- **Vision OCR** — `qwen2.5vl` reads images directly to extract text, preserving structure and formatting
- **PDF Rendering** — Scanned PDFs are rendered page-by-page as images for the vision model to process
